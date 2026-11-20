import { readFile } from "node:fs/promises";
import { join } from "node:path";


export async function cloudflareConnection() {
  let token=process.env.CLOUDFLARE_API_TOKEN;
  if(!token){const config=await readFile(join(process.env.APPDATA,"xdg.config",".wrangler","config","default.toml"),"utf8");token=/^oauth_token\s*=\s*"([^"]+)"/m.exec(config)?.[1];}
  if(!token)throw new Error("Sign in to Cloudflare with Wrangler before running this tool.");
  async function api(path,options={}){
    const response=await fetch(`https://api.cloudflare.com/client/v4${path}`,{...options,headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json",...options.headers}});
    const data=await response.json();if(!response.ok||data.success===false)throw new Error(`Cloudflare request failed (${response.status}): ${(data.errors||[]).map(e=>e.message).join("; ")}`);
    return data.result;
  }
  const accounts=await api("/accounts");
  const accountId=process.env.CLOUDFLARE_ACCOUNT_ID||(accounts.length===1?accounts[0].id:null);
  if(!accountId)throw new Error("Set CLOUDFLARE_ACCOUNT_ID to the intended existing account.");
  const config=JSON.parse(await readFile(new URL("../wrangler.json",import.meta.url),"utf8"));
  const endpoint=`/accounts/${accountId}/d1/database/${config.d1_databases[0].database_id}/query`;
  const db={prepare(sql){let params=[];return{bind(...values){params=values;return this;},async first(){return (await api(endpoint,{method:"POST",body:JSON.stringify({sql,params})}))[0].results[0]||null;},async all(){return (await api(endpoint,{method:"POST",body:JSON.stringify({sql,params})}))[0];},async run(){return (await api(endpoint,{method:"POST",body:JSON.stringify({sql,params})}))[0];},query(){return {sql,params};}};},async batch(statements){return api(endpoint,{method:"POST",body:JSON.stringify({batch:statements.map(s=>s.query())})});}};
  const AI={async run(model,input){const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify(input)});const data=await response.json();if(!response.ok||data.success===false)throw new Error((data.errors||[]).map(e=>e.message).join("; ")||`AI request failed (${response.status})`);return data.result;}};
  return {DB:db,AI,api,accountId,databaseId:config.d1_databases[0].database_id};
}
