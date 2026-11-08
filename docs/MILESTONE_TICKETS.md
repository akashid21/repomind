# Milestone Sub-Tickets

This document defines the reusable format for breaking milestones into reviewable implementation tickets. Create tickets for a milestone when work on it is planned, and keep each ticket within that milestone's roadmap scope. Do not pre-create tickets for future milestones unless requested.

## Ticket format

Use this structure for each ticket:

```markdown
### M<N>-<NN>: <Short title>

- **Status:** Not started | In progress | Blocked | Done
- **Goal:** One outcome this ticket delivers.
- **Scope:** Concrete included work.
- **Out of scope:** Nearby work reserved for another ticket or milestone.
- **Dependencies:** Earlier tickets or `None`.
- **Acceptance criteria:** Observable conditions for completion.
- **Security and data integrity:** Relevant safeguards, or `Not applicable` with a reason.
- **Documentation:** Docs to update, or `None`.
```

Ticket IDs use the milestone number and a two-digit sequence, for example `M1-01`. Keep status current. Acceptance criteria should be testable and should not imply capabilities outside the milestone.

## Milestone 1 — Local Repository Inventory

These tickets together implement only the Milestone 1 scope in `IMPLEMENTATION_ROADMAP.md`: accept a local repository path, validate it, safely inventory files and directories, filter excluded content, and emit stable JSON. The inventory must not execute repository code or read secret values.

### M1-01: Specify inventory contract and safety limits

- **Status:** Done
- **Goal:** Define the CLI behavior and JSON inventory contract before implementation.
- **Scope:** Specify command shape, report fields, path representation, deterministic ordering, exclusion reporting, and fixed limits for directory count, file count, individual file size, total bytes, and path depth. Define behavior for unreadable entries, symlinks, and limit exhaustion.
- **Out of scope:** Technology detection, parsing file contents for language/framework identification, persistence, and source-code analysis.
- **Dependencies:** None
- **Acceptance criteria:** The report schema and CLI inputs/outputs are documented; exclusion rules and limit values or defaults are explicit; errors and partial-inventory behavior are defined in `LOCAL_INVENTORY_CONTRACT.md`.
- **Security and data integrity:** Specify root containment and symlink behavior. Inventory must not load environment values, inspect secret contents, or execute repository code.
- **Documentation:** `LOCAL_INVENTORY_CONTRACT.md`; linked from `REPOSITORY_ONBOARDING.md`.

### M1-02: Add the local inventory CLI command

- **Status:** Done
- **Goal:** Provide an invokable inventory command on the Milestone 0 TypeScript foundation that accepts and validates a repository path.
- **Scope:** Add the inventory command entry point and argument handling using the existing project setup; validate arguments and surface clear errors.
- **Out of scope:** API server, database, queue, GitHub integration, technology detection, and unrelated lint/format tooling beyond what is needed for this command.
- **Dependencies:** M1-01
- **Acceptance criteria:** The package command is registered; argument parsing accepts exactly one path; root validation resolves a directory to its canonical path, permits a symlink as the user-supplied root, and rejects missing, inaccessible, and non-directory paths with a useful error. End-to-end JSON output belongs to M1-04.
- **Security and data integrity:** Resolve and validate the root before traversal; do not invoke repository scripts or package managers.
- **Documentation:** Document the local command in the inventory contract; keep the contract's end-to-end output requirements as the milestone target.

### M1-03: Implement safe repository traversal

- **Status:** Done
- **Goal:** Enumerate repository directories and candidate files without leaving the selected root or exceeding defined resource limits.
- **Scope:** Implement deterministic traversal, root containment checks, symlink handling, and directory-count, file-count, file-size, total-byte, and path-depth limit enforcement as specified by M1-01.
- **Out of scope:** Reading source contents for semantic analysis, AST parsing, and technology detection.
- **Dependencies:** M1-01, M1-02
- **Acceptance criteria:** Traversal returns normalized repository-relative paths in stable order; outside-root traversal is prevented; unreadable entries and all configured limit outcomes follow the documented behavior.
- **Security and data integrity:** Never follow symlinks. Do not open or execute repository files; binary classification in v1 is based on the documented extension rules.
- **Documentation:** Update the inventory contract if implementation exposes a necessary clarification.

