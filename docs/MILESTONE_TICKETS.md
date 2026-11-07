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
- **Scope:** Specify command shape, report fields, path representation, deterministic ordering, exclusion reporting, and configurable or fixed limits for file count, individual file size, total bytes, and path depth. Define behavior for unreadable entries, symlinks, and limit exhaustion.
- **Out of scope:** Technology detection, parsing file contents for language/framework identification, persistence, and source-code analysis.
- **Dependencies:** None
- **Acceptance criteria:** The report schema and CLI inputs/outputs are documented; exclusion rules and limit values or defaults are explicit; errors and partial-inventory behavior are defined in `LOCAL_INVENTORY_CONTRACT.md`.
- **Security and data integrity:** Specify root containment and symlink behavior. Inventory must not load environment values, inspect secret contents, or execute repository code.
- **Documentation:** `LOCAL_INVENTORY_CONTRACT.md`; linked from `REPOSITORY_ONBOARDING.md`.

### M1-02: Add the local inventory CLI command

- **Status:** Not started
- **Goal:** Provide an invokable inventory command on the Milestone 0 TypeScript foundation that accepts a repository path and emits the defined JSON report.
- **Scope:** Add the inventory command entry point and argument handling using the existing project setup; validate arguments and surface clear errors.
- **Out of scope:** API server, database, queue, GitHub integration, technology detection, and unrelated lint/format tooling beyond what is needed for this command.
- **Dependencies:** M1-01
- **Acceptance criteria:** The command can be invoked with a local path, rejects missing or invalid arguments with a useful error, and writes valid JSON to the documented output destination on success. It uses the package structure and quality tooling established in Milestone 0.
- **Security and data integrity:** Resolve and validate the root before traversal; do not invoke repository scripts or package managers.
- **Documentation:** Document the local command and its expected output.

### M1-03: Implement safe repository traversal

- **Status:** Not started
- **Goal:** Enumerate repository directories and candidate files without leaving the selected root or exceeding defined resource limits.
- **Scope:** Implement deterministic traversal, root containment checks, symlink handling, and file-count, file-size, total-byte, and path-depth limit enforcement as specified by M1-01.
- **Out of scope:** Reading source contents for semantic analysis, AST parsing, and technology detection.
- **Dependencies:** M1-01, M1-02
- **Acceptance criteria:** Traversal returns normalized repository-relative paths in stable order; outside-root traversal is prevented; unreadable entries and limit exhaustion follow the documented behavior.
- **Security and data integrity:** Never follow symlinks. Do not open or execute repository files; binary classification in v1 is based on the documented extension rules.
- **Documentation:** Update the inventory contract if implementation exposes a necessary clarification.

### M1-04: Apply exclusions and emit stable inventory JSON

- **Status:** Not started
- **Goal:** Produce a useful, reproducible inventory from traversal results.
- **Scope:** Filter generated, binary, and irrelevant paths using documented rules; retain important project inputs such as manifests, lockfiles, migrations, tests, CI and Docker configuration, and schemas; serialize the report with stable ordering and schema.
- **Out of scope:** Technology profiles, file-content summaries, language/framework claims, and persistent storage.
- **Dependencies:** M1-01, M1-03
- **Acceptance criteria:** Excluded paths do not appear as inventoried files; explicitly retained project inputs remain eligible; equivalent repository trees produce byte-for-byte stable JSON apart from any explicitly documented timestamp field.
- **Security and data integrity:** Secret exclusion is based on documented path/name rules and bounded metadata checks, not exposing secret values. Never include file contents in the report.
- **Documentation:** Document exclusion behavior and the report schema in `REPOSITORY_ONBOARDING.md` or a linked CLI usage document.

### M1-05: Add inventory tests and close out documentation

- **Status:** Not started
- **Goal:** Verify expected inventory behavior and important unsafe or malformed input cases.
- **Scope:** Add isolated fixture-based tests for valid and missing paths, non-directory paths, exclusions and retained files, deterministic ordering, symlink escape, unreadable entries where practical, binary classification, and each configured limit. Document setup and usage.
- **Out of scope:** Running tests or builds from an inventoried repository; tests for later milestone features.
- **Dependencies:** M1-02, M1-03, M1-04
- **Acceptance criteria:** Tests cover expected behavior and the listed failure cases; tests use temporary fixtures and do not execute fixture repository code; CLI usage and safety behavior are documented; Milestone 1 roadmap acceptance criteria can be checked against the resulting output.
- **Security and data integrity:** Fixtures include secret-like filenames/content to verify values are not emitted or logged. No repository scripts or dependency installation are invoked by inventory tests.
- **Documentation:** Update `IMPLEMENTATION_ROADMAP.md` and `REPOSITORY_ONBOARDING.md` if delivered behavior clarifies the milestone contract.
