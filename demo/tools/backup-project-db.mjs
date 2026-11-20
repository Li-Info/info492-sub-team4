import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import { cloudflareConnection } from "./cloudflare-db.mjs";
const output=process.argv[2];if(!output)throw new Error("Provide an external backup filename.");
const {DB}=await cloudflareConnection();
const schema=(await DB.prepare("SELECT name,type,sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY name").all()).results;
const tables=schema.filter(s=>s.type==="table"&&!s.name.startsWith("sqlite_")&&!s.name.startsWith("chunk_search")&&!s.name.startsWith("_cf_")&&!/VIRTUAL TABLE/i.test(s.sql));
const snapshot={capturedAt:new Date().toISOString(),schema,tables:{},checksums:{}};
for(const table of tables){
  const rows=[],step=table.name==="originals"?1:250;
  for(let offset=0;;offset+=step){const data=(await DB.prepare(`SELECT * FROM "${table.name.replaceAll('"','""')}" LIMIT ? OFFSET ?`).bind(step,offset).all()).results;rows.push(...data);if(data.length<step)break;}
  snapshot.tables[table.name]=rows;snapshot.checksums[table.name]=createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}
await mkdir(dirname(resolve(output)),{recursive:true});await writeFile(output,JSON.stringify(snapshot));
console.log(JSON.stringify({backup:resolve(output),tables:Object.fromEntries(Object.entries(snapshot.tables).map(([k,v])=>[k,v.length]))},null,2));
