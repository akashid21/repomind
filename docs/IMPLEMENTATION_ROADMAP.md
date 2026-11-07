# RepoMind Implementation Roadmap

**Version:** 1.0  
**Approach:** build a useful vertical slice, then expand

## Guiding rule

Do not build the whole platform at once. Start with local repository understanding, then add PR review, GitHub integration, and feedback learning.

## Milestone 0 — Project foundation

- Create Node.js + TypeScript project.
- Add linting, formatting, test runner, and environment validation.
- Add PostgreSQL connection and initial migration strategy.
- Establish module boundaries and structured logging.
- Add `AGENTS.md` and documentation.

**Acceptance:** project runs locally, tests run, config is validated, and the first database connection works.

**Status:** Complete. The repository has a Node.js/TypeScript setup, quality scripts, validated environment configuration, structured logging, a PostgreSQL connection check, and documented SQL migration conventions. No application schema or migration runner is introduced before a feature requires one.

## Milestone 1 — Local repository inventory

- Accept a local repository path through a CLI command.
- Validate path and prevent traversal.
- Walk directories safely.
- Exclude generated, binary, and irrelevant files.
- Produce a stable inventory JSON report.

**Acceptance:** given the pilot repository, RepoMind lists files and directories without reading secrets or executing repository code.

## Milestone 2 — Deterministic technology detection

- Detect languages from file extensions and content where appropriate.
- Detect frameworks and package managers from manifests/configuration.
- Detect database and infrastructure hints.
- Record evidence, confidence, and detection method.
- Generate a technology profile JSON.

**Acceptance:** report identifies the pilot's Ruby/Rails and JavaScript/TypeScript/React stack with evidence; uncertain technologies remain uncertain.

## Milestone 3 — Code structure analysis

- Add Ruby Prism analyzer.
- Add TypeScript/JavaScript analyzer.
- Extract symbols, imports, exports, routes, and source ranges.
- Store symbols and dependency relationships.
- Add tests with small fixture repositories.

**Acceptance:** RepoMind can locate important classes/functions and identify basic direct dependencies in the pilot.

## Milestone 4 — Project understanding

- Discover logical modules.
- Infer architecture with evidence.
- Summarize business domains using bounded AI context.
- Store project knowledge with provenance and confidence.
- Add developer confirmation for important rules.

**Acceptance:** project profile is reviewable and does not present unsupported inferences as confirmed facts.

## Milestone 5 — GitHub integration

- Create GitHub App.
- Connect one repository.
- Fetch exact commit snapshots.
- Receive PR webhooks.
- Deduplicate webhook deliveries.
- Persist PR metadata and changed-file diffs.

**Acceptance:** a test PR creates a review job for the correct head SHA.

## Milestone 6 — First PR reviewer

- Retrieve changed symbols and related code.
- Add deterministic checks.
- Add AI provider adapter.
- Generate structured findings.
- Validate evidence against exact head commit.
- Publish GitHub review comments.
- Prevent stale publishing.

**Acceptance:** reviewer produces a small number of evidence-backed comments on the pilot PR and does not invent test results.

## Milestone 7 — Finding lifecycle and developer feedback

- Track findings across commits.
- Reassess old findings after new commits.
- Capture author replies.
- Classify feedback.
- Add manual approval of durable project rules.
- Retrieve approved rules in later reviews.

**Acceptance:** a developer correction can be validated, approved, and used in a later review without retraining the foundation model.

## Milestone 8 — Harden and expand

- Add isolated test execution only after sandbox design.
- Improve quality metrics and false-positive tracking.
- Add Python or another analyzer based on real demand.
- Add incremental indexing.
- Evaluate local and hosted model providers.
- Add monitoring and cost controls.

**Acceptance:** stable operation on more than one representative repository and documented limitations.

## Recommended first coding task

Implement Milestone 1 only: a local repository inventory CLI that emits JSON. Do not start with agents, embeddings, a dashboard, Redis, or GitHub webhooks.

Milestone work is tracked as sub-tickets in [`MILESTONE_TICKETS.md`](MILESTONE_TICKETS.md). Use its ticket format for future milestones; the current ticket set covers Milestone 1.

## Decision log

Record significant decisions here using:

| Date | Decision | Reason | Consequence |
|---|---|---|---|
| 2026-11-07 | Define a stable local inventory JSON contract with fixed v1 safety limits; skip all repository symlinks | Keep the first local scan predictable, bounded, and contained without following repository-controlled links | Inventory omits oversized/deep entries with counts and fails without JSON when hard file-count or total-byte limits are exceeded |
| 2026-11-07 | Set v1 inventory limits to 50 path components, 20 MiB per file, 200,000 files, and 2 GiB total included size | Leave room for larger source files and repositories while retaining explicit bounds; inventory reads metadata only | Limits are fixed for v1 and should be revisited after measuring the pilot repository |
| 2026-11-07 | Cap included directories at 200,000 | Bound report memory even for repositories containing very large numbers of empty directories | Exceeding the directory cap fails the inventory without JSON |
| TBD | Start with local inventory before GitHub App | Faster feedback and simpler debugging | GitHub acquisition comes later |
| TBD | PostgreSQL as primary store | Durable relational records and queryable review history | Vector search remains optional |
| TBD | Feedback creates curated project knowledge, not model retraining | Safer, auditable, repository-scoped learning | Human approval in MVP |
