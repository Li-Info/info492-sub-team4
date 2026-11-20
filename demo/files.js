import { getAuthToken } from "./firebase-client.js";
import { element, request, setTokenProvider } from "./shared.js";
import { extractFile } from "./file-parser.js";
import { logLink, renderRelated, renderChanges } from "./rfi-ui.js";
import { evidenceTitle } from "./answer-state.js";
setTokenProvider(getAuthToken);
const post = (path, body) => request(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
let user, files = [], pending, selected;
let originalPreviewUrl;
const byId = id => document.getElementById(id);
const showError = error => { byId("file-error").textContent = error.message; byId("file-error").hidden = false; };
byId("choose-file").addEventListener("click", () => byId("upload-file").click());
async function refresh() {
  files = (await request("/api/files")).files;
  const target = byId("file-list"); target.replaceChildren();
  for (const id of [...new Set(files.map(f => f.id))]) {
    const versions = files.filter(f => f.id === id), card = element("article", "file-card");
    card.append(element("h3", "", evidenceTitle(versions.find(v => v.current_version === v.version_id) || versions[0])));
    for (const v of versions) {
      const button = element("button", "record-item", `${v.disposition === "void" ? "VOID · " : ""}${v.rfi_number ? `RFI ${v.rfi_number} · ` : ""}V${v.number} · ${v.revision || "No formal revision"} · ${v.state === "ready" ? "Ready to search" : v.state}${v.current_version === v.version_id ? " · Current" : ""}`);
      button.append(element("span", "", `${v.kind} · ${v.area || "Area not specified"} · ${v.approval}`));
      button.addEventListener("click", () => showVersion(v.version_id).catch(showError)); card.append(button);
    }
    target.append(card);
  }
  if (!files.length) target.append(element("p", "", "No files uploaded to this project yet. The public source corpus is available separately."));
}
async function showVersion(id) {
  const data = await post("/api/version", { versionId: id }); selected = data;
  const v = data.version;
  if(originalPreviewUrl)URL.revokeObjectURL(originalPreviewUrl);
  originalPreviewUrl=null;byId("original-preview").hidden=true;byId("original-preview").removeAttribute("src");
  byId("preview-original").hidden=!/\.pdf$/i.test(v.filename);byId("preview-original").textContent="View original PDF";
  byId("version-panel").hidden = false;
  byId("version-title").textContent = `${evidenceTitle(v)} · V${v.number}`;
  byId("version-meta").textContent = `${v.kind} · ${v.revision || "No formal revision"} · ${v.dated || "Date not supplied"} · ${v.area || "Area not specified"} · ${v.approval}${v.current_version === id ? " · Current search version" : " · Historical or retained version"}`;
  byId("ask-version").href = `index.html?version=${encodeURIComponent(id)}`;
  byId("set-current").hidden = user.role !== "engineer" || v.current_version === id;
  if (v.disposition === "void") byId("set-current").hidden = true;
  const context = await post("/api/rfi-context", { versionId: id });
  byId("rfi-version-context").hidden = !context.rfi;
  const status=byId("rfi-version-status");status.replaceChildren();
  if (context.rfi) {
    status.append(logLink(context.rfi.number));
    if(context.rfi.disposition === "void") status.append(element("p","answer-state warning",`VOID record${context.rfi.replacedBy ? ` · replaced by RFI ${context.rfi.replacedBy}` : ""}`));
    if(context.rfi.replacedBy) status.append(logLink(context.rfi.replacedBy,`Open replacement RFI ${context.rfi.replacedBy}`));
  }
  renderRelated(byId("rfi-file-relations"),context.related);renderChanges(byId("rfi-change-log"),context.changes);
  const passages = byId("file-passages"); passages.replaceChildren();
  for (const p of data.passages) {
    const article = element("article", "retrieved-passage"); article.id = p.id;
    const content=element("p","passage-content");
    const quote=new URL(location.href).searchParams.get("quote") || "";
    const normalized=p.text.replace(/\s+/g," "), needle=quote.replace(/\s+/g," ").trim(), start=needle ? normalized.indexOf(needle) : -1;
    if(start>=0) content.append(document.createTextNode(normalized.slice(0,start)),element("mark","evidence-highlight",normalized.slice(start,start+needle.length)),document.createTextNode(normalized.slice(start+needle.length)));
    else content.textContent=p.text;
    article.append(element("h4", "", p.location), content); passages.append(article);
  }
  const compare = byId("compare-version"); compare.replaceChildren();
  for (const [value, label] of [["", "Select a version"], ...files.filter(f => f.id === v.file_id && f.version_id !== id).map(f => [f.version_id, `V${f.number} · ${f.revision || "No formal revision"}`])]) { const o = element("option", "", label); o.value = value; compare.append(o); }
  byId("version-difference").replaceChildren();
  const hash = decodeURIComponent(location.hash.slice(1));
  const target = document.getElementById(hash) || passages.querySelector(".evidence-highlight")?.closest("article");
  if (target && passages.contains(target)) { target.classList.add("highlight-passage"); target.scrollIntoView({ block: "center" }); }
  else byId("version-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  history.replaceState(null, "", `?version=${encodeURIComponent(id)}${location.hash}`);
}
byId("upload-file").addEventListener("change", async event => {
  byId("file-error").hidden = true; byId("upload-form").hidden = true; pending = null;
  const file = event.target.files[0]; if (!file) return;
  byId("chosen-filename").textContent = file.name;
  byId("upload-status").textContent = "Reading file and checking for existing versions…";
  try {
    pending = await extractFile(file);
    const check = await post("/api/upload-check", { hash: pending.hash, filename: pending.filename });
    const select = byId("file-association"); select.replaceChildren();
    for (const [value, label] of [["", "Choose a file identity"], ["new", "Create a separate document"], ...[...new Map(files.map(f => [f.id, f.title]))].map(([id, title]) => [id, `New version of: ${title}`])]) { const o = element("option", "", label); o.value = value; select.append(o); }
    select.value = check.duplicates.length || check.candidates.length ? "" : "new";
    byId("file-title").value = file.name.replace(/\.[^.]+$/, "");
    byId("keep-duplicate").checked = false;
    byId("duplicate-label").hidden = !check.duplicates.length;
    byId("duplicate-message").hidden = !(check.duplicates.length || check.candidates.length);
    byId("duplicate-message").textContent = check.duplicates.length ? `This exact file is already uploaded (${check.duplicates.map(v => `V${v.number}`).join(", ")}). Choose its document identity and confirm Keep both, or cancel by choosing another file.` : "A file with this name already exists. Choose a new version of that document, or create a separate document.";
    byId("make-current").checked = false;
    byId("upload-form").hidden = false;
    byId("upload-status").textContent = "Text extracted. Confirm the document and revision before saving.";
  } catch (error) { byId("upload-status").textContent = "Processing failed. Choose the file again to retry."; showError(error); }
});
byId("upload-form").addEventListener("submit", async event => {
  event.preventDefault(); if (!pending) return;
  const button = byId("upload-submit"); button.disabled = true; byId("file-error").hidden = true;
  const association = byId("file-association").value;
  try {
    if (!byId("duplicate-label").hidden && !byId("keep-duplicate").checked) throw new Error("Confirm Keep both or choose another file.");
    byId("upload-status").textContent = "Saving the original and indexing searchable passages…";
    const { file, ...extracted } = pending;
    const upload = new FormData();
    upload.set("file", file, file.name);
    upload.set("metadata", JSON.stringify({ ...extracted, fileId: association === "new" ? undefined : association, title: byId("file-title").value, revision: byId("file-revision").value, dated: byId("file-date").value, area: byId("file-area").value, kind: byId("file-kind").value, approval: byId("file-approval").value, keepDuplicate: byId("keep-duplicate").checked, makeCurrent: byId("make-current").checked }));
    const result = await request("/api/upload", { method: "POST", body: upload });
    byId("upload-status").textContent = `V${result.version.number} saved · Ready to search. Previous versions have been retained.`;
    byId("upload-form").hidden = true; pending = null;
    await refresh(); await showVersion(result.version.id);
  } catch (error) { byId("upload-status").textContent = "Upload failed. Your selected file is retained here for retry."; showError(error); }
  finally { button.disabled = false; }
});
byId("set-current").addEventListener("click", async () => {
  if (!confirm(`Use V${selected.version.number} as the current search version? All other versions will be retained.`)) return;
  try { await post("/api/current-version", { versionId: selected.version.id, confirm: true }); await refresh(); await showVersion(selected.version.id); } catch (e) { showError(e); }
});
byId("download-original").addEventListener("click", async () => {
  const button = byId("download-original"); button.disabled = true;
  try { const blob = await request("/api/download", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ versionId: selected.version.id }), responseType: "blob" }); const url = URL.createObjectURL(blob); const a = element("a"); a.href = url; a.download = selected.version.filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); } catch (e) { showError(e); }
  finally { button.disabled = false; }
});
byId("preview-original").addEventListener("click",async()=>{
  const button=byId("preview-original"),frame=byId("original-preview");
  if(!frame.hidden){frame.hidden=true;button.textContent="View original PDF";return;}
  button.disabled=true;
  try{
    if(!originalPreviewUrl){const blob=await request("/api/download",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({versionId:selected.version.id}),responseType:"blob"});originalPreviewUrl=URL.createObjectURL(new Blob([blob],{type:"application/pdf"}));}
    frame.src=originalPreviewUrl;frame.hidden=false;button.textContent="Hide original PDF";
  }catch(e){showError(e);}finally{button.disabled=false;}
});
byId("compare-version").addEventListener("change", async event => {
  const target = byId("version-difference"); target.replaceChildren(); if (!event.target.value) return;
  try {
    const older = await post("/api/version", { versionId: event.target.value });
    const texts = [older.passages.map(p => p.text).join(""), selected.passages.map(p => p.text).join("")];
    let prefix = 0, suffix = 0; while (prefix < Math.min(...texts.map(t => t.length)) && texts[0][prefix] === texts[1][prefix]) prefix++;
    while (suffix < Math.min(...texts.map(t => t.length)) - prefix && texts[0].at(-1 - suffix) === texts[1].at(-1 - suffix)) suffix++;
    target.append(element("p", "", texts[0] === texts[1] ? "Searchable text is identical. Metadata may differ." : "Highlighted text changed between these versions. This does not determine which version is applicable."));
    const grid = element("div", "version-compare");
    for (const [i, data] of [older, selected].entries()) { const col = element("section"), text = texts[i], p = element("p", "passage-content"); p.append(document.createTextNode(text.slice(0, prefix)), element("mark", "", text.slice(prefix, suffix ? -suffix : undefined)), document.createTextNode(suffix ? text.slice(-suffix) : "")); col.append(element("h3", "", `V${data.version.number} · ${data.version.revision || "No formal revision"}`), p); grid.append(col); }
    target.append(grid);
  } catch (e) { showError(e); }
});
try {
  user = await request("/api/session"); byId("file-account").textContent = `${user.label} · ${user.projectName}`;
  document.querySelector('a[href="sources.html"]').hidden = user.sourceMode === "uploads-only";
  byId("upload-panel").hidden = user.role !== "engineer"; await refresh();
  const id = new URL(location.href).searchParams.get("version"); if (id) await showVersion(id);
} catch (error) { showError(new Error("Sign in through the workspace to view files in your assigned project. " + error.message)); }
