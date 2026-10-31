# INFO 492 Sub Team 4

This repository contains the team website and RFI retrieval demo for a pilot study of AI-assisted information retrieval when preparing construction RFIs from a subcontractor's perspective. The project context is the Seattle Aquarium Ocean Pavilion.

The hypothesis is that AI assistance can improve information accuracy by at least 10% compared with manual search using the same documents. The evaluation worksheet records the team's reported pilot findings for a selected task set.

- [Team website](https://info492-sub-team-4.web.app/)
- [Live Demo 2](https://info492-sub-team-4.web.app/demo/)
- [Standalone demo](https://info492-team4-demo1.web.app/)

The code in `demo1/` and the live demo use the Demo 2 iteration with passage retrieval and a separate source page. The team website opens the demo at `/demo/` in the same tab. The `demo1/` folder name and standalone demo URL are retained from Demo 1.

## Mid-quarter Analysis submission materials

| Requirement | Where to find it |
| --- | --- |
| Presentation | [Week 5 Mid-quarter Analysis slides](https://docs.google.com/presentation/d/1YIg74AzIheFEJqHieDm8K1FJuRT30m_OIslvaO4vurM/edit). A UW account is required. |
| Interim paper | [Mid-quarter Analysis tab in the team document](https://docs.google.com/document/d/1mWZ5glFVbaz-HXh6wqxvimRZcSYoCS94IFlVUTWIhmA/edit?tab=t.7f1jffnywgf2). |
| Individual contribution statements | At the end of the same [Mid-quarter Analysis tab](https://docs.google.com/document/d/1mWZ5glFVbaz-HXh6wqxvimRZcSYoCS94IFlVUTWIhmA/edit?tab=t.7f1jffnywgf2). |
| Code and dependency files for the first two demos | [Demo 1 source snapshot](https://github.com/Li-Info/info492-sub-team4/tree/f958c4d87d82f6e6323ebce237b58f4254680858/demo1) and [Demo 2 source snapshot](https://github.com/Li-Info/info492-sub-team4/tree/34c14b4a538086a5665e746c2ac60f1d355f7a4f/demo1). Each includes `package.json` and `package-lock.json`. |
| Data and preparation | [Source corpus](demo1/corpus.json), [manual search packet](demo1/corpus_for_manual_search.md), [task bank](demo1/tasks.json), [participant questions](demo1/questions.json) and [preparation script](demo1/generate-data.mjs). Data provenance and synthetic-task justification are [documented below](#data-and-synthetic-task-justification). |
| LLM prompts | The `instructions` variable in [Demo 1's rfi.mjs](https://github.com/Li-Info/info492-sub-team4/blob/f958c4d87d82f6e6323ebce237b58f4254680858/demo1/rfi.mjs) and [Demo 2's rfi.mjs](https://github.com/Li-Info/info492-sub-team4/blob/34c14b4a538086a5665e746c2ac60f1d355f7a4f/demo1/rfi.mjs). The [current prompt](demo1/rfi.mjs) includes later updates. |
| Stakeholder interview transcripts | [Edited interview record](interviews/carrie-dossick-interview-record.md) and [original team notes](interviews/carrie-dossick-notes.md). The edited record is based on notes, not a recording-based transcript. |
| LLM summary of classroom feedback | [Demo 1 and Demo 2 classroom feedback summary](feedback/class-feedback-summary.md). |
| Supporting evaluation materials | [Evaluation Lab worksheet](eval/lab.pdf) and [reference answer key](eval/answer-key.json). |
| Setup and use | [Runtime and dependencies](#runtime-and-dependencies) and [local run instructions](#run-locally). |

## Repository structure

The repository root has no application package. Run installation and application commands inside `website/` or `demo1/`.

| Path | Purpose |
| --- | --- |
| [website/](website/) | React and Vite source for the team website, including its internal Demo 2 link. |
| [website/build.mjs](website/build.mjs), [firebase.json](website/firebase.json) | Builds the homepage with the demo under `/demo/` and configures the main Hosting site. |
| [demo1/index.html](demo1/index.html), [app.js](demo1/app.js), [styles.css](demo1/styles.css) | Demo interface for entering questions and reviewing answers with evidence. |
| [demo1/sources.html](demo1/sources.html), [sources.js](demo1/sources.js), [shared.js](demo1/shared.js) | Separate corpus page, passage highlighting and shared browser helpers. |
| [demo1/retrieval.mjs](demo1/retrieval.mjs), [retrieval.test.mjs](demo1/retrieval.test.mjs) | Keyword passage retrieval and pipeline regression tests. |
| [demo1/wrangler.preview.json](demo1/wrangler.preview.json) | Local preview using the existing Cloudflare login and a remote AI binding. |
| [demo1/server.mjs](demo1/server.mjs) | Local Node.js server and AI requests using server-side environment variables. |
| [demo1/worker.mjs](demo1/worker.mjs), [wrangler.json](demo1/wrangler.json) | Deployed Cloudflare Worker API and Workers AI binding. |
| [demo1/rfi.mjs](demo1/rfi.mjs) | Full LLM system prompt in `instructions`, retrieved-context response schema, corpus mapping and response validation. |
| [demo1/corpus.json](demo1/corpus.json) | Public-source summaries with attribution and source limitations. |
| [demo1/corpus_for_manual_search.md](demo1/corpus_for_manual_search.md) | Readable version of the same source records and passages for manual search. |
| [demo1/questions.json](demo1/questions.json) | The 12 participant-facing questions, without answers or scoring labels. |
| [demo1/tasks.json](demo1/tasks.json) | The 12 tasks with reference answers and required elements for scoring. |
| [demo1/generate-data.mjs](demo1/generate-data.mjs) | Validates the supplied data and rebuilds the participant questions and manual packet. |
| [demo1/experiment_log_template.csv](demo1/experiment_log_template.csv) | Unfilled observation template for answers, evidence and timing. |
| [eval/lab.pdf](eval/lab.pdf) | Evaluation Lab worksheet with the team's reported run summaries and answer key. |
| [eval/answer-key.json](eval/answer-key.json) | The ten-task answer-key table and scoring rules transcribed from the Lab. |
| [interviews/carrie-dossick-notes.md](interviews/carrie-dossick-notes.md) | Team-provided interview preparation and notes, with the source document linked. |
| [interviews/carrie-dossick-interview-record.md](interviews/carrie-dossick-interview-record.md) | Interview points organized by topic from the team notes, with paraphrased attribution. |
| [feedback/class-feedback-summary.md](feedback/class-feedback-summary.md) | LLM-assisted summary of classroom feedback on Demo 1 and Demo 2. |
| [demo1/build.mjs](demo1/build.mjs), [firebase.json](demo1/firebase.json) | Builds the demo assets and configures its Firebase Hosting site. |
| `package.json` and `package-lock.json` in each application folder | Run commands and versioned dependencies. |

## Runtime and dependencies

Use Node.js 24.18.0 or a later Node.js 24 release. The demo requires Node.js below version 25. The development environment used Node.js 24.18.0 and npm 11.16.0.

The website uses React and Vite. The demo server and data preparation script use Node.js built-in modules. The demo's deployment tools are Firebase CLI 15.34.0 and Wrangler 4.151.0. Each application's `package-lock.json` records its resolved dependencies; use `npm ci` to install them.

## Use the live demo

Open the live demo and type or paste a question into **Your question**, then click **Ask AI**. Review the answer and its supporting corpus passages. When the response identifies unresolved source differences, **Source differences** lists each source's claim with a passage link. The **Still missing** section identifies information the response could not establish.

In the Demo 2 interface, open **View source corpus** to read the supplied passages. Citation links locate and highlight the cited passage. Returning to the question page restores the answer in the same browser tab. The manual packet is available through **Download manual search packet**. The 12 evaluation questions remain in `demo1/questions.json`; there is no question selector on the website.

## Run locally

Clone the repository:

```sh
git clone https://github.com/Li-Info/info492-sub-team4.git
cd info492-sub-team4
```

### Team website

From the repository root:

```sh
cd website
npm ci
npm run dev
```

Open the local address printed by Vite to view the homepage. Run `npm run build` to build the homepage and copy the demo into `website/dist/demo/`. `npm run preview` serves the resulting static pages. For local AI testing, use the demo preview described below; the deployed API accepts requests from the published site origins.

### Demo 2

Open a separate terminal at the repository root. The following example uses PowerShell and an existing Cloudflare account with a token authorized to use Workers AI:

```powershell
cd demo1
npm ci
$env:AI_PROVIDER = 'cloudflare'
$env:CLOUDFLARE_ACCOUNT_ID = Read-Host 'Cloudflare account ID'
$tokenInput = Read-Host 'Cloudflare API token' -AsSecureString
$env:CLOUDFLARE_API_TOKEN = [System.Net.NetworkCredential]::new('', $tokenInput).Password
Remove-Variable tokenInput
npm start
```

Open [http://127.0.0.1:8792](http://127.0.0.1:8792). Stop the server with Ctrl+C. If the port is occupied, set `$env:PORT` to an available port before starting.

Credentials stay in the server process environment. Do not put tokens in source files or frontend JavaScript. Close the terminal when finished to discard the session variables. `server.mjs` reads environment variables directly and does not automatically load `.env` files.

The local server can serve the page and corpus without AI credentials. Real AI answers require valid credentials and model access. The deployed demo uses the Worker's `AI` binding instead of the local server's API token.

## Data and synthetic task justification

This package prepares a small, source-attributed corpus of publicly reported Ocean Pavilion information, first used in Demo 1 and retained for Demo 2. The deployed application uses these records.

The project facts come from real public sources, but the retrieval chunks are concise paraphrases rather than complete copies of the linked documents. The 12 RFI-style prompts are synthetic evaluation tasks, not real project RFIs. The corpus does not contain approved construction specifications, material submittals, inspection acceptance criteria, or actual project RFIs. A case report that says a product or material was used must be reported as a source-attributed project claim, not upgraded into an approved requirement.

Synthetic questions provide fixed tasks for comparing manual and AI search on the same information. They also let the pilot test known source disagreements and information gaps without inventing technical project facts or claiming access to private RFI correspondence. Findings from this small public-source pilot should be interpreted within that scope.

The corpus contains 8 public source records with 12 passages. Its source types include a general contractor project update, an inspection provider's retrospective case report, a product manufacturer's case study, the structural engineer's project description, owner-published progress materials, and public design-review minutes. Each source has a different evidentiary role. The source registry records those roles so answers can retain their attribution and limits.

The task bank contains 8 directly answerable tasks. There are also 2 source-disagreement tasks and 2 missing-information tasks. The disagreement tasks require both reported figures with attribution because the corpus does not reconcile them.

### Preparation and generation procedure

`corpus.json` and `tasks.json` are the curated inputs supplied with the dataset. Source records preserve publisher names, original URLs, locations and interpretation limits. The task bank provides the fixed prompts and their reference elements.

From the repository root:

```sh
cd demo1
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

## Local Demo 2 preview

After installing dependencies in `demo1/`, run `npm run preview` with an existing Cloudflare login. If authentication is needed, run `npx wrangler login` first. The preview is available at http://127.0.0.1:8792. This runs the interface and retrieval code locally and uses real Workers AI inference through the remote `AI` binding; it does not deploy the site or API. AI calls use the account's available allowance. Stop with Ctrl+C.

Run `npm test` for retrieval and API regression checks. These tests use simulated AI responses where needed and do not measure model accuracy.

The **Retrieval record** is collapsed by default. Expand it to compare the retrieved passages with those actually sent to the AI and those cited in the answer. The ranked passage cards show the same stage labels and allow the evidence to be opened. Source-specific limitations remain on the source page.

In **Session records**, **Download CSV** exports one row per request for viewing in Excel or another spreadsheet application. Columns contain the question and AI answer, separate passage IDs for **Retrieved passages**, **Sent to AI** and **Cited passages**, missing information and source differences, request seconds, status and errors. **Score** and **Notes** are blank for human assessment. Failed requests remain in the export. CSV files use UTF-8 with a byte-order mark and quote multiline text.

**Raw JSON** retains the complete original records, including passage snapshots, candidate rankings, supplied and cited passage IDs, source differences, timestamps and failures. Both downloads are snapshots of all requests in the current tab; downloading does not clear them. Request seconds measure the browser request, including network time, and exclude participant reading and evidence review. Keyword match scores measure lexical overlap, not answer correctness; detailed scores and search terms remain in the raw records.

## AI workflow and LLM prompts

The current model is `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, accessed through Cloudflare Workers AI. The browser sends the current question to the backend. The backend uses weighted keyword overlap to select up to four passages before inference. Matching uses passage text, topic, publisher, title and source limitations, with a small generic term-alias list. The complete ranking and selected passage snapshots are returned in the trace. The model receives only the question and selected passages. This project does not train the model or use a vector search index. Retrieval is lexical and may miss paraphrases or relevant evidence; a miss does not establish absence from the whole corpus.

The complete system prompt is the `instructions` variable in [demo1/rfi.mjs](demo1/rfi.mjs). It requires answers to use supplied passages and cite supporting passage IDs. It also requires the model to preserve attribution, flag unresolved source differences, and identify missing context or documents needed to resolve an RFI.

`createAnswerSchema` in the same file defines `answer`, `citations`, `missingInformation` and `sourceDifferences`. Each source-difference entry contains a topic, source-attributed claims and an explanation. Its references must point to retrieved, cited passages from at least two distinct source documents. `worker.mjs` and `server.mjs` pass the prompt as a system message and serialize the current question with the retrieved passages as the user message. Citation IDs are restricted to that retrieved set. The trace records selected passage IDs separately from final citation IDs; it is an observable retrieval record, not hidden model reasoning.

The runtime does not load `tasks.json` or send reference answers to the model. Returned citation IDs are mapped to source metadata and excerpts for display. Format and known-ID validation do not prove that an excerpt supports a claim; that requires human checking.

## Evaluation materials

[eval/lab.pdf](eval/lab.pdf) contains the four-page **Evaluation Lab 10.22** tab from the [team document](https://docs.google.com/document/d/1mWZ5glFVbaz-HXh6wqxvimRZcSYoCS94IFlVUTWIhmA/edit?tab=t.ou87288eibor). It preserves the worksheet text, including its reported results for two AI runs and one manual keyword-search run.

The Lab uses ten selected tasks from the twelve-question bank. [eval/answer-key.json](eval/answer-key.json) preserves its Step 2 reference table, clarifications and scoring rules, with the matching question text from `demo1/questions.json`. These reference answers are separate from participant responses and model outputs. The original source data and `demo1/tasks.json` remain unchanged.

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
cd demo1
npm ci
npx wrangler login
npm run deploy:api
cd ../website
npm ci
npm run build
npx firebase login
npx firebase deploy --only hosting --project info492-sub-team-4 --config firebase.json
```

The Worker uses the `AI` binding in `demo1/wrangler.json`. The main Hosting configuration selects site `info492-sub-team-4` and publishes the demo at `/demo/`. Its demo pages use the same Worker API as the standalone site. The API allows both main-site and standalone-site origins.

Inside `demo1/`, `npm run build` prepares only `index.html`, `sources.html`, `styles.css`, `app.js`, `sources.js`, `shared.js` and `corpus_for_manual_search.md` in `demo1/dist/`. It inserts the Worker origin from the build command into the frontend and updates the matching connection policy in `demo1/firebase.json`. The website build copies those public files into `website/dist/demo/`. The scoring key is not a published static file or an AI context source.

The standalone demo remains available at its existing URL. To update it separately, run `npm run deploy:site` inside `demo1/`; that command selects Hosting site `info492-team4-demo1` and does not deploy the homepage.

For a deployment to different accounts, update the Hosting site and project settings, the Worker name, and the API origins in the build scripts. Update `allowedOrigins` in `worker.mjs` to match the new frontend origins.

Environment files, dependency folders and generated deployment folders are excluded by `.gitignore`. Keep credentials out of Git.
