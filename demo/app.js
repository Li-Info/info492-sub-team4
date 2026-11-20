import { demoAccounts } from "./demo-accounts.js";
import { configureProjectUI, renderReviewHistory, renderPending, refreshMonitoring } from "./project-ui.js";
import { startTour } from "./tour.js";
import { getAuthToken, signIn, signOutAccount, authError } from "./firebase-client.js";
import { element, request, passageLink, sourceLink, recordsToCsv, setTokenProvider, selectedProject, selectProject } from "./shared.js";
import { renderConclusions, renderRelated, logLink } from "./rfi-ui.js";
import { answerSummary, evidenceTitle } from "./answer-state.js";

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
const historyToggle = document.querySelector("#toggle-records");
let stateKey;
let currentUser;
let records = [];
let historyExpanded = false;
let latest = null;
let availableProjects = [];
const publicExample = "According to Terracon's case report, what material and strength were reported for the tank walls?";
let exampleQuestion = publicExample;
setTokenProvider(getAuthToken);

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
  if (records.length <= 4) historyExpanded = false;
  historyToggle.hidden = records.length <= 4;
  historyToggle.textContent = historyExpanded ? "Show less" : `Show all (${records.length})`;
  historyToggle.setAttribute("aria-expanded", String(historyExpanded));
  const list = document.querySelector("#record-list");
  list.replaceChildren();
  for (const record of records.slice(historyExpanded ? 0 : -4).reverse()) {
    const button = element("button", "record-item", record.question);
    button.append(element("span", "", record.error ? "Request failed" : decisionLabels[record.review?.decision] || "Awaiting your review"));
    button.addEventListener("click", () => {
      latest = record;
      questionInput.value = latest.question;
      errorMessage.hidden = true;
      if (latest.error) { document.querySelector("#review-content").hidden = true; document.querySelector("#review-empty").hidden = false; answerContent.hidden = true; emptyState.hidden = false; showError(latest.error); renderTrace(latest.result?.trace); }
      else renderAnswer(latest.result);
      saveState();
      answerPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    list.append(button);
  }
}

historyToggle.addEventListener("click", () => {
  historyExpanded = !historyExpanded;
  updateRecordCount();
});

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
}

