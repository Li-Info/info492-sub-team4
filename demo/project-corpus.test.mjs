import test from "node:test";
import assert from "node:assert/strict";
import { testDatabase } from "./storage-fixtures.mjs";
import { execute, searchProject, projectContext } from "./project-data.mjs";
import { projectApi, saveAnswer } from "./project-api.mjs";
import { answerQuestion } from "./agent.mjs";
import { processPending } from "./monitor.mjs";

const session = { id: "corpus-owner", role: "engineer", projectId: "isolated-training" };
async function setup() {
  const env = { DB: testDatabase() };
  await execute(env.DB, "INSERT INTO projects VALUES(?,?,?)", session.projectId, "Synthetic training project", new Date().toISOString());
  await execute(env.DB, "INSERT INTO members(project_id,user_id,role) VALUES(?,?,?)", session.projectId, session.id, session.role);
  await execute(env.DB, "INSERT INTO project_corpora VALUES(?,?,?,?,?,?)", session.projectId, "uploads-only", "synthetic-v1", "1", "Synthetic training records only.", "Training subcontractor");
  return env;
}
const upload = (env, text, filename = "training.txt") => projectApi("/api/upload", "POST", { filename, title: "Synthetic training document", kind: "Synthetic demonstration document", text, original: Buffer.from(text).toString("base64") }, env, session);

test("an isolated project never falls back to the legacy public corpus", async () => {
  const env = await setup();
  assert.deepEqual(await searchProject(env, session, "tank capacity"), []);
  const saved = await upload(env, "Synthetic training record. The Area A mix identifier is CCA-TEST-01.");
  const found = await searchProject(env, session, "Area A mix identifier");
  assert.ok(found.length && found.every(p => p.versionId === saved.version.id));
  assert.deepEqual(await searchProject(env, session, "Terracon"), []);
  assert.ok((await searchProject(env, { ...session, projectId: "older-project" }, "tank capacity")).some(p => !p.versionId));
  assert.equal((await projectContext(env, session)).datasetId, "synthetic-v1");
  env.DB.close();
});

test("the answer prompt and run snapshot use the isolated project context", async () => {
  const env = await setup();
  await upload(env, "Synthetic training record. The Area A mix identifier is CCA-TEST-01.");
  let supplied;
  env.AI = { async run(model, input) {
    const context = JSON.parse(input.messages[1].content);
    if (!context.documents) return { response: { tool: "finish", query: "" } };
    supplied = context.documents;
    assert.ok(input.messages[0].content.includes("isolated synthetic training project"));
    assert.ok(!input.messages[0].content.includes("Seattle Aquarium Ocean Pavilion"));
    return { response: { answer: "The synthetic record identifies CCA-TEST-01.", citations: [supplied[0].id], missingInformation: [], sourceDifferences: [] } };
  } };
  const result = await answerQuestion(env, session, "What is the Area A mix identifier?");
  assert.ok(supplied.every(p => p.versionId));
  assert.equal(result.trace.corpus.id, "synthetic-v1");
  assert.equal(result.trace.corpus.sourceMode, "uploads-only");
  env.DB.close();
});

test("background checks also exclude legacy public evidence in an isolated project", async () => {
  const env = await setup();
  const record = await saveAnswer(env, session, "What is the Area A mix identifier?", { answer: "Not established.", sources: [], missingInformation: ["Area A mix record"], sourceDifferences: [] });
  await projectApi("/api/monitor", "POST", { recordId: record.recordId }, env, session);
  await upload(env, "Synthetic training record. The Area A mix identifier is CCA-TEST-02.");
  env.AI = { async run(model, input) {
    const context = JSON.parse(input.messages[1].content);
    assert.ok(context.currentRetrievedEvidence.length && context.currentRetrievedEvidence.every(p => p.versionId));
    return { response: { changeType: "added-evidence", finding: "A synthetic Area A mix record is now supplied.", evidenceIds: [context.newEvidence[0].id] } };
  } };
  await processPending(env);
  const state = await projectApi("/api/monitoring", "GET", {}, env, session);
  assert.equal(state.runs[0].status, "completed");
  assert.equal(state.updates.length, 1);
  env.DB.close();
});
