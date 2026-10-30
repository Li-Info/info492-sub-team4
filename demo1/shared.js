export const apiBase = "";

function csvCell(value) {
  let text = String(value ?? "");
  if (/^[\s\uFEFF]*[=+@-]/u.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

export function recordsToCsv(records) {
  const rows = [["Request", "Question", "AI answer", "Retrieved passages", "Sent to AI", "Cited passages", "Missing information", "Source differences", "Request seconds", "Status", "Error", "Score", "Notes"]];
  for (const [index, record] of records.entries()) {
    const result = record.result || {};
    const trace = result.trace || {};
    const duration = record.browserRequestMs ?? result.durationMs;
    rows.push([
      index + 1,
      record.question,
      result.answer,
      (trace.retrieval?.passages || []).map(passage => passage.id).join("; "),
      (trace.modelInputPassageIds || []).join("; "),
      (trace.citedPassageIds || (result.sources || []).map(source => source.id)).join("; "),
      (result.missingInformation || []).join("; "),
      (result.sourceDifferences || []).map(difference => `${difference.topic}: ${difference.claims.map(claim => `${claim.passageId}: ${claim.statement}`).join(" | ")} — ${difference.explanation}`).join("\n"),
      Number.isFinite(duration) ? (duration / 1000).toFixed(3) : "",
      record.error || trace.status === "failed" ? "failed" : trace.status || (result.answer ? "completed" : "unknown"),
      record.error || result.error || trace.error || "",
      "",
      "",
    ]);
  }
  return "\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, { ...options, signal: AbortSignal.timeout(65000) });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || "The request could not be completed.");
    error.data = data;
    throw error;
  }
  return data;
}

export function passageLink(passage, text = "View passage in corpus") {
  const link = element("a", "passage-link", text);
  link.href = `sources.html#${encodeURIComponent(passage.id)}`;
  return link;
}

export function sourceLink(source) {
  const link = element("a", "source-link", "Original public source");
  link.href = source.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}
