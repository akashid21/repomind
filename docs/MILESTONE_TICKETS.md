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

- **Status:** Done
- **Goal:** Identify configured framework and test-tool hints for representative backend and frontend ecosystems.
- **Scope:** Add declarative dependency rules for Rails and JavaScript frameworks using bounded Gemfile/package.json output, plus exact configuration-path rules for Django, Laravel, and representative test-tool configs. Add rules for RSpec, Minitest, Jest, Vitest, Playwright, and Cypress. Record unsupported framework-manifest combinations that need additional readers.
- **Out of scope:** Adding new manifest parsers, proving runtime use, analyzing architecture, executing tests, and exhaustive ecosystem coverage.
- **Dependencies:** M2-01, M2-02, M2-04
- **Acceptance criteria:** Fixtures cover dependency declarations and configuration paths across Ruby, JavaScript, and Python conventions; multiple signals retain evidence and confidence is raised only by direct declaration; absent or unsupported evidence creates no claim. The contract documents the remaining parser-dependent coverage gaps.
- **Security and data integrity:** Consume only existing bounded manifest-reader output and inventoried paths; do not execute package scripts or repository-defined commands.
- **Documentation:** Update framework/test-tool rules, evidence semantics, and coverage limits in `docs/TECHNOLOGY_DETECTION_CONTRACT.md`.

### M2-06: Detect database and infrastructure hints

- **Status:** Done
- **Goal:** Report evidence-backed database and infrastructure hints across common stacks.
- **Scope:** Add database client rules for dependencies exposed by the bounded Gemfile/package.json readers, a generic database configuration marker, and path-only rules for Docker, Compose, Terraform, Kubernetes, Helm, AWS CDK, and Serverless Framework.
- **Out of scope:** Connecting to databases or cloud services, validating deployment behavior, inspecting runtime state, and architecture inference.
- **Dependencies:** M2-01, M2-02, M2-04
- **Acceptance criteria:** Fixtures detect database declarations and infrastructure path markers across Ruby and JavaScript examples; evidence is path-backed, confidence follows the contract, and generic/unsupported signals create no claim.
- **Security and data integrity:** Use only existing bounded manifest output and inventoried paths; never load `.env` values, credentials, or cloud secrets, and do not contact external systems.
- **Documentation:** Record supported indicators, secret exclusions, and limitations in `docs/TECHNOLOGY_DETECTION_CONTRACT.md`.

### M2-07: Emit a stable technology profile

- **Status:** Done
- **Goal:** Provide a CLI entry point that emits the combined technology profile as deterministic JSON.
- **Scope:** Connect the M1 inventory, bounded readers, and detectors; serialize schema-versioned output with stable ordering and clear failure behavior.
- **Out of scope:** Database storage, API endpoints, incremental indexing, and changes to the M1 inventory JSON schema.
- **Dependencies:** M2-03, M2-04, M2-05, M2-06
- **Acceptance criteria:** `npm run --silent technology-profile -- <repository-path>` accepts one repository path, emits schema-v1 JSON only on stdout, keeps diagnostics on stderr, and exits nonzero without JSON on fatal errors; repeated runs over unchanged repositories produce byte-for-byte identical output.
- **Security and data integrity:** Reuse M1 root validation and traversal safeguards; profile contains no absolute local paths, source contents, secret values, or unsubstantiated claims.
- **Documentation:** Document CLI use and profile examples in `README.md` and `docs/TECHNOLOGY_DETECTION_CONTRACT.md`.

### M2-08: Test cross-stack detection and close out documentation

- **Status:** Done
- **Goal:** Verify detection coverage, evidence quality, stable profile output, and safety across representative stacks.
- **Scope:** Add isolated detector and CLI fixtures for documented rules and categories, unsupported signals, missing/malformed/oversized manifest handling, conflicting technologies, stable output, secret-like values, and non-execution of fixture scripts; validate the end-to-end profile against the Rails + React pilot and a Node/Express + React non-pilot stack.
- **Out of scope:** Detection features reserved for later milestones, repository code execution, and persistence.
- **Dependencies:** M2-02, M2-03, M2-04, M2-05, M2-06, M2-07
- **Acceptance criteria:** Unit tests cover supported rule sets and reader limit/failure outcomes; subprocess tests prove claims are evidence-backed, unsupported and absent signals are omitted, malformed inputs produce documented partial profiles, fatal errors emit no JSON, repeated output is stable, secret values and absolute paths are omitted, and fixture scripts are never run. Both pilot and non-pilot profiles pass without narrowing product scope.
- **Security and data integrity:** Fixtures confirm secret values and absolute paths are not emitted; tests never install dependencies or execute repository scripts.
- **Documentation:** Update `README.md`, `docs/REPOSITORY_ONBOARDING.md`, `docs/TECHNOLOGY_DETECTION_CONTRACT.md`, and `docs/IMPLEMENTATION_ROADMAP.md` as needed.

