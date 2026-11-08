# RepoMind Implementation Roadmap

**Version:** 1.1
**Approach:** build a useful vertical slice, then expand

## Guiding rule

Do not build the whole platform at once. Start with local repository understanding, then add PR review, GitHub integration, and feedback learning.

Build one stack-neutral workflow. Technology-specific behavior belongs in controlled detection rules and replaceable analyzers, not in orchestration, project-profile, review, or feedback flows. Track detection and deep-analysis coverage separately. The Rails + React POS repository is a validation pilot; it must not be treated as the only supported stack or as the architecture's organizing assumption. Validate the workflow with additional representative repositories as coverage grows.

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

**Acceptance:** given any local repository, RepoMind lists files and directories without reading secrets or executing repository code.

**Status:** Complete. The local CLI validates its root, performs bounded metadata-only traversal, filters documented paths, emits stable schema-v1 JSON, and is covered by fixture and subprocess tests. Usage and limitations are documented in `README.md` and `LOCAL_INVENTORY_CONTRACT.md`. The pilot repository is not present in this workspace, so validation against that repository remains a manual acceptance check.

## Milestone 2 — Deterministic technology detection

- Detect languages from file extensions and content where appropriate.
- Detect frameworks and package managers from manifests/configuration.
- Detect database and infrastructure hints.
- Record evidence, confidence, and detection method.
- Generate a technology profile JSON.

**Acceptance:** report identifies technologies from an explicitly documented, cross-stack initial support set with evidence; uncertain or unsupported technologies remain qualified. The pilot is one validation fixture among multiple technology examples.

**Status:** In progress. M2-01 through M2-03 are complete; remaining cross-stack detection and profile work is tracked in M2-04 through M2-08 in [`MILESTONE_TICKETS.md`](MILESTONE_TICKETS.md).

## Milestone 3 — Code structure analysis

- Define and implement a shared language-analyzer adapter contract.
- Add Ruby, JavaScript/TypeScript, and Python analyzers behind the shared adapter contract; keep parser-specific behavior behind adapters.
- Extract symbols, imports, exports, routes, and source ranges.
- Store symbols and dependency relationships.
- Add tests with small fixture repositories.

**Acceptance:** RepoMind can analyze Ruby, JavaScript/TypeScript, and Python fixtures through adapters, identify basic structures/dependencies in the Rails + React pilot and a Node/Express + React validation case, and demonstrate Python analysis on a fixture repository; unsupported files are reported clearly and do not break indexing.

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

**Acceptance:** reviewer produces evidence-backed comments on PRs from supported and partially supported stacks, identifies analysis gaps, and does not invent test results.

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

**Acceptance:** stable operation across multiple representative stacks and documented detection/analyzer coverage and limitations.

## Initial implementation task

The first implementation task was Milestone 1: a local repository inventory CLI that emits JSON. It is complete. Proceed milestone by milestone; Milestone 2 is the next planned work.

Milestone work is tracked as sub-tickets in [`MILESTONE_TICKETS.md`](MILESTONE_TICKETS.md). Use its ticket format when planning each milestone; tickets are created only for milestones selected for upcoming work. M2's remaining tickets were revised on 2026-11-08 to set a representative cross-stack detection baseline and distinguish detection from deep analyzer support.

## Decision log

Record significant decisions here using:

| Date | Decision | Reason | Consequence |
|---|---|---|---|
| 2026-11-07 | Define a stable local inventory JSON contract with fixed v1 safety limits; skip all repository symlinks | Keep the first local scan predictable, bounded, and contained without following repository-controlled links | Inventory omits oversized/deep entries with counts and fails without JSON when hard file-count or total-byte limits are exceeded |
| 2026-11-07 | Set v1 inventory limits to 50 path components, 20 MiB per file, 200,000 files, and 2 GiB total included size | Leave room for larger source files and repositories while retaining explicit bounds; inventory reads metadata only | Limits are fixed for v1 and should be revisited after measuring the pilot repository |
| 2026-11-07 | Cap included directories at 200,000 | Bound report memory even for repositories containing very large numbers of empty directories | Exceeding the directory cap fails the inventory without JSON |
| 2026-11-07 | Close M1 with fixture and subprocess coverage plus README usage instructions | Verify the user-visible CLI contract, report stability, safety properties, and failure output | Platform-specific unreadable-permission and special-file fixtures remain outside automated tests; the pilot scan remains a manual acceptance check |
| 2026-11-07 | Break Milestone 2 into seven reviewable tickets before implementation | Specify evidence and safety contracts first, then build small detector groups and a stable profile output | Initial detector rules were a narrow first slice; the M2 plan is being broadened to a documented cross-stack baseline without changing evidence-only semantics |
| 2026-11-07 | Define technology profile v1 as repository evidence, with bounded reads of `package.json` and literal `Gemfile` declarations | Keep repository content inert and limit exposure while beginning with selected manifest formats | Profile claims cite relative evidence paths and confidence; runtime usage is never inferred, and each additional manifest requires a documented parser and safety rule |
| 2026-11-08 | Keep product workflow stack-neutral and treat Rails + React as a validation pilot | Make RepoMind useful across repository stacks while using the available POS project for end-to-end experimentation | Detection coverage and deep analyzer coverage are separate; future M2/M3 work must validate representative non-pilot stacks and report unsupported areas |
| TBD | Start with local inventory before GitHub App | Faster feedback and simpler debugging | GitHub acquisition comes later |
| TBD | PostgreSQL as primary store | Durable relational records and queryable review history | Vector search remains optional |
| TBD | Feedback creates curated project knowledge, not model retraining | Safer, auditable, repository-scoped learning | Human approval in MVP |
