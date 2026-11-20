# Demo 4: RFI records and evidence review

The current application uses the existing [team website](https://info492-sub-team-4.web.app/demo/). The two supplied RFI collections remain separate projects. Historical synthetic records remain in the Cedar Cove project.

## Data and behavior

The original PDFs and registers are in [data/demo4](data/demo4/README.md). The [source inventory](data/demo4/source-inventory.json) records their SHA-256 hashes. The RFI register retains entries even when the corresponding PDF is absent. An absent PDF is labelled `File missing - upload needed`; register status does not establish the technical answer.

Related RFIs are based on explicit document references, with the source page shown. NKC RFI 025 explicitly states that it is void and refers to 025.1. Both originals remain available. Its change log links added requests to their source text. Later uploads under the same document identity receive source-text change excerpts for review. These excerpts do not establish approval or applicability.

Answers separate conclusions into evidence found, source conflict or information missing. Evidence quotations must occur in a retrieved, cited passage. Known missing-file claims that contradict the inventory are rejected. A missing technical detail inside an available PDF can still be identified. The overall status and missing-information list include the per-conclusion findings. This checks provenance and consistency, not semantic correctness. Human review decisions remain separate.

## Local setup

Use Node.js 24.18 or a later supported Node 24 version. Install both applications and the Python preparation dependency from the repository root:

```sh
npm --prefix demo ci
npm --prefix website ci
python -m pip install -r demo/requirements-rfi.txt
```

From `demo/`, prepare the supplied files without changing their contents:

```sh
python tools/prepare-rfi-data.py --ocean data/demo4/ocean-pavilion --nkc data/demo4/nkc-seattle --output .preview/demo4-manifest.json
```

For a local preview using the existing sample accounts, sign in to the team's Cloudflare account first. The import resolves the three sample Firebase identities; their credentials are not saved in the database:

```sh
npx wrangler login
node tools/import-rfi-data.mjs --input .preview/demo4-manifest.json --db .preview/demo4-v2.sqlite --demo-accounts
npm run preview:demo4
```

The preview listens on `http://127.0.0.1:8794/`. Stop it with Ctrl+C. Cloudflare access and available Workers AI capacity are required for inference. The local database and prepared manifest are ignored by Git. Deployment credentials and private account data must remain outside the repository.

The spreadsheet reader reads cells and cached formula values without running VBA macros. Drawing geometry and handwritten annotations still require checking the original PDF. Low-text pages are listed in the source inventory.

## Validation and deployment

Run `npm test` and `npm run build` inside `demo/`. The tests cover role and project isolation, file handling, explicit missing files, void revisions, register duplicates and evidence quotations. They also cover the 025.1 citation-title regression and inconsistent answer-state display. Functional checks are separate from an experimental accuracy evaluation. Earlier scoring rules and reported results are unchanged.

The build publishes only its explicit frontend allowlist. Source datasets and evaluator keys are not copied into Firebase Hosting assets. Uploaded originals are accessed through the authenticated API. Backend changes use `npm run deploy:api`; the integrated website uses `npm run deploy:site`. Both commands target the existing team services and require the team's deployment access.

For an authorized production data import, back up the existing database with `tools/backup-project-db.mjs`. `tools/publish-rfi-data.mjs` requires an explicit apply flag and a pre-change backup. It adds project records without replacing earlier projects. D1's ordinary export does not support this database's FTS5 table; the backup tool preserves the normal table rows and schema for reconstruction.
