import { dataset, HttpError } from "./rfi.mjs";
import { decorateRfiVersion, rfiSearchVersions, isRfiProject } from "./rfi-data.mjs";
import { evidenceTitle } from "./answer-state.js";

export const now = () => new Date().toISOString();
export const uid = () => crypto.randomUUID();
export const rows = async (db, sql, ...args) => (await db.prepare(sql).bind(...args).all()).results;
export const one = (db, sql, ...args) => db.prepare(sql).bind(...args).first();
export const execute = (db, sql, ...args) => db.prepare(sql).bind(...args).run();

export async function projectContext(env, session) {
  const context = env.DB ? await one(env.DB, "SELECT p.name,c.* FROM projects p LEFT JOIN project_corpora c ON c.project_id=p.id WHERE p.id=?", session.projectId) : null;
  return { projectName: context?.name || "Ocean Pavilion study project", sourceMode: context?.source_mode || "public-and-uploads", datasetId: context?.dataset_id || dataset.id, datasetVersion: context?.dataset_version || dataset.version, notice: context?.notice || dataset.scopeNotice, organization: context?.organization || "Concrete Subcontractor" };
}

export async function authorizeProject(env, session) {
  if (!env.DB) throw new HttpError(503, "Project storage is not configured.");
  const db = env.DB;
  const project = session.projectId;
  if (!session.assignedProject) {
    await db.batch([
      db.prepare("INSERT OR IGNORE INTO projects(id,name,created_at) VALUES(?,?,?)").bind(project, "Ocean Pavilion study project", now()),
      db.prepare("INSERT OR IGNORE INTO members(project_id,user_id,role) VALUES(?,?,?)").bind(project, session.id, session.role),
    ]);
  }
  const member = await one(db, "SELECT role,active FROM members WHERE project_id=? AND user_id=?", project, session.id);
  if (!member?.active || member.role !== session.role) throw new HttpError(403, "Your account does not have an active assignment to this project. Contact your team.");
  return { ...session, ...await projectContext(env, session) };
}

export function versionPassages(version, chunks) {
  return chunks.map(chunk => {
    const markers = /\.pdf$/i.test(version.filename) ? [...version.text.matchAll(/\[PDF page (\d+)\]/g)] : [];
    const start = chunk.position * 2400;
    const firstPage = markers.filter(m => m.index <= start).at(-1)?.[1] || (markers.length ? "1" : null);
    const lastPage = markers.filter(m => m.index < start + chunk.text.length).at(-1)?.[1] || firstPage;
    const page = firstPage && (firstPage === lastPage ? firstPage : `${firstPage}–${lastPage}`);
    return ({
    id: chunk.id, sourceId: version.file_id, documentId: version.file_id, versionId: version.id,
    versionNumber: version.number, revision: version.revision, publishedOn: version.dated,
    ...(version.rfi_number ? { rfiNumber: version.rfi_number, rfiDisposition: version.disposition, replacedBy: version.replaced_by } : {}),
    sourceType: "uploaded_project_document", title: evidenceTitle(version), filename: version.filename, publisher: "Project upload",
    location: `V${version.number} · ${version.revision || "No revision label"}${page ? ` · PDF page ${page}` : ""} · passage ${chunk.position + 1}`,
    evidenceClass: version.kind, limits: `User-labelled ${version.kind}; approval label: ${version.approval}. Verify applicability and approval with the project team.`,
    area: version.area, approval: version.approval, topic: `${evidenceTitle(version)} ${version.area}`, text: chunk.text, url: "",
  }); });
}

export async function getVersion(env, session, id) {
  const version = await one(env.DB, "SELECT v.*,f.title,f.current_version FROM versions v JOIN files f ON f.id=v.file_id WHERE v.id=? AND v.project_id=?", id, session.projectId);
  if (!version) throw new HttpError(404, "This file version is not available in your project.");
  return decorateRfiVersion(env.DB, version);
}

