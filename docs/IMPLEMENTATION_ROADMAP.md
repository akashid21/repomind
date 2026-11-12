# RepoMind Implementation Roadmap

**Version:** 1.3
**Approach:** build a useful vertical slice, then expand

## Guiding rule

Do not build the whole platform at once. Start with local repository understanding, prove the core review workflow on local changes, then add GitHub integration and feedback learning.

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

**Status:** Complete. M2-01 through M2-08 are complete. The local `technology-profile` CLI combines the M1 inventory, bounded manifest reads, and deterministic detectors; representative Rails + React and Node/Express + React fixtures validate the end-to-end flow. Detection coverage remains bounded by the declarations and path rules listed in the technology detection contract; additional manifest readers are still required for some ecosystems.

## Milestone 3 — Code structure analysis

- Define and implement the shared language-analyzer adapter contract in [`LANGUAGE_ANALYZER_CONTRACT.md`](LANGUAGE_ANALYZER_CONTRACT.md).
- Add Ruby, JavaScript/TypeScript, and Python analyzers behind the shared adapter contract; keep parser-specific behavior behind adapters.
- Extract symbols, imports, exports, routes, and source ranges.
- Store symbols and dependency relationships.
- Add tests with small fixture repositories.

**Acceptance:** RepoMind can analyze Ruby, JavaScript/TypeScript, and Python fixtures through adapters, identify basic structures/dependencies in the Rails + React pilot and a Node/Express + React validation case, and demonstrate Python analysis on a fixture repository; unsupported files are reported clearly and do not break indexing.

**Status:** In progress. M3-01 and M3-02 are complete: the contract and shared registry are in place. M3-03 through M3-07 remain planned in `MILESTONE_TICKETS.md`.

## Milestone 4 — Project understanding

- Discover logical modules.
- Infer architecture with evidence.
- Summarize business domains using bounded AI context.
- Store project knowledge with provenance and confidence.
- Add developer confirmation for important rules.

**Acceptance:** project profile is reviewable and does not present unsupported inferences as confirmed facts.

## Milestone 5 — Local AI-assisted code review

- Accept a local repository and an explicit comparison base (commit or branch) through a CLI.
- Capture and identify the exact review snapshot, including working-tree changes when requested.
- Select bounded changed-code context plus relevant symbols, dependencies, tests, and confirmed project knowledge.
- Run deterministic checks and supported analyzers before AI investigation.
- Add a replaceable AI provider adapter for bounded, evidence-seeking investigation.
- Validate structured findings against the exact local snapshot and emit a stable review report.

**Acceptance:** a developer can run a local review over a supported fixture and the Rails + React pilot, receive a stable structured report with evidence-backed findings, see unsupported-analysis gaps, and verify that repository code is never executed and secrets are not sent to providers. The review core must have no GitHub dependency so the later GitHub milestone can reuse it.

**Status:** Planned. This milestone is the first end-to-end test of RepoMind's main code-review goal; M5 tickets are defined in `MILESTONE_TICKETS.md`.

## Milestone 6 — GitHub integration

- Create GitHub App.
- Connect one repository.
- Fetch exact commit snapshots.
- Receive PR webhooks.
- Deduplicate webhook deliveries.
- Persist PR metadata and changed-file diffs.
- Adapt GitHub PR input and comment publishing to the shared review core from M5.

**Acceptance:** a test PR creates an idempotent review job for the correct base and head SHAs, reuses the local review core, and publishes only validated findings against the current head.

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
- Add incremental indexing.
- Evaluate local and hosted model providers.
- Add monitoring and cost controls.

**Acceptance:** stable operation across multiple representative stacks and documented detection/analyzer coverage and limitations.

## Initial implementation task

Milestones 1 and 2 are complete. M3 and M4 build repository understanding; M5 exercises local AI-assisted review before M6 adds GitHub acquisition and publishing. Proceed milestone by milestone.

Milestone work is tracked as sub-tickets in [`MILESTONE_TICKETS.md`](MILESTONE_TICKETS.md). Use its ticket format when planning each milestone; tickets are created only for milestones selected for upcoming work. M2's remaining tickets were revised on 2026-11-08 to set a representative cross-stack detection baseline and distinguish detection from deep analyzer support. M3 tickets were created on 2026-11-09, with M3-01 defining the normative analyzer contract before implementation.

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
| 2026-11-08 | Validate the review core locally before integrating GitHub | Test the product's main code-review value with faster local iteration and fewer platform dependencies | M5 provides local diff review and a reusable input/output core; M6 adapts GitHub PRs and publishing to that core |
| 2026-11-09 | Define analyzer results around immutable snapshot identity, normalized source ranges, and explicit per-file outcomes | Make parser adapters replaceable while ensuring every extracted fact can be checked against exact source | M3 adapters return deterministic, source-free structural records; unsupported, partial, and failed analysis are distinct outcomes |
| TBD | Start with local inventory before GitHub App | Faster feedback and simpler debugging | GitHub acquisition comes later |
| TBD | PostgreSQL as primary store | Durable relational records and queryable review history | Vector search remains optional |
| TBD | Feedback creates curated project knowledge, not model retraining | Safer, auditable, repository-scoped learning | Human approval in MVP |
