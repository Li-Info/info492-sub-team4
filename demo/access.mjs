import { verifyFirebaseToken } from "./firebase-token.mjs";
import { HttpError } from "./rfi.mjs";

export const roles = {
  foreman: { label: "Foreman", description: "Ask a field question and flag evidence for the project team.", decisions: ["flag-review"] },
  engineer: { label: "Project Engineer", description: "Search and verify documents. Manage file versions and monitor saved questions.", decisions: ["checked", "needs-information", "clarification-needed"] },
  manager: { label: "Project Manager", description: "Review shared project items and record the next internal step.", decisions: ["request-evidence", "ready-for-rfi"] },
};

const encode = value => btoa(String.fromCharCode(...value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
const decode = value => Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), char => char.charCodeAt(0));
const bytes = value => new TextEncoder().encode(value);

async function signingKey(env) {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) throw new HttpError(503, "Team access has not been configured.");
  return crypto.subtle.importKey("raw", bytes(env.SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signRecord(value, env, purpose, seconds = 28800) {
  const payload = encode(bytes(JSON.stringify({ ...value, purpose, expires: Math.floor(Date.now() / 1000) + seconds })));
  return `${payload}.${encode(new Uint8Array(await crypto.subtle.sign("HMAC", await signingKey(env), bytes(payload))))}`;
}

export async function readRecord(token, env, purpose) {
  try {
    if (typeof token !== "string" || token.length > 16000) throw new Error();
    const parts = token.split(".");
    if (parts.length !== 2 || !await crypto.subtle.verify("HMAC", await signingKey(env), decode(parts[1]), bytes(parts[0]))) throw new Error();
    const record = JSON.parse(new TextDecoder().decode(decode(parts[0])));
    if (record.purpose !== purpose || record.expires <= Math.floor(Date.now() / 1000)) throw new Error();
    return record;
  } catch {
    throw new HttpError(401, "Your access has expired or is invalid. Please sign in again.");
  }
}

export function accountSession(claims) {
  const role = claims.role === undefined ? "engineer" : claims.role;
  if (typeof role !== "string" || !Object.hasOwn(roles, role)) throw new HttpError(403, "Your account has no available project role. Contact your team.");
  const assignedProject = typeof claims.projectId === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(claims.projectId);
  return { id: claims.sub, email: claims.email, role, projectId: assignedProject ? claims.projectId : `personal-${claims.sub}`, assignedProject };
}

export async function authenticate(request) {
  const token = request.headers.get("Authorization")?.replace(/^Bearer /, "");
  return accountSession(await verifyFirebaseToken(token));
}

export async function runReceipt(result, question, session, env) {
  const digest = encode(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes(JSON.stringify({ question, answer: result.answer, sources: result.sources, missingInformation: result.missingInformation, sourceDifferences: result.sourceDifferences })))));
  return signRecord({ id: crypto.randomUUID(), sessionId: session.id, role: session.role, digest, citations: result.sources.map(source => source.id) }, env, "run");
}

export async function review(body, session, env) {
  const run = await readRecord(body.runToken, env, "run");
  if (run.sessionId !== session.id || run.role !== session.role) throw new HttpError(403, "Review an answer from your current session.");
  if (!roles[session.role].decisions.includes(body.decision)) throw new HttpError(403, "Your role cannot make this review decision.");
  const checked = body.checkedPassageIds;
  if (!Array.isArray(checked) || checked.some(id => !run.citations.includes(id)) || new Set(checked).size !== checked.length) throw new HttpError(400, "Select only the passages cited in this answer.");
  if (body.decision !== "needs-information" && (!run.citations.length || run.citations.some(id => !checked.includes(id)))) throw new HttpError(400, "Check every cited passage before completing the review.");
  if (typeof body.note !== "string" || body.note.length > 1000 || (body.decision === "needs-information" && !body.note.trim())) throw new HttpError(400, "Describe what needs to be checked or supplied.");
  const record = { runId: run.id, answerDigest: run.digest, role: session.role, reviewerId: session.id, decision: body.decision, checkedPassageIds: checked, note: body.note.trim(), reviewedAt: new Date().toISOString() };
  return { ...record, receipt: await signRecord(record, env, "review", 31536000) };
}
