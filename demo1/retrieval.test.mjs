import test from "node:test";
import assert from "node:assert/strict";
import { retrievePassages } from "./retrieval.mjs";
import { dataset, parseAnswer, createAnswerSchema } from "./rfi.mjs";
import worker from "./worker.mjs";
import { recordsToCsv } from "./shared.js";

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
  const value = { answer: "A reported quantity.", citations: [dataset.documents[1].id], missingInformation: [], sourceDifferences: [] };
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
      return { response: JSON.stringify({ answer: "Test response.", citations: [modelInput.documents[0].id], missingInformation: [], sourceDifferences: [] }) };
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
        return { response: JSON.stringify({ answer: "Test response.", citations: [documents[0].id], missingInformation: [], sourceDifferences: [] }) };
      } },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
  }
});

function differenceResponse(ids) {
  return {
    answer: "The supplied sources report different tank capacities.",
    citations: ids,
    missingInformation: [],
    sourceDifferences: [{
      topic: "Reported tank capacity",
      claims: ids.map((id, index) => ({ passageId: id, statement: index ? "Hycrete reports 360,000 gallons." : "Terracon reports 325,000 gallons." })),
      explanation: "The supplied reports do not establish a common basis for the figures.",
    }],
  };
}

test("source differences preserve distinct source claims separately from missing information", () => {
  const ids = ["TERRACON-MATERIAL-SELECTION", "HYCRETE-TANK-CAPACITY"];
  const selected = dataset.documents.filter(passage => ids.includes(passage.id));
  const value = differenceResponse(ids);
  const result = parseAnswer(JSON.stringify(value), selected);
  assert.deepEqual(result.sourceDifferences, value.sourceDifferences);
  assert.deepEqual(result.missingInformation, []);
  assert.deepEqual(result.sources.map(source => source.id), ids);
});

test("source differences cannot cite an unselected or uncited passage", () => {
  const ids = ["TERRACON-MATERIAL-SELECTION", "HYCRETE-TANK-CAPACITY"];
  const selected = dataset.documents.filter(passage => ids.includes(passage.id));
  const value = differenceResponse(ids);
  value.sourceDifferences[0].claims[1].passageId = "TURNER-TANK-QUANTITIES";
  assert.throws(() => parseAnswer(JSON.stringify(value), selected), /source-difference references/);
  value.sourceDifferences[0].claims[1].passageId = ids[1];
  value.citations = [ids[0]];
  assert.throws(() => parseAnswer(JSON.stringify(value), selected), /source-difference references/);
});

test("source differences require distinct documents and nonduplicate claims", () => {
  const ids = ["TERRACON-MATERIAL-SELECTION", "TERRACON-TESTING"];
  const selected = dataset.documents.filter(passage => ids.includes(passage.id));
  const value = differenceResponse(ids);
  assert.throws(() => parseAnswer(JSON.stringify(value), selected), /source-difference references/);
  value.sourceDifferences[0].claims[1].passageId = ids[0];
  assert.throws(() => parseAnswer(JSON.stringify(value), selected), /source-difference references/);
});

test("invalid difference output retains the actual supplied passages in a failed request", async () => {
  const response = await worker.fetch(questionRequest("tank capacity"), {
    AI: { async run(model, input) {
      const documents = JSON.parse(input.messages[1].content).documents;
      const value = differenceResponse([documents[0].id]);
      return { response: JSON.stringify(value) };
    } },
  });
  const result = await response.json();
  assert.equal(response.status, 502);
  assert.equal(result.trace.status, "failed");
  assert.equal(result.trace.modelInputPassageIds.length, 4);
  assert.deepEqual(result.trace.citedPassageIds, []);
});

test("CSV exports keep retrieved, supplied and cited passages distinct and escape formula text", () => {
  const csv = recordsToCsv([{
    question: "=1+1",
    result: {
      answer: "A reported value.", missingInformation: [], sourceDifferences: [],
      trace: { status: "completed", retrieval: { passages: [{ id: "P1" }, { id: "P2" }] }, modelInputPassageIds: ["P1"], citedPassageIds: ["P1"] },
    },
  }]);
  assert.match(csv, /"Retrieved passages","Sent to AI","Cited passages"/);
  assert.match(csv, /"P1; P2","P1","P1"/);
  assert.ok(csv.includes('"\'=1+1"'));
  assert.match(csv, /"Source differences"/);
});

test("CSV exports preserve source-difference claims and support saved legacy records", () => {
  const value = differenceResponse(["TERRACON-MATERIAL-SELECTION", "HYCRETE-TANK-CAPACITY"]);
  const csv = recordsToCsv([{ question: "tank capacity", result: value }, { question: "legacy question", result: { answer: "Older answer.", sources: [], missingInformation: [] } }]);
  assert.ok(csv.includes("Terracon reports 325,000 gallons."));
  assert.ok(csv.includes("Hycrete reports 360,000 gallons."));
  assert.ok(csv.includes('"legacy question","Older answer."'));
});
