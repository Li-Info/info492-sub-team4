export const apiBase = "";
let tokenProvider = async () => null;
export function setTokenProvider(provider) { tokenProvider = provider; }

function csvCell(value) {
  let text = String(value ?? "");
  if (/^[\s\uFEFF]*[=+@-]/u.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

export function recordsToCsv(records) {
  const rows = [["Request", "Question", "AI answer", "Retrieved passages", "Sent to AI", "Cited passages", "Missing information", "Source differences", "Request seconds", "Status", "Error", "Score", "Notes", "User role", "Review decision", "Checked passages", "Review notes", "Reviewed at"]];
  for (const [index, record] of records.entries()) {
    const result = record.result || {};
    const trace = result.trace || {};
    const duration = result.durationMs ?? record.browserRequestMs;
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
      record.role || "",
      record.review?.decision || "",
      (record.review?.checkedPassageIds || []).join("; "),
      record.review?.note || "",
      record.review?.reviewedAt || "",
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
  const { responseType, ...fetchOptions } = options;
  const headers = new Headers(options.headers);
  if (!["/api/documents", "/api/questions", "/api/status"].includes(path)) {
    const token = await tokenProvider(path === "/api/session");
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(`${apiBase}${path}`, { ...fetchOptions, headers, signal: AbortSignal.timeout(120000) });
  if (response.ok && responseType === "blob") return response.blob();
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
  link.href = passage.versionId ? `files.html?version=${encodeURIComponent(passage.versionId)}#${encodeURIComponent(passage.id)}` : `sources.html#${encodeURIComponent(passage.id)}`;
  return link;
}

export function sourceLink(source) {
  const link = element("a", "source-link", "Original public source");
  link.href = source.versionId ? `files.html?version=${encodeURIComponent(source.versionId)}` : source.url;
  if (source.versionId) link.textContent = `Uploaded file · V${source.versionNumber}`;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  if (source.versionId) link.target = "_self";
  return link;
}
