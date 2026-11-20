import { readFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { openDatabase } from "./sqlite-adapter.mjs";
import { projectApi } from "../project-api.mjs";
import { indexRfiDocument } from "../rfi-data.mjs";
import { one, execute } from "../project-data.mjs";
import { demoAccounts } from "../demo-accounts.js";
import { firebaseConfig } from "../firebase-config.js";

export async function importRfiData(env, manifest, members) {
  const summary=[];
  for(const p of manifest.projects) {
    const existing=await one(env.DB,"SELECT p.id,c.dataset_version FROM projects p LEFT JOIN project_corpora c ON c.project_id=p.id WHERE p.id=?",p.id);
    if(existing?.dataset_version==="1.0") { summary.push({project:p.name,state:"Already present; original import retained"});continue; }
    if(existing) { const count=await one(env.DB,"SELECT COUNT(*) AS n FROM files WHERE project_id=?",p.id);if(existing.dataset_version!=="importing"||count.n)throw new Error("An unfinished import with files exists. Retain it for inspection before resuming."); }
    else {
      await execute(env.DB,"INSERT INTO projects(id,name,created_at) VALUES(?,?,?)",p.id,p.name,new Date().toISOString());
      await execute(env.DB,"INSERT INTO project_corpora VALUES(?,?,?,?,?,?)",p.id,"uploads-only",p.datasetId,"importing",`Supplied RFI records for ${p.name}. Referenced files may be missing. Check the dated response and revision before recording a review.`,"Concrete subcontractor");
    }
    for(const m of members)await execute(env.DB,"INSERT OR IGNORE INTO members(project_id,user_id,role) VALUES(?,?,?)",p.id,m.id,m.role);
    const session={id:members.find(m=>m.role==="engineer")?.id||"local-import",role:"engineer",projectId:p.id};
    const upload=async (doc,extra={})=>{
      const raw=await readFile(doc.path);
      if(doc.sha256 && createHash("sha256").update(raw).digest("hex")!==doc.sha256)throw new Error("An original changed after preparation: "+doc.filename);
      return projectApi("/api/upload","POST",{filename:doc.filename,title:doc.title||doc.filename,text:doc.text,file:new File([raw],doc.filename),kind:"Project RFI record",approval:"Not verified",...extra},env,session);
    };
    const log=await upload(p.log,{title:`${p.name} · supplied RFI register`,kind:"RFI register"});
    for(let i=0;i<p.register.length;i+=80) {
      const data=p.register.slice(i,i+80).map(r=>({...r,metadata:JSON.stringify(r.metadata)}));
      await execute(env.DB,"INSERT INTO rfi_register(project_id,rfi_number,title,status,metadata,log_version_id,row_number) SELECT ?,json_extract(value,'$.number'),json_extract(value,'$.title'),json_extract(value,'$.status'),json_extract(value,'$.metadata'),?,json_extract(value,'$.row') FROM json_each(?)",p.id,log.version.id,JSON.stringify(data));
    }
    const versions=new Map();
    for(const doc of p.documents) {
      let extra={revision:`RFI ${doc.rfiNumber}`,title:`RFI ${doc.rfiNumber} · ${doc.title}`};
      if(p.id.endsWith("nkc-seattle") && doc.rfiNumber==="25.1" && versions.has("25")) extra={...extra,fileId:versions.get("25").file_id,makeCurrent:true,revision:"RFI 025.1 · Rev 1"};
      if(/\bVOID\b/i.test(doc.filename))extra.approval="Superseded as labelled in file";
      const {version}=await upload(doc,extra);versions.set(doc.rfiNumber,version);
      if(doc.rfiNumber==="25.1" && versions.has("25")) {
        const old=versions.get("25");
        const changes=[{summary:"RFI 025 is void and explicitly refers to RFI 025.1.",sourceVersionId:old.id,page:1,quote:"RFI VOID -\nRefer to RFI-025.1"}];
        for(const [label,pattern] of [["Added clarification about the SCL Transformer Vault north wall.",/5\.\s+There[\s\S]*?(?=\n6\.)/],["Added clarification about the LU01 Electrical Room east wall.",/6\.\s+There[\s\S]*?(?=\nSee attached)/],["Added the wall discrepancy at grid B8.",/7\.\s*Discrepancy on wall at grid B8 intersection\./]]) {
          const quote=doc.text.match(pattern)?.[0]?.trim(); if(quote)changes.push({summary:label,sourceVersionId:version.id,page:1,quote});
        }
        changes.push({summary:"The revised file contains architectural and structural replies. Read the dated replies with their marked-up drawings.",sourceVersionId:version.id,page:1,quote:"Mahlum Response:"});
        await indexRfiDocument(env.DB,session,{id:version.id,filename:doc.filename,text:doc.text},changes);
      }
    }
    await execute(env.DB,"UPDATE project_corpora SET dataset_version='1.0' WHERE project_id=?",p.id);
    summary.push({project:p.name,pdfs:p.documents.length,registerEntries:p.register.length,state:"Imported; original bytes retained"});
  }
  return summary;
}
async function main(){
  const args=process.argv.slice(2),get=k=>args[args.indexOf(k)+1];
  if(!args.includes("--input")||!args.includes("--db"))throw new Error("Provide --input prepared-manifest.json --db local-preview.sqlite. This tool only writes a local database.");
  const dbPath=resolve(get("--db"));await mkdir(dirname(dbPath),{recursive:true});
  const db=openDatabase(dbPath);db.sqlite.exec(await readFile(new URL("../schema.sql",import.meta.url),"utf8"));
  const members=[];
  if(args.includes("--demo-accounts")) for(const account of demoAccounts){
    const response=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseConfig.apiKey}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:account.email,password:account.password,returnSecureToken:true})});
    const data=await response.json();if(!response.ok)throw new Error("Could not identify a demo account. No credential was stored.");
    const payload=JSON.parse(Buffer.from(data.idToken.split(".")[1],"base64url").toString());
    members.push({id:data.localId,role:payload.role||"engineer"});
  }
  const manifest=JSON.parse(await readFile(get("--input"),"utf8"));
  try{console.log(JSON.stringify(await importRfiData({DB:db},manifest,members),null,2));}finally{db.close();}
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main();