function renderTrace(trace, checks) {
  const panel = document.querySelector("#retrieval-panel");
  panel.hidden = !trace;
  panel.open = false;
  if (!trace) return;
  const retrieval = trace.retrieval;
  const activity = element("div", "run-activity");
  for (const tool of trace.activity || []) activity.append(element("p", "", `${tool.tool}: ${tool.query || (tool.passageIds || []).join(", ") || "Version metadata checked"}`));
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
  stages.append(activity);
  if (checks) { const checked = element("section", "run-checks"); checked.append(element("h3", "", "Checks performed")); for (const value of Object.values(checks)) checked.append(element("p", "", value)); stages.append(checked); }
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
  const summary = answerSummary(result);
  document.querySelector("#answer-text").textContent = result.answer;
  document.querySelector("#answer-text").hidden = Boolean(result.conclusions?.length);
  renderConclusions(document.querySelector("#answer-conclusions"), result.conclusions, result.sources, note => {
    const choices = currentUser.decisions;
    document.querySelector("#review-decision").value = choices.includes("clarification-needed") ? "clarification-needed" : choices.includes("flag-review") ? "flag-review" : "request-evidence";
    document.querySelector("#review-note").value = note.slice(0,1000);
    document.querySelector("#review-panel").scrollIntoView({behavior:"smooth",block:"center"});
    document.querySelector("#review-note").focus();
  });
  renderRelated(document.querySelector("#related-rfis"), result.relatedRfis || []);
  document.querySelector("#related-rfis-panel").hidden = !result.relatedRfis?.length;
  const differences = result.sourceDifferences || [];
  const state = document.querySelector("#answer-state");
  state.className = "answer-state " + ({ "source-difference": "danger", insufficient: "warning", "reported-evidence": "evidence" }[summary.answerState]);
  state.textContent = { "source-difference": "Source difference — human review needed", insufficient: "Information missing", "reported-evidence": "Evidence found — check the cited passages" }[summary.answerState];
  document.querySelector("#evidence-details").open = currentUser.role !== "foreman";
  const keyEvidence = document.querySelector("#key-evidence"); keyEvidence.replaceChildren(); keyEvidence.hidden = currentUser.role !== "foreman";
  for (const source of result.sources.slice(0, 2)) keyEvidence.append(passageLink(source, `${source.publisher} · ${evidenceTitle(source)}`));
  document.querySelector("#source-differences-panel").hidden = differences.length === 0 || Boolean(result.conclusions?.length);
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
    card.append(label, element("h4", "", evidenceTitle(source)));
    card.append(element("p", "source-meta", source.location), passageLink(source, source.id));
    const preview = source.excerpt || source.text.slice(0,280) + (source.text.length > 280 ? "…" : "");
    card.append(element("p", "excerpt-label", source.excerpt ? "Quoted evidence" : "Passage preview"), element("blockquote", "", preview));
    const full = element("details", "full-passage"); full.append(element("summary", "", "Read full passage"), element("blockquote", "", source.text)); card.append(full);
    const links = element("div", "citation-links");
    links.append(passageLink(source), sourceLink(source));
    if (source.rfiNumber) links.append(logLink(source.rfiNumber));
    if (source.rfiDisposition === "void") card.append(element("p", "answer-state warning", `VOID record${source.replacedBy ? ` · replaced by RFI ${source.replacedBy}` : ""}`));
    card.append(links);
    const checkLabel = element("label", "passage-check");
    const check = document.createElement("input");
    check.type = "checkbox";
    check.value = source.id;
    check.checked = Boolean(latest?.checkedPassageIds?.includes(source.id));
    check.addEventListener("change", () => {
      latest.checkedPassageIds = [...document.querySelectorAll("#citations .passage-check input:checked")].map(input => input.value);
      saveState();
    });
    checkLabel.append(check, document.createTextNode("I checked this passage against the answer"));
    card.append(checkLabel);
    citations.append(card);
  }
  if (!result.sources.length) citations.append(element("p", "no-citations", "No supporting corpus passage was cited."));
  const missing = document.querySelector("#missing-information");
  missing.replaceChildren(...summary.missingInformation.map(text => element("li", "", text)));
  missing.hidden = summary.missingInformation.length === 0;
  document.querySelector("#nothing-missing").hidden = summary.missingInformation.length > 0;
  answerMeta.textContent = `Pipeline request ${(result.durationMs / 1000).toFixed(1)}s`;
  answerMeta.title = result.model;
  answerMeta.hidden = false;
  emptyState.hidden = true;
  answerContent.hidden = false;
  document.querySelector("#review-empty").hidden = true;
  document.querySelector("#review-content").hidden = false;
  renderTrace(result.trace, result.checks);
  document.querySelector("#gap-check-label").hidden = result.sources.length > 0;
  document.querySelector("#gap-check").checked = Boolean(latest?.gapChecked);
  const decisions = document.querySelector("#review-decision");
  const prompt = element("option", "", "Select a review decision"); prompt.value = "";
  decisions.replaceChildren(prompt, ...currentUser.decisions.map(value => { const option = element("option", "", decisionLabels[value]); option.value = value; return option; }));
  decisions.value = "";
  document.querySelector("#review-note").value = "";
  renderReviewHistory(latest);
  document.querySelector("#review-message").textContent = latest?.review ? `Saved: ${decisionLabels[latest.review.decision]}` : "Awaiting your review.";
}

