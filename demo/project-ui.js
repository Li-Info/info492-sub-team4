import { element, request, passageLink } from "./shared.js";

let user, getLatest, openRecord;
const post = (path, body) => request(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const stamp = value => value ? new Date(value).toLocaleString() : "Not checked yet";
const changeLabels = { "added-evidence": "New supporting evidence", "source-difference": "Source difference", "version-change": "File version changed", "unable-to-determine": "Impact needs clarification" };
const reviewLabels = { "affects-item": "Affects this item", "not-applicable": "Reviewed, not applicable", "still-missing": "Still needs information" };

export function configureProjectUI(account, latest, opener) {
  user = account; getLatest = latest; openRecord = opener;
  document.querySelector("#save-monitor").hidden = user.role !== "engineer";
  document.querySelector("#project-name").textContent = `${user.projectName} · ${user.assignedProject ? "Assigned team project" : "Private project"}`;
}

export function renderReviewHistory(record) {
  const target = document.querySelector("#review-history");
  target.replaceChildren();
  for (const r of record?.reviewHistory || []) target.append(element("p", "review-log", `${r.role} · ${r.decision} · ${stamp(r.reviewedAt)}${r.note ? ` — ${r.note}` : ""}`));
  document.querySelector("#share-review").checked = Boolean(record?.shared);
  document.querySelector("#share-review").disabled = record?.ownerId !== user.id;
  document.querySelector("#monitor-message").textContent = "";
  document.querySelector("#save-monitor").hidden = user.role !== "engineer" || record?.ownerId !== user.id;
}

document.querySelector("#save-monitor").addEventListener("click", async event => {
  const record = getLatest();
  if (!record?.result?.recordId) return;
  event.target.disabled = true;
  try { await post("/api/monitor", { recordId: record.result.recordId, state: "active" }); document.querySelector("#monitor-message").textContent = "Monitoring saved. Checks continue after you leave this page."; await refreshMonitoring(); }
  catch (error) { document.querySelector("#monitor-message").textContent = error.message; }
  finally { event.target.disabled = false; }
});

export function renderPending(records) {
  const panel = document.querySelector("#pending-panel"), target = document.querySelector("#pending-items");
  panel.hidden = user.role !== "manager";
  target.replaceChildren();
  for (const record of records.filter(r => r.shared && r.review?.decision !== "ready-for-rfi")) {
    const button = element("button", "record-item", record.question);
    button.append(element("span", "", record.review?.note || "Awaiting project review"));
    button.addEventListener("click", () => openRecord(record));
    target.append(button);
  }
  if (!target.children.length) target.append(element("p", "", "No shared items awaiting review."));
}

export async function refreshMonitoring() {
  const status = document.querySelector("#monitoring-status");
  try {
    const data = await request("/api/monitoring");
    status.textContent = `${data.monitors.filter(m => m.state === "active").length} active items · Checks also run in the background`;
    const items = document.querySelector("#monitor-items"), updates = document.querySelector("#update-items"), runs = document.querySelector("#monitor-runs");
    items.replaceChildren(); updates.replaceChildren(); runs.replaceChildren();
    for (const m of data.monitors) {
      const card = element("article", "monitor-card");
      card.append(element("h3", "", m.question), element("p", "monitor-state", m.state), element("p", "", `Last successful check: ${stamp(m.checked_at)}`), element("p", "", m.state === "active" ? `Next scheduled check: ${stamp(m.next_check)}` : "Checks stopped"));
      if (m.error) card.append(element("p", "error-message", m.error));
      if (user.id === m.owner_id && user.role === "engineer") for (const [state, label] of m.state === "active" ? [["paused", "Pause"], ["archived", "Archive"]] : [["active", "Resume"]]) {
        const button = element("button", "secondary-button", label);
        button.addEventListener("click", async () => { button.disabled = true; try { await post("/api/monitor", { recordId: m.record_id, state }); await refreshMonitoring(); } catch (e) { status.textContent = e.message; button.disabled = false; } });
        card.append(button);
      }
      items.append(card);
    }
    if (!data.monitors.length) items.append(element("p", "", "No monitored questions yet. Project Engineers can turn on monitoring below a saved answer."));
    for (const update of data.updates) {
      const card = element("article", "update-card");
      card.append(element("p", "answer-state warning", changeLabels[update.change_type]), element("h3", "", update.question), element("p", "", update.finding), element("p", "source-meta", `${stamp(update.created_at)} · ${update.reviews.length ? "Review decision recorded" : "Awaiting human review"}`));
      const evidence = element("details", "");
      evidence.append(element("summary", "", "View old and new evidence"));
      for (const [label, passages] of [["Earlier evidence snapshots", update.oldEvidence], ["New evidence", update.evidence]]) {
        evidence.append(element("h4", "", label));
        if (!passages.length) evidence.append(element("p", "", "No supporting passage in the original answer."));
        for (const p of passages) evidence.append(passageLink(p, `${p.title} · ${p.location || p.id}`), element("blockquote", "", p.text));
      }
      card.append(evidence);
      for (const r of update.reviews) card.append(element("p", "review-log", `${r.role} · ${reviewLabels[r.decision]} · ${stamp(r.created_at)} — ${r.note}`));
      if (["engineer", "manager"].includes(user.role)) {
        const form = element("form", "update-review");
        const select = element("select"); select.required = true; select.setAttribute("aria-label", "Update review decision");
        for (const [value, label] of [["", "Select a review decision"], ...Object.entries(reviewLabels)]) { const option = element("option", "", label); option.value = value; select.append(option); }
        const note = element("textarea"); note.rows = 2; note.required = true; note.maxLength = 1000; note.placeholder = "Explain your review decision"; note.setAttribute("aria-label", "Update review notes");
        const button = element("button", "primary-button", "Record review decision"); button.type = "submit";
        const message = element("p", ""); message.setAttribute("role", "status");
        form.append(select, note, button, message);
        form.addEventListener("submit", async event => { event.preventDefault(); button.disabled = true; try { await post("/api/update-review", { updateId: update.id, decision: select.value, note: note.value }); await refreshMonitoring(); } catch (e) { message.textContent = e.message; button.disabled = false; } });
        card.append(form);
      }
      updates.append(card);
    }
    if (!data.updates.length) updates.append(element("p", "", "No evidence changes awaiting review."));
    for (const run of data.runs) {
      const detail = element("details", "run-log");
      detail.append(element("summary", "", `${run.status} · ${run.trigger} · attempt ${run.attempts} · ${stamp(run.started_at || run.available_at)}`));
      detail.append(element("p", "", run.error || run.result?.finding || "Waiting for a background worker."));
      for (const tool of run.activity) detail.append(element("p", "", `${tool.tool}: ${tool.query || tool.outcome || (tool.passageIds || []).join(", ")} · ${stamp(tool.at)}`));
      if (run.status === "failed" && user.role === "engineer") { const retry = element("button", "secondary-button", "Retry failed check"); retry.addEventListener("click", async () => { retry.disabled = true; try { await post("/api/retry", { runId: run.id }); await refreshMonitoring(); } catch (e) { status.textContent = e.message; retry.disabled = false; } }); detail.append(retry); }
      runs.append(detail);
    }
  } catch (error) { status.textContent = error.message; }
}
document.querySelector("#refresh-monitoring").addEventListener("click", refreshMonitoring);
