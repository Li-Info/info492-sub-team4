import test from "node:test";
import assert from "node:assert/strict";
import { testDatabase } from "./storage-fixtures.mjs";
import { maxFileBytes, maxTextBytes } from "./upload-limits.js";
import { readUpload, downloadOriginal } from "./file-storage.mjs";
import { projectApi } from "./project-api.mjs";
import { searchProject, execute, one } from "./project-data.mjs";
import worker from "./worker.mjs";
import { testToken, mockFirebaseKeys } from "./test-fixtures.mjs";
mockFirebaseKeys();

const session = { id: "upload-test", role: "engineer", projectId: "upload-project" };
const metadata = { title: "Synthetic storage test", text: "Synthetic demonstration: approved mix ID QA-LARGE-42 applies to Area A.", area: "Area A", kind: "Synthetic demonstration document" };
const digest = async data => Buffer.from(await crypto.subtle.digest("SHA-256", data)).toString("hex");
function formRequest(file, meta = metadata) { const form = new FormData(); form.set("file", file); form.set("metadata", JSON.stringify(meta)); return new Request("http://127.0.0.1:8793/api/upload", { method: "POST", body: form }); }

test("a full 10 MiB multipart upload preserves every original byte and its checksum", async () => {
  const env = { DB: testDatabase() };
  const bytes = Uint8Array.from({ length: maxFileBytes }, (_, i) => i % 256);
  const body = await readUpload(formRequest(new File([bytes], "synthetic-storage.pdf")));
  const saved = await projectApi("/api/upload", "POST", body, env, session);
  assert.equal(saved.version.hash, await digest(bytes));
  assert.ok((await one(env.DB, "SELECT COUNT(*) AS n FROM originals")).n > 1);
  const downloaded = await downloadOriginal(env, session, saved.version.id, {});
  assert.equal(await digest(await downloaded.arrayBuffer()), saved.version.hash);
  await assert.rejects(projectApi("/api/upload", "POST", body, env, session), { status: 409 });
  await assert.rejects(downloadOriginal(env, { ...session, projectId: "another-project" }, saved.version.id, {}), { status: 404 });
  env.DB.close();
});

test("files over 10 MiB and text over the UTF-8 byte budget are rejected before indexing", async () => {
  await assert.rejects(readUpload(formRequest(new File([new Uint8Array(maxFileBytes + 1)], "too-large.pdf"))), { status: 413 });
  const env = { DB: testDatabase() };
  await assert.rejects(projectApi("/api/upload", "POST", { ...metadata, filename: "too-long.txt", file: new File(["Synthetic data"], "too-long.txt"), text: "\u4e00".repeat(maxTextBytes / 3 + 1) }, env, session), { status: 413 });
  assert.equal((await one(env.DB, "SELECT COUNT(*) AS n FROM versions")).n, 0);
  env.DB.close();
});

test("long extracted text is indexed through the final passage within D1 binding limits", async () => {
  const env = { DB: testDatabase() };
  const tail = "\nSynthetic record: the final approved identifier is TAILTEST742 for Area A.";
  const text = '"'.repeat(maxTextBytes - tail.length) + tail;
  const saved = await projectApi("/api/upload", "POST", { ...metadata, filename: "synthetic-long.txt", text, file: new File([text], "synthetic-long.txt") }, env, session);
  const found = await searchProject(env, session, "TAILTEST742", { versionId: saved.version.id });
  assert.ok(found.some(p => p.text.includes("TAILTEST742")));
  env.DB.close();
});

test("an indexing failure rolls back originals and does not publish a ready file event", async () => {
  const env = { DB: testDatabase() }, originalBatch = env.DB.batch.bind(env.DB);
  env.DB.batch = statements => originalBatch([...statements.slice(0, 2), env.DB.prepare("INSERT INTO missing_test_table VALUES(1)"), ...statements.slice(2)]);
  await assert.rejects(projectApi("/api/upload", "POST", { ...metadata, filename: "synthetic.txt", file: new File([metadata.text], "synthetic.txt") }, env, session));
  for (const table of ["files", "versions", "chunks", "originals", "file_events"]) assert.equal((await one(env.DB, `SELECT COUNT(*) AS n FROM ${table}`)).n, 0);
  env.DB.close();
});

test("downloads still reconstruct files saved with the earlier base64 part format", async () => {
  const env = { DB: testDatabase() }, raw = Buffer.alloc(200003, 137), original = raw.toString("base64");
  const saved = await projectApi("/api/upload", "POST", { ...metadata, filename: "legacy.txt", original }, env, session);
  await execute(env.DB, "DELETE FROM originals WHERE version_id=?", saved.version.id);
  const parts = original.match(/[\s\S]{1,120000}/g);
  for (const [i, part] of parts.entries()) await execute(env.DB, "INSERT INTO originals VALUES(?,?,?)", saved.version.id, i, part);
  assert.equal(await digest(await (await downloadOriginal(env, session, saved.version.id, {})).arrayBuffer()), await digest(raw));
  env.DB.close();
});

test("the HTTP API accepts multipart files and preserves role and download access checks", async () => {
  const env = { DB: testDatabase() };
  await execute(env.DB, "INSERT INTO members(project_id,user_id,role) VALUES(?,?,?)", session.projectId, session.id, "engineer");
  const token = await testToken({ sub: session.id, role: "engineer", projectId: session.projectId });
  const request = formRequest(new File([new Uint8Array(700000)], "synthetic-http.pdf"));
  request.headers.set("Authorization", `Bearer ${token}`); request.headers.set("Origin", "http://127.0.0.1:8793");
  const response = await worker.fetch(request, env);
  assert.equal(response.status, 200);
  const saved = await response.json();
  const downloadRequest = id => new Request("http://127.0.0.1:8793/api/download", { method: "POST", headers: { Authorization: `Bearer ${token}`, Origin: "http://127.0.0.1:8793", "Content-Type": "application/json" }, body: JSON.stringify({ versionId: id }) });
  assert.equal((await (await worker.fetch(downloadRequest(saved.version.id), env)).arrayBuffer()).byteLength, 700000);
  assert.equal((await worker.fetch(downloadRequest("unavailable-version"), env)).status, 404);
  await execute(env.DB, "INSERT INTO members(project_id,user_id,role) VALUES(?,?,?)", session.projectId, "manager-test", "manager");
  const forbidden = formRequest(new File([metadata.text], "synthetic.txt"));
  forbidden.headers.set("Authorization", `Bearer ${await testToken({ sub: "manager-test", role: "manager", projectId: session.projectId })}`); forbidden.headers.set("Origin", "http://127.0.0.1:8793");
  assert.equal((await worker.fetch(forbidden, env)).status, 403);
  env.DB.close();
});
