import { DatabaseSync } from "node:sqlite";
export function openDatabase(path) {
  const sqlite = new DatabaseSync(path);
  sqlite.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");
  return { sqlite, prepare(sql) {
    let args=[];
    return { bind(...values){args=values;return this;}, async first(){return sqlite.prepare(sql).get(...args)||null;}, async all(){return {results:sqlite.prepare(sql).all(...args)};}, async run(){return {meta:sqlite.prepare(sql).run(...args)};} };
  }, async batch(statements) { sqlite.exec("BEGIN");try{const r=[];for(const s of statements)r.push(await s.run());sqlite.exec("COMMIT");return r;}catch(e){sqlite.exec("ROLLBACK");throw e;} }, close(){sqlite.close();} };
}
