import { element, request, passageLink, sourceLink, recordsToCsv } from "./shared.js";

const questionForm = document.querySelector("#question-form");
const questionInput = document.querySelector("#question");
const askButton = document.querySelector("#ask-button");
const requestStatus = document.querySelector("#request-status");
const connectionStatus = document.querySelector("#connection-status");
const errorMessage = document.querySelector("#error-message");
const answerPanel = document.querySelector("#answer-panel");
const answerContent = document.querySelector("#answer-content");
const emptyState = document.querySelector("#empty-state");
const answerMeta = document.querySelector("#answer-meta");
const downloadButton = document.querySelector("#download-records");
const jsonButton = document.querySelector("#download-json");
const stateKey = "info492-demo2-session-v1";
let records = [];
let latest = null;

function saveState() {
  try {
    sessionStorage.setItem(stateKey, JSON.stringify({ question: questionInput.value, records, latest }));
  } catch {
    document.querySelector("#storage-note").textContent = "Browser storage is unavailable. Download records before leaving this page.";
  }
}

function updateRecordCount() {
  document.querySelector("#record-count").textContent = `${records.length} recorded request${records.length === 1 ? "" : "s"}`;
  downloadButton.disabled = records.length === 0;
  jsonButton.disabled = records.length === 0;
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
}

function renderTrace(trace) {
  const panel = document.querySelector("#retrieval-panel");
  panel.hidden = !trace;
  panel.open = false;
  if (!trace) return;
  const retrieval = trace.retrieval;
  const sentIds = trace.modelInputPassageIds || [];
  const citedIds = trace.citedPassageIds || [];
  document.querySelector("#retrieval-summary").textContent = `${retrieval.passages.length} retrieved · ${sentIds.length} sent · ${citedIds.length} cited`;
  const stages = document.querySelector("#retrieval-stages");
  stages.replaceChildren();
  for (const [label, ids] of [["Retrieved", retrieval.passages.map(passage => passage.id)], ["Sent to AI", sentIds], ["Cited", citedIds]]) {
    const stage = element("section", "retrieval-stage");
    stage.append(element("h3", "", `${label} (${ids.length})`));
    const list = element("ul", "");
    for (const id of ids) {
      const passage = retrieval.passages.find(item => item.id === id);
      if (!passage) continue;
      const item = element("li", "");
      item.append(passageLink(passage, id));
      list.append(item);
    }
    stage.append(ids.length ? list : element("p", "", "None"));
    stages.append(stage);
  }
  const container = document.querySelector("#retrieved-passages");
  container.replaceChildren();
  for (const passage of retrieval.passages) {
    const item = element("article", "retrieved-passage");
    const header = element("div", "retrieval-label");
    header.append(element("span", "rank-label", `#${passage.rank}`));
    const cited = trace.citedPassageIds?.includes(passage.id);
    const sent = sentIds.includes(passage.id);
    if (sent) header.append(element("span", "evidence-badge sent", "Sent to AI"));
    if (cited) header.append(element("span", "evidence-badge cited", "Cited"));
    if (!sent && !cited) header.append(element("span", "evidence-badge", "Retrieved only"));
    item.append(header, passageLink(passage, passage.id), element("p", "retrieval-topic", `${passage.publisher} · ${passage.topic}`));
    const details = element("details", "retrieval-excerpt");
    details.append(element("summary", "", "Read passage"), element("p", "", passage.text));
    item.append(details);
    container.append(item);
  }
  if (!retrieval.passages.length) container.append(element("p", "no-citations", "No passage matched. This is a retrieval miss, not proof that the corpus has no answer."));
}

function renderAnswer(result) {
  document.querySelector("#answer-text").textContent = result.answer;
  const differences = result.sourceDifferences || [];
  document.querySelector("#source-differences-panel").hidden = differences.length === 0;
  const differenceContainer = document.querySelector("#source-differences");
  differenceContainer.replaceChildren();
  for (const difference of differences) {
    const card = element("article", "source-difference");
    const heading = element("div", "difference-heading");
    heading.append(element("h4", "", difference.topic), element("span", "difference-status", "Unresolved"));
    card.append(heading);
    for (const claim of difference.claims) {
      const source = result.sources.find(item => item.id === claim.passageId);
      const item = element("div", "difference-claim");
      item.append(passageLink(source, `${source.publisher} · ${source.id}`), element("p", "", claim.statement));
      card.append(item);
    }
    card.append(element("p", "difference-explanation", difference.explanation));
    differenceContainer.append(card);
  }
  const citations = document.querySelector("#citations");
  citations.replaceChildren();
  for (const source of result.sources) {
    const card = element("article", "citation");
    const label = element("div", "citation-label");
    label.append(element("span", "", source.sourceId), element("span", "", source.publisher));
    card.append(label, element("h4", "", source.title));
    card.append(element("p", "source-meta", source.location), passageLink(source, source.id));
    card.append(element("p", "excerpt-label", "Source summary"), element("blockquote", "", source.text));
    const links = element("div", "citation-links");
    links.append(passageLink(source), sourceLink(source));
    card.append(links);
    citations.append(card);
  }
  if (!result.sources.length) citations.append(element("p", "no-citations", "No supporting corpus passage was cited."));
  const missing = document.querySelector("#missing-information");
  missing.replaceChildren(...result.missingInformation.map(text => element("li", "", text)));
  missing.hidden = result.missingInformation.length === 0;
  document.querySelector("#nothing-missing").hidden = result.missingInformation.length > 0;
  answerMeta.textContent = `Pipeline request ${(result.durationMs / 1000).toFixed(1)}s`;
  answerMeta.title = result.model;
  answerMeta.hidden = false;
  emptyState.hidden = true;
  answerContent.hidden = false;
  renderTrace(result.trace);
}

