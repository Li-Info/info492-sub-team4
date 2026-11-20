# INFO 492 Sub Team 4

This repository contains the team website and RFI retrieval demo for a pilot study of AI-assisted information retrieval when preparing construction RFIs from a subcontractor's perspective. Demo 4 uses supplied project RFI records for the Seattle Aquarium Ocean Pavilion and a separate NKC Seattle collection. Each collection has its own project and register.

The project tests whether AI-assisted retrieval improves RFI information accuracy compared with manual search using the same documents. The initial demos used a 10% improvement hypothesis. The Demo 3 submission note states a later target of 15 percentage points. These targets and evaluation stages should not be treated as interchangeable.

- [Team website](https://info492-sub-team-4.web.app/)
- [Live Demo 4](https://info492-sub-team-4.web.app/demo/)

The homepage's **Try Demo 4** button opens `/demo/` on the same team website. Historical snapshots retain the original `demo1/` folder name.

## Demo 4: current implementation

| Material | Where to find it |
| --- | --- |
| Working demo | [Current workspace](https://info492-sub-team-4.web.app/demo/). Sign in with a displayed sample account and select a project. |
| Original project data and provenance | [Demo 4 data](demo/data/demo4/README.md), including 16 original RFI PDFs and two registers. [Source inventory](demo/data/demo4/source-inventory.json) lists file hashes, page counts and extraction limits. |
| RFI registers and related records | [Register interface](demo/rfi-log.html) and [register API](demo/rfi-data.mjs). A register entry can exist without its PDF; the interface identifies that distinction. |
| Revision history and change log | [Version viewer](demo/files.js) and [evidence components](demo/rfi-ui.js). NKC RFI 025 remains available as a void record with its explicit reference to 025.1. |
| Answer prompts and validation | [RFI prompt and response schema](demo/rfi-answer.mjs), [retrieval workflow](demo/agent.mjs) and [shared status rules](demo/answer-state.js). |
| Preparation and local preview | [Demo 4 setup](demo/DEMO4.md), [preparation script](demo/tools/prepare-rfi-data.py), [import script](demo/tools/import-rfi-data.mjs) and [Python dependency](demo/requirements-rfi.txt). Node dependencies are pinned in the application lockfile. |
| Regression checks | [RFI checks](demo/rfi-data.test.mjs), [status and title checks](demo/answer-state.test.mjs) and the existing role, storage and retrieval tests. Run `npm test` inside `demo/`. These checks are not an accuracy experiment. |

The interface shows a short evidence quotation with its page and version. Full passages can be expanded, and the original PDF can be opened. Each conclusion has an evidence, conflict or missing-information status. Human review remains a separate recorded action. Known contradictions between a missing-file claim and the project's file inventory fail validation and receive one correction attempt. A quotation occurring in a passage does not independently establish that its meaning supports a conclusion.

The original data remains unchanged. Missing referenced PDFs are not reconstructed or inferred from register status. The supplied registers contain 1,809 Ocean Pavilion rows and 428 NKC rows; duplicate NKC number 287.1 is retained as two source rows. These collections are not complete project archives. The earlier public-source corpus and Cedar Cove synthetic dataset remain separate. Previous evaluation results and scoring criteria are preserved below.

## Demo 3 submission materials

These links preserve the earlier submission. The live demo URL now serves Demo 4; the Demo 3 code remains available in its [source snapshot](https://github.com/Li-Info/info492-sub-team4/tree/67499b98f0881280ea863512530981f3f87b9173/demo).

| Requirement | Where to find it |
| --- | --- |
| Working system | [Team website](https://info492-sub-team-4.web.app/) and [current application](https://info492-sub-team-4.web.app/demo/). Sign-in provides the Foreman, Project Engineer and Project Manager views. |
| Presentation | [Slides linked from the team's Demo 3 submission tab](https://docs.google.com/presentation/d/1YIg74AzIheFEJqHieDm8K1FJuRT30m_OIslvaO4vurM/edit). |
| Demo note, reported evaluation and individual contributions | [Coordination Demo 3 tab](https://docs.google.com/document/d/1mWZ5glFVbaz-HXh6wqxvimRZcSYoCS94IFlVUTWIhmA/edit?tab=t.hr9ed8rs6cu2). |
| Stakeholder input | [Carrie Cassidy interview notes](https://docs.google.com/document/d/1mWZ5glFVbaz-HXh6wqxvimRZcSYoCS94IFlVUTWIhmA/edit?tab=t.uc701a695nh2), including feedback after a webpage demonstration. These are interview notes, not a recording-based transcript. |
| Course feedback | [Feedback 11.12](https://docs.google.com/document/d/1mWZ5glFVbaz-HXh6wqxvimRZcSYoCS94IFlVUTWIhmA/edit?tab=t.vubg0m95p0nu). |
| Code | [Interface](demo/app.js), [Worker API](demo/worker.mjs), [retrieval agent](demo/agent.mjs), [project storage and permissions](demo/project-api.mjs), [background monitoring](demo/monitor.mjs) and [database schema](demo/schema.sql). |
| Source data | [T0: initial 18 PDFs](demo/data/demo3-synthetic-v1/T0/), [T1: three staged update PDFs](demo/data/demo3-synthetic-v1/T1/) and [T2: three staged update PDFs](demo/data/demo3-synthetic-v1/T2/). |
| Evaluation inputs | [48 candidate questions and answer key](eval/demo3/T0_48_questions_and_answer_key.csv), [ground truth](eval/demo3/ground_truth.json), [12 planned update events](eval/demo3/continuous_events.jsonl) and [package consistency report](eval/demo3/validation_report.json). These supplied files are preserved unchanged. |
| LLM prompts | [Project-document system prompt](demo/project-instructions.mjs), [agent tool-choice prompt](demo/agent.mjs), [evidence-change comparison prompt](demo/monitor.mjs) and [earlier public-corpus prompt](demo/rfi.mjs). |
| Dependencies and commands | [Demo package](demo/package.json), [demo lockfile](demo/package-lock.json), [homepage package](website/package.json), [homepage lockfile](website/package-lock.json) and the [run instructions below](#run-locally). |

The submission note reports 47 main evaluation tasks and one separately handled system-boundary question. Its result summary is team reported; the raw responses and completed per-task scoring sheets for that comparison are not included in this repository. The candidate answer key and static package consistency report are not experimental outputs. Automated software checks do not independently verify the reported accuracy or establish the thesis.

## Demo 3 workspace

Demo 3 used the team-supplied **Demo3_Synthetic_Data_v1** package for the fictional Cedar Cove Aquarium Annex, with Bayform Concrete as the simulated subcontractor. Its initial corpus contains only the 18 T0 PDFs in [demo/data/demo3-synthetic-v1/T0/](demo/data/demo3-synthetic-v1/T0/). The original PDF bytes are preserved. These are synthetic training records marked NOT FOR CONSTRUCTION, not Ocean Pavilion project records or professionally validated design documents.

For Demo 3, the three public demo accounts were assigned to the Cedar Cove project, which retrieves only its uploaded files. For Demo 4, the same accounts also have role-matched membership in the two real-record projects. The project selector determines which corpus is searched. Earlier project data and history remain separate. The package's T1 and T2 documents are included as staged update-test inputs; storing them in Git does not upload them to the project's searchable corpus. TXT alternatives are not imported alongside the PDFs. Evaluator questions, answer keys and the package manifest are not part of the retrieval corpus. The supplied package did not include its original document-generation script. The historical `generate-data.mjs` prepares the earlier public-source task packet; it does not generate these synthetic PDFs.


The three roles are internal positions within a **Concrete Subcontractor**: Foreman, Project Engineer and Project Manager. The Project Engineer is the main persona. Firebase email/password sign-in establishes identity; server-assigned claims and active project membership control access. The sign-in page displays three public demonstration accounts with their assigned role names. The account determines the authorized role after login; there is no role selector or self-registration interface. These accounts have assigned demonstration projects. Private project accounts remain separate. A project administrator assigns project membership and matching Firebase claims.

Foremen ask field questions and flag items for team review. Project Engineers manage uploaded files, check evidence and monitor their saved questions. Project Managers review explicitly shared records and record an internal RFI-preparation decision. These actions do not approve construction or send an RFI. All roles search the same evidence within their assigned project; the role changes the view and allowed actions, not the underlying facts.

Answers use warning text for missing information or source differences. Human review starts with **Select a review decision**. Reviews append the actor, role, time and notes without replacing the AI answer. Saved answer and citation snapshots persist in Cloudflare D1 across sign-out. Only an owner or an assigned teammate with an explicitly shared record can access it.

**Project files** accepts searchable PDF, DOCX, TXT, MD, CSV, JSON, XLSX and XLSM files up to 10 MiB per file (shown as 10 MB), with at most 1,500,000 UTF-8 bytes of extracted text and 100 PDF pages. PDF text keeps page markers; DOCX extraction does not invent page numbers. Scanned documents need OCR first. Extraction happens in the browser. The original file and metadata use a multipart upload; the backend verifies the original SHA-256 hash and saves base64-encoded file parts in separate D1 rows within the same indexing transaction. Original downloads stream the decoded parts and support files saved by the earlier version. Oversized files or extracted text are rejected before saving; text is not silently truncated. Duplicate content is flagged. The user chooses a separate document or a new version of an existing document and confirms keeping a duplicate. Internal V1/V2 numbering is separate from formal revision labels. Previous versions remain available. Setting the current search version requires an explicit choice; upload time alone does not establish applicability or approval. File types and approval labels are user supplied, not independently verified.

**Save and monitor updates** starts an account-owned background task. Ready-file events enter a persistent queue; a five-minute cron also checks for missed events. Each check verifies the owner's project access, compares evidence and saves its actual activity. Meaningful changes enter **Updates to review**; no-change checks only enter the log. Monitoring state, check state and human review are stored separately. A failed check keeps its event position and has two automatic retries. Users can pause, archive or manually retry failed checks. Checks process up to two queued items per worker invocation, so queued work can delay the next completed check. No notification is a guarantee that all changes were found. This implementation does not establish hours of successful operation or measured reminder accuracy.

The system does not connect to Autodesk or Procore. Uploaded synthetic demonstrations must be labelled as such and kept distinct from public-source summaries and real project records. Original evaluation data and scoring rules remain unchanged.

[demo/firebase-config.js](demo/firebase-config.js) contains public Firebase web-app identifiers. Passwords go to Firebase, not the AI. The three public sample credentials in `demo/demo-accounts.js` are intentionally displayed on the sign-in page. Private account passwords and deployment credentials must stay outside Git.

## Mid-quarter Analysis submission materials

| Requirement | Where to find it |
| --- | --- |
| Presentation | [Week 5 Mid-quarter Analysis slides](https://docs.google.com/presentation/d/1YIg74AzIheFEJqHieDm8K1FJuRT30m_OIslvaO4vurM/edit). A UW account is required. |
| Interim paper | [Mid-quarter Analysis tab in the team document](https://docs.google.com/document/d/1mWZ5glFVbaz-HXh6wqxvimRZcSYoCS94IFlVUTWIhmA/edit?tab=t.7f1jffnywgf2). |
| Individual contribution statements | At the end of the same [Mid-quarter Analysis tab](https://docs.google.com/document/d/1mWZ5glFVbaz-HXh6wqxvimRZcSYoCS94IFlVUTWIhmA/edit?tab=t.7f1jffnywgf2). |
| Code and dependency files for the first two demos | [Demo 1 source snapshot](https://github.com/Li-Info/info492-sub-team4/tree/f958c4d87d82f6e6323ebce237b58f4254680858/demo1) and [Demo 2 source snapshot](https://github.com/Li-Info/info492-sub-team4/tree/34c14b4a538086a5665e746c2ac60f1d355f7a4f/demo1). Each includes `package.json` and `package-lock.json`. |
| Data and preparation | [Source corpus](demo/corpus.json), [manual search packet](demo/corpus_for_manual_search.md), [task bank](demo/tasks.json), [participant questions](demo/questions.json) and [preparation script](demo/generate-data.mjs). Data provenance and synthetic-task justification are [documented below](#data-and-synthetic-task-justification). |
| LLM prompts | The `instructions` variable in [Demo 1's rfi.mjs](https://github.com/Li-Info/info492-sub-team4/blob/f958c4d87d82f6e6323ebce237b58f4254680858/demo1/rfi.mjs) and [Demo 2's rfi.mjs](https://github.com/Li-Info/info492-sub-team4/blob/34c14b4a538086a5665e746c2ac60f1d355f7a4f/demo1/rfi.mjs). The [current prompt](demo/rfi.mjs) includes later updates. |
| Stakeholder interview transcripts | [Edited interview record](interviews/carrie-dossick-interview-record.md) and [original team notes](interviews/carrie-dossick-notes.md). The edited record is based on notes, not a recording-based transcript. |
| LLM summary of classroom feedback | [Demo 1 and Demo 2 classroom feedback summary](feedback/class-feedback-summary.md). |
| Supporting evaluation materials | [Evaluation Lab worksheet](eval/lab.pdf) and [reference answer key](eval/answer-key.json). |
| Setup and use | [Runtime and dependencies](#runtime-and-dependencies) and [local run instructions](#run-locally). |

## Repository structure

The repository root has no application package. Run installation and application commands inside `website/` or `demo/`.

| Path | Purpose |
| --- | --- |
| [website/](website/) | React and Vite source for the team website, including its internal demo link. |
| [website/build.mjs](website/build.mjs), [firebase.json](website/firebase.json) | Builds the homepage with the demo under `/demo/` and configures the main Hosting site. |
| [demo/index.html](demo/index.html), [app.js](demo/app.js), [styles.css](demo/styles.css) | Demo interface for entering questions and reviewing answers with evidence. |
| [demo/sources.html](demo/sources.html), [sources.js](demo/sources.js), [shared.js](demo/shared.js) | Separate corpus page, passage highlighting and shared browser helpers. |
| [demo/firebase-client.js](demo/firebase-client.js), [firebase-config.js](demo/firebase-config.js), [firebase-token.mjs](demo/firebase-token.mjs), [access.mjs](demo/access.mjs) | Firebase email/password sign-in, server token verification and account-bound review permissions. |
| [demo/files.html](demo/files.html), [files.js](demo/files.js), [file-parser.js](demo/file-parser.js) | Authenticated uploads, duplicate confirmation, version history and text comparison. |
| [demo/file-storage.mjs](demo/file-storage.mjs), [upload-limits.js](demo/upload-limits.js), [upload.test.mjs](demo/upload.test.mjs) | Bounded multipart uploads, original-file parts, streaming downloads and size/access regression checks. |
| [demo/agent.mjs](demo/agent.mjs), [monitor.mjs](demo/monitor.mjs) | Bounded retrieval tool choices and background evidence-change checks. |
| [demo/schema.sql](demo/schema.sql), [project-data.mjs](demo/project-data.mjs), [project-api.mjs](demo/project-api.mjs) | D1 schema, project access, persistent records and file events. |
| [demo/project-ui.js](demo/project-ui.js), [project.test.mjs](demo/project.test.mjs) | Monitoring interface and permission/version/queue regression checks. |
| [demo/retrieval.mjs](demo/retrieval.mjs), [retrieval.test.mjs](demo/retrieval.test.mjs) | Keyword passage retrieval and pipeline regression tests. |
| [demo/wrangler.preview.json](demo/wrangler.preview.json) | Local preview using the existing Cloudflare login and a remote AI binding. |
| [demo/server.mjs](demo/server.mjs) | Local Node.js server and AI requests using server-side environment variables. |
| [demo/worker.mjs](demo/worker.mjs), [wrangler.json](demo/wrangler.json) | Deployed Cloudflare Worker API and Workers AI binding. |
| [demo/rfi.mjs](demo/rfi.mjs) | Full LLM system prompt in `instructions`, retrieved-context response schema, corpus mapping and response validation. |
| [demo/data/demo3-synthetic-v1/T0/](demo/data/demo3-synthetic-v1/T0/), [project-instructions.mjs](demo/project-instructions.mjs), [project-corpus.test.mjs](demo/project-corpus.test.mjs) | Initial synthetic PDFs, the project-document prompt and corpus-isolation checks. |
| [demo/corpus.json](demo/corpus.json) | Public-source summaries with attribution and source limitations. |
| [demo/corpus_for_manual_search.md](demo/corpus_for_manual_search.md) | Readable version of the same source records and passages for manual search. |
| [demo/questions.json](demo/questions.json) | The 12 participant-facing questions, without answers or scoring labels. |
| [demo/tasks.json](demo/tasks.json) | The 12 tasks with reference answers and required elements for scoring. |
| [demo/generate-data.mjs](demo/generate-data.mjs) | Validates the supplied data and rebuilds the participant questions and manual packet. |
| [demo/experiment_log_template.csv](demo/experiment_log_template.csv) | Unfilled observation template for answers, evidence and timing. |
| [eval/lab.pdf](eval/lab.pdf) | Evaluation Lab worksheet with the team's reported run summaries and answer key. |
| [eval/answer-key.json](eval/answer-key.json) | The ten-task answer-key table and scoring rules transcribed from the Lab. |
| [interviews/carrie-dossick-notes.md](interviews/carrie-dossick-notes.md) | Team-provided interview preparation and notes, with the source document linked. |
| [interviews/carrie-dossick-interview-record.md](interviews/carrie-dossick-interview-record.md) | Interview points organized by topic from the team notes, with paraphrased attribution. |
| [feedback/class-feedback-summary.md](feedback/class-feedback-summary.md) | LLM-assisted summary of classroom feedback on Demo 1 and Demo 2. |
| [demo/build.mjs](demo/build.mjs), [firebase.json](demo/firebase.json) | Builds demo assets and selects the existing team Hosting site and integrated build output. |
| `package.json` and `package-lock.json` in each application folder | Run commands and versioned dependencies. |

## Runtime and dependencies

Use Node.js 24.18.0 or a later Node.js 24 release. The demo requires Node.js below version 25. The development environment used Node.js 24.18.0 and npm 11.16.0.

Demo 4 RFI preparation also uses Python with `openpyxl`; its version is pinned in [demo/requirements-rfi.txt](demo/requirements-rfi.txt). PDF extraction uses the installed PDF.js package.

The website uses React and Vite. The data preparation script uses Node.js built-in modules. The demo server also uses jose for Firebase token verification. The demo's deployment tools are Firebase CLI 15.34.0 and Wrangler 4.151.0. Each application's `package-lock.json` records its resolved dependencies; use `npm ci` to install them.

## Use the live demo

Open the live demo, choose **Use this account** under one of the three sample accounts, then select **Sign in**. The assigned role appears after login. Then type or paste a question into **Your question**, then click **Ask AI**. Review the answer and its supporting corpus passages. When the response identifies unresolved source differences, **Source differences** lists each source's claim with a passage link. The **Still missing** section identifies information the response could not establish.

In the current real-record projects, **Browse source documents** opens the uploaded files and their versions. **RFI register** opens the supplied log. The Cedar Cove synthetic project remains separate. Citation links open the relevant version and highlight the cited passage. Earlier public-corpus projects retain **Browse public sources** and the manual packet. The historical 12 questions in `demo/questions.json` are separate from the 48 Demo 3 candidate cases in `eval/demo3/`; there is no question selector on the website.

Search history shows the latest four loaded records first. **Show all** expands the list and **Show less** collapses it. CSV and JSON downloads retain all loaded records; the history API currently loads up to 100 accessible records. A Foreman can open a saved answer, choose **Flag for project team review**, add a note and save it. This shares the item with the assigned team; the Project Manager can see it after refreshing the page. Reviewing an existing record does not require a new AI inference.

AI requests depend on the Cloudflare account's available Workers AI allowance. A configured connection does not guarantee remaining inference capacity. Allowance exhaustion is recorded as a failed request, not a successful answer. The interface can still display saved records when no new inference allowance is available.

## Run locally

Clone the repository:

```sh
git clone https://github.com/Li-Info/info492-sub-team4.git
cd info492-sub-team4
```

### Team website

From the repository root:

```sh
cd demo
npm ci
cd ../website
npm ci
npm run dev
```

Open the local address printed by Vite to view the homepage. Run `npm run build` inside `website/` to build the homepage and copy the demo into `website/dist/demo/`. `npm run preview` serves the resulting static pages. For local AI testing, use the demo preview described below; the deployed API accepts requests from the published site origins.

### Demo

The general demo preview uses Wrangler with local D1 storage and a remote Workers AI binding. Use a Cloudflare login authorized for Workers, D1 and AI, and enable Firebase email/password sign-in for the configured project.

```powershell
cd demo
npm ci
npx wrangler login
npm run db:local
npm start
```

Open http://127.0.0.1:8792 and stop with Ctrl+C. The preview uses a local database; cloud project records are not copied automatically. An administrator must seed local shared-project membership for accounts with an assigned shared-project claim. Existing private accounts initialize their own project. The preview has no self-registration interface. Local scheduled events can be tested by adding `--test-scheduled` to the Wrangler command and invoking its documented scheduled-event endpoint. A local preview stops when Wrangler stops; continuous monitoring requires the deployed Worker and cron.

`server.mjs` is the earlier standalone Node server. It does not implement D1 file storage, shared history or continuous monitoring; use Wrangler for the current interface.

## Data and synthetic task justification

This package prepares a small, source-attributed corpus of publicly reported Ocean Pavilion information, first used in Demo 1 and retained for Demo 2. These records remain available for the earlier demos and public-corpus projects. They are excluded from the isolated Cedar Cove and Demo 4 corpora.

The project facts come from real public sources, but the retrieval chunks are concise paraphrases rather than complete copies of the linked documents. The 12 RFI-style prompts are synthetic evaluation tasks, not real project RFIs. The corpus does not contain approved construction specifications, material submittals, inspection acceptance criteria, or actual project RFIs. A case report that says a product or material was used must be reported as a source-attributed project claim, not upgraded into an approved requirement.

Synthetic questions provide fixed tasks for comparing manual and AI search on the same information. They also let the pilot test known source disagreements and information gaps without inventing technical project facts or claiming access to private RFI correspondence. Findings from this small public-source pilot should be interpreted within that scope.

The corpus contains 8 public source records with 12 passages. Its source types include a general contractor project update, an inspection provider's retrospective case report, a product manufacturer's case study, the structural engineer's project description, owner-published progress materials, and public design-review minutes. Each source has a different evidentiary role. The source registry records those roles so answers can retain their attribution and limits.

The task bank contains 8 directly answerable tasks. There are also 2 source-disagreement tasks and 2 missing-information tasks. The disagreement tasks require both reported figures with attribution because the corpus does not reconcile them.

### Preparation and generation procedure

`corpus.json` and `tasks.json` are the curated inputs supplied with the dataset. Source records preserve publisher names, original URLs, locations and interpretation limits. The task bank provides the fixed prompts and their reference elements.

From the repository root:

```sh
cd demo
npm run generate-data
```

`generate-data.mjs` checks unique task IDs and validates the source and passage references in the scoring key. It then writes `questions.json` from the task bank and `corpus_for_manual_search.md` from the corpus. The script is deterministic and makes no LLM request. It does not recreate the original source records or the authored task bank from scratch.

`questions.json` excludes answerability labels and scoring information. `tasks.json` remains a separate scoring key. Give participants only the questions and manual packet before their session.

### Important interpretation limits

- Turner reports a minimum tank-wall thickness and project quantities. Those are contractor-reported project facts, not a substitute for approved structural drawings.
- Terracon reports that 10,000 psi high-strength grout was chosen. The source says grout; the corpus does not include the mix design, test age, curing requirements, or acceptance criteria.
- Hycrete reports use of Endure WP and describes its functions. The case study does not establish an approved dosage or independent product-performance finding.
- MKA provides structural context. Its project page does not provide design calculations or reinforcement schedules.
- Design Commission minutes record review comments and design proposals. They are not construction specifications.
- Public sources currently disagree on tank capacity and reinforcing-steel quantities. Keep the original source, units, and stated scope attached to each number.
- The waterstop task tests whether the system identifies a gap in this assembled corpus. It does not claim that the real project has no waterstop specification.

Draft drawing dimensions from the 90% Design presentation were excluded because they had not been verified against the PDF pages during preparation. EIS scoping material was not used as a concrete technical source, and permit records were not incorporated through the original portal lookup. Verify original documents before expanding the corpus with these materials.

## Local demo preview

Use the Wrangler setup above. The preview runs local application code with real Workers AI inference through the remote binding. It does not deploy the site or API. Cloudflare service access and available allowance are required.

Run `npm test` for retrieval and API regression checks. These tests use simulated AI responses where needed and do not measure model accuracy.

The **Retrieval record** is collapsed by default. Expand it to compare the retrieved passages with those actually sent to the AI and those cited in the answer. The ranked passage cards show the same stage labels and allow the evidence to be opened. Source-specific limitations remain on the source page.

In **Search history**, **Download CSV** exports one row per request for viewing in Excel or another spreadsheet application. Columns contain the question and AI answer, separate passage IDs for **Retrieved passages**, **Sent to AI** and **Cited passages**, missing information and source differences, request seconds, status and errors. **Score** and **Notes** are blank for human assessment. Failed requests remain in the export. CSV files use UTF-8 with a byte-order mark and quote multiline text.

**Raw JSON** retains the complete original records, including passage snapshots, candidate rankings, supplied and cited passage IDs, source differences, timestamps and failures. Both downloads are snapshots of the loaded account history and any failed requests retained in the current tab; downloading does not clear them. Successful request seconds measure the server retrieval-and-inference pipeline and exclude browser network overhead, participant reading and evidence review. A failed browser request uses its observed request duration when no pipeline duration is available. Keyword match scores measure lexical overlap, not answer correctness; detailed scores and search terms remain in the raw records.

## AI workflow and LLM prompts

The current model is `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, accessed through Cloudflare Workers AI. The browser sends the current question to the backend. The backend searches the public corpus and current versions of authorized uploaded files. D1 full-text search provides upload candidates; weighted keyword overlap ranks up to six passages per search. The agent can finish, choose a focused search or inspect version metadata. It is limited to three searches and eighteen accumulated passages per query. Matching uses passage text, topic, publisher, title and source limitations, with a small generic term-alias list. The complete ranking and selected passage snapshots are returned in the trace. The answer model receives the current question, selected passages and any version-tool results. A monitoring comparison also receives the saved answer and earlier evidence snapshots. This project does not train the model or use a vector search index. Retrieval is lexical and may miss paraphrases or relevant evidence; a miss does not establish absence from the whole corpus.

Demo 4 uses [demo/rfi-answer.mjs](demo/rfi-answer.mjs) for real-record answers. Its schema adds per-conclusion evidence quotations and status. The parser checks quoted text against retrieved passages and rejects known missing-file claims that contradict project inventory. The interface uses the returned `answerState` and includes insufficient conclusions in the missing-information list. These checks preserve provenance and display consistency; they do not independently grade semantic accuracy.

Earlier public-corpus projects use `instructions` in [demo/rfi.mjs](demo/rfi.mjs). Isolated uploaded-document projects use [demo/project-instructions.mjs](demo/project-instructions.mjs), without assuming that their records describe Ocean Pavilion. [demo/agent.mjs](demo/agent.mjs) adds uploaded-document rules and the tool-choice prompt. [demo/monitor.mjs](demo/monitor.mjs) contains the evidence-change comparison prompt. It requires answers to use supplied passages and cite supporting passage IDs. It also requires the model to preserve attribution, flag unresolved source differences, and identify missing context or documents needed to resolve an RFI.

`createAnswerSchema` in the same file defines `answer`, `citations`, `missingInformation` and `sourceDifferences`. Each source-difference entry contains a topic, source-attributed claims and an explanation. Its references must point to retrieved, cited passages from at least two distinct source documents. `worker.mjs` and `server.mjs` pass the prompt as a system message and serialize the current question with the retrieved passages as the user message. Citation IDs are restricted to that retrieved set. The trace records selected passage IDs separately from final citation IDs; it is an observable retrieval record, not hidden model reasoning.

The runtime does not load `tasks.json` or send reference answers to the model. Returned citation IDs are mapped to source metadata and excerpts for display. Format and known-ID validation do not prove that an excerpt supports a claim; that requires human checking.

## Evaluation materials

[eval/lab.pdf](eval/lab.pdf) contains the four-page **Evaluation Lab 10.22** tab from the [team document](https://docs.google.com/document/d/1mWZ5glFVbaz-HXh6wqxvimRZcSYoCS94IFlVUTWIhmA/edit?tab=t.ou87288eibor). It preserves the worksheet text, including its reported results for two AI runs and one manual keyword-search run.

The Lab uses ten selected tasks from the twelve-question bank. [eval/answer-key.json](eval/answer-key.json) preserves its Step 2 reference table, clarifications and scoring rules, with the matching question text from `demo/questions.json`. These reference answers are separate from participant responses and model outputs. The original source data and `demo/tasks.json` remain unchanged.

The Lab's fully grounded metric includes correct source support. The content-only protocol below is a different scoring definition for full-bank evaluation; its percentages are not interchangeable with the Lab's results. This snapshot contains the worksheet and reference key, without the original run exports or completed response sheets for those three runs.

## Experiment protocol and records

Freeze the corpus and question bank before testing. Both conditions must cover the same fixed questions and use the same source records and passages. Manual participants use `corpus_for_manual_search.md`. Do not open external pages during timed tasks or give participants the scoring key in advance.

The supplied CSV is an unfilled template with an example counterbalanced A/B allocation for two participants. Each set has four answerable tasks, one disagreement task and one missing-information task. Across that example allocation, every question appears in both conditions. Record the participants and task order actually used in the pilot; preset template labels are not completed observations.

For each question, start timing before the first reading and stop when the answer and source/passage IDs are recorded. Use the same definition in both conditions. Retain the original answer and its evidence, along with elapsed time and any failure. The website's **AI request** timer measures request latency only, so it is not the full-task time used for the manual comparison.

For Demo 2, score each of the 12 questions as pass or fail under its applicable minimum content requirements, using `tasks.json` as the reference-answer bank. Task-level content accuracy is the number of passing questions divided by 12, multiplied by 100%. Apply the same final minimum rules to manual and agent answers and report results overall and by task type.

| Task type | Minimum content requirements |
| --- | --- |
| Fact retrieval | Correct required facts, values, units and task-specific details. |
| Source differences | Both source-attributed figures in their original units, without an invented reconciliation. |
| Missing information | Identify the requested gap without inventing a parameter; identify missing approved evidence where required. |

Record the exact minimum requirements applied to each question with its judgment. The reference answers and required elements in `tasks.json` do not constitute completed observations. Keep the original responses and record who scored them. Disclose any scoring revisions or run selection made after seeing results; such decisions limit the strength of the comparison.

Check citation quality separately from content accuracy. Assess the retrieval path by comparing the required evidence with the passages retrieved, actually supplied to the model and finally cited. Use the manual recording to distinguish finding the wrong passage from omitting information after finding the right one.

Relative accuracy improvement is `(agent accuracy - manual accuracy) / manual accuracy * 100%`; the percentage-point difference is `agent accuracy - manual accuracy`. Relative improvement is undefined if manual accuracy is zero. Compare average full-task completion time only when reliable timing observations are available for both methods.

To assess missing RFI context, check whether the answer identifies what cannot be established from the supplied passages and names the document needed next. Public reports about product use do not establish project approval. For the waterstop question, for example, the missing source is the approved joint detail. Missing-context evaluation should check that distinction rather than reward a guessed product or width.

Functional checks of AI answers are separate from the comparative experiment. The blank log does not establish measured accuracy or speed. Report the actual scored comparison before claiming that the 10% hypothesis is supported.

## Build and deployment

Use the live links for review; deployment is not needed to run the local projects. The checked-in deployment settings target the team's existing accounts and require access to those accounts.

From the repository root, deploy the API, then build and deploy the main website with its integrated demo:

```sh
cd demo
npm ci
npx wrangler login
npx wrangler d1 execute info492-demo3 --remote --file schema.sql
npm run deploy:api
cd ../website
npm ci
npm run build
npx firebase login
npx firebase deploy --only hosting --project info492-sub-team-4 --config firebase.json
```

The Worker uses the `AI` and `DB` bindings and the cron trigger in `demo/wrangler.json`. Create a D1 database and update its binding ID before deploying to a different account. Apply `schema.sql` to that database. Shared-project members must be provisioned by an administrator; membership cannot be requested by changing a frontend role selector. The Hosting configuration selects site `info492-sub-team-4` and publishes the demo at `/demo/` on the team website.

Inside `demo/`, `npm run build` now runs the complete website build. That build invokes `demo/build.mjs`, whose explicit public-file allowlist bundles Firebase Auth and document parsing, inserts the Worker origin and sets the connection policy. The built demo is copied into `website/dist/demo/`. Uploaded project files are served only through the authenticated API, not as public Hosting assets. Evaluation keys in `eval/` are neither published static files nor AI context sources.

For a frontend-only update after both application folders have been installed, run `npx firebase login`, then `npm run deploy:site` inside `demo/`. This builds and publishes the existing team homepage with its integrated demo. It does not deploy the Worker API or push GitHub. The earlier standalone demo address is no longer the submission entry.

For a deployment to different accounts, update the Hosting site and project settings, the Worker name, and the API origins in the build scripts. Update `allowedOrigins` in `worker.mjs` to match the new frontend origins.

Environment files, dependency folders and generated deployment folders are excluded by `.gitignore`. Keep credentials out of Git.