function clearAnswer() {
  errorMessage.hidden = true;
  answerContent.hidden = true;
  answerMeta.hidden = true;
  emptyState.hidden = false;
  document.querySelector("#retrieval-panel").hidden = true;
  latest = null;
  document.querySelector("#review-content").hidden = true;
  document.querySelector("#review-empty").hidden = false;
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
  document.querySelector("#sign-out").disabled = true;
  document.querySelector("#project-select").disabled = true;
  askButton.textContent = "Searching…";
  questionInput.readOnly = true;
  requestStatus.textContent = "Searching passages…";
  const startedAt = new Date().toISOString();
  const started = performance.now();
  try {
    const result = await request("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, versionId: new URL(location.href).searchParams.get("version") || undefined }),
    });
    latest = { ownerId: currentUser.id, shared: false, role: currentUser.role, question, result, startedAt, completedAt: new Date().toISOString(), browserRequestMs: Math.round(performance.now() - started) };
    records.push(latest);
    renderAnswer(result);
    requestStatus.textContent = "Answer ready.";
  } catch (error) {
    const message = error.name === "TimeoutError" ? "The request took too long. This failed attempt was recorded; please try again." : error.message;
    latest = { role: currentUser.role, question, error: message, result: error.data || null, startedAt, completedAt: new Date().toISOString(), browserRequestMs: Math.round(performance.now() - started) };
    records.push(latest);
    showError(message);
    renderTrace(error.data?.trace);
    requestStatus.textContent = "Request failed.";
  } finally {
    updateRecordCount();
    saveState();
    askButton.disabled = false;
    document.querySelector("#sign-out").disabled = false;
    document.querySelector("#project-select").disabled = false;
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
  link.download = `info492-demo4-records-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

downloadButton.addEventListener("click", () => {
  downloadRecords(recordsToCsv(records), "text/csv;charset=utf-8", "csv");
});

jsonButton.addEventListener("click", () => {
  const record = { formatVersion: "1.3", interfaceVersion: "demo4", pipelineVersion: "demo4-1.0", projectId: currentUser.projectId, exportedAt: new Date().toISOString(), timingNote: "Request times exclude reading, evidence review and writing a final participant answer. They are not full-task completion times.", records };
  downloadRecords(JSON.stringify(record, null, 2) + "\n", "application/json", "json");
});

async function load() {
  try {
    const draft = JSON.parse(sessionStorage.getItem(stateKey) || "null");
    if (draft) questionInput.value = draft.question || "";
    await loadHistory(draft?.latest?.result?.recordId);
  } catch (error) { showError(error.message); }
  updateRecordCount(); renderPending(records);
  try {
    const isolated = currentUser.sourceMode === "uploads-only";
    const [data, status] = await Promise.all([request(isolated ? "/api/files" : "/api/documents"), request("/api/status")]);
    const sourceCount = isolated ? data.files.filter(file => file.current_version === file.version_id && file.state === "ready").length : data.sourceCount;
    document.querySelector("#document-count").textContent = sourceCount;
    document.querySelector("#corpus-meta").textContent = isolated ? `${sourceCount} searchable files · ${currentUser.datasetId?.startsWith("demo4-") ? "Project RFI records" : "Synthetic training records"}` : `${data.sourceCount} sources · ${data.documents.length} passages`;
    const providerName = { cloudflare: "Cloudflare", gemini: "Gemini", openai: "OpenAI", anthropic: "Claude" }[status.provider] || "AI";
    connectionStatus.textContent = status.ready ? `${providerName} configured` : `${providerName} not configured`;
    connectionStatus.classList.toggle("ready", status.ready);
    if (!status.ready) requestStatus.textContent = "AI access has not been set up yet. You can still browse the project documents.";
  } catch {
    connectionStatus.textContent = "Service unavailable";
    showError("The AI service is unavailable. Reload the page and try again.");
  }
}

const decisionLabels = { "flag-review": "Flag for project team review", "clarification-needed": "Clarification needed", "request-evidence": "Request more evidence", "ready-for-rfi": "Confirm ready for RFI preparation", checked: "Evidence checked", "needs-information": "Needs more information", "ready-for-coordination": "Ready for GC coordination", "technical-review-complete": "Technical review complete" };

function showEntry(panel) {
  for (const id of ["login-panel", "dashboard"]) document.querySelector(`#${id}`).hidden = id !== panel;
}

