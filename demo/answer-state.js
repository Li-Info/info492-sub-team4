export function answerSummary(result) {
  const conclusions = result.conclusions || [];
  const missingInformation = [...new Set([
    ...(result.missingInformation || []),
    ...conclusions.filter(c => c.status === "insufficient").map(c => `Needs confirmation: ${c.statement}`),
  ].filter(Boolean).map(text => text.trim()))];
  const inferred = result.sourceDifferences?.length || conclusions.some(c => c.status === "source-conflict")
    ? "source-difference" : missingInformation.length ? "insufficient" : "reported-evidence";
  const answerState = ["source-difference", "insufficient", "reported-evidence"].includes(result.answerState) ? result.answerState : inferred;
  if (answerState === "insufficient" && !missingInformation.length) missingInformation.push("Additional information is needed. Review the answer's information gaps.");
  return { answerState, missingInformation };
}

export function evidenceTitle(source) {
  const number = source.rfiNumber || source.rfi_number;
  if (number && source.sourceType !== "rfi_log_entry") return source.filename || source.revision || `RFI ${number}`;
  return source.title || source.filename || "Untitled source";
}
