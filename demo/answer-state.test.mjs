import test from "node:test";
import assert from "node:assert/strict";
import { answerSummary, evidenceTitle } from "./answer-state.js";

test("the overall banner uses the backend answer state even without legacy differences", () => {
  assert.equal(answerSummary({ answerState: "source-difference", sourceDifferences: [], missingInformation: [] }).answerState, "source-difference");
});

test("insufficient conclusions appear in the missing list for new and saved answers", () => {
  const result = { answerState: "insufficient", missingInformation: [], conclusions: [{ status: "insufficient", statement: "The applicable reply has not been established." }] };
  const summary = answerSummary(result);
  assert.equal(summary.answerState, "insufficient");
  assert.match(summary.missingInformation[0], /Needs confirmation/);
  assert.deepEqual(result.missingInformation, []);
  assert.deepEqual(answerSummary({ ...result, ...summary }).missingInformation, summary.missingInformation);
  assert.equal(answerSummary({ conclusions: [{ status: "source-conflict" }] }).answerState, "source-difference");
});

test("RFI citation titles use the selected version rather than an old file-family label", () => {
  const old = { title: "RFI 25 - LU02 Concrete Walls-VOID", rfiNumber: "25.1", revision: "RFI 025.1 - Rev 1", sourceType: "uploaded_project_document" };
  assert.equal(evidenceTitle(old), "RFI 025.1 - Rev 1");
  assert.equal(evidenceTitle({ ...old, filename: "RFI 025.1 - LU02 Concrete Walls Rev1 (Response).pdf" }), "RFI 025.1 - LU02 Concrete Walls Rev1 (Response).pdf");
  assert.equal(evidenceTitle({ ...old, rfiNumber: "25", filename: "RFI 025 - VOID.pdf" }), "RFI 025 - VOID.pdf");
  assert.equal(evidenceTitle({ ...old, sourceType: "rfi_log_entry", title: "RFI 25.1 - register entry" }), "RFI 25.1 - register entry");
});
