import test from "node:test";
import assert from "node:assert/strict";
import { testDatabase } from "./storage-fixtures.mjs";
import { execute, searchProject } from "./project-data.mjs";
import { projectApi } from "./project-api.mjs";
import { rfiNumber, requestedRfis, rfiEntry, relatedRfis } from "./rfi-data.mjs";
import { parseRfiAnswer } from "./rfi-answer.mjs";
import { answerQuestion } from "./agent.mjs";
import worker from "./worker.mjs";
import { mockFirebaseKeys, testToken } from "./test-fixtures.mjs";

const session={id:"test-user",role:"engineer",projectId:"demo4-test",assignedProject:true};
async function setup(){
 const env={DB:testDatabase()};
 for(const id of [session.projectId,"another-project"]) {await execute(env.DB,"INSERT INTO projects VALUES(?,?,?)",id,id,"2026-11-19");await execute(env.DB,"INSERT INTO project_corpora VALUES(?,?,?,?,?,?)",id,"uploads-only",`demo4-${id}`,"1.0","Supplied RFI records.","Subcontractor");}
 await execute(env.DB,"INSERT INTO members(project_id,user_id,role) VALUES(?,?,?)",session.projectId,session.id,session.role);
 return env;
}
async function upload(env,number,text,extra={}){return projectApi("/api/upload","POST",{filename:`RFI ${number} - Record (Response).pdf`,title:`RFI ${number}`,text:`[PDF page 1]\n${text}`,original:Buffer.from(text).toString("base64"),...extra},env,session);}
async function log(env,number,meta={},row=2){
 let v=await env.DB.prepare("SELECT id FROM versions WHERE filename='register.csv'").first();
 if(!v)v=(await projectApi("/api/upload","POST",{filename:"register.csv",text:"RFI Number,Status\n569,Closed",original:Buffer.from("RFI Number,Status\n569,Closed").toString("base64")},env,session)).version;
 await execute(env.DB,"INSERT INTO rfi_register VALUES(?,?,?,?,?,?,?)",session.projectId,number,`RFI ${number}`,"Closed",JSON.stringify(meta),v.id,row);
}
test("RFI identifiers retain decimals and hyphen suffixes while normalizing leading zeros",()=>{
 assert.equal(rfiNumber("025.1"),"25.1");assert.equal(rfiNumber("230-1"),"230-1");assert.notEqual(rfiNumber("25"),rfiNumber("25.1"));
 assert.deepEqual(requestedRfis("Compare RFI 025 and RFI 025.1"),["25","25.1"]);
 assert.deepEqual(requestedRfis("Compare RFI 020＋021 + 025.1"),["20","21","25.1"]);
 assert.deepEqual(requestedRfis("020+021"),["20","21"]);
});
test("missing referenced PDFs remain missing even when another project has the number",async()=>{
 const env=await setup();await log(env,"569");
 const source=await upload(env,"569.3","Reference RFI 569. Use of HILTI HY-200 epoxy is acceptable.");
 const entry=await rfiEntry(env,session,"569");assert.equal(entry.missingDocument,true);assert.equal(entry.status,"Closed");
 const refs=await relatedRfis(env,session,[source.version.id]);assert.equal(refs[0].number,"569");assert.equal(refs[0].missingDocument,true);
 await assert.rejects(projectApi("/api/version","POST",{versionId:source.version.id},env,{...session,projectId:"another-project"}),{status:404});
 env.DB.close();
});
test("missing-file questions use the actual register without making an AI call",async()=>{
 const env=await setup();await log(env,"569",{Status:"Closed"});
 env.AI={run(){throw new Error("The inventory must not call AI");}};
 const answer=await answerQuestion(env,session,"Show the PDF for RFI 569");assert.equal(answer.answerState,"insufficient");assert.match(answer.answer,/PDF has not been supplied/);assert.equal(answer.trace.modelInputPassageIds.length,0);env.DB.close();
});
test("void records remain available explicitly but cannot replace the active revision",async()=>{
 const env=await setup();
 const old=await upload(env,"025","RFI VOID - Refer to RFI-025.1",{filename:"RFI 025 - Record-VOID.pdf"});
 const next=await upload(env,"025.1","The response confirms the architectural dimension.",{fileId:old.version.file_id,makeCurrent:true});
 await assert.rejects(projectApi("/api/current-version","POST",{versionId:old.version.id,confirm:true},env,session),{status:400});
 const explicit=await searchProject(env,session,"Show RFI 025");assert.ok(explicit.some(p=>p.versionId===old.version.id&&p.rfiDisposition==="void"&&p.replacedBy==="25.1"));
 const regular=await searchProject(env,session,"architectural dimension");assert.ok(regular.some(p=>p.versionId===next.version.id));assert.ok(!regular.some(p=>p.versionId===old.version.id));env.DB.close();
 assert.ok(regular.every(p=>!p.title.includes("VOID")));
});
test("present RFI files cannot be listed as missing while genuine information gaps remain",()=>{
 const p={id:"p21",sourceId:"doc21",sourceType:"uploaded_project_document",rfiNumber:"21",text:"Sleeves which interrupt rebar are to be detailed by 4/S-300."};
 const supported={statement:"The response refers to 4/S-300.",status:"supported",evidence:[{passageId:p.id,quote:p.text,label:"PCS Response"}],nextAction:""};
 const result={answer:supported.statement,citations:[p.id],missingInformation:["RFI 021 document"],sourceDifferences:[],conclusions:[supported]};
 assert.throws(()=>parseRfiAnswer(result,[p]),e=>e.status===502&&/RFI 21 PDF is supplied/.test(e.message));
 assert.throws(()=>parseRfiAnswer({...result,missingInformation:["The PDF for RFI 021 has not been supplied."]},[p]),{status:502});
 const gap="RFI 021 document does not provide the required material strength.";
 const actualGap=parseRfiAnswer({...result,missingInformation:[gap],conclusions:[{statement:gap,status:"insufficient",evidence:[],nextAction:"Supply the strength requirement."}]},[p]);
 assert.equal(actualGap.answerState,"insufficient");assert.ok(actualGap.missingInformation.includes(gap));
 const missingRelated=parseRfiAnswer({...result,missingInformation:["RFI 569 document"]},[p]);
 assert.ok(missingRelated.missingInformation.includes("RFI 569 document"));
});
test("multi-RFI inventory contradicting a model gap triggers a corrected answer",async()=>{
 const env=await setup();await upload(env,"020","The response confirms the revised column connection.");await upload(env,"021","Sleeves which interrupt rebar are to be detailed by 4/S-300.");let calls=0;
 env.AI={async run(model,input){
   calls++;const supplied=JSON.parse(input.messages[1].content);
   assert.deepEqual(supplied.projectInventory.requested.map(r=>[r.number,r.missingDocument]),[["20",false],["21",false]]);
   const p=supplied.documents.find(p=>p.rfiNumber==="21");
   if(calls>1)assert.match(input.messages.at(-1).content,/RFI 21 PDF is supplied/);
   return{response:{answer:"The response refers to 4/S-300.",citations:[p.id],missingInformation:calls===1?["RFI 021 document"]:[],sourceDifferences:[],conclusions:[{statement:"The response refers to 4/S-300.",status:"supported",evidence:[{passageId:p.id,quote:"Sleeves which interrupt rebar are to be detailed by 4/S-300.",label:"PCS Response"}],nextAction:""}]}};
 }};
 const answer=await answerQuestion(env,session,"Compare RFI 020＋021",{singleSearch:true});
 assert.equal(calls,2);assert.equal(answer.answerState,"reported-evidence");assert.deepEqual(answer.missingInformation,[]);env.DB.close();
});
test("duplicate register numbers preserve distinct source rows and citation identifiers",async()=>{
 const env=await setup();await log(env,"287.1",{description:"First entry"},104);await log(env,"287.1",{description:"Second entry"},105);
 const data=await rfiEntry(env,session,"287.1");assert.equal(data.registerEntries.length,2);
 const passages=await searchProject(env,session,"RFI 287.1");assert.equal(new Set(passages.map(p=>p.id)).size,2);env.DB.close();
});
test("conclusion quotations must occur in the selected cited passage",()=>{
 const p={id:"p1",sourceId:"doc1",text:'Architectural plan: 10 feet. Structural plan: 11 feet.'};
 const c={statement:"The plans differ.",status:"source-conflict",evidence:[{passageId:"p1",quote:"Architectural plan: 10 feet.",label:"Architectural"},{passageId:"p1",quote:"Structural plan: 11 feet.",label:"Structural"}],nextAction:"Check the formal RFI response; request clarification if unresolved."};
 const result={answer:c.statement,citations:["p1"],missingInformation:[],sourceDifferences:[],conclusions:[c]};
 assert.equal(parseRfiAnswer(result,[p]).conclusions[0].status,"source-conflict");
 assert.throws(()=>parseRfiAnswer({...result,conclusions:[{...c,evidence:[{passageId:"p1",quote:"12 feet",label:"Invented"},{...c.evidence[1]}]}]},[p]),{status:502});
});
test("repeated valid citations are deduplicated without accepting unknown evidence",()=>{
 const p={id:"p1",sourceId:"doc1",text:"Use of HILTI HY-200 epoxy is acceptable."};
 const result={answer:"Reported response.",citations:["p1","p1"],missingInformation:[],sourceDifferences:[],conclusions:[{statement:"The response accepts HILTI HY-200 epoxy.",status:"supported",evidence:[{passageId:"p1",quote:p.text,label:"RFI response"}],nextAction:""}]};
 assert.equal(parseRfiAnswer(result,[p]).sources.length,1);
 assert.throws(()=>parseRfiAnswer({...result,citations:["p1","unknown"]},[p]),{status:502});
});
test("invalid RFI answer formatting gets one bounded retry with evidence revalidation",async()=>{
 const env=await setup();await upload(env,"569.3","Use of HILTI HY-200 epoxy is acceptable.");let calls=0;
 env.AI={async run(model,input){
   calls++;const documents=JSON.parse(input.messages[1].content).documents,p=documents[0];
   if(calls===1)return{response:{answer:"Malformed response"}};
   assert.match(input.messages.at(-1).content,/failed validation/);
   return{response:{answer:"Reported response.",citations:[p.id],missingInformation:[],sourceDifferences:[],conclusions:[{statement:"The response accepts HILTI HY-200 epoxy.",status:"supported",evidence:[{passageId:p.id,quote:"Use of HILTI HY-200 epoxy is acceptable.",label:"RFI response"}],nextAction:""}]}};
 }};
 const answer=await answerQuestion(env,session,"What does RFI 569.3 say?",{singleSearch:true});
 assert.equal(calls,2);assert.equal(answer.trace.status,"completed");assert.ok(answer.trace.activity.some(a=>a.tool==="answer-validation"));
 calls=0;env.AI={async run(){calls++;return{response:{answer:"Invalid response"}};}};
 await assert.rejects(answerQuestion(env,session,"What does RFI 569.3 say?",{singleSearch:true}),e=>e.status===502&&e.trace.status==="failed");
 assert.equal(calls,2);env.DB.close();
});
test("project switching requires an active same-role membership",async()=>{
 const env=await setup();mockFirebaseKeys();const token=await testToken({projectId:session.projectId,role:"engineer"});
 const req=id=>new Request("http://127.0.0.1:8792/api/session",{headers:{Authorization:`Bearer ${token}`,"X-Project-Id":id}});
 assert.equal((await worker.fetch(req("another-project"),env)).status,403);
 await execute(env.DB,"INSERT INTO members(project_id,user_id,role) VALUES(?,?,?)","another-project",session.id,"engineer");
 const allowed=await worker.fetch(req("another-project"),env);assert.equal(allowed.status,200);assert.equal((await allowed.json()).projectId,"another-project");env.DB.close();
});

test("later RFI uploads record sourced change excerpts without making an AI call",async()=>{
 const env=await setup();const a=await upload(env,"400","The original request concerns the west concrete wall location.");
 const b=await upload(env,"400","The revised request concerns the east concrete wall location.",{fileId:a.version.file_id});
 const data=await projectApi("/api/rfi-context","POST",{versionId:b.version.id},env,session);
 assert.ok(data.changes.some(c=>c.sourceVersionId===b.version.id&&c.quote.includes("east concrete")));
 assert.ok(data.changes.some(c=>c.sourceVersionId===a.version.id&&c.quote.includes("west concrete")));
 env.DB.close();
});
