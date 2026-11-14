import { HttpError } from "./rfi.mjs";
import { getVersion, one } from "./project-data.mjs";
import { maxFileBytes, maxTextBytes, originalPartBytes } from "./upload-limits.js";

export function encodeBytes(bytes) {
  if (bytes.toBase64) return bytes.toBase64();
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}

export function decodeBytes(text) {
  return Uint8Array.fromBase64 ? Uint8Array.fromBase64(text) : Uint8Array.from(atob(text), c => c.charCodeAt(0));
}

export async function readUpload(request) {
  const maxRequest = maxFileBytes + maxTextBytes * 6 + 65536;
  let received = 0;
  const limited = request.body?.pipeThrough(new TransformStream({ transform(chunk, controller) {
    received += chunk.byteLength;
    if (received > maxRequest) throw new HttpError(413, "The upload request is too large.");
    controller.enqueue(chunk);
  } }));
  if (!limited) throw new HttpError(400, "Choose a file to upload.");
  let form;
  try { form = await new Response(limited, { headers: { "Content-Type": request.headers.get("Content-Type") } }).formData(); }
  catch (error) { if (error.status) throw error; throw new HttpError(400, "The upload could not be read. Choose the file again."); }
  const file = form.get("file"), metadata = form.get("metadata");
  if (!(file instanceof File) || !file.size) throw new HttpError(400, "Choose a file to upload.");
  if (file.size > maxFileBytes) throw new HttpError(413, "Use a file no larger than 10 MB.");
  if (typeof metadata !== "string" || metadata.length > maxTextBytes * 6 + 4096) throw new HttpError(400, "The file metadata is too large.");
  try {
    const body = JSON.parse(metadata);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return { ...body, filename: file.name, file };
  } catch { throw new HttpError(400, "The upload metadata is invalid."); }
}

export function originalStatements(db, versionId, bytes) {
  const statements = [];
  for (let start = 0; start < bytes.length; start += originalPartBytes) statements.push(db.prepare("INSERT INTO originals(version_id,part,data) VALUES(?,?,?)").bind(versionId, start / originalPartBytes, encodeBytes(bytes.subarray(start, start + originalPartBytes))));
  return statements;
}

export async function downloadOriginal(env, session, versionId, headers) {
  await getVersion(env, session, versionId);
  const count = await one(env.DB, "SELECT COUNT(*) AS n FROM originals WHERE version_id=?", versionId);
  if (!count.n) throw new HttpError(404, "The original file is unavailable.");
  let part = 0;
  const stream = new ReadableStream({ async pull(controller) {
    try {
      const row = await one(env.DB, "SELECT data FROM originals WHERE version_id=? AND part=?", versionId, part);
      if (!row) throw new Error("An original file part is unavailable.");
      controller.enqueue(decodeBytes(row.data));
      if (++part === count.n) controller.close();
    } catch (error) { controller.error(error); }
  } });
  return new Response(stream, { headers: { ...headers, "Content-Type": "application/octet-stream", "Content-Disposition": "attachment" } });
}
