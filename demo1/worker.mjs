import { dataset, questionBank, createAnswerSchema, prepareRun, instructions, HttpError, parseAnswer } from "./rfi.mjs";

const model = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const allowedOrigins = new Set([
  "https://info492-sub-team-4.web.app",
  "https://info492-sub-team-4.firebaseapp.com",
  "https://info492-team4-demo1.web.app",
  "https://info492-team4-demo1.firebaseapp.com",
]);

async function readJson(request) {
  if (!request.headers.get("Content-Type")?.startsWith("application/json")) {
    throw new HttpError(415, "The request must use JSON.");
  }
  const reader = request.body?.getReader();
  let text = "";
  let length = 0;
  const decoder = new TextDecoder();
  if (reader) {
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > 8192) {
          await reader.cancel();
          throw new HttpError(413, "The request is too large.");
        }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      reader.releaseLock();
    }
  }
  try {
    const body = JSON.parse(text);
    if (!body || Array.isArray(body) || typeof body !== "object") throw new Error();
    return body;
  } catch {
    throw new HttpError(400, "The request contains invalid JSON.");
  }
}

export default {
  async fetch(request, env) {
    const requestUrl = new URL(request.url);
    const localPreview = ["localhost", "127.0.0.1"].includes(requestUrl.hostname);
    const origin = request.headers.get("Origin");
    const acceptedOrigin = allowedOrigins.has(origin) || (localPreview && origin === requestUrl.origin);
    const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", Vary: "Origin" };
    if (acceptedOrigin) headers["Access-Control-Allow-Origin"] = origin;
    const json = (status, body) => Response.json(body, { status, headers });
    let trace;
    try {
      if (origin && !acceptedOrigin) throw new HttpError(403, "This service only accepts requests from the demo website.");
      const path = requestUrl.pathname;
      if (request.method === "OPTIONS" && path === "/api/ask" && acceptedOrigin) {
        return new Response(null, { status: 204, headers: { ...headers, "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "3600" } });
      }
      if (request.method === "GET" && path === "/api/documents") return json(200, dataset);
      if (request.method === "GET" && path === "/api/questions") return json(200, questionBank);
      if (request.method === "GET" && path === "/api/status") return json(200, { ready: Boolean(env.AI), provider: "cloudflare", model, pipelineVersion: "demo2-1.0" });
      if (request.method !== "POST" || path !== "/api/ask") throw new HttpError(404, "This page was not found.");
      if (!acceptedOrigin) throw new HttpError(403, "Open the demo website to ask a question.");
      const body = await readJson(request);
      if (typeof body.question !== "string" || !body.question.trim() || body.question.trim().length > 1000) {
        throw new HttpError(400, "Enter a question between 1 and 1000 characters.");
      }
      const started = performance.now();
      trace = prepareRun(body.question.trim());
      const selectedDocuments = trace.retrieval.passages;
      if (!selectedDocuments.length) throw new HttpError(422, "No passages matched this question. No AI request was made. Try terms used in the source corpus; a retrieval miss does not prove the answer is absent.");
      if (!env.AI) throw new HttpError(503, "AI access has not been set up yet.");
      trace.aiRequestedAt = new Date().toISOString();
      trace.modelInputPassageIds = selectedDocuments.map(document => document.id);
      let response;
      try {
        response = await env.AI.run(model, {
          messages: [
            { role: "system", content: instructions },
            { role: "user", content: JSON.stringify({ question: body.question.trim(), documents: selectedDocuments }) },
          ],
          max_tokens: 1500,
          temperature: 0,
          response_format: { type: "json_schema", json_schema: createAnswerSchema(selectedDocuments) },
        });
      } catch {
        throw new HttpError(503, "The AI service could not complete the request. Check Workers AI access and usage limits before trying again.");
      }
      const answer = response?.response;
      const text = typeof answer === "string" ? answer : answer && typeof answer === "object" && !Array.isArray(answer) ? JSON.stringify(answer) : "";
      if (!text.trim()) throw new HttpError(502, "The AI service did not return an answer.");
      const result = parseAnswer(text, selectedDocuments);
      return json(200, { ...result, model, durationMs: Math.round(performance.now() - started), trace: { ...trace, status: "completed", completedAt: new Date().toISOString(), citedPassageIds: result.sources.map(source => source.id) } });
    } catch (error) {
      const message = error.status ? error.message : "The service could not complete the request.";
      return json(error.status || 500, { error: message, ...(trace ? { model, trace: { ...trace, status: "failed", completedAt: new Date().toISOString(), citedPassageIds: [], error: message } } : {}) });
    }
  },
};
