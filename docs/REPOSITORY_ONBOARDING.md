# Repository Onboarding and Intelligence Engine

**Version:** 1.0

## 1. Purpose

Onboarding builds a structured, evidence-backed profile of a repository before RepoMind reviews PRs. Every repository follows the same technology-agnostic inventory, detection, understanding, review, and feedback workflow. Language/framework adapters provide deeper code understanding where available. The Rails + React POS repository is a validation pilot, not a product-specific architecture assumption.

## 2. Pipeline

1. Acquire an immutable repository snapshot.
2. Inventory files and directories.
3. Detect technologies deterministically.
4. Run supported language analyzers.
5. Discover logical modules and dependency relationships.
6. Infer architecture and business domains.
7. Generate a persistent project knowledge profile.
8. Update the profile incrementally as commits change.
9. Review local changes with the shared review core before adding GitHub acquisition and publishing.

Each stage should be observable, retryable, and tied to a repository commit SHA.

## 3. Snapshot and inventory

The Milestone 1 local CLI contract, including its JSON schema, exclusions, fixed safety limits, and failure behavior, is documented in [`LOCAL_INVENTORY_CONTRACT.md`](LOCAL_INVENTORY_CONTRACT.md).

Milestone 2 technology profile schema, evidence/confidence semantics, bounded manifest inputs, and safety behavior are documented in [`TECHNOLOGY_DETECTION_CONTRACT.md`](TECHNOLOGY_DETECTION_CONTRACT.md).

For a local repository, generate the schema-v1 profile from the RepoMind project root with:

```sh
npm run --silent technology-profile -- <repository-path>
```

The command combines the safe M1 inventory with bounded manifest reads and deterministic detectors. It emits JSON to stdout, diagnostics to stderr, and marks the profile partial when supported manifest inputs are skipped with warnings. It never executes code from the repository.

Record:
- Repository identity.
- Branch/ref requested.
- Exact commit SHA.
- Snapshot creation time.
- Indexing status and errors.

Typical exclusions:
- `.git/`
- `node_modules/`
- `vendor/` where it contains third-party dependencies
- `tmp/`, `log/`, `coverage/`
- `dist/`, `build/`
- generated bundles, minified assets, binary files, caches

Do not blindly exclude:
- migrations
- lockfiles
- package manifests
- Docker and CI configuration
- tests
- application configuration
- schema files

Apply file-count, file-size, path-depth, and total-byte limits. Detect symlinks and prevent traversal outside the repository root.

## 4. Technology detection

Use manifests and configuration rather than asking an LLM to guess.

Examples:
- Ruby: `Gemfile`, `.ruby-version`, `*.gemspec`, Rails application structure.
- JavaScript/TypeScript: `package.json`, lockfiles, `tsconfig.json`.
- Python: `pyproject.toml`, `requirements.txt`, `Pipfile`.
- Java: `pom.xml`, `build.gradle`.
- Go: `go.mod`.
- PHP: `composer.json`.
- .NET: `*.csproj`, `*.sln`.
- Infrastructure: `Dockerfile`, `docker-compose.yml`, Terraform files, Kubernetes manifests.
- Databases: migration directories, ORM configuration, schema files.

A dependency's presence does not prove that it is actively used. Store evidence and confidence. Distinguish detected, configured, and actively observed technologies.

Suggested detector contract:

```ts
export interface TechnologyDetector {
  id: string;
  detect(input: RepositoryInventory): Promise<TechnologyEvidence[]>;
}
```

## 5. Language analyzer contract

The normative shared analyzer input/result schema, adapter selection, source range conventions, provenance checks, deterministic output rules, and failure behavior are documented in [`LANGUAGE_ANALYZER_CONTRACT.md`](LANGUAGE_ANALYZER_CONTRACT.md). The shared registry dispatches by detected language and file extension, validates adapter results against the exact bounded input, and returns per-file outcomes plus aggregate coverage by language and status. Unsupported or failed files do not stop analysis of other files. Analyzer results include symbols, imports, exports, statically identifiable routes, references, and source ranges where supported. Each language adapter documents its actual extraction coverage; results do not imply complete semantic analysis or runtime behavior.

