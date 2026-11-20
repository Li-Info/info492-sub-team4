import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chmod, copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";

const local = process.argv[2] === "--local";
const api = local ? null : new URL(process.argv[2] || "");
if (!local && (api.protocol !== "https:" || !api.hostname.endsWith(".workers.dev") || api.pathname !== "/" || api.search || api.hash || api.username || api.password)) {
  throw new Error("Provide the HTTPS workers.dev origin of the deployed API.");
}
const folder = new URL("./dist/", import.meta.url);
await mkdir(folder, { recursive: true });
const publicFiles = new Set(["index.html", "sources.html", "files.html", "rfi-log.html", "rfi-log.js", "rfi-ui.js", "answer-state.js", "styles.css", "app.js", "demo-accounts.js", "upload-limits.js", "sources.js", "files.js", "file-parser.js", "pdf.worker.mjs", "project-ui.js", "shared.js", "tour.js", "firebase-client.js", "corpus_for_manual_search.md"]);
for (const file of await readdir(folder)) {
  if (!publicFiles.has(file)) throw new Error("The build folder contains an unexpected file: " + file);
}
for (const file of ["index.html", "sources.html", "files.html", "rfi-log.html", "rfi-log.js", "rfi-ui.js", "answer-state.js", "styles.css", "app.js", "demo-accounts.js", "upload-limits.js", "sources.js", "files.js", "project-ui.js", "tour.js", "corpus_for_manual_search.md"]) {
  const destination = new URL(file, folder);
  try {
    await chmod(destination, 0o600);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await copyFile(new URL(file, import.meta.url), destination);
}
await build({ entryPoints: [fileURLToPath(new URL("./firebase-client.js", import.meta.url))], bundle: true, format: "esm", platform: "browser", target: "es2022", minify: true, legalComments: "none", outfile: fileURLToPath(new URL("firebase-client.js", folder)) });
await build({ entryPoints: [fileURLToPath(new URL("./file-parser.js", import.meta.url))], bundle: true, format: "esm", platform: "browser", target: "es2022", minify: true, legalComments: "none", outfile: fileURLToPath(new URL("file-parser.js", folder)) });
await copyFile(new URL("./node_modules/pdfjs-dist/build/pdf.worker.mjs", import.meta.url), new URL("pdf.worker.mjs", folder));
const app = await readFile(new URL("./shared.js", import.meta.url), "utf8");
if (!app.includes('const apiBase = "";')) throw new Error("The API origin setting was not found.");
await writeFile(new URL("./shared.js", folder), app.replace('const apiBase = "";', `const apiBase = ${JSON.stringify(api?.origin || "")};`));
if (local) {
  console.log("Local preview assets built with same-origin API requests.");
  process.exit(0);
}
const configPath = new URL("./firebase.json", import.meta.url);
const config = JSON.parse(await readFile(configPath, "utf8"));
const csp = config.hosting.headers[0].headers.find(header => header.key === "Content-Security-Policy");
csp.value = `default-src 'self'; script-src 'self'; worker-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' ${api.origin} https://identitytoolkit.googleapis.com https://securetoken.googleapis.com; frame-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`;
await writeFile(configPath, JSON.stringify(config, null, 2) + "\n");
console.log("Firebase Hosting assets built with API origin: " + api.origin);
