import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dataset, questionBank, createAnswerSchema, prepareRun, pipelineVersion, instructions, HttpError, parseAnswer } from "./rfi.mjs";

const host = "127.0.0.1";
const port = Number(process.env.PORT || 8792);
const provider = (process.env.AI_PROVIDER || "cloudflare").trim();
const defaultModels = { cloudflare: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", gemini: "gemini-3.8-flash" };
const model = (process.env.AI_MODEL || defaultModels[provider] || "").trim();
const apiKeys = {
  cloudflare: process.env.CLOUDFLARE_API_TOKEN,
  gemini: process.env.GEMINI_API_KEY,
  openai: process.env.OPENAI_API_KEY,
  anthropic: process.env.ANTHROPIC_API_KEY,
};
const apiKey = Object.hasOwn(apiKeys, provider) ? apiKeys[provider]?.trim() : undefined;
const accountId = (process.env.CLOUDFLARE_ACCOUNT_ID || "").trim();
const ready = Object.hasOwn(apiKeys, provider) && Boolean(model && apiKey) && (provider !== "cloudflare" || /^[a-f0-9]{32}$/i.test(accountId));
const allowedOrigins = new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`]);
const staticFiles = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/shared.js", ["shared.js", "text/javascript; charset=utf-8"]],
  ["/sources.js", ["sources.js", "text/javascript; charset=utf-8"]],
  ["/sources.html", ["sources.html", "text/html; charset=utf-8"]],
  ["/corpus_for_manual_search.md", ["corpus_for_manual_search.md", "text/markdown; charset=utf-8"]],
]);

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  if (!request.headers["content-type"]?.startsWith("application/json")) {
    throw new HttpError(415, "The request must use JSON.");
  }
  let length = 0;
  const chunks = [];
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 8192) throw new HttpError(413, "The request is too large.");
    chunks.push(chunk);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || Array.isArray(body) || typeof body !== "object") throw new Error();
    return body;
  } catch {
    throw new HttpError(400, "The request contains invalid JSON.");
  }
}

async function askAI(question, selectedDocuments) {
  const content = JSON.stringify({ question, documents: selectedDocuments });
  const answerSchema = createAnswerSchema(selectedDocuments);
  const headers = { "Content-Type": "application/json" };
  let url;
  let body;
  if (provider === "cloudflare") {
    url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
    headers.Authorization = `Bearer ${apiKey}`;
    body = {
      messages: [{ role: "system", content: instructions }, { role: "user", content }],
      max_tokens: 1500,
      temperature: 0,
      response_format: { type: "json_schema", json_schema: answerSchema },
    };
  } else if (provider === "gemini") {
    url = "https://generativelanguage.googleapis.com/v1beta/interactions";
    headers["x-goog-api-key"] = apiKey;
    body = {
      model,
      input: content,
      system_instruction: instructions,
      store: false,
      generation_config: { max_output_tokens: 3000, thinking_level: "low" },
      response_format: { type: "text", mime_type: "application/json", schema: answerSchema },
    };
  } else if (provider === "openai") {
    url = "https://api.openai.com/v1/responses";
    headers.Authorization = `Bearer ${apiKey}`;
    body = {
      model,
      store: false,
      max_output_tokens: 3000,
      input: [{ role: "system", content: instructions }, { role: "user", content }],
      text: { format: { type: "json_schema", name: "rfi_answer", strict: true, schema: answerSchema } },
    };
  } else {
    url = "https://api.anthropic.com/v1/messages";
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
    body = { model, max_tokens: 1500, system: instructions, messages: [{ role: "user", content }] };
  }
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(55000),
    });
  } catch (error) {
    if (error.name === "TimeoutError") throw new HttpError(504, "The AI service took too long to respond. Please try again.");
    throw new HttpError(502, "The AI service could not be reached. Check the connection and try again.");
  }
  if (!response.ok) {
    if ([401, 403].includes(response.status)) {
      let detail = "";
      if (provider === "gemini") {
        const error = await response.json().catch(() => null);
        if (typeof error?.error?.message === "string") {
          const message = error.error.message.split(apiKey).join("[REDACTED]").replace(/AIza[A-Za-z0-9_-]+/g, "[REDACTED]").slice(0, 1000);
          detail = ` Google response (${response.status}): ${message}`;
        }
      }
      throw new HttpError(502, `The AI service rejected access. Check the server credentials and model permissions.${detail}`);
    }
    if (response.status === 429) throw new HttpError(503, "The AI service has reached a usage or rate limit. Check the account before trying again.");
    if ([400, 404].includes(response.status)) throw new HttpError(502, "The AI service could not use the selected model or request settings.");
    throw new HttpError(502, "The AI service returned an error. Please try again later.");
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new HttpError(502, "The AI service returned an unreadable response.");
  }
  let text;
  if (provider === "cloudflare") {
    if (data.success !== true) throw new HttpError(502, "Cloudflare could not complete the AI request. Check the account's Workers AI access and usage limits.");
    const answer = data.result?.response;
    text = typeof answer === "string" ? answer : answer && typeof answer === "object" && !Array.isArray(answer) ? JSON.stringify(answer) : "";
  } else if (provider === "gemini") {
    if (data.status !== "completed") throw new HttpError(502, "The AI response was incomplete or blocked. Please try again.");
    text = (data.steps || []).filter(step => step.type === "model_output").flatMap(step => step.content || []).filter(item => item.type === "text").map(item => item.text).join("");
  } else if (provider === "openai") {
    if (data.status && data.status !== "completed") throw new HttpError(502, "The AI response was incomplete. Please try again.");
    text = (data.output || []).flatMap(item => item.content || []).filter(item => item.type === "output_text").map(item => item.text).join("");
  } else {
    if (data.stop_reason === "max_tokens") throw new HttpError(502, "The AI response was incomplete. Please try again.");
    text = (data.content || []).filter(item => item.type === "text").map(item => item.text).join("");
  }
  if (!text.trim()) throw new HttpError(502, "The AI service did not return an answer. Please try a different question.");
  return parseAnswer(text, selectedDocuments);
}

let activeRequest = false;

const server = createServer(async (request, response) => {
  let trace;
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  try {
    if (![`${host}:${port}`, `localhost:${port}`].includes(request.headers.host)) throw new HttpError(403, "This sample only accepts local requests.");
    if (request.headers.origin && !allowedOrigins.has(request.headers.origin)) throw new HttpError(403, "This sample only accepts requests from its own page.");
    if (request.headers["sec-fetch-site"] === "cross-site") throw new HttpError(403, "Cross-site requests are not allowed.");
    const path = new URL(request.url, `http://${host}:${port}`).pathname;
    if (request.method === "GET" && staticFiles.has(path)) {
      const [file, type] = staticFiles.get(path);
      const content = await readFile(new URL(file, import.meta.url));
      response.writeHead(200, { "Content-Type": type });
      response.end(content);
      return;
    }
    if (request.method === "GET" && path === "/api/documents") {
      json(response, 200, dataset);
      return;
    }
    if (request.method === "GET" && path === "/api/questions") {
      json(response, 200, questionBank);
      return;
    }
    if (request.method === "GET" && path === "/api/status") {
      json(response, 200, { ready, provider, model, pipelineVersion });
      return;
    }
    if (request.method === "POST" && path === "/api/ask") {
      if (!request.headers.origin || !allowedOrigins.has(request.headers.origin)) throw new HttpError(403, "Open the local sample page to ask a question.");
      const body = await readJson(request);
      if (typeof body.question !== "string" || !body.question.trim() || body.question.trim().length > 1000) throw new HttpError(400, "Enter a question between 1 and 1000 characters.");
      if (activeRequest) throw new HttpError(429, "A question is already being processed. Please wait for the answer.");
      const started = performance.now();
      trace = prepareRun(body.question.trim());
      const selectedDocuments = trace.retrieval.passages;
      if (!selectedDocuments.length) throw new HttpError(422, "No passages matched this question. No AI request was made. Try terms used in the source corpus; a retrieval miss does not prove the answer is absent.");
      if (!ready) throw new HttpError(503, "AI access has not been set up yet. Ask your team to configure the local AI service.");
      activeRequest = true;
      try {
        trace.aiRequestedAt = new Date().toISOString();
        trace.modelInputPassageIds = selectedDocuments.map(document => document.id);
        const result = await askAI(body.question.trim(), selectedDocuments);
        json(response, 200, { ...result, model, durationMs: Math.round(performance.now() - started), trace: { ...trace, status: "completed", completedAt: new Date().toISOString(), citedPassageIds: result.sources.map(source => source.id) } });
      } finally {
        activeRequest = false;
      }
      return;
    }
    throw new HttpError(404, "This page was not found.");
  } catch (error) {
    const message = error.status ? error.message : "The local service could not complete the request.";
    if (!response.headersSent && !response.destroyed) json(response, error.status || 500, { error: message, ...(trace ? { model, trace: { ...trace, status: "failed", completedAt: new Date().toISOString(), citedPassageIds: [], error: message } } : {}) });
  }
});

server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.on("error", error => {
  console.error(error.code === "EADDRINUSE" ? `Port ${port} is already in use. Set PORT to another local port.` : "The local sample server could not start.");
  process.exitCode = 1;
});
server.listen(port, host, () => console.log(`RFI sample: http://${host}:${port}`));