## Milestone 3 — Code structure analysis

These tickets implement the M3 scope in `IMPLEMENTATION_ROADMAP.md`: a shared adapter contract, initial Ruby/JavaScript/TypeScript/Python structure extraction, snapshot-scoped symbols and dependency relationships, and clear unsupported-file reporting. Analysis is static and deterministic; no repository code is executed. The normative input, result, range, provenance, and error semantics are in [`LANGUAGE_ANALYZER_CONTRACT.md`](LANGUAGE_ANALYZER_CONTRACT.md).

### M3-01: Specify the shared language analyzer contract

- **Status:** Done
- **Goal:** Define a language-neutral contract for analyzer inputs, structural results, provenance, and failure behavior.
- **Scope:** Specify adapter selection, bounded snapshot-bound input, symbols, imports, exports, routes, references, source ranges, deterministic ordering, unsupported/partial/failed outcomes, and host responsibilities.
- **Out of scope:** Implementing a registry, parser adapters, cross-file resolution, persistence, and analysis-result CLI output.
- **Dependencies:** M2-08
- **Acceptance criteria:** The normative contract is documented in `docs/LANGUAGE_ANALYZER_CONTRACT.md`; source locations have explicit indexing conventions; each output is verifiable against the exact file content and snapshot; unsupported or malformed files cannot be mistaken for successfully analyzed empty files.
- **Security and data integrity:** Analyzer input is bounded and selected by the host from safe inventory; adapters are pure with respect to repository content and may not access the filesystem, execute code, use network, or emit source contents.
- **Documentation:** `docs/LANGUAGE_ANALYZER_CONTRACT.md`; linked from `docs/REPOSITORY_ONBOARDING.md` and `docs/SYSTEM_ARCHITECTURE.md`.

### M3-02: Implement the shared analyzer registry and result validation

- **Status:** Done
- **Goal:** Provide a deterministic registry that dispatches files to adapters and validates normalized results.
- **Scope:** Define typed interfaces, deterministic adapter selection, host-side bounded input contract, result provenance checks, safe exception containment, and per-file coverage outcomes.
- **Out of scope:** Language-specific parsing, cross-file dependency resolution, database persistence, and AI inference.
- **Dependencies:** M3-01
- **Acceptance criteria:** Tests cover supported and unsupported extension selection, ambiguous adapter registration, mismatched snapshot/path/content digests, malformed adapter results, parser exceptions, continuation after a per-file failure, stable batch ordering, and aggregate coverage counts by language and status.
- **Security and data integrity:** Host validates paths and limits before reading; adapters cannot read files, run subprocesses, install packages, or access network; diagnostics do not contain source text or secrets.
- **Documentation:** Update `LANGUAGE_ANALYZER_CONTRACT.md` only if implementation requires a compatible clarification; document the registry entry point in onboarding.

### M3-03: Add the Ruby analyzer adapter

- **Status:** Done
- **Goal:** Extract contract-compliant Ruby structures from bounded Ruby source.
- **Scope:** Implement documented Ruby symbol, import/require, constant/export-like, route, and direct-reference extraction that the selected parser supports; record parser coverage and limitations.
- **Out of scope:** Executing Ruby, resolving arbitrary dynamic dispatch, Rails runtime inspection, and project-wide architecture inference.
- **Dependencies:** M3-02
- **Acceptance criteria:** Ruby fixtures cover nested modules/classes, methods, source ranges, require forms, parse errors, dynamic/unsupported forms, and representative Rails route declarations where statically identifiable; outputs are deterministic and contract-valid.
- **Security and data integrity:** Parse source as inert text only; never load gems, evaluate Ruby, or run repository commands.
- **Documentation:** Document Ruby extraction coverage and gaps in the analyzer contract.

### M3-04: Add JavaScript and TypeScript analyzer adapters