async function enterWorkspace(user) {
  if (currentUser && currentUser.projectId !== user.projectId) { saveState(); records=[];latest=null;historyExpanded=false;questionInput.value="";clearAnswer(); }
  currentUser = user;
  document.body.dataset.role = user.role;
  configureProjectUI(user, () => latest, openSavedRecord);
  const isolated = user.sourceMode === "uploads-only";
  document.querySelector("#organization-name").textContent = user.organization;
  document.querySelector(".intro .data-note").textContent = isolated ? user.notice : "Public-source summaries and simulated RFI tasks. Check the version and approval labels on uploaded project files.";
  document.querySelector("#documents-title").textContent = isolated ? "Source documents" : "Public source corpus";
  const corpusButtons = document.querySelectorAll(".documents-panel .corpus-button");
  corpusButtons[0].href = isolated ? "files.html" : "sources.html";
  corpusButtons[0].firstChild.textContent = isolated ? "Browse source documents " : "Browse public sources ";
  corpusButtons[1].hidden = isolated;
  document.querySelector(".manual-packet-link").hidden = isolated;
  const realRfi = user.datasetId?.startsWith("demo4-");
  exampleQuestion = realRfi ? user.datasetId.includes("nkc") ? "What changed between RFI 025 and RFI 025.1?" : "What does the response to RFI 569.3 say, and which RFI does it reference?" : isolated ? "Which documents describe the Area A tank base?" : publicExample;
  document.querySelector("#register-link").hidden = !realRfi;
  const projectSelect = document.querySelector("#project-select"); projectSelect.replaceChildren();
  for (const p of availableProjects) { const o=element("option","",p.name); o.value=p.id;projectSelect.append(o); }
  projectSelect.value=user.projectId;
  questionInput.placeholder = exampleQuestion;
  document.querySelector("#question-title").textContent = { foreman: "Ask a field question", engineer: "Search and verify documents", manager: "Search project evidence" }[user.role];
  stateKey = `info492-demo3-records-${user.projectId}-${user.id}`;
  document.querySelector("#active-role").textContent = user.label;
  document.querySelector("#role-description").textContent = user.description;
  document.querySelector("#account-email").textContent = user.email;
  showEntry("dashboard");
  startTour(currentUser.id);
  await load();
  await refreshMonitoring();
}

for (const [index, account] of demoAccounts.entries()) {
  const card = element("article", "demo-account");
  const details = element("dl", "demo-credentials");
  for (const [label, value] of [["Email", account.email], ["Password", account.password]]) {
    const field = element("dd"); field.append(element("code", "", value));
    details.append(element("dt", "", label), field);
  }
  const button = element("button", "text-button", "Use this account");
  button.type = "button";
  button.dataset.account = String(index);
  button.setAttribute("aria-label", `Use ${account.label} account`);
  button.addEventListener("click", () => {
    document.querySelector("#login-email").value = account.email;
    document.querySelector("#login-password").value = account.password;
    document.querySelector("#login-error").hidden = true;
    document.querySelector("#login-button").focus();
  });
  card.append(element("h3", "", account.label), details, button);
  document.querySelector("#demo-accounts").append(card);
}

document.querySelector("#login-form").addEventListener("submit", async event => {
  event.preventDefault();
  const button = document.querySelector("#login-button");
  const error = document.querySelector("#login-error");
  button.disabled = true;
  button.textContent = "Signing in…";
  error.hidden = true;
  for (const choice of document.querySelectorAll("#demo-accounts button")) choice.disabled = true;
  try {
    await signIn(document.querySelector("#login-email").value.trim(), document.querySelector("#login-password").value);
    const user = await workspaceSession();
    document.querySelector("#login-password").value = "";
    await enterWorkspace(user);
  } catch (failure) {
    await signOutAccount().catch(() => {});
    error.textContent = authError(failure); error.hidden = false;
  } finally {
    button.disabled = false; button.textContent = "Sign in";
    for (const choice of document.querySelectorAll("#demo-accounts button")) choice.disabled = false;
  }
});

