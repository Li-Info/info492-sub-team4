import test from "node:test";
import assert from "node:assert/strict";
import { retrievePassages } from "./retrieval.mjs";
import { dataset, parseAnswer, createAnswerSchema } from "./rfi.mjs";
import worker from "./worker.mjs";

test("retrieval is deterministic, bounded and does not mutate the corpus", () => {
  const before = JSON.stringify(dataset);
  const first = retrievePassages("tank capacity", dataset.documents);
  const second = retrievePassages("tank capacity", dataset.documents);
  assert.deepEqual(first.passages, second.passages);
  assert.equal(first.passages.length, 4);
  assert.equal(JSON.stringify(dataset), before);
  assert.ok(first.passages.some(passage => passage.id === "TERRACON-MATERIAL-SELECTION"));
  assert.ok(first.passages.some(passage => passage.id === "HYCRETE-TANK-CAPACITY"));
});

test("unmatched terms do not fall back to passing the entire corpus", () => {
  assert.equal(retrievePassages("zxqvzz", dataset.documents).passages.length, 0);
  assert.equal(retrievePassages("the and what", dataset.documents).passages.length, 0);
});

test("citation validation rejects a real corpus ID outside retrieved context", () => {
  const selected = dataset.documents.slice(0, 1);
  const value = { answer: "A reported quantity.", citations: [dataset.documents[1].id], missingInformation: [] };
  assert.throws(() => parseAnswer(JSON.stringify(value), selected), /outside the retrieved evidence/);
  assert.deepEqual(createAnswerSchema(selected).properties.citations.items.enum, [selected[0].id]);
});

function questionRequest(question, origin = "http://127.0.0.1:8792") {
  return new Request("http://127.0.0.1:8792/api/ask", { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify({ question }) });
}

test("worker sends only retrieved passages and returns the actual selection", async () => {
  let modelInput;
  const response = await worker.fetch(questionRequest("tank capacity"), {
    AI: { async run(model, input) {
      modelInput = JSON.parse(input.messages[1].content);
      return { response: JSON.stringify({ answer: "Test response.", citations: [modelInput.documents[0].id], missingInformation: [] }) };
    } },
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(modelInput.documents.length, 4);
  assert.deepEqual(modelInput.documents.map(passage => passage.id), result.trace.modelInputPassageIds);
  assert.deepEqual(result.trace.retrieval.passages, modelInput.documents);
  assert.deepEqual(result.trace.citedPassageIds, [modelInput.documents[0].id]);
  assert.equal(result.trace.status, "completed");
  assert.ok(!JSON.stringify(modelInput).includes("reference_answer"));
});

test("a retrieval miss is retained and never calls AI", async () => {
  let called = false;
  const response = await worker.fetch(questionRequest("zxqvzz"), { AI: { async run() { called = true; } } });
  const result = await response.json();
  assert.equal(response.status, 422);
  assert.equal(called, false);
  assert.equal(result.trace.retrieval.passages.length, 0);
  assert.equal(result.trace.status, "failed");
  assert.equal(result.trace.modelInputPassageIds, undefined);
});

test("a model failure preserves the retrieval trace", async () => {
  const response = await worker.fetch(questionRequest("tank capacity"), { AI: { async run() { throw new Error("Unavailable"); } } });
  const result = await response.json();
  assert.equal(response.status, 503);
  assert.equal(result.trace.retrieval.passages.length, 4);
  assert.equal(result.trace.status, "failed");
  assert.equal(result.trace.modelInputPassageIds.length, 4);
});

test("local preview does not allow another site's origin", async () => {
  const response = await worker.fetch(questionRequest("tank capacity", "https://example.com"), {});
  assert.equal(response.status, 403);
  const remote = new Request("https://api.example.com/api/ask", { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://127.0.0.1:8792" }, body: JSON.stringify({ question: "tank capacity" }) });
  assert.equal((await worker.fetch(remote, {})).status, 403);
});

test("the main team website can use the demo API", async () => {
  for (const origin of ["https://info492-sub-team-4.web.app", "https://info492-sub-team-4.firebaseapp.com"]) {
    const request = new Request("https://api.example.com/api/ask", { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify({ question: "tank capacity" }) });
    const response = await worker.fetch(request, {
      AI: { async run(model, input) {
        const documents = JSON.parse(input.messages[1].content).documents;
        return { response: JSON.stringify({ answer: "Test response.", citations: [documents[0].id], missingInformation: [] }) };
      } },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
  }
});
