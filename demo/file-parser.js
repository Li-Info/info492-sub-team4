import * as pdfjs from "pdfjs-dist/build/pdf.mjs";
import mammoth from "mammoth/mammoth.browser.js";
import { maxFileBytes, maxTextBytes } from "./upload-limits.js";
import { extractSpreadsheet } from "./spreadsheet-parser.js";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("./pdf.worker.mjs", import.meta.url).href;
export async function extractFile(file) {
  if (file.size > maxFileBytes) throw new Error("Use a file no larger than 10 MB.");
  const buffer = await file.arrayBuffer();
  let text;
  if (/\.pdf$/i.test(file.name)) {
    const task = pdfjs.getDocument({ data: new Uint8Array(buffer.slice(0)), isEvalSupported: false });
    const pdf = await task.promise;
    if (pdf.numPages > 100) { await task.destroy(); throw new Error("Use a PDF with no more than 100 pages."); }
    const pages = [];
    try { for (let page = 1; page <= pdf.numPages; page++) { const content = await (await pdf.getPage(page)).getTextContent(); pages.push(`[PDF page ${page}]\n` + content.items.map(item => item.str + (item.hasEOL ? "\n" : " ")).join("")); } }
    finally { await task.destroy(); }
    text = pages.join("\n\n");
  } else if (/\.docx$/i.test(file.name)) text = (await mammoth.extractRawText({ arrayBuffer: buffer })).value;
  else if (/\.(xlsx|xlsm)$/i.test(file.name)) text = await extractSpreadsheet(buffer);
  else if (/\.(txt|md|csv|json)$/i.test(file.name)) text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  else throw new Error("Choose PDF, DOCX, TXT, MD, CSV, JSON, XLSX or XLSM.");
  if (text.trim().length < 10) throw new Error("No searchable text was found. Scanned documents need OCR first.");
  if (new TextEncoder().encode(text).byteLength > maxTextBytes) throw new Error("The searchable text exceeds 1.5 MB. Split the document into smaller sections.");
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", buffer))].map(v => v.toString(16).padStart(2, "0")).join("");
  return { filename: file.name, file, hash, text };
}
