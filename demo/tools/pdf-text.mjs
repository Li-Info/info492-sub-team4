import { readFile } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
const task=getDocument({data:new Uint8Array(await readFile(process.argv[2])),isEvalSupported:false,disableFontFace:true,verbosity:0});
try { const pdf=await task.promise,pages=[];
  for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i),content=await page.getTextContent();pages.push(content.items.map(item=>item.str+(item.hasEOL?"\n":" ")).join(""));page.cleanup();}
  process.stdout.write(JSON.stringify(pages));
}finally{await task.destroy();}