- **Status:** Not started
- **Goal:** Extract contract-compliant structures from JavaScript and TypeScript source.
- **Scope:** Implement documented symbols, imports, exports, routes, and direct references for the syntax supported by the selected parser; keep JS/TS distinctions and parser limits explicit.
- **Out of scope:** Executing JavaScript, type-checking the target project, dependency installation, and framework runtime analysis.
- **Dependencies:** M3-02
- **Acceptance criteria:** Fixtures cover functions, classes, types, nested declarations, imports/exports, source ranges, representative statically identifiable routes, malformed syntax, and unsupported constructs; JS and TS results are deterministic and valid.
- **Security and data integrity:** Parse source text without loading project configuration or executing modules; no target repository scripts or package managers run.
- **Documentation:** Document JavaScript and TypeScript extraction coverage and gaps in the analyzer contract.

### M3-05: Add the Python analyzer adapter

- **Status:** Not started
- **Goal:** Extract contract-compliant structures from bounded Python source.
- **Scope:** Implement documented symbols, imports, exports where statically identifiable, routes, and direct references supported by the selected parser; record syntax-version coverage.
- **Out of scope:** Executing Python, importing project modules, resolving dynamic imports, and project-wide architecture inference.
- **Dependencies:** M3-02
- **Acceptance criteria:** Fixtures cover modules, classes, functions, decorators, imports, source ranges, representative statically identifiable routes, syntax errors, and unsupported syntax; results are deterministic and valid.
- **Security and data integrity:** Parse source as inert text only; never import project modules, execute Python, install dependencies, or invoke repository commands.
- **Documentation:** Document Python extraction coverage and gaps in the analyzer contract.

### M3-06: Resolve and store snapshot-scoped symbols and dependencies

- **Status:** Not started
- **Goal:** Connect per-file analyzer results into repository-level symbol and dependency records.
- **Scope:** Resolve statically identifiable imports/references across analyzed files, preserve unresolved edges, and store analysis output scoped to repository snapshot using the selected persistence approach.
- **Out of scope:** Runtime call graphs, embeddings/vector storage, project understanding summaries, and incremental re-index optimization.
- **Dependencies:** M3-03, M3-04, M3-05
- **Acceptance criteria:** Cross-file fixtures demonstrate resolved and unresolved references; re-indexing a changed snapshot does not mix symbols across snapshots; storage round-trips contract fields and source ranges.
- **Security and data integrity:** Persist only paths and structural metadata needed for indexing, with source snapshot provenance; never persist file contents in symbol records.
- **Documentation:** Document storage and resolution semantics in the analyzer contract and architecture data model.

### M3-07: Validate cross-stack analysis and close out documentation

- **Status:** Not started
- **Goal:** Verify the analyzer workflow across all initial languages and report coverage gaps clearly.
- **Scope:** Add integration fixtures for Ruby, JavaScript, TypeScript, Python, polyglot repositories, unsupported files, malformed/oversized inputs, and snapshot provenance; update onboarding and roadmap acceptance details.
- **Out of scope:** Additional languages, AI-assisted project understanding, GitHub integration, and executing repository tests/builds.
- **Dependencies:** M3-02, M3-03, M3-04, M3-05, M3-06
- **Acceptance criteria:** End-to-end tests confirm supported files yield contract-valid structures, unsupported or failed files do not abort other analysis, ordering is stable, provenance is exact, and coverage summaries distinguish detected from analyzed content.
- **Security and data integrity:** Fixtures and tests do not run target repository code or install dependencies; verify no absolute paths or source text leak into results and diagnostics.
- **Documentation:** Update `README.md`, `docs/REPOSITORY_ONBOARDING.md`, `docs/LANGUAGE_ANALYZER_CONTRACT.md`, and `docs/IMPLEMENTATION_ROADMAP.md`.

## Milestone 5 — Local AI-assisted code review

These tickets implement a local review workflow to validate RepoMind's core value before GitHub integration. The review core accepts normalized changes and repository evidence; a local CLI is the first adapter. It must produce findings grounded in the exact frozen review snapshot, keep repository code inert, and report unsupported analysis. GitHub acquisition and publishing belong to M6 and must reuse this core.

### M5-01: Specify local review input and snapshot identity

- **Status:** Not started
- **Goal:** Define the local review CLI contract, change selection, snapshot identity, and report format.
- **Scope:** Specify base/ref handling, committed and optional working-tree changes, untracked files, review snapshot identity, finding evidence fields, output ordering, failure/partial behavior, and bounded input/context limits.
- **Out of scope:** AI provider implementation, GitHub integration, persistence, and running repository tests or scripts.
- **Dependencies:** M3 and M4
- **Acceptance criteria:** A local review contract documents CLI inputs/outputs and establishes an immutable identity for every reviewed file state, including uncommitted changes; findings refer to the exact snapshot and use repository-relative paths and valid source ranges.
- **Security and data integrity:** Define secret exclusions/redaction, safe diff capture, path containment, symlink handling, and how untrusted repository text is isolated from trusted instructions.
- **Documentation:** `docs/PR_REVIEW_ENGINE.md`, `docs/SECURITY_AND_TRUST.md`, and a local review contract linked from onboarding.

