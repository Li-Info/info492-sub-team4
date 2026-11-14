import test from "node:test";
import assert from "node:assert/strict";
import { authenticate, signRecord, accountSession, review, runReceipt, readRecord } from "./access.mjs";
import worker from "./worker.mjs";
import { verifyFirebaseToken } from "./firebase-token.mjs";
import { testToken, testKey, mockFirebaseKeys } from "./test-fixtures.mjs";
mockFirebaseKeys();

const env = { SESSION_SECRET: "test-only-signing-secret-at-least-32-characters" };
const result = { answer: "A reported value.", sources: [{ id: "P1", text: "Evidence." }], missingInformation: [], sourceDifferences: [] };
const authRequest = token => new Request("https://api.example.com/api/session", { headers: { Authorization: `Bearer ${token}` } });

test("Firebase identity and server-assigned claims determine the role", async () => {
  const token = await testToken({ role: "manager" });
  assert.equal((await authenticate(authRequest(token))).role, "manager");
  assert.equal(accountSession({ sub: "A", email: "a@example.test" }).role, "engineer");
  assert.throws(() => accountSession({ sub: "A", role: "__proto__" }), { status: 403 });
  assert.throws(() => accountSession({ sub: "A", role: "admin" }), { status: 403 });
});

test("Firebase verification rejects altered, expired and wrong-project tokens", async () => {
  const token = await testToken();
  const parts = token.split(".");
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  const forged = `${parts[0]}.${Buffer.from(JSON.stringify({ ...payload, role: "manager" })).toString("base64url")}.${parts[2]}`;
  await assert.rejects(verifyFirebaseToken(forged, testKey), { status: 401 });
  for (const claims of [{ exp: 1 }, { aud: "another-project" }, { iss: "https://example.com" }, { auth_time: 9999999999 }, { iat: 9999999999 }, { sub: "" }, { firebase: { sign_in_provider: "anonymous" } }]) {
    await assert.rejects(verifyFirebaseToken(await testToken(claims), testKey), { status: 401 });
  }
  await assert.rejects(authenticate(authRequest(await signRecord({ id: "A", role: "manager" }, env, "session"))), { status: 401 });
});

test("review binds the exact answer and enforces checked citations and role permissions", async () => {
  const session = { id: "A", role: "engineer" };
  const runToken = await runReceipt(result, "Question", session, env);
  const body = { runToken, decision: "checked", checkedPassageIds: ["P1"], note: "Confirmed the reported value." };
  const accepted = await review(body, session, env);
  assert.equal((await readRecord(accepted.receipt, env, "review")).answerDigest, accepted.answerDigest);
  await assert.rejects(review({ ...body, checkedPassageIds: [] }, session, env), { status: 400 });
  await assert.rejects(review({ ...body, checkedPassageIds: ["P2"] }, session, env), { status: 400 });
  await assert.rejects(review({ ...body, decision: "ready-for-rfi" }, session, env), { status: 403 });
  await assert.rejects(review(body, { id: "B", role: "engineer" }, env), { status: 403 });
  await assert.rejects(review({ ...body, decision: "needs-information", note: "" }, session, env), { status: 400 });
  assert.equal((await review({ ...body, decision: "needs-information", checkedPassageIds: [], note: "Need an approved detail." }, session, env)).decision, "needs-information");
  const changed = await runReceipt({ ...result, answer: "Changed value." }, "Question", session, env);
  assert.notEqual((await readRecord(changed, env, "run")).digest, accepted.answerDigest);
});

test("Internal project review actions stay within their roles", async () => {
  for (const [role, decision] of [["manager", "ready-for-rfi"], ["foreman", "flag-review"]]) {
    const session = { id: role, role };
    const body = { runToken: await runReceipt(result, "Question", session, env), decision, checkedPassageIds: ["P1"], note: "Reviewed." };
    assert.equal((await review(body, session, env)).decision, decision);
    await assert.rejects(review({ ...body, decision: role === "manager" ? "flag-review" : "ready-for-rfi" }, session, env), { status: 403 });
  }
});

test("the API rejects unauthenticated inference and supports authorization preflight", async () => {
  let called = false;
  const request = new Request("https://api.example.com/api/ask", { method: "POST", headers: { Origin: "https://info492-sub-team-4.web.app", "Content-Type": "application/json" }, body: JSON.stringify({ question: "tank capacity" }) });
  const response = await worker.fetch(request, { ...env, AI: { run() { called = true; } } });
  assert.equal(response.status, 401);
  assert.equal(called, false);
  const preflight = await worker.fetch(new Request("https://api.example.com/api/review", { method: "OPTIONS", headers: { Origin: "https://info492-sub-team-4.web.app" } }), env);
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get("Access-Control-Allow-Headers"), /Authorization/);
});
