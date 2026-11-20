import { HttpError } from "./rfi.mjs";

const all = async (db, sql, ...args) => (await db.prepare(sql).bind(...args).all()).results;
const first = (db, sql, ...args) => db.prepare(sql).bind(...args).first();
export const isRfiProject = context => context.datasetId?.startsWith("demo4-");
export function rfiNumber(value) {
  const match = /^(?:RFI[\s#:-]*)?(\d{1,5})(?:([.-])(\d{1,3}))?$/i.exec(String(value ?? "").trim());
  return match ? String(Number(match[1])) + (match[3] === undefined ? "" : match[2] + match[3]) : null;
}
export function requestedRfis(question) {
  const result = [];
  const text = question.normalize("NFKC");
  const number = "\\d{1,5}(?:[.-]\\d{1,3})?";
  const list = `${number}(?:\\s*(?:and|versus|vs\\.?|[,+&]|\\u548c|\\u4e0e)\\s*(?:RFI[\\s#:-]*)?${number})*`;
  for (const m of text.matchAll(new RegExp(`\\bRFI[\\s#:-]*(${list})`, "gi"))) {
    for (const n of m[1].matchAll(new RegExp(number, "g"))) result.push(rfiNumber(n[0]));
  }
  if (!result.length && new RegExp(`^\\s*(?:${list})\\s*$`, "i").test(text)) {
    for (const n of text.matchAll(new RegExp(number, "g"))) result.push(rfiNumber(n[0]));
  }
  return [...new Set(result.filter(Boolean))].slice(0,4);
}
export async function decorateRfiVersion(db, version) {
  const meta = await first(db, "SELECT rfi_number,disposition,replaced_by,change_log FROM rfi_documents WHERE version_id=? AND project_id=?", version.id, version.project_id);
  return meta ? { ...version, ...meta } : version;
}
export function logPassage(entry) {
  return { id: `${entry.log_version_id}-RFI-${entry.rfi_number}-R${entry.row_number}`, sourceId: entry.log_version_id, documentId: entry.log_version_id, versionId: entry.log_version_id,
    versionNumber: entry.log_version_number || 1, rfiNumber: entry.rfi_number, sourceType: "rfi_log_entry", title: `RFI ${entry.rfi_number} · register entry`, publisher: "Project RFI register",
    location: `Register row ${entry.row_number}`, topic: `RFI ${entry.rfi_number} ${entry.title}`, evidenceClass: "RFI register", limits: "Register metadata only; not the RFI's technical answer.",
    text: JSON.stringify({ rfiNumber: entry.rfi_number, ...JSON.parse(entry.metadata) }, null, 2), url: "", rowNumber: entry.row_number };
}
const documentSql = "SELECT v.*,f.title,f.current_version,d.rfi_number,d.disposition,d.replaced_by,d.change_log FROM rfi_documents d JOIN versions v ON v.id=d.version_id JOIN files f ON f.id=v.file_id WHERE d.project_id=? AND v.project_id=d.project_id";
export async function rfiEntry(env, session, number) {
  const num = rfiNumber(number); if (!num) throw new HttpError(400, "Enter a valid RFI number.");
  const entries = await all(env.DB, "SELECT r.*,v.number AS log_version_number FROM rfi_register r JOIN versions v ON v.id=r.log_version_id WHERE r.project_id=? AND r.rfi_number=? ORDER BY r.row_number", session.projectId, num);
  const entry = entries[0];
  const docs = await all(env.DB, documentSql + " AND d.rfi_number=? ORDER BY v.number DESC", session.projectId, num);
  const references = await all(env.DB, "SELECT l.*,v.filename,d.rfi_number AS from_number FROM rfi_links l JOIN versions v ON v.id=l.source_version_id LEFT JOIN rfi_documents d ON d.version_id=v.id WHERE l.project_id=? AND l.target_number=?", session.projectId, num);
  if (!entry && !docs.length && !references.length) throw new HttpError(404, `RFI ${num} is not in this project's supplied register or documents.`);
  return { number: num, title: entry?.title || docs[0]?.title || `RFI ${num}`, status: entry?.status || "Not recorded in supplied register", metadata: entry ? JSON.parse(entry.metadata) : {},
    logSource: entry ? logPassage(entry) : null, registerEntries: entries.map(e=>({row:e.row_number,status:e.status,metadata:JSON.parse(e.metadata)})), missingDocument: !docs.length, documents: docs.map(({ text, hash, ...d }) => d), referencedBy: references };
}
export async function relatedRfis(env, session, versionIds) {
  if (!versionIds.length) return [];
  const refs = await all(env.DB, "SELECT l.*,d.rfi_number AS from_number FROM rfi_links l JOIN rfi_documents d ON d.version_id=l.source_version_id WHERE l.project_id=? AND l.source_version_id IN (SELECT value FROM json_each(?)) ORDER BY l.target_number", session.projectId, JSON.stringify(versionIds));
  if(!refs.length)return [];
  const targets=JSON.stringify([...new Set(refs.map(r=>r.target_number))]);
  const entries=await all(env.DB,"SELECT r.*,v.number AS log_version_number FROM rfi_register r JOIN versions v ON v.id=r.log_version_id WHERE r.project_id=? AND r.rfi_number IN (SELECT value FROM json_each(?)) ORDER BY r.row_number",session.projectId,targets);
  const documents=await all(env.DB,"SELECT d.rfi_number,d.version_id,v.revision,d.disposition,v.filename FROM rfi_documents d JOIN versions v ON v.id=d.version_id WHERE d.project_id=? AND d.rfi_number IN (SELECT value FROM json_each(?))",session.projectId,targets);
  const result = [];
  for (const ref of refs) {
    const entry=entries.find(e=>e.rfi_number===ref.target_number),docs=documents.filter(d=>d.rfi_number===ref.target_number);
    result.push({ ...ref, number: ref.target_number, title: entry?.title||docs[0]?.filename||`RFI ${ref.target_number}`, status: entry?.status||"Not recorded in supplied register", missingDocument: !docs.length,
      documents: docs.map(d => ({ versionId: d.version_id, revision: d.revision, disposition: d.disposition })), logSource: entry?logPassage(entry):null });
  }
  return result;
}
export async function rfiSearchVersions(env, session, question, { versionId, eventSeq } = {}) {
  if (versionId || eventSeq !== undefined) return null;
  const nums = requestedRfis(question);
  if (!nums.length) return null;
  const versions = await all(env.DB, documentSql + " AND d.rfi_number IN (SELECT value FROM json_each(?)) AND v.state='ready'", session.projectId, JSON.stringify(nums));
  const entries = await all(env.DB, "SELECT r.*,v.number AS log_version_number FROM rfi_register r JOIN versions v ON v.id=r.log_version_id WHERE r.project_id=? AND r.rfi_number IN (SELECT value FROM json_each(?))", session.projectId, JSON.stringify(nums));
  return { versions, logPassages: entries.map(logPassage) };
}
export async function rfiQuestionContext(env, session, question, passages) {
  const ids = [...new Set(passages.map(p => p.versionId).filter(Boolean))];
  const related = await relatedRfis(env, session, ids);
  const requested = [];
  for (const n of requestedRfis(question)) {
    try { requested.push(await rfiEntry(env, session, n)); }
    catch (e) { if (e.status !== 404) throw e; }
  }
  const compact = text => text.replace(/\s+/g," ").trim();
  return { related, requested: requested.map(({ documents, ...entry }) => ({ ...entry, documentVersions: documents.map(d => ({ id: d.id, rfiNumber: d.rfi_number, disposition: d.disposition, replacedBy: d.replaced_by,
    keyChanges: JSON.parse(d.change_log || "[]").flatMap(change => {
      const source = passages.find(p => p.versionId === change.sourceVersionId && compact(p.text).includes(compact(change.quote || "")));
      return source && change.quote ? [{ summary: change.summary, passageId: source.id, quote: change.quote }] : [];
    }),
  })) })) };
}
export async function rfiApi(path, method, body, env, session) {
  if (method !== "POST") throw new HttpError(405, "Use POST for RFI register requests.");
  if (path === "/api/rfi-entry") return rfiEntry(env, session, body.number);
  if (path === "/api/rfi-log") {
    const query = String(body.query || "").slice(0, 200).trim();
    const offset = Number.isInteger(body.offset) && body.offset >= 0 ? body.offset : 0;
    const num = rfiNumber(query);
    const filter = num ? "r.rfi_number=?" : "(r.rfi_number LIKE ? OR r.title LIKE ?)";
    const args = num ? [num] : [`%${query}%`, `%${query}%`];
    const total = await first(env.DB, `SELECT COUNT(*) AS n FROM rfi_register r WHERE r.project_id=? AND ${filter}`, session.projectId, ...args);
    const entries = await all(env.DB, `SELECT r.rfi_number,r.title,r.status,r.row_number,r.log_version_id,EXISTS(SELECT 1 FROM rfi_documents d WHERE d.project_id=r.project_id AND d.rfi_number=r.rfi_number) AS has_document FROM rfi_register r WHERE r.project_id=? AND ${filter} ORDER BY CAST(r.rfi_number AS REAL) LIMIT 40 OFFSET ?`, session.projectId, ...args, offset);
    return { entries, total: total.n, offset, pageSize: 40 };
  }
  if (path === "/api/rfi-context") {
    const v = await first(env.DB, documentSql + " AND v.id=?", session.projectId, body.versionId);
    if (!v) return { rfi: null, related: [], changes: [] };
    return { rfi: { number: v.rfi_number, disposition: v.disposition, replacedBy: v.replaced_by }, related: await relatedRfis(env, session, [v.id]), changes: JSON.parse(v.change_log) };
  }
  throw new HttpError(404, "This RFI page was not found.");
}
export async function indexRfiDocument(db, session, version, changes = []) {
  const match = /^RFI\s*[-#]?\s*(\d{1,5}(?:[.-]\d{1,3})?)/i.exec(version.filename);
  if (!match) return;
  const num = rfiNumber(match[1]);
  const firstPage = version.text.split("[PDF page 2]")[0];
  const voided = /\bVOID\b/i.test(version.filename) || /RFI\s+VOID/i.test(firstPage);
  const replacement = voided ? /(?:refer\s+to|replaced\s+by|superseded\s+by)\s*RFI[-\s]*(\d{1,5}(?:\.\d{1,3})?)/i.exec(firstPage)?.[1] : "";
  if(!changes.length) {
    const current=await first(db,"SELECT file_id,number FROM versions WHERE id=? AND project_id=?",version.id,session.projectId);
    const previous=current?await first(db,"SELECT id,text FROM versions WHERE file_id=? AND project_id=? AND number<? ORDER BY number DESC LIMIT 1",current.file_id,session.projectId,current.number):null;
    const compact=t=>t.replace(/\s+/g," ").trim(), lines=t=>t.split(/\n+/).map(x=>x.trim()).filter(x=>x.length>=35&&!/^\[PDF page/.test(x));
    if(previous) {
      const old=new Set(lines(previous.text).map(compact)),next=new Set(lines(version.text).map(compact));
      for(const quote of lines(version.text).filter(q=>!old.has(compact(q))).slice(0,3)) {
        const page=Number([...version.text.slice(0,version.text.indexOf(quote)).matchAll(/\[PDF page (\d+)\]/g)].at(-1)?.[1]||1);
        changes.push({summary:"Added or revised source text; check its context.",sourceVersionId:version.id,page,quote});
      }
      const removed=lines(previous.text).find(q=>!next.has(compact(q)));
      if(removed)changes.push({summary:"Earlier text is absent from this extraction; check both originals.",sourceVersionId:previous.id,page:Number([...previous.text.slice(0,previous.text.indexOf(removed)).matchAll(/\[PDF page (\d+)\]/g)].at(-1)?.[1]||1),quote:removed});
    } else if(replacement) changes.push({summary:`VOID record explicitly refers to RFI ${rfiNumber(replacement)}.`,sourceVersionId:version.id,page:1,quote:firstPage.match(/RFI\s+VOID[\s\S]{0,80}?RFI[-\s]*\d+(?:\.\d+)?/i)?.[0]||`Refer to RFI-${replacement}`});
  }
  await db.prepare("INSERT INTO rfi_documents(version_id,project_id,rfi_number,disposition,replaced_by,change_log) VALUES(?,?,?,?,?,?) ON CONFLICT(version_id) DO UPDATE SET disposition=excluded.disposition,replaced_by=excluded.replaced_by,change_log=excluded.change_log").bind(version.id, session.projectId, num, voided ? "void" : /response/i.test(version.filename) ? "response" : "record", rfiNumber(replacement) || "", JSON.stringify(changes)).run();
  const seen = new Set();
  for (const m of version.text.matchAll(/\bRFI[-\s]*(\d{1,5}(?:[.-]\d{1,3})?)/gi)) {
    const target = rfiNumber(m[1]); if (target === num || seen.has(target)) continue; seen.add(target);
    const page = Number([...version.text.slice(0, m.index).matchAll(/\[PDF page (\d+)\]/g)].at(-1)?.[1] || 1);
    const reason = version.text.slice(Math.max(0,m.index-70),m.index+m[0].length+100).replace(/\[PDF page \d+\]/g, "").replace(/\s+/g, " ").trim();
    await db.prepare("INSERT OR REPLACE INTO rfi_links(source_version_id,project_id,target_number,relation,reason,page) VALUES(?,?,?,?,?,?)").bind(version.id,session.projectId,target,target === rfiNumber(replacement) ? "replaced-by" : "explicit-reference",reason,page).run();
  }
}
