import test from "node:test";
import assert from "node:assert/strict";
import { testDatabase } from "./storage-fixtures.mjs";
import { projectApi, saveAnswer } from "./project-api.mjs";
import { authorizeProject, execute, rows, one, searchProject, enqueueEvents } from "./project-data.mjs";
import { processPending, scheduleChecks } from "./monitor.mjs";

const engineer = { id: "engineer", role: "engineer", projectId: "test-project", assignedProject: true };
const manager = { id: "manager", role: "manager", projectId: "test-project", assignedProject: true };
async function setup() {
  const env = { DB: testDatabase() };
  await execute(env.DB, "INSERT INTO projects VALUES(?,?,?)", "test-project", "Test project", new Date().toISOString());
  for (const s of [engineer, manager]) await execute(env.DB, "INSERT INTO members(project_id,user_id,role) VALUES(?,?,?)", s.projectId, s.id, s.role);
  return env;
}
const upload = (text, extra = {}) => ({ filename: "synthetic-area-A.txt", title: "Synthetic Area A approval", text, original: Buffer.from(text).toString("base64"), revision: "Rev A", area: "Area A", kind: "Synthetic demonstration document", approval: "Approved as labelled in file", ...extra });
const call = (env, path, body, session = engineer, method = "POST") => projectApi(`/api/${path}`, method, body, env, session);
async function baseline(env) {
  return saveAnswer(env, engineer, "What is the approved mix ID for Area A?", { answer: "No approval evidence was found.", sources: [], missingInformation: ["Area A approval document"], sourceDifferences: [] });
}
test("project membership, upload permissions and record sharing are enforced", async () => {
  const env = await setup();
  await authorizeProject(env, engineer);
  await assert.rejects(authorizeProject(env, { ...engineer, role: "manager" }), { status: 403 });
  await assert.rejects(call(env, "upload", upload("Synthetic approved mix ID MC-A01 for Area A."), manager), { status: 403 });
  const saved = await baseline(env);
  assert.equal((await call(env, "history", {}, manager, "GET")).records.length, 0);
  await assert.rejects(call(env, "review", { recordId: saved.recordId, decision: "ready-for-rfi", checkedPassageIds: [] }, manager), { status: 404 });
  await assert.rejects(call(env, "review", { recordId: saved.recordId, decision: "", checkedPassageIds: [] }), { status: 403 });
  await call(env, "review", { recordId: saved.recordId, decision: "needs-information", checkedPassageIds: [], note: "Need the approval document.", share: true });
  assert.equal((await call(env, "history", {}, manager, "GET")).records.length, 1);
  await call(env, "review", { recordId: saved.recordId, decision: "request-evidence", checkedPassageIds: [], note: "Please obtain the applicable approval." }, manager);
  const history = await call(env, "history", {}, engineer, "GET");
  assert.equal(history.records[0].reviews.length, 2);
  assert.equal(history.records[0].result.answer, "No approval evidence was found.");
  assert.equal((await call(env, "history", {}, { ...engineer, projectId: "other" }, "GET")).records.length, 0);
  env.DB.close();
});
test("uploads preserve originals, duplicate choices, historical versions and explicit current selection", async () => {
  const env = await setup(), first = upload("Synthetic Area A approval. Approved mix ID MC-A01. Applies only to Area A.");
  const a = await call(env, "upload", first);
  assert.equal(a.version.number, 1);
  assert.equal(a.version.current_version, a.version.id);
  assert.equal((await call(env, "original", { versionId: a.version.id })).original, first.original);
  await assert.rejects(call(env, "upload", first), { status: 409 });
  const b = await call(env, "upload", upload("Synthetic Area A approval revised. Approved mix ID MC-A02. Applies only to Area A.", { fileId: a.version.file_id, revision: "Rev B" }));
  assert.equal(b.version.number, 2);
  assert.equal(b.version.current_version, a.version.id);
  let search = await searchProject(env, engineer, "approved mix Area A");
  assert.ok(search.some(p => p.text.includes("MC-A01")));
  assert.ok(!search.some(p => p.text.includes("MC-A02")));
  await call(env, "current-version", { versionId: b.version.id, confirm: true });
  search = await searchProject(env, engineer, "approved mix Area A");
  assert.ok(search.some(p => p.text.includes("MC-A02")));
  assert.ok(!search.some(p => p.text.includes("MC-A01")));
  assert.ok((await searchProject(env, engineer, "approved mix", { versionId: a.version.id })).some(p => p.text.includes("MC-A01")));
  await assert.rejects(call(env, "version", { versionId: a.version.id }, { ...engineer, projectId: "other" }), { status: 404 });
  const c = await call(env, "upload", { ...first, fileId: a.version.file_id, keepDuplicate: true });
  assert.equal(c.version.number, 3);
  assert.equal((await call(env, "files", {}, engineer, "GET")).files.length, 3);
  env.DB.close();
});
test("monitoring queues file events, deduplicates alerts, preserves reviews and stops after pause", async () => {
  const env = await setup(), saved = await baseline(env);
  await call(env, "monitor", { recordId: saved.recordId });
  env.AI = { async run(model, input) {
    const content = JSON.parse(input.messages[1].content);
    return { response: content.newVersion.area === "Area B" ? { changeType: "no-change", finding: "Area B does not apply to this item.", evidenceIds: [] } : { changeType: "added-evidence", finding: "Synthetic Area A approval provides MC-A01; applicability needs human review.", evidenceIds: [content.newEvidence[0].id] } };
  } };
  await call(env, "upload", upload("Synthetic Area B work note. Mix ID MC-B01 applies only to Area B.", { filename: "area-b.txt", area: "Area B" }));
  await processPending(env);
  assert.equal((await rows(env.DB, "SELECT * FROM updates")).length, 0);
  await call(env, "upload", upload("Synthetic Area A approval. Approved mix ID MC-A01 applies to Area A."));
  await enqueueEvents(env, engineer.projectId); await processPending(env); await enqueueEvents(env, engineer.projectId); await processPending(env);
  let data = await call(env, "monitoring", {}, engineer, "GET");
  assert.equal(data.updates.length, 1);
  await call(env, "update-review", { updateId: data.updates[0].id, decision: "affects-item", note: "Checked synthetic Area A scope." });
  data = await call(env, "monitoring", {}, engineer, "GET");
  assert.equal(data.updates[0].reviews.length, 1);
  assert.equal((await call(env, "history", {}, engineer, "GET")).records[0].result.answer, "No approval evidence was found.");
  await call(env, "monitor", { recordId: saved.recordId, state: "paused" });
  await call(env, "upload", upload("Synthetic Area A approval. Approved mix ID MC-A03 applies to Area A.", { filename: "area-a-3.txt" }));
  await processPending(env);
  assert.equal((await rows(env.DB, "SELECT * FROM updates")).length, 1);
  env.DB.close();
});
test("failed monitoring keeps its cursor, retries twice, and pauses when access is revoked", async () => {
  const env = await setup(), saved = await baseline(env);
  await call(env, "monitor", { recordId: saved.recordId });
  await call(env, "upload", upload("Synthetic Area A approval. Mix MC-A01 applies only to Area A."));
  env.AI = { async run() { throw new Error("Synthetic service outage"); } };
  for (let attempt = 0; attempt < 3; attempt++) { await execute(env.DB, "UPDATE runs SET available_at='2000-01-01' WHERE status='queued'"); await processPending(env); }
  const run = await one(env.DB, "SELECT * FROM runs");
  assert.equal(run.status, "failed"); assert.equal(run.attempts, 3);
  assert.equal(JSON.parse(run.activity).filter(a => a.tool === "attempt-failed").length, 3);
  assert.equal((await one(env.DB, "SELECT cursor FROM monitors")).cursor, 0);
  await call(env, "retry", { runId: run.id });
  await execute(env.DB, "UPDATE members SET active=0 WHERE user_id=?", engineer.id);
  await processPending(env);
  assert.equal((await one(env.DB, "SELECT state FROM monitors")).state, "paused");
  env.DB.close();
});

test("scheduled no-change checks are persisted once per tick without AI calls or alerts", async () => {
  const env = await setup(), saved = await baseline(env);
  await call(env, "monitor", { recordId: saved.recordId });
  env.AI = { run() { throw new Error("No AI call should be needed without new files"); } };
  await scheduleChecks(env); await scheduleChecks(env);
  const runs = await rows(env.DB, "SELECT * FROM runs");
  assert.equal(runs.length, 1); assert.equal(runs[0].status, "completed"); assert.equal(runs[0].trigger, "scheduled");
  assert.equal((await rows(env.DB, "SELECT * FROM updates")).length, 0);
  assert.ok((await one(env.DB, "SELECT checked_at FROM monitors")).checked_at);
  env.DB.close();
});
