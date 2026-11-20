import { getAuthToken } from "./firebase-client.js";
import { element, request, setTokenProvider, sourceLink } from "./shared.js";
setTokenProvider(getAuthToken);
const byId = id => document.getElementById(id);
const post = (path, body) => request(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
let offset = 0;
const error = e => { byId("log-error").textContent = e.message; byId("log-error").hidden = false; };
async function list() {
  const data = await post("/api/rfi-log", { query: byId("log-query").value, offset });
  const target = byId("log-entries"); target.replaceChildren();
  byId("log-count").textContent = `${data.total} matching register ${data.total === 1 ? "entry" : "entries"}${data.entries.length ? ` · ${offset+1}–${offset+data.entries.length}` : ""}`;
  for (const row of data.entries) {
    const b = element("button", "register-row", `RFI ${row.rfi_number} · ${row.title}`); b.type = "button";
    b.append(element("span", "source-meta", `${row.status} · ${row.has_document ? "PDF supplied" : "File missing · upload needed"}`));
    b.addEventListener("click", () => detail(row.rfi_number).catch(error)); target.append(b);
  }
  byId("log-prev").disabled = offset === 0; byId("log-next").disabled = offset + data.pageSize >= data.total;
}
async function detail(number) {
  const data = await post("/api/rfi-entry", { number });
  byId("log-detail").hidden = false; byId("log-title").textContent = `RFI ${data.number} · ${data.title}`;
  byId("log-status").textContent = data.status;
  byId("log-availability").className = data.missingDocument ? "answer-state warning" : "answer-state evidence";
  byId("log-availability").textContent = data.missingDocument ? "File missing · upload needed. The register entry is available, but the RFI PDF has not been supplied." : "The RFI PDF is supplied. Check its original question, dated reply and version status.";
  const docs = byId("log-documents"); docs.replaceChildren();
  for (const d of data.documents) {
    const a = element("a", "secondary-button", `${d.disposition === "void" ? "VOID · " : ""}RFI ${d.rfi_number} · ${d.revision || `V${d.number}`}`); a.href = `files.html?version=${encodeURIComponent(d.id)}`; docs.append(a);
    if (d.replaced_by) { const a = element("a", "passage-link", `Replaced by RFI ${d.replaced_by}`); a.href = `?rfi=${encodeURIComponent(d.replaced_by)}`; docs.append(a); }
  }
  const fields = byId("log-fields"); fields.replaceChildren();
  for (const [key,value] of Object.entries(data.metadata)) if (value !== null && value !== "") fields.append(element("dt", "", key),element("dd", "", String(value)));
  if(data.registerEntries?.length>1) {
    fields.replaceChildren();
    byId("log-availability").append(document.createTextNode(" Multiple register entries use this RFI number; check each row."));
    for(const row of data.registerEntries) { fields.append(element("dt","",`Register row ${row.row}`),element("dd","",row.status)); for(const [k,v]of Object.entries(row.metadata))if(v!==null&&v!=="")fields.append(element("dt","",k),element("dd","",String(v))); }
  }
  const src = byId("log-source"); src.replaceChildren(); if (data.logSource) src.append(element("p", "source-meta", data.logSource.location), sourceLink(data.logSource));
  const refs = byId("log-references"); refs.replaceChildren();
  for (const ref of data.referencedBy) { const a = element("a", "passage-link", `RFI ${ref.from_number || "record"} · page ${ref.page} · ${ref.reason}`); a.href = `files.html?version=${encodeURIComponent(ref.source_version_id)}&page=${ref.page}`; refs.append(a); }
  byId("log-references-section").hidden = !data.referencedBy.length;
  history.replaceState(null,"",`?rfi=${encodeURIComponent(data.number)}`); byId("log-detail").scrollIntoView({block:"start",behavior:"smooth"});
}
byId("log-search").addEventListener("submit", e => { e.preventDefault();offset=0;list().catch(error); });
byId("log-prev").addEventListener("click", () => { offset=Math.max(0,offset-40);list().catch(error); });
byId("log-next").addEventListener("click", () => { offset+=40;list().catch(error); });
try { const user=await request("/api/session"); byId("log-account").textContent=`${user.projectName} · ${user.label}`; await list(); const n=new URL(location.href).searchParams.get("rfi"); if(n) await detail(n); }
catch(e) { error(e); }