export function searchExpression(query) {
  const tokens = [...new Set((query.toLowerCase().match(/[a-z0-9]+/g) || []).filter(t => t.length > 2 && !new Set(["what","which","according","does","this","that","the","and","for","from","with","project","documents","supplied","about","please"]).has(t)))].slice(0, 20);
  return tokens.map(term => `"${term}"*`).join(" OR ");
}

export async function searchProject(env, session, query, { versionId, eventSeq } = {}) {
  if (!env.DB) return dataset.documents;
  const context = await projectContext(env, session);
  const base = context.sourceMode === "uploads-only" ? [] : dataset.documents;
  const rfiSelection = isRfiProject(context) ? await rfiSearchVersions(env, session, query, { versionId, eventSeq }) : null;
  if (rfiSelection) {
    const chunks = rfiSelection.versions.length ? await rows(env.DB, "SELECT * FROM chunks WHERE project_id=? AND version_id IN (SELECT value FROM json_each(?)) ORDER BY version_id,position", session.projectId, JSON.stringify(rfiSelection.versions.map(v => v.id))) : [];
    return [...rfiSelection.versions.flatMap(v => versionPassages(v, chunks.filter(c => c.version_id === v.id)).map((p,i)=>({...p,rfiPrimary:i<2}))), ...rfiSelection.logPassages];
  }
  let versions;
  if (versionId) versions = [await getVersion(env, session, versionId)];
  else if (eventSeq !== undefined) versions = await rows(env.DB, "SELECT v.*,f.title FROM versions v JOIN files f ON f.id=v.file_id JOIN activations a ON a.version_id=v.id WHERE a.project_id=? AND a.event_seq=(SELECT MAX(a2.event_seq) FROM activations a2 WHERE a2.file_id=a.file_id AND a2.event_seq<=?) AND v.state='ready'", session.projectId, eventSeq);
  else versions = await rows(env.DB, "SELECT v.*,f.title FROM files f JOIN versions v ON v.id=f.current_version WHERE f.project_id=? AND v.state='ready'", session.projectId);
  const expression = searchExpression(query);
  if (!expression || !versions.length) return versionId ? [] : base;
  const matching = await rows(env.DB, "SELECT c.* FROM chunk_search s JOIN chunks c ON c.id=s.id WHERE chunk_search MATCH ? AND c.project_id=? AND c.version_id IN (SELECT value FROM json_each(?)) ORDER BY bm25(chunk_search) LIMIT 96", expression, session.projectId, JSON.stringify(versions.map(v => v.id)));
  if (isRfiProject(context)) {
    const metadata=await rows(env.DB,"SELECT version_id,rfi_number,disposition,replaced_by FROM rfi_documents WHERE project_id=? AND version_id IN (SELECT value FROM json_each(?))",session.projectId,JSON.stringify(versions.map(v=>v.id)));
    versions=versions.map(v=>({...v,...metadata.find(m=>m.version_id===v.id)}));
  }
  const allowed = new Map(versions.map(v => [v.id, v]));
  const uploaded = matching.filter(c => allowed.has(c.version_id)).flatMap(chunk => versionPassages(allowed.get(chunk.version_id), [chunk]));
  return versionId ? uploaded : [...base, ...uploaded];
}

export async function loadRecord(env, session, id) {
  const record = await one(env.DB, "SELECT * FROM records WHERE id=? AND project_id=? AND (owner_id=? OR shared=1)", id, session.projectId, session.id);
  if (!record) throw new HttpError(404, "This record is not available to your account.");
  return { ...record, result: JSON.parse(record.result), reviews: await rows(env.DB, "SELECT * FROM reviews WHERE record_id=? AND project_id=? ORDER BY created_at", id, session.projectId) };
}

export async function enqueueEvents(env, projectId) {
  await execute(env.DB, "INSERT OR IGNORE INTO runs(id,monitor_id,project_id,event_seq,event_key,trigger,status,available_at) SELECT m.id||'-'||e.seq,m.id,m.project_id,e.seq,'version-'||e.seq,'file-ready','queued',? FROM monitors m JOIN file_events e ON e.project_id=m.project_id AND e.seq>m.cursor WHERE m.state='active' AND (? IS NULL OR m.project_id=?)", now(), projectId || null, projectId || null);
}