### M5-02: Build normalized local change and context selection

- **Status:** Not started
- **Goal:** Turn a local comparison into a bounded review request with relevant repository context.
- **Scope:** Implement explicit base comparison, changed-file/range mapping, and selection of related analyzed symbols, dependencies, tests, and confirmed knowledge; expose unsupported-analysis gaps.
- **Out of scope:** AI calls, GitHub APIs, publishing, and executing repository tooling.
- **Dependencies:** M5-01
- **Acceptance criteria:** Fixture repositories produce deterministic local change requests and bounded evidence packets; dirty and untracked-file behavior follows the contract; unsupported files remain visible without aborting otherwise valid review preparation.
- **Security and data integrity:** Keep all paths under the selected repository, read only approved bounded content, never follow symlinks, and never execute repository code.
- **Documentation:** Update the local review contract with implemented selection behavior.

### M5-03: Add a replaceable AI provider adapter

- **Status:** Not started
- **Goal:** Allow bounded AI investigation without coupling review logic to a provider.
- **Scope:** Define a small provider interface, implement one selected provider or local-model adapter, construct bounded prompts from approved evidence, and parse structured candidate findings.
- **Out of scope:** GitHub integration, autonomous tool selection, model training, and unrestricted repository-wide prompting.
- **Dependencies:** M5-01, M5-02
- **Acceptance criteria:** Provider behavior is mockable in tests; malformed or refused responses fail safely; requests respect configured token/context bounds and identify provider/model; review orchestration remains provider-neutral.
- **Security and data integrity:** Redact likely secrets before requests, identify external source sharing, treat repository content as hostile input, and keep credentials out of logs and reports.
- **Documentation:** Update `docs/PR_REVIEW_ENGINE.md` and `docs/SECURITY_AND_TRUST.md` with provider and data-flow behavior.

### M5-04: Validate findings against the frozen snapshot

- **Status:** Not started
- **Goal:** Filter AI and deterministic candidates so the report contains only findings supported by exact source evidence.
- **Scope:** Validate file paths, snapshot identity, source ranges, claim/evidence consistency, finding schema, confidence, and duplicate findings; distinguish omitted or unverifiable candidates.
- **Out of scope:** GitHub comment placement, lifecycle tracking across commits, and claiming test/build results.
- **Dependencies:** M5-01, M5-02, M5-03
- **Acceptance criteria:** Valid candidates cite existing content and line ranges from the frozen snapshot; fabricated paths/ranges, stale snapshot evidence, unsupported test claims, malformed output, and weakly supported claims are rejected or clearly qualified with tests.
- **Security and data integrity:** Source excerpts are authoritative; model prose cannot create evidence or change policy. Findings must not include secret values.
- **Documentation:** Document validation and omission semantics in the local review contract and `docs/PR_REVIEW_ENGINE.md`.

### M5-05: Deliver local review CLI and validate the vertical slice

- **Status:** Not started
- **Goal:** Make the shared review core usable locally and prove the end-to-end review behavior before GitHub work.
- **Scope:** Add the local CLI, stable structured report, provider configuration, fixture tests with a mocked provider, and pilot/non-pilot validation cases for Rails + React and Node/Express + React; update onboarding usage.
- **Out of scope:** GitHub App/webhooks/comments, sandboxed test execution, and persistent review history unless required by a documented existing foundation.
- **Dependencies:** M5-01, M5-02, M5-03, M5-04
- **Acceptance criteria:** A developer can review a local fixture and pilot repository against an explicit base, inspect stable structured findings with snapshot-backed evidence and analysis gaps, and see clear errors/partial results. Tests prove secrets are redacted, malicious repository instructions do not alter policy, repository scripts are not run, and provider failures do not emit misleading findings.
- **Security and data integrity:** Local and external provider paths both obey bounded context and redaction rules; no tests, builds, or source scripts run as a side effect.
- **Documentation:** Update `README.md`, `docs/REPOSITORY_ONBOARDING.md`, `docs/PR_REVIEW_ENGINE.md`, and `docs/IMPLEMENTATION_ROADMAP.md`.