### M1-04: Apply exclusions and emit stable inventory JSON

- **Status:** Done
- **Goal:** Produce a useful, reproducible inventory from traversal results.
- **Scope:** Filter generated, binary, and irrelevant paths using documented rules; retain important project inputs such as manifests, lockfiles, migrations, tests, CI and Docker configuration, and schemas; serialize the report with stable ordering and schema.
- **Out of scope:** Technology profiles, file-content summaries, language/framework claims, and persistent storage.
- **Dependencies:** M1-01, M1-03
- **Acceptance criteria:** Excluded paths do not appear as inventoried files; explicitly retained project inputs remain eligible; equivalent repository trees produce byte-for-byte stable JSON apart from any explicitly documented timestamp field.
- **Security and data integrity:** Secret exclusion is based on documented path/name rules and bounded metadata checks, not exposing secret values. Never include file contents in the report.
- **Documentation:** Document exclusion behavior and the report schema in `REPOSITORY_ONBOARDING.md` or a linked CLI usage document.

### M1-05: Add inventory tests and close out documentation

- **Status:** Done
- **Goal:** Verify expected inventory behavior and important unsafe or malformed input cases.
- **Scope:** Add isolated fixture-based tests for valid and missing paths, non-directory paths, exclusions and retained files, deterministic ordering, symlink escape, unreadable entries where practical, binary classification, and each configured limit. Document setup and usage.
- **Out of scope:** Running tests or builds from an inventoried repository; tests for later milestone features.
- **Dependencies:** M1-02, M1-03, M1-04
- **Acceptance criteria:** Fixture tests cover root validation, exclusions and retained files, stable ordering, symlink escape, binary classification, and every configured limit. A subprocess test verifies JSON-only success output, failure output, secret value omission, and that repository scripts are not run. CLI usage and safety behavior are documented; Milestone 1 roadmap acceptance criteria are checkable from the report.
- **Security and data integrity:** Fixtures include secret-like filenames and content; tests confirm values are not emitted and scripts are not invoked. No repository scripts or dependency installation are run by inventory tests. OS permission errors and special files are not constructed in automated tests because Node's portable test APIs do not reliably create those conditions; traversal handles recoverable permission errors in code.
- **Documentation:** `README.md`, `LOCAL_INVENTORY_CONTRACT.md`, and this ticket; onboarding links to the contract.

## Milestone 2 — Deterministic Technology Detection

These tickets implement only the Milestone 2 scope in `IMPLEMENTATION_ROADMAP.md`: detect technology hints across representative common repository stacks from the M1 inventory and selected repository manifests/configuration, attach evidence and confidence, and emit a stable technology profile. Detection is deterministic; repository code and scripts are never executed. The Rails + React project is one validation fixture, not the scope boundary. Detection support does not imply AST analysis or runtime use.

### M2-01: Specify the technology profile and detection contract

- **Status:** Done
- **Goal:** Define which claims RepoMind may make, how it cites evidence, and the stable technology profile format.
- **Scope:** Specify profile fields, evidence records, confidence levels, detection methods, categories, command behavior, ordering, malformed/unsupported input handling, and the distinction between files/dependencies being present or configured versus technology being actively used.
- **Out of scope:** Implementing detectors, persistence, code parsing, runtime observation, and AI-based inference.
- **Dependencies:** M1-05
- **Acceptance criteria:** The profile schema and CLI contract are documented in `TECHNOLOGY_DETECTION_CONTRACT.md`; every technology claim can cite one or more repository-relative evidence paths and a deterministic method; the contract does not present configured dependencies as proof of active use.
- **Security and data integrity:** Define an allowlist of manifest/configuration inputs that may be read, bounded read sizes, and handling for secrets and malformed data. Repository content remains untrusted and is never executed.
- **Documentation:** `docs/TECHNOLOGY_DETECTION_CONTRACT.md`; linked from `docs/REPOSITORY_ONBOARDING.md`.