function clearAnswer() {
  errorMessage.hidden = true;
  answerContent.hidden = true;
  answerMeta.hidden = true;
  emptyState.hidden = false;
  document.querySelector("#retrieval-panel").hidden = true;
  latest = null;
  requestStatus.textContent = "";
}

questionInput.addEventListener("input", () => {
  clearAnswer();
  saveState();
});

questionForm.addEventListener("submit", async event => {
  event.preventDefault();
  const question = questionInput.value.trim();
  if (!question) return questionInput.focus();
  clearAnswer();
  answerPanel.setAttribute("aria-busy", "true");
  askButton.disabled = true;
  askButton.textContent = "Searching…";
  questionInput.readOnly = true;
  requestStatus.textContent = "Searching passages…";
  const startedAt = new Date().toISOString();
  const started = performance.now();
  try {
    const result = await request("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    latest = { question, result, startedAt, completedAt: new Date().toISOString(), browserRequestMs: Math.round(performance.now() - started) };
    records.push(latest);
    renderAnswer(result);
    requestStatus.textContent = "Answer ready.";
  } catch (error) {
    const message = error.name === "TimeoutError" ? "The request took too long. This failed attempt was recorded; please try again." : error.message;
    latest = { question, error: message, result: error.data || null, startedAt, completedAt: new Date().toISOString(), browserRequestMs: Math.round(performance.now() - started) };
    records.push(latest);
    showError(message);
    renderTrace(error.data?.trace);
    requestStatus.textContent = "Request failed.";
  } finally {
    updateRecordCount();
    saveState();
    askButton.disabled = false;
    askButton.replaceChildren(document.createTextNode("Ask AI "), element("span", "", "↗"));
    askButton.lastChild.setAttribute("aria-hidden", "true");
    questionInput.readOnly = false;
    answerPanel.setAttribute("aria-busy", "false");
  }
});

function downloadRecords(content, type, extension) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = element("a");
  link.href = url;
  link.download = `info492-demo2-records-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

downloadButton.addEventListener("click", () => {
  downloadRecords(recordsToCsv(records), "text/csv;charset=utf-8", "csv");
});

jsonButton.addEventListener("click", () => {
  const record = { formatVersion: "1.1", pipelineVersion: "demo2-1.1", exportedAt: new Date().toISOString(), timingNote: "Request times exclude reading, evidence review and writing a final participant answer. They are not full-task completion times.", records };
  downloadRecords(JSON.stringify(record, null, 2) + "\n", "application/json", "json");
});

async function load() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(stateKey) || "null");
    if (saved && Array.isArray(saved.records)) {
      records = saved.records;
      questionInput.value = saved.question || "";
      latest = saved.latest;
      if (latest?.error) {
        showError(latest.error);
        renderTrace(latest.result?.trace);
      } else if (latest?.result) {
        renderAnswer(latest.result);
      }
    }
  } catch {
    latest = null;
  }
  updateRecordCount();
  try {
    const [data, status] = await Promise.all([request("/api/documents"), request("/api/status")]);
    document.querySelector("#document-count").textContent = data.sourceCount;
    document.querySelector("#corpus-meta").textContent = `${data.sourceCount} sources · ${data.documents.length} passages`;
    const providerName = { cloudflare: "Cloudflare", gemini: "Gemini", openai: "OpenAI", anthropic: "Claude" }[status.provider] || "AI";
    connectionStatus.textContent = status.ready ? `${providerName} configured` : `${providerName} not configured`;
    connectionStatus.classList.toggle("ready", status.ready);
    if (!status.ready) requestStatus.textContent = "AI access has not been set up yet. You can still browse the source corpus.";
  } catch {
    connectionStatus.textContent = "Service unavailable";
    showError("The AI service is unavailable. Reload the page and try again.");
  }
}

load();