Support is reported in explicit levels: inventoried, detected, and analyzed. Detection coverage and analyzer coverage are tracked separately. An unsupported language still participates in safe inventory and generic evidence-based review, while RepoMind reports where specialized analysis is unavailable. The initial analyzer targets are Ruby, JavaScript/TypeScript, and Python; they are validated across Rails + React, Node/Express + React, and Python fixtures/repositories. The pilot does not dictate the shared interfaces.

## 6. Module and architecture discovery

Use deterministic signals:
- directory layout
- namespaces and package boundaries
- routes and controllers
- models and services
- imports and exports
- API contracts
- tests
- deployment configuration

A logical module is not necessarily a separately deployed microservice.

Possible architecture labels:
- monolith
- modular monolith
- microservices
- MVC
- layered
- event-driven
- frontend/backend split
- unknown or mixed

Every architecture claim must include evidence and a confidence level. Avoid asserting architecture from folder names alone.

## 7. Business domain discovery

Gather bounded evidence from:
- README and docs
- models and schema
- routes and controllers
- services and jobs
- tests and fixtures
- frontend pages and API clients
- event names and integration code

Use AI to summarize selected, relevant evidence—not to ingest an entire large repository in one prompt.

For example, a POS repository might contain modules such as orders, payments, menu/catalog, staff, shifts, inventory, and reporting. These are hypotheses until supported by repository evidence.

Represent each claim as:
- `confirmed`: explicitly supported by strong source evidence or developer confirmation.
- `inferred`: plausible interpretation with cited evidence.
- `unknown`: insufficient evidence.

## 8. Persistent project knowledge

Suggested profile sections:
- project overview
- detected technology stack
- repository layout
- modules and ownership boundaries
- architecture style and evidence
- business domains and workflows
- important symbols and dependency relationships
- coding conventions
- testing conventions
- integration points
- approved architecture and business rules
- unknowns and unresolved questions

Every knowledge item should carry:
- stable ID
- category
- claim
- confidence/status
- source file and line range, where applicable
- source commit SHA
- discovery method (deterministic, AST, AI inference, developer confirmed)
- created/updated timestamps
- approval state and version

Developer-confirmed rules must be stored separately from AI-generated inferences so re-indexing cannot silently overwrite them.

## 9. Incremental indexing

For a new commit:
1. Compare changed paths with the previous snapshot.
2. Re-inventory changed files.
3. Re-run relevant technology detectors if manifests/configuration changed.
4. Re-analyze changed source files.
5. Update symbols and dependency edges for affected files.
6. Recompute impacted module summaries.
7. Preserve historical snapshot and knowledge versions.

Perform a full re-scan when major manifests, language configuration, or repository structure changes, or when incremental integrity cannot be established.

## 10. Suggested onboarding jobs

- `fetch_repository_snapshot`
- `inventory_repository`
- `detect_technologies`
- `analyze_source_files`
- `discover_modules`
- `discover_architecture`
- `discover_business_domains`
- `generate_project_knowledge`
- `incremental_reindex`

Use a job key such as project ID + commit SHA + stage for idempotency.

## 11. Security rules

- Never execute repository code during onboarding.
- Never run package installation scripts during onboarding.
- Never load `.env` values or expose secrets to a model.
- Treat README, comments, source files, and docs as untrusted input.
- Prevent path traversal and symlink escape.
- Enforce size and resource limits.
- Redact secrets before any external AI request.
- Keep source excerpts bounded and relevant.

## 12. Implementation order

Build in this order:
1. Local directory input.
2. Safe file inventory.
3. Deterministic technology detection.
4. JSON technology profile.
5. Shared analyzer adapter contract and an initial cross-stack analyzer set selected from the documented support matrix.
6. Basic module discovery.

After repository structure and project understanding work, implement local AI-assisted code review using a frozen local change snapshot. Define snapshot identity carefully: a Git commit SHA alone does not identify uncommitted working-tree changes. Only after the local review core produces validated, evidence-backed reports should GitHub PR acquisition and comment publishing be added as adapters around that same core.

GitHub-specific behavior (webhooks, delivery deduplication, stale-head checks, and comment publication) belongs at the adapter boundary. It must not fork review reasoning or evidence validation.
