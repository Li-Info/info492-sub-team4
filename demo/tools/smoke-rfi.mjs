import {openDatabase}from"./sqlite-adapter.mjs";
import{cloudflareConnection}from"./cloudflare-db.mjs";
import{answerQuestion}from"../agent.mjs";
import{writeFile}from"node:fs/promises";
const DB=openDatabase(process.argv[2]),{AI}=await cloudflareConnection(),results=[];
try{
 for(const [projectId,question]of [["demo4-ocean-pavilion","What does the response to RFI 569.3 say, and which RFI does it reference?"],["demo4-nkc-seattle","What changed between RFI 025 and RFI 025.1?"]]){
  try{const result=await answerQuestion({DB,AI},{id:"smoke-check",role:"engineer",projectId},question,{singleSearch:true});results.push({projectId,question,result});console.log(JSON.stringify({projectId,state:result.answerState,conclusions:result.conclusions?.length,cited:result.sources.length,quotes:result.conclusions?.flatMap(c=>c.evidence).length,answer:result.answer}));}
  catch(error){results.push({projectId,question,error:error.message,status:error.status});console.log(JSON.stringify({projectId,error:error.message,status:error.status}));}
 }
 await writeFile(process.argv[3],JSON.stringify({purpose:"Functional smoke checks only; not an experimental accuracy evaluation",results},null,2));
 if(results.some(r=>r.error))process.exitCode=1;
}finally{DB.close();}
