import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

export function testDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("schema.sql", import.meta.url), "utf8"));
  const prepare = sql => {
    let args = [];
    return { bind(...values) { if (values.some(v => typeof v === "string" && Buffer.byteLength(v, "utf8") > 2000000)) throw new Error("D1 string limit exceeded"); args = values; return this; }, async first() { return sqlite.prepare(sql).get(...args) || null; }, async all() { return { results: sqlite.prepare(sql).all(...args) }; }, async run() { return { meta: sqlite.prepare(sql).run(...args) }; } };
  };
  return { prepare, async batch(statements) { sqlite.exec("BEGIN"); try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec("COMMIT"); return results; } catch (e) { sqlite.exec("ROLLBACK"); throw e; } }, close() { sqlite.close(); } };
}
