import { HttpError } from "./rfi.mjs";
import { roles } from "./access.mjs";
import { now, uid, rows, one, execute, getVersion, versionPassages, loadRecord, enqueueEvents } from "./project-data.mjs";
import { originalStatements, decodeBytes, encodeBytes } from "./file-storage.mjs";
import { maxFileBytes, maxTextBytes } from "./upload-limits.js";
import { rfiApi, indexRfiDocument } from "./rfi-data.mjs";

const requireEngineer = session => { if (session.role !== "engineer") throw new HttpError(403, "Only the assigned Project Engineer can manage files and monitoring."); };
const textField = (body, key, max = 200, fallback = "") => { const value = body[key] ?? fallback; if (typeof value !== "string" || value.length > max) throw new HttpError(400, `Check the ${key} field.`); return value.trim(); };
const checkIds = (ids, sources) => Array.isArray(ids) && new Set(ids).size === ids.length && ids.every(id => sources.some(p => p.id === id));

export async function saveAnswer(env, session, question, result) {
  const id = uid();
  await execute(env.DB, "INSERT INTO records(id,project_id,owner_id,owner_role,question,result,created_at) VALUES(?,?,?,?,?,?,?)", id, session.projectId, session.id, session.role, question, JSON.stringify(result), now());
  return { ...result, recordId: id };
}

