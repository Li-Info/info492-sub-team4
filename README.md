# INFO 492 Sub Team 4

This repository contains the team website and Demo 1 for a pilot study of AI-assisted information retrieval when preparing construction RFIs from a subcontractor's perspective. The project context is the Seattle Aquarium Ocean Pavilion.

The hypothesis is that AI assistance can improve information accuracy by at least 10% compared with manual search using the same documents. The repository does not report a measured accuracy improvement.

- [Team website](https://info492-sub-team-4.web.app/)
- [Live Demo 1](https://info492-team4-demo1.web.app/)

## Repository structure

The repository root has no application package. Run installation and application commands inside `website/` or `demo1/`.

| Path | Purpose |
| --- | --- |
| [website/](website/) | React and Vite source for the team website, including its Demo 1 link. |
| [demo1/index.html](demo1/index.html), [app.js](demo1/app.js), [styles.css](demo1/styles.css) | Demo interface for entering questions and reviewing answers with evidence. |
| [demo1/server.mjs](demo1/server.mjs) | Local Node.js server and AI requests using server-side environment variables. |
| [demo1/worker.mjs](demo1/worker.mjs), [wrangler.json](demo1/wrangler.json) | Deployed Cloudflare Worker API and Workers AI binding. |
| [demo1/rfi.mjs](demo1/rfi.mjs) | Full LLM system prompt in `instructions`, response schema, corpus mapping and response validation. |
| [demo1/corpus.json](demo1/corpus.json) | Public-source summaries with attribution and source limitations. |
| [demo1/corpus_for_manual_search.md](demo1/corpus_for_manual_search.md) | Readable version of the same source records and passages for manual search. |
| [demo1/questions.json](demo1/questions.json) | The 12 participant-facing questions, without answers or scoring labels. |
| [demo1/tasks.json](demo1/tasks.json) | The 12 tasks with reference answers and required elements for scoring. |
| [demo1/generate-data.mjs](demo1/generate-data.mjs) | Validates the supplied data and rebuilds the participant questions and manual packet. |
| [demo1/experiment_log_template.csv](demo1/experiment_log_template.csv) | Unfilled observation template for answers, evidence and timing. |
| [demo1/build.mjs](demo1/build.mjs), [firebase.json](demo1/firebase.json) | Builds the demo assets and configures its Firebase Hosting site. |
| `package.json` and `package-lock.json` in each application folder | Run commands and versioned dependencies. |

## Runtime and dependencies

Use Node.js 24.18.0 or a later Node.js 24 release. The demo requires Node.js below version 25. The development environment used Node.js 24.18.0 and npm 11.16.0.

The website uses React and Vite. The demo server and data preparation script use Node.js built-in modules. The demo's deployment tools are Firebase CLI 15.34.0 and Wrangler 4.151.0. Each application's `package-lock.json` records its resolved dependencies; use `npm ci` to install them.

## Use the live demo

Open the live demo and type or paste a question into **Your question**, then click **Ask AI**. Review the answer and its supporting corpus passages. The **Still missing** section identifies information the response could not establish.

Expand a source in **Source corpus** to read its supplied passages. The manual packet is available through **Download manual search packet**. The 12 evaluation questions remain in `demo1/questions.json`; there is no question selector on the website.

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

Open the local address printed by Vite. Run `npm run build` to create `website/dist/`, or `npm run preview` to preview that build.

### Demo 1

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

This package prepares a small, source-attributed corpus of publicly reported Ocean Pavilion information for Demo 1. The deployed application now uses these records.

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

## AI workflow and LLM prompts

The current model is `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, accessed through Cloudflare Workers AI. The browser sends the current question to the backend. The backend sends that question and all 12 corpus passages to the model. The model is an existing model; this project does not train it or use a vector search index.

The complete system prompt is the `instructions` variable in [demo1/rfi.mjs](demo1/rfi.mjs). It requires answers to use supplied passages and cite supporting passage IDs. It also requires the model to preserve attribution, flag unresolved source differences, and identify missing context or documents needed to resolve an RFI.

`answerSchema` in the same file defines `answer`, `citations` and `missingInformation`. `worker.mjs` and `server.mjs` pass the prompt as a system message and serialize the current question with `dataset.documents` as the user message.

The runtime does not load `tasks.json` or send reference answers to the model. Returned citation IDs are mapped to source metadata and excerpts for display. Format and known-ID validation do not prove that an excerpt supports a claim; that requires human checking.

## Experiment protocol and records

Freeze the corpus and question bank before testing. Both conditions must cover the same fixed questions and use the same source records and passages. Manual participants use `corpus_for_manual_search.md`. Do not open external pages during timed tasks or give participants the scoring key in advance.

The supplied CSV is an unfilled template with an example counterbalanced A/B allocation for two participants. Each set has four answerable tasks, one disagreement task and one missing-information task. Across that example allocation, every question appears in both conditions. Record the participants and task order actually used in the pilot; preset template labels are not completed observations.

For each question, start timing before the first reading and stop when the answer and source/passage IDs are recorded. Use the same definition in both conditions. Retain the original answer and its evidence, along with elapsed time and any failure. The website's **AI request** timer measures request latency only, so it is not the full-task time used for the manual comparison.

Score required elements against `tasks.json`. Accuracy is the total number of correct required elements divided by the total number of required elements. Check citation support separately and report results by task type. Compare average full-task completion time using actual observations.

To assess missing RFI context, check whether the answer identifies what cannot be established from the supplied passages and names the document needed next. Public reports about product use do not establish project approval. For the waterstop question, for example, the missing source is the approved joint detail. Missing-context evaluation should check that distinction rather than reward a guessed product or width.

Functional checks of AI answers are separate from the comparative experiment. The blank log does not establish measured accuracy or speed. Report the actual scored comparison before claiming that the 10% hypothesis is supported.

## Build and deployment

Use the live links for review; deployment is not needed to run the local projects. The checked-in deployment settings target the team's existing accounts and require access to those accounts.

From the repository root, deploy the demo API and site separately:

```sh
cd demo1
npm ci
npx wrangler login
npm run deploy:api
npx firebase login
npm run deploy:site
```

The Worker uses the `AI` binding in `wrangler.json`. The demo Hosting configuration selects site `info492-team4-demo1` in Firebase project `info492-sub-team-4`. Its deployment command does not deploy the main team website.

`npm run build` publishes only `index.html`, `styles.css`, `app.js` and `corpus_for_manual_search.md` to `demo1/dist/`. It inserts the Worker origin from the build command into the frontend and updates the matching connection policy in `demo1/firebase.json`. The scoring key is not a published static file or an AI context source.

For a deployment to different accounts, update the Hosting site and project settings, the Worker name, and the build command's API origin. Update `allowedOrigins` in `worker.mjs` to match the new frontend origin. The website has its own Firebase configuration in `website/` and is built and deployed separately.

Environment files, dependency folders and generated deployment folders are excluded by `.gitignore`. Keep credentials out of Git.