### M2-02: Add bounded manifest and configuration readers

- **Status:** Done
- **Goal:** Safely read only the contract-approved files needed by deterministic detectors.
- **Scope:** Add small typed helpers to select allowlisted paths from inventory, enforce size bounds, read and parse supported data formats without evaluation, and return clear outcomes for malformed, missing, or unsupported inputs.
- **Out of scope:** Reading arbitrary source files, language parsing, detector rules, persistence, and executing repository tools.
- **Dependencies:** M2-01
- **Acceptance criteria:** Readers accept only approved repository-relative inputs present in the M1 inventory and contained under the canonical root; oversized inputs are skipped or reported as specified by the contract; malformed data does not crash profile generation or create unsupported claims. Tests cover malformed, missing, oversized, symlinked, escaping, and unsupported inputs plus count and aggregate-byte limits.
- **Security and data integrity:** Do not follow symlinks, evaluate code, load environment values, or log file contents; reject path escapes and respect bounded reads.
- **Documentation:** `docs/TECHNOLOGY_DETECTION_CONTRACT.md` documents implemented reader behavior.

### M2-03: Detect languages and package managers

- **Status:** Done
- **Goal:** Report language and package-manager evidence deterministically from inventory paths and supported manifests.
- **Scope:** Implement extension-based language signals and explicit manifest/lockfile indicators for the initial supported set, including Ruby and JavaScript/TypeScript; emit path-backed evidence and confidence according to M2-01.
- **Out of scope:** Framework detection, parsing source code for symbols, dependency installation, and claims about runtime usage.
- **Dependencies:** M2-01, M2-02
- **Acceptance criteria:** Fixtures detect supported language and package-manager signals, preserve multiple languages, and avoid claims when evidence is absent or ambiguous; each result identifies its evidence paths.
- **Security and data integrity:** Use paths and bounded metadata/manifest parsing only; do not install packages or execute scripts.
- **Documentation:** Document supported extensions, manifests, lockfiles, and known blind spots in `docs/TECHNOLOGY_DETECTION_CONTRACT.md`.

### M2-04: Expand baseline detection across representative stacks

- **Status:** Done
- **Goal:** Recognize common languages and package managers beyond the initial Ruby and JavaScript/TypeScript rule set.
- **Scope:** Extend declarative rule tables to cover a representative baseline for Python, Java, Go, PHP, and C#/.NET alongside existing Ruby, JavaScript, and TypeScript. Include ecosystem-specific manifest and lockfile path markers where safely supported. This ticket needs no new content readers because these signals come from inventoried names and extensions; keep rules separate from detector control flow.
- **Out of scope:** Exhaustive language coverage, source-content sniffing, framework detection, AST analysis, and claims about runtime use.
- **Dependencies:** M2-01, M2-02, M2-03
- **Acceptance criteria:** Fixtures detect each documented language and package-manager rule, preserve polyglot repositories, cite paths, and ignore absent, malformed, or unknown declarations without inventing claims. Adding a supported mapping does not require changing generic detector control flow.
- **Security and data integrity:** Use only normalized inventory paths and existing bounded manifest-reader output; do not open additional repository files, run package managers, tests, or repository-defined commands.
- **Documentation:** Update the cross-stack language/package-manager support table and known blind spots in `docs/TECHNOLOGY_DETECTION_CONTRACT.md`.

### M2-05: Detect frameworks and test tools across stacks

