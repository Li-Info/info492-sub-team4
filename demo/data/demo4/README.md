# Demo 4 source data

These project records were supplied to the team for Demo 4. They are real RFI documents and registers, rather than the earlier public-source paraphrases or the fictional Cedar Cove training package. Files are preserved as received; their original SHA-256 hashes are listed in [source-inventory.json](source-inventory.json).

| Collection | Original files | Supplied register |
| --- | --- | --- |
| [Seattle Aquarium - Ocean Pavilion](ocean-pavilion/) | 9 RFI PDFs and `RFI Log.csv` | 1,809 data rows |
| [NKC Seattle](nkc-seattle/) | 7 RFI PDFs and `Sample RFI Log.xlsm` | 428 data rows |

Each collection is imported into a separate project. The original project identity, RFI number and page markers remain attached to retrieved passages. The registers are metadata sources, not substitutes for the technical response in an RFI PDF. These supplied collections are not complete project archives.

Some PDFs explicitly refer to documents that are absent from this collection. For example, Ocean Pavilion RFI 569.3 refers to RFI 569, and RFI 284.3 refers to 284.1. Their register entries can be displayed, but their technical contents cannot be reconstructed. Missing PDFs remain labelled as requiring upload. A `Closed` register status does not remove that limitation.

NKC RFI 025 is explicitly marked void and refers to 025.1. Both files remain available; the revised file is the current version of that document family. This relationship comes from the original text, not its upload order or decimal suffix alone. The NKC register contains two rows numbered 287.1; both are retained rather than overwriting one another.

Preparation extracts searchable PDF text with page markers and reads spreadsheet cells and cached values without executing macros. It does not change the original documents. Geometry, scanned content and handwritten annotations may not be represented in the extracted text. In particular, NKC RFI 034 page 6 and RFI 054 page 3 have little extractable text; open the original PDFs for those pages. The inventory records these extraction limits.

See [Demo 4 setup](../../DEMO4.md) for preparation and import commands. The source data does not include completed experimental scores. Older answer keys and evaluation materials remain outside the retrieval corpus.
