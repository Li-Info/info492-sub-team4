import { element, passageLink } from "./shared.js";

export function logLink(number, label = "View in RFI Log") {
  const a = element("a", "secondary-button", label); a.href = `rfi-log.html?rfi=${encodeURIComponent(number)}`; return a;
}
export function renderRelated(target, refs = []) {
  target.replaceChildren();
  const seen = new Set();
  for (const ref of refs) {
    if (seen.has(ref.number)) continue; seen.add(ref.number);
    const card = element("article", "related-rfi");
    card.append(logLink(ref.number, `RFI ${ref.number}`), element("span", `evidence-status ${ref.missingDocument ? "insufficient" : "supported"}`, ref.missingDocument ? "File missing · upload needed" : "PDF available"));
    if (ref.from_number) card.append(element("p", "source-meta", `${ref.relation === "replaced-by" ? "Replacement named" : "Explicitly referenced"} in RFI ${ref.from_number}, page ${ref.page}`));
    if (ref.reason) card.append(element("p", "reference-reason", ref.reason));
    if (ref.missingDocument) card.append(element("p", "missing-file-copy", "The reference is retained. The original RFI PDF has not been supplied."));
    for (const doc of ref.documents || []) { const a = element("a", "passage-link", `Open ${doc.disposition === "void" ? "void record" : "supplied PDF"}${doc.revision ? ` · ${doc.revision}` : ""}`); a.href = `files.html?version=${encodeURIComponent(doc.versionId)}`; card.append(a); }
    target.append(card);
  }
  target.hidden = seen.size === 0;
}
export function renderConclusions(target, conclusions, sources, onClarify) {
  target.replaceChildren(); target.hidden = !conclusions?.length;
  for (const c of conclusions || []) {
    const card = element("article", `conclusion-card ${c.status}`);
    card.append(element("span", `evidence-status ${c.status}`, { supported: "Evidence found", "source-conflict": "Source conflict", insufficient: "Information missing" }[c.status]), element("p", "conclusion-statement", c.statement));
    const grid = element("div", c.status === "source-conflict" ? "conflict-evidence" : "conclusion-evidence");
    for (const e of c.evidence || []) {
      const p = sources.find(p => p.id === e.passageId); if (!p) continue;
      const section = element("section", "evidence-quote");
      section.append(element("h4", "", e.label), element("blockquote", "", e.quote), passageLink({ ...p, excerpt: e.quote }, p.location)); grid.append(section);
    }
    if (grid.children.length) card.append(grid);
    if (c.nextAction) card.append(element("p", "next-check", `Next check: ${c.nextAction}`));
    if (c.status !== "supported" && onClarify) { const b = element("button", "text-button", "Record a clarification request"); b.type = "button"; b.addEventListener("click", () => onClarify(c.nextAction || c.statement)); card.append(b); }
    target.append(card);
  }
}
export function renderChanges(target, changes = []) {
  target.replaceChildren();
  for (const change of changes) {
    const item = element("article", "change-item");
    item.append(element("h4", "", change.summary));
    if (change.quote) item.append(element("blockquote", "", change.quote));
    if (change.sourceVersionId) { const a = element("a", "passage-link", `Check source · page ${change.page || 1}`); a.href = `files.html?version=${encodeURIComponent(change.sourceVersionId)}&page=${change.page || 1}&quote=${encodeURIComponent(change.quote || "")}`; item.append(a); }
    target.append(item);
  }
  if (!changes.length) target.append(element("p", "", "No key-change summary has been recorded for this version. Use version comparison to inspect the source text."));
}
