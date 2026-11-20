import JSZip from "jszip";

export async function extractSpreadsheet(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const readXml = async name => {
    const file=zip.file(name); if(!file)return null;
    const text=await file.async("string"); if(text.length>8000000)throw new Error("The spreadsheet is too large to read here.");
    const doc=new DOMParser().parseFromString(text,"application/xml"); if(doc.querySelector("parsererror"))throw new Error("The spreadsheet XML could not be read."); return doc;
  };
  const values=(doc,tag)=>Array.from(doc?.getElementsByTagNameNS("*",tag)||[]);
  const strings=values(await readXml("xl/sharedStrings.xml"),"si").map(node=>values(node,"t").map(t=>t.textContent).join(""));
  const workbook=await readXml("xl/workbook.xml"), rels=await readXml("xl/_rels/workbook.xml.rels");
  const relationMap=new Map(values(rels,"Relationship").map(n=>[n.getAttribute("Id"),n.getAttribute("Target")]));
  const output=[];let count=0;
  for(const sheet of values(workbook,"sheet")) {
    const id=sheet.getAttribute("r:id"), target=relationMap.get(id);if(!target)continue;
    const name=sheet.getAttribute("name"), filename=target.startsWith("/")?target.slice(1):`xl/${target.replace(/^\.\//,"")}`;
    const xml=await readXml(filename);if(!xml)continue;
    output.push(`[Spreadsheet sheet ${name}]`);
    for(const row of values(xml,"row")) {
      const cells=values(row,"c").map(cell=>{
        if(++count>100000)throw new Error("Split this spreadsheet into smaller files.");
        const type=cell.getAttribute("t"),raw=values(cell,"v")[0]?.textContent;
        const value=type==="s"?strings[Number(raw)]||"":type==="inlineStr"?values(cell,"t").map(t=>t.textContent).join(""):raw||"";
        return value ? `${cell.getAttribute("r")}: ${value}`:"";
      }).filter(Boolean);
      if(cells.length)output.push(`[Row ${row.getAttribute("r")}] ${cells.join(" | ")}`);
    }
  }
  return output.join("\n");
}
