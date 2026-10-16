import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";

const api = new URL(process.argv[2] || "");
if (api.protocol !== "https:" || !api.hostname.endsWith(".workers.dev") || api.pathname !== "/" || api.search || api.hash || api.username || api.password) {
  throw new Error("Provide the HTTPS workers.dev origin of the deployed API.");
}
const folder = new URL("./dist/", import.meta.url);
await mkdir(folder, { recursive: true });
const publicFiles = new Set(["index.html", "styles.css", "app.js", "corpus_for_manual_search.md"]);
for (const file of await readdir(folder)) {
  if (!publicFiles.has(file)) throw new Error("The build folder contains an unexpected file: " + file);
}
for (const file of ["index.html", "styles.css", "corpus_for_manual_search.md"]) await copyFile(new URL(file, import.meta.url), new URL(file, folder));
const app = await readFile(new URL("./app.js", import.meta.url), "utf8");
if (!app.includes('const apiBase = "";')) throw new Error("The API origin setting was not found.");
await writeFile(new URL("./app.js", folder), app.replace('const apiBase = "";', `const apiBase = ${JSON.stringify(api.origin)};`));
const configPath = new URL("./firebase.json", import.meta.url);
const config = JSON.parse(await readFile(configPath, "utf8"));
const csp = config.hosting.headers[0].headers.find(header => header.key === "Content-Security-Policy");
csp.value = `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' ${api.origin}; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`;
await writeFile(configPath, JSON.stringify(config, null, 2) + "\n");
console.log("Firebase Hosting assets built with API origin: " + api.origin);
