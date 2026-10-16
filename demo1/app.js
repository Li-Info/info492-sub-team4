const apiBase = "";
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
const questionSelect = document.querySelector("#test-question");
let testQuestions = [];

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, { ...options, signal: AbortSignal.timeout(65000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "The request could not be completed.");
  return data;
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
}

function renderDocuments(documents) {
  const sources = new Map();
  for (const passage of documents) {
    if (!sources.has(passage.sourceId)) sources.set(passage.sourceId, []);
    sources.get(passage.sourceId).push(passage);
  }
  document.querySelector("#document-count").textContent = sources.size;
  const container = document.querySelector("#documents");
  container.replaceChildren();
  for (const passages of sources.values()) {
    const source = passages[0];
    const details = element("details", "document");
    const summary = element("summary");
    const title = element("span");
    title.append(
      element("span", "document-title", source.publisher),
      element("span", "document-meta", source.sourceId),
    );
    const icon = element("span", "document-icon", "TXT");
    icon.setAttribute("aria-hidden", "true");
    summary.append(icon, title);
    const contents = element("div", "document-contents");
    contents.append(element("h3", "source-title", source.title));
    const publication = source.publishedOn ? ` · Published ${source.publishedOn}` : " · Date not listed";
    contents.append(element("p", "source-meta", source.evidenceClass + publication));
    contents.append(element("p", "source-meta", source.location));
    for (const passage of passages) {
      const chunk = element("section", "source-passage");
      chunk.append(element("h4", "passage-topic", passage.topic), element("p", "passage-id", passage.id), element("p", "passage-text", passage.text));
      contents.append(chunk);
    }
    contents.append(element("p", "source-limits", source.limits), sourceLink(source));
    details.append(summary, contents);
    container.append(details);
  }
}

function sourceLink(source) {
  const link = element("a", "source-link", "Original public source");
  link.href = source.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}

function renderQuestions(questions) {
  testQuestions = questions;
  questionSelect.replaceChildren(new Option("Choose a test question", ""));
  for (const question of questions) questionSelect.append(new Option(`${question.id} — ${question.question}`, question.id));
  questionSelect.disabled = false;
}

function renderAnswer(result) {
  document.querySelector("#answer-text").textContent = result.answer;
  const citations = document.querySelector("#citations");
  citations.replaceChildren();
  for (const source of result.sources) {
    const card = element("article", "citation");
    const label = element("div", "citation-label");
    label.append(element("span", "", source.sourceId), element("span", "", source.publisher));
    card.append(label, element("h4", "", source.title));
    card.append(element("p", "source-meta", source.location), element("p", "passage-id", source.id));
    card.append(element("p", "excerpt-label", "Paraphrased corpus passage"), element("blockquote", "", source.text));
    card.append(element("p", "source-limits", source.limits), sourceLink(source));
    citations.append(card);
  }
  if (!result.sources.length) citations.append(element("p", "no-citations", "No supporting corpus passage was cited."));
  const missing = document.querySelector("#missing-information");
  missing.replaceChildren(...result.missingInformation.map(text => element("li", "", text)));
  missing.hidden = result.missingInformation.length === 0;
  document.querySelector("#nothing-missing").hidden = result.missingInformation.length > 0;
  answerMeta.textContent = `${result.model} · AI request ${(result.durationMs / 1000).toFixed(1)}s`;
  answerMeta.hidden = false;
  emptyState.hidden = true;
  answerContent.hidden = false;
}

function clearAnswer() {
  errorMessage.hidden = true;
  answerContent.hidden = true;
  answerMeta.hidden = true;
  emptyState.hidden = false;
  requestStatus.textContent = "Click Ask AI to search the documents for this question.";
}

questionInput.addEventListener("input", () => {
  questionSelect.value = "";
  clearAnswer();
});

questionSelect.addEventListener("change", () => {
  const selected = testQuestions.find(question => question.id === questionSelect.value);
  if (!selected) return;
  questionInput.value = selected.question;
  clearAnswer();
  questionInput.focus();
});

questionForm.addEventListener("submit", async event => {
  event.preventDefault();
  const question = questionInput.value.trim();
  if (!question) {
    questionInput.focus();
    return;
  }
  errorMessage.hidden = true;
  answerContent.hidden = true;
  answerMeta.hidden = true;
  emptyState.hidden = false;
  answerPanel.setAttribute("aria-busy", "true");
  askButton.disabled = true;
  questionSelect.disabled = true;
  askButton.textContent = "Searching…";
  questionInput.readOnly = true;
  requestStatus.textContent = "Checking the supplied corpus with AI…";
  try {
    const result = await request("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    renderAnswer(result);
    requestStatus.textContent = result.sources.length
      ? "Review the evidence before using the answer."
      : result.missingInformation.length
        ? "No passage was cited. Check the reported gap against the supplied corpus."
        : "No supporting source was returned. Treat this answer as unverified.";
  } catch (error) {
    const message = error.name === "TimeoutError"
      ? "The AI request took too long. Please try again."
      : error.message;
    showError(message);
    requestStatus.textContent = "No AI answer was generated.";
  } finally {
    askButton.disabled = false;
    questionSelect.disabled = false;
    askButton.replaceChildren(document.createTextNode("Ask AI "), element("span", "", "↗"));
    askButton.lastChild.setAttribute("aria-hidden", "true");
    questionInput.readOnly = false;
    answerPanel.setAttribute("aria-busy", "false");
  }
});

async function load() {
  try {
    const [data, status, questions] = await Promise.all([request("/api/documents"), request("/api/status"), request("/api/questions")]);
    renderDocuments(data.documents);
    renderQuestions(questions.questions);
    document.querySelector("#corpus-meta").textContent = `Corpus v${data.version} · ${data.sourceCount} sources · ${data.documents.length} passages`;
    const providerName = { cloudflare: "Cloudflare", gemini: "Gemini", openai: "OpenAI", anthropic: "Claude" }[status.provider] || "AI";
    connectionStatus.textContent = status.ready ? `${providerName} configured` : `${providerName} not configured`;
    connectionStatus.classList.toggle("ready", status.ready);
    if (!status.ready) requestStatus.textContent = "AI access has not been set up yet. You can still browse the documents.";
  } catch {
    connectionStatus.textContent = "Service unavailable";
    showError("The AI service is unavailable. Reload the page and try again.");
  }
}

load();