- **Status:** Not started
- **Goal:** Identify configured framework and test-tool hints for representative backend and frontend ecosystems.
- **Scope:** Add declarative dependency/configuration rules for the documented initial set, including Rails, Express/NestJS, Django/FastAPI, Spring, ASP.NET, Laravel, React/Next.js, Angular, Vue, and Svelte, plus representative test tools such as RSpec, Minitest, Jest, Vitest, Playwright, and Cypress.
- **Out of scope:** Proving runtime use, analyzing architecture, executing tests, and exhaustive ecosystem coverage.
- **Dependencies:** M2-01, M2-02, M2-04
- **Acceptance criteria:** Fixtures cover documented indicators from more than the pilot stack; multiple or conflicting signals remain evidence-backed and qualified; absent or malformed evidence does not become an unsupported claim.
- **Security and data integrity:** Parse allowlisted files as data only; do not execute package scripts or repository-defined commands.
- **Documentation:** Update framework/test-tool rules, evidence semantics, and coverage limits in `docs/TECHNOLOGY_DETECTION_CONTRACT.md`.

### M2-06: Detect database and infrastructure hints

- **Status:** Not started
- **Goal:** Report evidence-backed database and infrastructure hints across common stacks.
- **Scope:** Add declarative rules for representative database clients/configuration and Docker, Compose, Terraform, Kubernetes, and cloud configuration markers.
- **Out of scope:** Connecting to databases or cloud services, validating deployment behavior, inspecting runtime state, and architecture inference.
- **Dependencies:** M2-01, M2-02, M2-04
- **Acceptance criteria:** Fixtures detect documented hints across more than one stack; unknown or incomplete evidence remains qualified and path-backed.
- **Security and data integrity:** Never load `.env` values, credentials, or cloud secrets; parse only allowlisted non-secret configuration and do not contact external systems.
- **Documentation:** Record supported indicators, secret exclusions, and limitations in `docs/TECHNOLOGY_DETECTION_CONTRACT.md`.

### M2-07: Emit a stable technology profile

- **Status:** Not started
- **Goal:** Provide a CLI entry point that emits the combined technology profile as deterministic JSON.
- **Scope:** Connect the M1 inventory, bounded readers, and detectors; serialize schema-versioned output with stable ordering and clear failure behavior.
- **Out of scope:** Database storage, API endpoints, incremental indexing, and changes to the M1 inventory JSON schema.
- **Dependencies:** M2-03, M2-04, M2-05, M2-06
- **Acceptance criteria:** The documented CLI accepts one repository path, emits only valid stable JSON on success, keeps diagnostics on stderr, and exits nonzero without partial JSON on fatal errors; repeated runs over unchanged fixtures produce byte-for-byte identical output.
- **Security and data integrity:** Reuse M1 root validation and traversal safeguards; profile contains no absolute local paths, source contents, secret values, or unsubstantiated claims.
- **Documentation:** Document CLI use and profile examples in `README.md` and `docs/TECHNOLOGY_DETECTION_CONTRACT.md`.

### M2-08: Test cross-stack detection and close out documentation

- **Status:** Not started
- **Goal:** Verify detection coverage, evidence quality, stable profile output, and safety across representative stacks.
- **Scope:** Add isolated fixtures for each documented supported stack and category, unsupported signals, missing/malformed/oversized manifests, conflicting evidence, stable output, and secret-like values; validate the profile against the Rails + React pilot and at least one non-pilot stack fixture.
- **Out of scope:** Detection features reserved for later milestones, repository code execution, and persistence.
- **Dependencies:** M2-02, M2-03, M2-04, M2-05, M2-06, M2-07
- **Acceptance criteria:** Tests prove technology claims are evidence-backed, uncertain or absent signals are not overstated, malformed inputs are handled as specified, outputs are stable, fixture scripts are never run, and pilot validation does not narrow the product contract.
- **Security and data integrity:** Fixtures confirm secret values and absolute paths are not emitted; tests never install dependencies or execute repository scripts.
- **Documentation:** Update `README.md`, `docs/REPOSITORY_ONBOARDING.md`, `docs/TECHNOLOGY_DETECTION_CONTRACT.md`, and `docs/IMPLEMENTATION_ROADMAP.md` as needed.
