import { copyFile, mkdir, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const website = new URL("./", import.meta.url);
const demo = new URL("../demo/", import.meta.url);
const local = process.argv.includes("--local");

function run(script, args, cwd) {
  const result = spawnSync(process.execPath, [fileURLToPath(script), ...args], { cwd: fileURLToPath(cwd), stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

run(new URL("node_modules/vite/bin/vite.js", website), ["build"], website);
run(new URL("build.mjs", demo), [local ? "--local" : "https://info492-demo1-api.info492-sample.workers.dev"], demo);

const destination = new URL("dist/demo/", website);
await mkdir(destination, { recursive: true });
for (const file of await readdir(new URL("dist/", demo))) {
  await copyFile(new URL(`dist/${file}`, demo), new URL(file, destination));
}
console.log("Team website built with the demo at /demo/.");