document.querySelector("#sign-out").addEventListener("click", async () => {
  const button = document.querySelector("#sign-out");
  button.disabled = true;
  try { await signOutAccount(); } catch { button.disabled = false; showError("Sign-out could not be completed. Please try again."); return; }
  sessionStorage.removeItem(stateKey);
  selectProject("");
  records = [];
  historyExpanded = false;
  latest = null;
  currentUser = null;
  questionInput.value = "";
  clearAnswer();
  updateRecordCount();
  document.querySelector("#citations").replaceChildren();
  document.querySelector("#answer-text").textContent = "";
  document.querySelector("#review-note").value = "";
  document.querySelector("#account-email").textContent = "";
  document.querySelector("#login-password").value = "";
  document.querySelector("#login-error").hidden = true;
  showEntry("login-panel");
  button.disabled = false;
});
document.querySelector("#show-guide").addEventListener("click", () => startTour(currentUser.id, true));
document.querySelector("#use-example").addEventListener("click", () => { questionInput.value = exampleQuestion; clearAnswer(); saveState(); questionInput.focus(); });
document.querySelector("#review-form").addEventListener("submit", async event => {
  event.preventDefault();
  const record = latest;
  if (!record?.result?.recordId) return;
  const button = document.querySelector("#save-review");
  const message = document.querySelector("#review-message");
  button.disabled = true;
  document.querySelector("#sign-out").disabled = true;
  try {
    const result = await request("/api/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recordId: record.result.recordId, share: document.querySelector("#share-review").checked, decision: document.querySelector("#review-decision").value, checkedPassageIds: record.checkedPassageIds || [], note: document.querySelector("#review-note").value }) });
    record.reviewHistory = [...(record.reviewHistory || []), result];
    record.review = result;
    if (document.querySelector("#share-review").checked || result.decision === "flag-review") record.shared = true;
    renderReviewHistory(record); renderPending(records);
    saveState(); updateRecordCount();
    if (latest === record) message.textContent = `Saved: ${decisionLabels[result.decision]}`;
  } catch (error) { if (latest === record) message.textContent = error.message; }
  finally { button.disabled = false; document.querySelector("#sign-out").disabled = false; }
});

async function restoreAccess() {
  try {
    if (await getAuthToken()) await enterWorkspace(await workspaceSession());
  } catch (error) {
    await signOutAccount().catch(() => {});
    showEntry("login-panel");
    document.querySelector("#login-error").textContent = authError(error);
    document.querySelector("#login-error").hidden = false;
  }
}

document.querySelector("#gap-check").addEventListener("change", event => { if (latest) { latest.gapChecked = event.target.checked; saveState(); } });
restoreAccess();

async function workspaceSession() {
  availableProjects = (await request("/api/projects")).projects;
  const p = availableProjects.find(p => p.id === selectedProject()) || availableProjects[0];
  selectProject(p?.id || "");
  return request("/api/session");
}
document.querySelector("#project-select").addEventListener("change", async event => {
  const previous=selectedProject(), selector=event.target; selector.disabled=true;askButton.disabled=true;
  try { selectProject(selector.value); const url=new URL(location.href);url.searchParams.delete("version");history.replaceState(null,"",url); await enterWorkspace(await request("/api/session")); }
  catch(e) { selectProject(previous);selector.value=previous;showError(e.message); }
  finally { selector.disabled=false;askButton.disabled=false; }
});

function openSavedRecord(record) {
  latest = record; questionInput.value = record.question; errorMessage.hidden = true;
  renderAnswer(record.result); saveState(); answerPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}
async function loadHistory(selectedId) {
  const data = await request("/api/history");
  records = data.records.map(record => {
    const reviewHistory = record.reviews.map(r => ({ role: r.role, reviewerId: r.actor_id, decision: r.decision, note: r.note, checkedPassageIds: JSON.parse(r.checked_ids), reviewedAt: r.created_at }));
    return { ownerId: record.owner_id, shared: Boolean(record.shared), role: record.owner_role, question: record.question, result: record.result, reviewHistory, review: reviewHistory.at(-1), completedAt: record.created_at };
  }).reverse();
  latest = records.find(record => record.result.recordId === selectedId) || null;
  if (latest) renderAnswer(latest.result);
}