export async function projectApi(path, method, body, env, session) {
  const db = env.DB, project = session.projectId;
  if (path.startsWith("/api/rfi-")) return rfiApi(path, method, body, env, session);
  if (path === "/api/history" && method === "GET") {
    const records = await rows(db, "SELECT * FROM records WHERE project_id=? AND (owner_id=? OR shared=1) ORDER BY created_at DESC LIMIT 100", project, session.id);
    const reviews = await rows(db, "SELECT r.* FROM reviews r JOIN records a ON a.id=r.record_id WHERE a.project_id=? AND (a.owner_id=? OR a.shared=1) ORDER BY r.created_at", project, session.id);
    return { records: records.map(r => ({ ...r, result: { ...JSON.parse(r.result), recordId: r.id }, reviews: reviews.filter(v => v.record_id === r.id) })) };
  }
  if (path === "/api/review" && method === "POST") {
    const record = await loadRecord(env, session, body.recordId);
    if (!roles[session.role].decisions.includes(body.decision)) throw new HttpError(403, "Choose an allowed review decision for your role.");
    const sources = record.result.sources || [];
    if (!checkIds(body.checkedPassageIds, sources)) throw new HttpError(400, "Select only this answer's cited passages.");
    if (["checked", "ready-for-rfi"].includes(body.decision) && (!sources.length || sources.some(p => !body.checkedPassageIds.includes(p.id)))) throw new HttpError(400, "Check every cited passage before making this decision.");
    const note = textField(body, "note", 1000);
    if (!note && !["checked"].includes(body.decision)) throw new HttpError(400, "Add a short note explaining your decision.");
    const id = uid(), at = now();
    const statements = [db.prepare("INSERT INTO reviews(id,record_id,project_id,actor_id,role,decision,note,checked_ids,created_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(id, record.id, project, session.id, session.role, body.decision, note, JSON.stringify(body.checkedPassageIds), at)];
    if (body.share === true || body.decision === "flag-review") statements.push(db.prepare("UPDATE records SET shared=1 WHERE id=? AND owner_id=? AND project_id=?").bind(record.id, session.id, project));
    await db.batch(statements);
    return { id, role: session.role, reviewerId: session.id, decision: body.decision, note, checkedPassageIds: body.checkedPassageIds, reviewedAt: at };
  }
  if (path === "/api/files" && method === "GET") return { files: await rows(db, "SELECT f.id,f.title,f.current_version,v.id AS version_id,v.number,v.filename,v.revision,v.dated,v.area,v.approval,v.kind,v.hash,v.state,v.error,v.created_at,d.rfi_number,d.disposition,d.replaced_by FROM files f JOIN versions v ON v.file_id=f.id LEFT JOIN rfi_documents d ON d.version_id=v.id AND d.project_id=f.project_id WHERE f.project_id=? ORDER BY f.created_at DESC,v.number DESC", project) };
  if (path === "/api/upload-check" && method === "POST") {
    requireEngineer(session);
    const hash = textField(body, "hash", 64);
    return { duplicates: await rows(db, "SELECT v.id,v.file_id,v.number,v.filename,v.revision,f.title FROM versions v JOIN files f ON f.id=v.file_id WHERE v.project_id=? AND v.hash=?", project, hash), candidates: await rows(db, "SELECT DISTINCT f.id,f.title FROM files f JOIN versions v ON v.file_id=f.id WHERE f.project_id=? AND lower(v.filename)=lower(?)", project, textField(body, "filename")) };
  }
  if (path === "/api/upload" && method === "POST") {
    requireEngineer(session);
    const filename = textField(body, "filename"), title = textField(body, "title") || filename;
    if (!/\.(pdf|docx|txt|md|csv|json|xlsx|xlsm)$/i.test(filename)) throw new HttpError(400, "Upload PDF, DOCX, TXT, MD, CSV, JSON, XLSX or XLSM.");
    const text = textField(body, "text", maxTextBytes);
    if (text.length < 10) throw new HttpError(400, "No searchable text was extracted. Scanned images need OCR before uploading.");
    if (new TextEncoder().encode(text).byteLength > maxTextBytes) throw new HttpError(413, "The searchable text exceeds 1.5 MB. Split the document into smaller sections.");
    let raw;
    if (body.file instanceof File) {
      if (body.file.size > maxFileBytes) throw new HttpError(413, "Use a file no larger than 10 MB.");
      raw = new Uint8Array(await body.file.arrayBuffer());
    } else {
      if (typeof body.original !== "string" || body.original.length > 1400000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(body.original)) throw new HttpError(400, "Choose the file again using the current upload page.");
      try { raw = decodeBytes(body.original); } catch { throw new HttpError(400, "The original file could not be read."); }
    }
    if (!raw.length || raw.length > maxFileBytes) throw new HttpError(413, "Use a file no larger than 10 MB.");
    const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", raw))].map(v => v.toString(16).padStart(2, "0")).join("");
    const duplicate = await one(db, "SELECT id FROM versions WHERE project_id=? AND hash=? LIMIT 1", project, hash);
    if (duplicate && body.keepDuplicate !== true) throw new HttpError(409, "This exact file is already uploaded. Confirm Keep both to create another version.");
    let fileId = body.fileId, newFile = false;
    if (fileId) { if (!await one(db, "SELECT id FROM files WHERE id=? AND project_id=?", fileId, project)) throw new HttpError(404, "Choose a file in this project."); }
    else { fileId = uid(); newFile = true; }
    const id = uid(), at = now();
    const meta = { revision: textField(body, "revision"), dated: textField(body, "dated", 40), area: textField(body, "area"), approval: textField(body, "approval", 80, "Not verified"), kind: textField(body, "kind", 80, "Project document") };
    const chunks = text.match(/[\s\S]{1,2400}/g).map((value, position) => ({ id: `${id}-P${position + 1}`, position, text: value }));
    const commands = [];
    if (newFile) commands.push(db.prepare("INSERT INTO files(id,project_id,title,created_by,created_at) VALUES(?,?,?,?,?)").bind(fileId, project, title, session.id, at));
    commands.push(db.prepare("INSERT INTO versions(id,project_id,file_id,number,filename,revision,dated,area,approval,kind,hash,text,state,created_by,created_at) SELECT ?,?,?,COALESCE(MAX(number),0)+1,?,?,?,?,?,?,?,?,?,?,? FROM versions WHERE file_id=?").bind(id, project, fileId, filename, meta.revision, meta.dated, meta.area, meta.approval, meta.kind, hash, text, "ready", session.id, at, fileId));
    for (let start = 0; start < chunks.length; start += 100) commands.push(db.prepare("INSERT INTO chunks(id,project_id,version_id,file_id,position,text) SELECT json_extract(value,'$.id'),?,?,?,json_extract(value,'$.position'),json_extract(value,'$.text') FROM json_each(?)").bind(project, id, fileId, JSON.stringify(chunks.slice(start, start + 100))));
    commands.push(...originalStatements(db, id, raw));
    commands.push(db.prepare("INSERT INTO file_events(project_id,version_id,reason,created_at) VALUES(?,?,?,?)").bind(project, id, "ready", at));
    if (newFile || body.makeCurrent === true) {
      commands.push(db.prepare("UPDATE files SET current_version=? WHERE id=? AND project_id=?").bind(id, fileId, project));
      commands.push(db.prepare("INSERT INTO activations(event_seq,project_id,file_id,version_id) SELECT seq,?,?,? FROM file_events WHERE version_id=? ORDER BY seq DESC LIMIT 1").bind(project, fileId, id, id));
    }
    await db.batch(commands);
    await indexRfiDocument(db, session, { id, filename, text });
    await enqueueEvents(env, project);
    return { version: await getVersion(env, session, id), state: "ready" };
  }
  if (path === "/api/version" && method === "POST") {
    const version = await getVersion(env, session, body.versionId);
    return { version: { ...version, text: undefined }, passages: versionPassages(version, await rows(db, "SELECT * FROM chunks WHERE version_id=? ORDER BY position", version.id)) };
  }
  if (path === "/api/original" && method === "POST") {
    const version = await getVersion(env, session, body.versionId);
    const size = await one(db, "SELECT SUM(length(data)*3/4) AS bytes FROM originals WHERE version_id=?", version.id);
    if (size.bytes > 1048578) throw new HttpError(413, "Download this file through the current file viewer.");
    const parts = (await rows(db, "SELECT data FROM originals WHERE version_id=? ORDER BY part", version.id)).map(p => decodeBytes(p.data));
    const bytes = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
    let offset = 0; for (const part of parts) { bytes.set(part, offset); offset += part.length; }
    return { filename: version.filename, original: encodeBytes(bytes) };
  }
  if (path === "/api/current-version" && method === "POST") {
    requireEngineer(session);
    const v = await getVersion(env, session, body.versionId);
    if (v.disposition === "void") throw new HttpError(400, "A VOID RFI cannot become the current search version. Open its replacement or retain it as history.");
    if (v.state !== "ready" || body.confirm !== true) throw new HttpError(400, "Confirm which searchable version should be current.");
    await db.batch([
      db.prepare("UPDATE files SET current_version=? WHERE id=? AND project_id=?").bind(v.id, v.file_id, project),
      db.prepare("INSERT INTO file_events(project_id,version_id,reason,created_at) VALUES(?,?,?,?)").bind(project, v.id, "current-version", now()),
      db.prepare("INSERT INTO activations(event_seq,project_id,file_id,version_id) SELECT seq,?,?,? FROM file_events WHERE project_id=? AND version_id=? ORDER BY seq DESC LIMIT 1").bind(project, v.file_id, v.id, project, v.id),
    ]);
    await enqueueEvents(env, project);
    return { saved: true };
  }
  if (path === "/api/monitor" && method === "POST") {
    requireEngineer(session);
    const record = await loadRecord(env, session, body.recordId);
    if (record.owner_id !== session.id) throw new HttpError(403, "You can monitor your own saved questions.");
    const state = body.state || "active";
    if (!["active", "paused", "archived"].includes(state)) throw new HttpError(400, "Choose an available monitoring state.");
    const existing = await one(db, "SELECT * FROM monitors WHERE record_id=?", record.id);
    if (state === "active" && existing?.state !== "active" && (await one(db, "SELECT COUNT(*) AS n FROM monitors WHERE owner_id=? AND state='active'", session.id)).n >= 10) throw new HttpError(400, "Pause an item before monitoring more than ten questions.");
    const cursor = (await one(db, "SELECT COALESCE(MAX(seq),0) AS seq FROM file_events WHERE project_id=?", project)).seq;
    const nextCheck = new Date(Math.ceil((Date.now() + 1) / 300000) * 300000).toISOString();
    if (existing) await execute(db, "UPDATE monitors SET state=?,next_check=? WHERE id=? AND owner_id=?", state, nextCheck, existing.id, session.id);
    else {
      await execute(db, "INSERT INTO monitors(id,project_id,owner_id,record_id,state,cursor,next_check,created_at) VALUES(?,?,?,?,?,?,?,?)", uid(), project, session.id, record.id, state, cursor, nextCheck, now());
    }
    return { saved: true, state };
  }
  if (path === "/api/monitoring" && method === "GET") {
    const monitors = await rows(db, "SELECT m.*,a.question,a.shared FROM monitors m JOIN records a ON a.id=m.record_id WHERE m.project_id=? AND (m.owner_id=? OR a.shared=1) ORDER BY m.created_at DESC", project, session.id);
    const updates = await rows(db, "SELECT u.*,a.question FROM updates u JOIN records a ON a.id=u.record_id WHERE u.project_id=? AND (u.owner_id=? OR a.shared=1) ORDER BY u.created_at DESC LIMIT 100", project, session.id);
    const reviews = await rows(db, "SELECT ur.* FROM update_reviews ur JOIN updates u ON u.id=ur.update_id JOIN records a ON a.id=u.record_id WHERE a.project_id=? AND (a.owner_id=? OR a.shared=1) ORDER BY ur.created_at", project, session.id);
    const runs = await rows(db, "SELECT r.* FROM runs r JOIN monitors m ON m.id=r.monitor_id JOIN records a ON a.id=m.record_id WHERE r.project_id=? AND (m.owner_id=? OR a.shared=1) ORDER BY COALESCE(r.completed_at,r.started_at,r.available_at) DESC LIMIT 30", project, session.id);
    return { monitors, updates: updates.map(u => ({ ...u, evidence: JSON.parse(u.evidence), oldEvidence: JSON.parse(u.old_evidence), reviews: reviews.filter(r => r.update_id === u.id) })), runs: runs.map(r => ({ ...r, activity: JSON.parse(r.activity), result: r.result ? JSON.parse(r.result) : null })) };
  }
  if (path === "/api/update-review" && method === "POST") {
    const update = await one(db, "SELECT * FROM updates WHERE id=? AND project_id=?", body.updateId, project);
    if (!update) throw new HttpError(404, "This update was not found.");
    await loadRecord(env, session, update.record_id);
    if (!["engineer", "manager"].includes(session.role) || !["affects-item", "not-applicable", "still-missing"].includes(body.decision)) throw new HttpError(403, "Select an allowed update review decision.");
    const note = textField(body, "note", 1000);
    if (!note) throw new HttpError(400, "Add a short explanation for the review.");
    await execute(db, "INSERT INTO update_reviews(id,update_id,project_id,actor_id,role,decision,note,created_at) VALUES(?,?,?,?,?,?,?,?)", uid(), update.id, project, session.id, session.role, body.decision, note, now());
    return { saved: true };
  }
  if (path === "/api/retry" && method === "POST") {
    requireEngineer(session);
    await execute(db, "UPDATE runs SET status='queued',attempts=0,available_at=?,error=NULL WHERE id=? AND status='failed' AND monitor_id IN (SELECT id FROM monitors WHERE owner_id=? AND project_id=? AND state='active')", now(), body.runId, session.id, project);
    return { queued: true };
  }
  throw new HttpError(404, "This page was not found.");
}
