import{readFile,writeFile}from"node:fs/promises";
import{createHash}from"node:crypto";
import assert from"node:assert/strict";
import{cloudflareConnection}from"./cloudflare-db.mjs";
import{rfiEntry}from"../rfi-data.mjs";
const env=await cloudflareConnection(),manifest=JSON.parse(await readFile(process.argv[2],"utf8")),snapshot=JSON.parse(await readFile(process.argv[3],"utf8"));
let preserved=0,originals=0,quotes=0;
for(const [table,oldRows]of Object.entries(snapshot.tables)){
 if(!oldRows.length)continue;
 const fields=(await env.DB.prepare(`PRAGMA table_info("${table}")`).all()).results.filter(f=>f.pk).sort((a,b)=>a.pk-b.pk).map(f=>f.name);
 assert.ok(fields.length,`No primary key for ${table}`);
 const sql=`SELECT * FROM "${table}" WHERE `+oldRows.map(()=>"("+fields.map(f=>`"${f}"=?`).join(" AND ")+")").join(" OR ");
 const rows=(await env.DB.prepare(sql).bind(...oldRows.flatMap(r=>fields.map(f=>r[f]))).all()).results;
 const key=r=>JSON.stringify(fields.map(f=>r[f])),lookup=new Map(rows.map(r=>[key(r),r]));
 for(const old of oldRows){const row=lookup.get(key(old));assert.ok(row,`Original ${table} row missing`);for(const [k,v]of Object.entries(old))assert.equal(row[k],v,`Original ${table}.${k} changed`);preserved++;}
}
for(const p of manifest.projects){
 const versions=(await env.DB.prepare("SELECT * FROM versions WHERE project_id=?").bind(p.id).all()).results;
 assert.equal(versions.length,p.documents.length+1);
 assert.equal((await env.DB.prepare("SELECT COUNT(*) AS n FROM rfi_register WHERE project_id=?").bind(p.id).first()).n,p.register.length);
 for(const source of [...p.documents,p.log]){
  const v=versions.find(v=>v.filename===source.filename);assert.ok(v);
  const count=(await env.DB.prepare("SELECT COUNT(*) AS n FROM originals WHERE version_id=?").bind(v.id).first()).n;
  const parts=[];for(let i=0;i<count;i++)parts.push(Buffer.from((await env.DB.prepare("SELECT data FROM originals WHERE version_id=? AND part=?").bind(v.id,i).first()).data,"base64"));
  assert.equal(createHash("sha256").update(Buffer.concat(parts)).digest("hex"),createHash("sha256").update(await readFile(source.path)).digest("hex"));originals++;
 }
 const records=(await env.DB.prepare("SELECT * FROM rfi_documents WHERE project_id=?").bind(p.id).all()).results;
 for(const r of records)for(const c of JSON.parse(r.change_log)){const v=versions.find(v=>v.id===c.sourceVersionId);assert.ok(v&&v.text.replace(/\s+/g," ").includes(c.quote.replace(/\s+/g," ")));quotes++;}
}
assert.equal((await rfiEntry(env,{projectId:"demo4-ocean-pavilion"},"569")).missingDocument,true);
const old=await rfiEntry(env,{projectId:"demo4-nkc-seattle"},"25");assert.equal(old.documents[0].replaced_by,"25.1");
const result={verifiedAt:new Date().toISOString(),preservedOriginalRows:preserved,originalFilesVerified:originals,changeLogQuotationsVerified:quotes,projects:manifest.projects.map(p=>({id:p.id,pdfs:p.documents.length,registerEntries:p.register.length})),missingFilesRemainExplicit:true};
await writeFile(process.argv[4],JSON.stringify(result,null,2));console.log(JSON.stringify(result));
