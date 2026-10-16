import { readFile, writeFile } from "node:fs/promises";

const corpus = JSON.parse(await readFile(new URL("./corpus.json", import.meta.url), "utf8"));
const taskBank = JSON.parse(await readFile(new URL("./tasks.json", import.meta.url), "utf8"));
const sourceIds = new Set(corpus.records.map(source => source.source_id));
const passages = new Map(corpus.records.flatMap(source => source.chunks.map(chunk => [chunk.chunk_id, source.source_id])));
const taskIds = new Set();
for (const task of taskBank.tasks) {
  if (taskIds.has(task.task_id) || !task.prompt?.trim()) throw new Error("Test tasks must have unique IDs and nonempty prompts.");
  taskIds.add(task.task_id);
  for (const element of task.required_elements) {
    if (element.source_id && !sourceIds.has(element.source_id)) throw new Error("Unknown scoring source: " + element.source_id);
    if (element.chunk_id && passages.get(element.chunk_id) !== element.source_id) throw new Error("Unknown scoring passage: " + element.chunk_id);
  }
}

const questions = {
  dataset_id: taskBank.dataset_id.replace(/-tasks$/, "-questions"),
  version: taskBank.version,
  questions: taskBank.tasks.map(task => ({ task_id: task.task_id, prompt: task.prompt })),
};

const lines = [
  "# Demo 1 Public-Source Search Packet",
  "",
  `Dataset: \`${corpus.dataset_id}\` (version ${corpus.version})`,
  "",
  "> This packet contains concise, source-attributed paraphrases of real public project sources. It is not a set of approved construction specifications or a transcript of the linked pages. For a fair timed comparison, the AI condition must use the same records and chunks in `corpus.json`; do not open external pages during one condition unless they are available in both.",
];

for (const source of corpus.records) {
  lines.push(
    "",
    `## ${source.source_id} — ${source.title}`,
    "",
    `- Publisher: ${source.publisher}`,
    `- Published: ${source.published_on || "Date not listed"}`,
    `- Source type: ${source.source_type}`,
    `- Evidence class: ${source.evidence_class}`,
    `- Source: ${source.url}`,
    `- Location: ${source.location_note}`,
    `- Limit: ${source.limits}`,
  );
  for (const chunk of source.chunks) lines.push("", `### ${chunk.chunk_id} — ${chunk.topic}`, "", chunk.text);
}

await writeFile(new URL("./questions.json", import.meta.url), JSON.stringify(questions, null, 2) + "\n");
await writeFile(new URL("./corpus_for_manual_search.md", import.meta.url), lines.join("\n") + "\n");
console.log(`Prepared ${questions.questions.length} participant questions and ${passages.size} corpus passages. The scoring key remains in tasks.json.`);
