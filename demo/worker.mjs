import { authenticate, roles } from "./access.mjs";
import { dataset, questionBank, HttpError } from "./rfi.mjs";
import { answerQuestion, agentVersion, model } from "./agent.mjs";
import { authorizeProject } from "./project-data.mjs";
import { projectApi, saveAnswer } from "./project-api.mjs";
import { drainPending, scheduleChecks } from "./monitor.mjs";
import { readUpload, downloadOriginal } from "./file-storage.mjs";

const allowedOrigins = new Set(["https://info492-sub-team-4.web.app", "https://info492-sub-team-4.firebaseapp.com", "https://info492-team4-demo1.web.app", "https://info492-team4-demo1.firebaseapp.com"]);
async function readJson(request, max = 32768) {
  if (!request.headers.get("Content-Type")?.startsWith("application/json")) throw new HttpError(415, "The request must use JSON.");
  const reader = request.body?.getReader();
  let length = 0, text = "";
  const decoder = new TextDecoder();
  if (reader) try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > max) { await reader.cancel(); throw new HttpError(413, "The request is too large."); }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally { reader.releaseLock(); }
  try { const body = JSON.parse(text); if (!body || Array.isArray(body) || typeof body !== "object") throw new Error(); return body; }
  catch { throw new HttpError(400, "The request contains invalid JSON."); }
}
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url), origin = request.headers.get("Origin");
    const accepted = allowedOrigins.has(origin) || (["localhost", "127.0.0.1"].includes(url.hostname) && origin === url.origin);
    const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", Vary: "Origin" };
    if (accepted) headers["Access-Control-Allow-Origin"] = origin;
    const json = (status, body) => Response.json(body, { status, headers });
    try {
      if (origin && !accepted) throw new HttpError(403, "This service only accepts requests from the demo website.");
      if (request.method === "OPTIONS" && url.pathname.startsWith("/api/") && accepted) return new Response(null, { status: 204, headers: { ...headers, "Access-Control-Allow-Methods": "GET, POST", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Max-Age": "3600" } });
      if (request.method === "GET" && url.pathname === "/api/documents") return json(200, dataset);
      if (request.method === "GET" && url.pathname === "/api/questions") return json(200, questionBank);
      if (request.method === "GET" && url.pathname === "/api/status") return json(200, { ready: Boolean(env.AI && env.DB), provider: "cloudflare", model, pipelineVersion: agentVersion });
      const session = await authorizeProject(env, await authenticate(request, env));
      if (request.method === "GET" && url.pathname === "/api/session") return json(200, { ...session, ...roles[session.role] });
      if (!["GET", "POST"].includes(request.method)) throw new HttpError(405, "This method is not available.");
      if (request.method === "POST" && !accepted) throw new HttpError(403, "Open the demo website to make changes.");
      if (url.pathname === "/api/upload" && session.role !== "engineer") throw new HttpError(403, "Only the assigned Project Engineer can upload files.");
      const body = request.method !== "POST" ? {} : url.pathname === "/api/upload" && request.headers.get("Content-Type")?.startsWith("multipart/form-data") ? await readUpload(request) : await readJson(request, url.pathname === "/api/upload" ? 2300000 : 32768);
      if (request.method === "POST" && url.pathname === "/api/download") return await downloadOriginal(env, session, body.versionId, headers);
      if (url.pathname === "/api/ask" && request.method === "POST") {
        if (typeof body.question !== "string" || !body.question.trim() || body.question.trim().length > 1000) throw new HttpError(400, "Enter a question between 1 and 1000 characters.");
        const result = await answerQuestion(env, session, body.question.trim(), body.versionId ? { versionId: body.versionId } : {});
        return json(200, await saveAnswer(env, session, body.question.trim(), result));
      }
      const result = await projectApi(url.pathname, request.method, body, env, session);
      if (["/api/upload", "/api/current-version", "/api/retry"].includes(url.pathname)) ctx?.waitUntil(drainPending(env));
      return json(200, result);
    } catch (error) {
      return json(error.status || 500, { error: error.status ? error.message : "The service could not complete the request. Please retry; no completed result was saved.", ...(error.trace ? { trace: error.trace, model } : {}) });
    }
  },
  async scheduled(controller, env, ctx) { ctx.waitUntil(scheduleChecks(env)); },
};
