import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase } from "./tools/sqlite-adapter.mjs";
import { cloudflareConnection } from "./tools/cloudflare-db.mjs";
import worker from "./worker.mjs";
const root=resolve(fileURLToPath(new URL("../website/dist/",import.meta.url)));
const DB=openDatabase(fileURLToPath(new URL("./.preview/demo4-v2.sqlite",import.meta.url)));
let AI;try{AI=(await cloudflareConnection()).AI;}catch{console.log("Local records are available; AI access is not configured in this preview.");}
const port=Number(process.env.PORT||8794),env={DB,AI};
const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".mjs":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".svg":"image/svg+xml",".md":"text/markdown; charset=utf-8"};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,`http://127.0.0.1:${port}`);
  if(url.pathname.startsWith("/api/")){
   const request=new Request(url,{method:req.method,headers:req.headers,...(!["GET","HEAD"].includes(req.method)?{body:req,duplex:"half"}:{})});
   const response=await worker.fetch(request,env,{waitUntil(promise){promise.catch(()=>{});}});res.writeHead(response.status,Object.fromEntries(response.headers));
   if(response.body)for await(const part of response.body)res.write(part);res.end();return;
  }
  const filename=resolve(root,"."+decodeURIComponent(url.pathname)+(url.pathname.endsWith("/")?"index.html":""));
  if(filename!==root&&!filename.startsWith(root+sep))throw new Error("Outside preview");
  if(!(await stat(filename)).isFile())throw new Error("File unavailable");
  res.writeHead(200,{"Content-Type":types[extname(filename)]||"application/octet-stream","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});res.end(await readFile(filename));
 }catch(e){res.writeHead(404,{"Content-Type":"text/plain"});res.end("This preview page is unavailable.");}
});
server.listen(port,"127.0.0.1",()=>console.log(`Team website preview: http://127.0.0.1:${port}/`));
for(const signal of ["SIGINT","SIGTERM"])process.on(signal,()=>server.close(()=>{DB.close();process.exit(0);}));
