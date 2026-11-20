import {readFile}from"node:fs/promises";
import{createHash}from"node:crypto";
import assert from"node:assert/strict";
import{openDatabase}from"./sqlite-adapter.mjs";
const db=openDatabase(process.argv[2]),manifest=JSON.parse(await readFile(process.argv[3],"utf8"));
let originals=0,quotes=0;
try{
 for(const p of manifest.projects){
  const versions=db.sqlite.prepare("SELECT * FROM versions WHERE project_id=?").all(p.id);
  assert.equal(versions.length,p.documents.length+1);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM rfi_register WHERE project_id=?").get(p.id).n,p.register.length);
  for(const source of [...p.documents,p.log]){
   const version=versions.find(v=>v.filename===source.filename);assert.ok(version);
   const parts=db.sqlite.prepare("SELECT data FROM originals WHERE version_id=? ORDER BY part").all(version.id);
   const bytes=Buffer.concat(parts.map(p=>Buffer.from(p.data,"base64")));
   assert.equal(createHash("sha256").update(bytes).digest("hex"),createHash("sha256").update(await readFile(source.path)).digest("hex"));originals++;
   const last=db.sqlite.prepare("SELECT text FROM chunks WHERE version_id=? ORDER BY position DESC LIMIT 1").get(version.id);assert.ok(last?.text);
  }
 }
 const compact=x=>x.replace(/\s+/g," ").trim();
 for(const record of db.sqlite.prepare("SELECT * FROM rfi_documents").all())for(const c of JSON.parse(record.change_log)){
  const source=db.sqlite.prepare("SELECT text FROM versions WHERE id=?").get(c.sourceVersionId);assert.ok(source&&compact(source.text).includes(compact(c.quote)));quotes++;
 }
 const old=db.sqlite.prepare("SELECT * FROM rfi_documents WHERE project_id=? AND rfi_number='25'").get("demo4-nkc-seattle");assert.equal(old.disposition,"void");assert.equal(old.replaced_by,"25.1");
 console.log(JSON.stringify({originalsVerified:originals,changeLogQuotationsVerified:quotes,projects:manifest.projects.length,allRegisterRowsPreserved:true}));
}finally{db.close();}
