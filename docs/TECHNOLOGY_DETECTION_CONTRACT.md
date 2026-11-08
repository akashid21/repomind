# Deterministic Technology Detection Contract

**Status:** Defined for Milestone 2
**Schema version:** 1

This document defines the first deterministic technology profile produced from a local repository. It describes evidence found in repository paths and selected declarations. It does not prove that a detected technology is active at runtime.

The detection contract is stack-neutral. A technology's presence in the support matrix means RepoMind has documented detection rules for evidence signals; it does not mean RepoMind has a deep analyzer for that technology. Product support levels and the intended cross-stack baseline are defined in `PRODUCT_REQUIREMENTS.md` and `MILESTONE_TICKETS.md`.

## Command

The planned command, invoked from the RepoMind project root, is:

```sh
npm run --silent technology-profile -- <repository-path>
```

It accepts exactly one local path. Relative paths are resolved from the caller's current working directory. Root validation, canonicalization, containment, traversal, symlink handling, and inventory limits follow [`LOCAL_INVENTORY_CONTRACT.md`](LOCAL_INVENTORY_CONTRACT.md).

On success, stdout contains one schema-versioned JSON profile followed by a newline; diagnostics go to stderr. An invalid root, inventory failure, or other fatal error exits nonzero without JSON. A profile may be marked partial when optional detection inputs cannot be read, are malformed, or exceed detection read limits; it includes stable warning codes so callers can see that evidence may be incomplete. Raw parser errors and file contents are never emitted.

## Profile schema

```json
{
  "schemaVersion": 1,
  "status": "complete",
  "technologies": [
    {
      "category": "language",
      "name": "Ruby",
      "confidence": "high",
      "evidence": [
        {
          "path": "app/models/order.rb",
          "method": "file-extension"
        }
      ]
    },
    {
      "category": "framework",
      "name": "Rails",
      "confidence": "high",
      "evidence": [
        {
          "path": "Gemfile",
          "method": "manifest-declaration"
        }
      ]
    }
  ],
  "warnings": []
}
```

- `schemaVersion` is the integer `1` for this contract.
- `status` is `complete` when all eligible detection inputs were processed, or `partial` when one or more eligible inputs could not be read or processed due to a parse or resource-limit warning.
- `technologies` contains one entry per distinct `(category, name)` pair. Initial categories are `language`, `packageManager`, `framework`, `testTool`, `database`, and `infrastructure`.
- `name` is a stable display identifier from a controlled detector rule, not arbitrary text copied from the repository.
- `confidence` is `high`, `medium`, or `low` and describes how directly the available evidence supports the signal. It does not describe runtime usage or operational health.
- `evidence` contains one or more repository-relative paths and a controlled `method`: `file-extension`, `manifest-name`, `lockfile-name`, `manifest-declaration`, or `configuration-path`.
- `warnings` contains stable records with a code and repository-relative path when relevant. It never contains parser output, source excerpts, secret values, or absolute paths.

Schema v1 warning codes are `manifest-malformed`, `manifest-unreadable`, `manifest-oversized`, `manifest-count-limit`, and `manifest-total-size-limit`. Each warning identifies the affected path when there is one. A warning that indicates skipped input makes `status` partial. Count and aggregate-size limit warnings are emitted once per profile, not once for every skipped candidate.

An example warning is:

```json
{
  "code": "manifest-malformed",
  "path": "package.json"
}
```

## Meaning of a technology signal

Technology claims describe repository evidence only:

- A language signal means an inventoried file has a recognized extension. It does not mean the file is executed or maintained.
- A package-manager signal means a manager-specific lockfile, supported manager declaration, or manager-specific manifest is present. A generic `package.json` alone does not identify the package manager. It does not prove the manager was used to install the current dependencies.
- A framework or test-tool signal means a recognized dependency declaration or configuration marker exists. It does not prove the framework or tool is used by the running application.
- A database or infrastructure signal means a recognized driver declaration or configuration/deployment marker exists. It does not prove a live database, cloud service, or deployment exists.

The profile must not use terms such as “active”, “in use”, or “running” unless a later feature observes that fact through a separately defined process. Unknown or conflicting evidence must remain absent or be represented with lower confidence and warning evidence; detectors must not guess.

### Confidence guidance

- **High:** direct, unambiguous evidence from a recognized file extension, exact manifest/lockfile name, or explicit declaration in a supported manifest.
- **Medium:** a recognized configuration or deployment marker that indicates a technology family but does not identify a specific implementation or prove use.
- **Low:** indirect or ambiguous evidence that still meets a documented detector rule. Do not emit claims supported only by generic naming coincidence.

Confidence is assigned by deterministic rules. It is not a probability and must not be interpreted as a runtime-use estimate.

## Initial evidence and input boundaries

### M2-03/M2-04 language and package-manager rules

The initial language detector uses a declarative, typed extension rule table in `src/technology/detector-rules.ts`:

| Language | Recognized extensions |
|---|---|
| Ruby | `.rb`, `.rake`, `.gemspec` |
| JavaScript | `.js`, `.jsx`, `.mjs`, `.cjs` |
| TypeScript | `.ts`, `.tsx`, `.mts`, `.cts` |
| Python | `.py`, `.pyi`, `.pyw` |
| Java | `.java` |
| Go | `.go` |
| PHP | `.php`, `.phtml` |
| C# | `.cs`, `.csx` |

Each recognized inventoried file contributes high-confidence `file-extension` evidence. Multiple languages are retained. Extension matching is case-insensitive; package-manager basenames and suffixes are exact and case-sensitive.

Package-manager evidence comes from these exact basenames, at any inventoried path: `package-lock.json` or `npm-shrinkwrap.json` (npm), `yarn.lock` (Yarn), `pnpm-lock.yaml` (pnpm), `bun.lock` or `bun.lockb` (Bun), and `Gemfile.lock` (Bundler); `requirements.txt` (pip-compatible requirements), `Pipfile` (Pipenv), `Pipfile.lock` (Pipenv), `poetry.lock` (Poetry), and `uv.lock` (uv); `pom.xml` (Maven), `build.gradle` or `build.gradle.kts` (Gradle), and `gradle.lockfile` (Gradle); `go.mod` and `go.sum` (Go Modules); `composer.json` and `composer.lock` (Composer); `packages.lock.json` or a project file ending in `.csproj`, `.fsproj`, or `.vbproj` (NuGet). Lockfile names produce high-confidence `lockfile-name` evidence; manager-specific project/manifest names produce high-confidence `manifest-name` evidence. A supported `package.json` `packageManager` declaration contributes high-confidence `manifest-declaration` evidence only for recognized `npm`, `yarn`, `pnpm`, or `bun` prefixes. Unknown declaration values are ignored. A generic `package.json` does not identify a package manager.

These mappings are maintained as declarative rules separately from detector logic. Extending coverage requires adding a rule and tests, and documenting the evidence semantics here. The detector does not discover arbitrary new technologies automatically.

The detector merges duplicate claims and evidence and sorts technologies and evidence with ordinal code-point ordering. Its output is a detector result for later profile assembly; M2-07 owns the public CLI and complete profile serialization.

The M2-03/M2-04 rule set covers the language extensions and package-manager markers listed above. These are path signals and do not require reading the additional manifests or lockfiles. M2-05 adds representative framework and test-tool rules across backend and frontend ecosystems. These additions remain controlled, versioned rules with fixtures; this plan does not imply exhaustive ecosystem coverage.

### M2-05 framework and test-tool rules

Framework and test-tool declarations are matched against dependency names already returned by the bounded `package.json` and `Gemfile` readers. A matched dependency produces high-confidence `manifest-declaration` evidence at that manifest path. Supported declarations are:

| Category | Technology | Declaration source and exact dependency names |
|---|---|---|
| Framework | Rails | Gemfile: `rails` |
| Framework | Express | package.json: `express` |
| Framework | NestJS | package.json: `@nestjs/core` |
| Framework | React | package.json: `react` |
| Framework | Next.js | package.json: `next` |
| Framework | Angular | package.json: `@angular/core` |
| Framework | Vue | package.json: `vue` |
| Framework | Svelte | package.json: `svelte` |
| Framework | Django | Exact `manage.py` path basename (configuration-path, medium confidence) |
| Framework | Laravel | Exact `artisan` path basename (configuration-path, medium confidence) |
| Test tool | RSpec | Gemfile: `rspec` |
| Test tool | Minitest | Gemfile: `minitest` |
| Test tool | Jest | package.json: `jest`, or exact `jest.config.js`, `.cjs`, `.mjs`, or `.ts` basename |
| Test tool | Vitest | package.json: `vitest`, or exact `vitest.config.js`, `.ts`, or `.mts` basename |
| Test tool | Playwright | package.json: `@playwright/test` or `playwright`, or exact `playwright.config.js` or `.ts` basename |
| Test tool | Cypress | package.json: `cypress`, or exact `cypress.config.js` or `.ts` basename |

Configuration-path matches produce medium-confidence evidence. If both a declaration and a configuration path support the same claim, the claim is high confidence and retains both evidence records. These signals describe declarations or markers only. In particular, `manage.py` and `artisan` are conventional markers and may be renamed or used in nonstandard projects.

M2-05 does not read Python, Java, PHP, or .NET dependency manifests. As a result, FastAPI, Spring, and ASP.NET dependency declarations, and Laravel Composer declarations, are not yet detected. Supporting those declarations requires a separate contract-approved bounded parser; generic files such as `pom.xml` or `Program.cs` are not treated as proof of a framework. This is a detection coverage limitation, not an analyzer-support claim.

### M2-06 database and infrastructure rules

Database client declarations are matched against dependency names from the bounded `package.json` and `Gemfile` readers. They produce high-confidence `manifest-declaration` evidence at the manifest path:

| Database   | Gemfile dependencies | package.json dependencies   |
| ---------- | -------------------- | --------------------------- |
| PostgreSQL | `pg`                 | `pg`                        |
| SQLite     | `sqlite3`            | `sqlite3`, `better-sqlite3` |
| MySQL      | `mysql2`             | `mysql`, `mysql2`           |
| MongoDB    | `mongoid`            | `mongodb`, `mongoose`       |
| Redis      | `redis`              | `redis`, `ioredis`          |

An exact `database.yml` basename reports the generic `Database configuration` hint with medium-confidence `configuration-path` evidence; the detector does not infer a database vendor from that filename.

Infrastructure rules inspect inventory paths only and do not open configuration contents:

| Technology           | Recognized path signal                                                             | Evidence                                |
| -------------------- | ---------------------------------------------------------------------------------- | --------------------------------------- |
| Docker               | Exact `Dockerfile`, any basename beginning `Dockerfile.`, or exact `.dockerignore` | `configuration-path`, medium confidence |
| Docker Compose       | `compose.yaml`, `compose.yml`, `docker-compose.yaml`, or `docker-compose.yml`      | `configuration-path`, medium confidence |
| Terraform            | `.tf` or `.tf.json` suffix                                                         | `configuration-path`, medium confidence |
| Terraform            | Exact `terraform.lock.hcl`                                                         | `lockfile-name`, high confidence        |
| Kubernetes           | `kustomization.yaml` or `kustomization.yml`                                        | `configuration-path`, medium confidence |
| Helm                 | Exact `Chart.yaml`                                                                 | `configuration-path`, medium confidence |
| AWS CDK              | Exact `cdk.json`                                                                   | `configuration-path`, medium confidence |
| Serverless Framework | Exact `serverless.yml` or `serverless.yaml`                                        | `configuration-path`, medium confidence |

These signals show declared clients or repository configuration markers only. They do not prove a live database, cloud account, deployment, or runtime use. The detector never reads `.env`, credential files, cloud credential directories, or configuration values, and makes no network connections. The inventory already excludes secret and local credential paths; arbitrary paths supplied without a matching rule produce no claim.

Detectors consume M1's filtered inventory. They may inspect paths and file metadata without opening file contents. Content reads are limited to explicit, non-secret manifest formats needed for declarations:

- `package.json`: parse as JSON data; inspect only `packageManager`, `dependencies`, `devDependencies`, `optionalDependencies`, and `peerDependencies`. Never evaluate scripts or load package code. A `package.json` without a manager-specific field or lockfile does not identify npm, Yarn, pnpm, or Bun.
- `Gemfile`: inspect as inert text for simple literal dependency declarations only. Never evaluate Ruby expressions, interpolation, `eval`, or subprocess directives.

The M2-02 reader returns only the `packageManager` string and sorted dependency names from the supported JSON fields, or deduplicated literal gem names from a Gemfile. Dependency version values, scripts, and other manifest fields are not returned to callers. Unsupported files absent from the completed inventory are ignored; an eligible file that is malformed, unreadable, or changed since inventory is skipped with a warning.

The first implementation may use additional exact manifest inputs only after adding them to this allowlist with a parser and safety rule. Lockfiles and configuration/deployment files are initially path signals unless a later contract update explicitly authorizes bounded parsing. In particular, `.env` files, credential files, arbitrary source files, README text, and repository scripts are never technology-detection inputs.

Allowlisted content is processed locally in memory only. It is not logged, persisted, or sent to an AI provider. Output includes only recognized technology names, controlled methods, and relative evidence paths; it never copies raw manifest values.

Detection reads are bounded independently of M1 inventory traversal:

| Limit | Default | Behavior |
|---|---:|---|
| Maximum bytes per content-read manifest | 1,048,576 bytes (1 MiB) | Skip that input and add `manifest-oversized`; continue with other evidence. |
| Maximum content-read manifests | 100 | Skip additional candidates in stable path order and add `manifest-count-limit`; mark the profile partial. |
| Maximum aggregate bytes read | 10 MiB | Stop reading further candidates and add `manifest-total-size-limit`; mark the profile partial. |

Only files present in the completed M1 inventory are eligible. Readers must resolve each selected path under the canonical root, reject path escape, and never follow a symlink. A malformed supported manifest is skipped with `manifest-malformed`; an eligible manifest that disappears or cannot be read after inventory is skipped with `manifest-unreadable`. Unsupported fields or declaration syntax are ignored without copying their values to output. Warnings are deduplicated and sorted deterministically.

## Determinism and privacy

- Technology entries are sorted by category and then name using ordinal Unicode code-point ordering. Evidence is sorted by path, then method. Warnings are sorted by path and code.
- Duplicate evidence for the same technology, path, and method appears once.
- The profile contains no absolute paths, file contents, raw dependency values outside recognized technology names, timestamps, filesystem metadata, or inferred architecture/business-domain claims.
- Output is byte-for-byte stable for unchanged paths and contents. No generated time or machine-specific value is included.
- Repository content is untrusted data. Parsing is bounded and non-evaluating; no repository command, package manager, test, build, or network request is run.

## Known limits for schema v1

- The current implementation is a narrow first slice, not the product support boundary. The planned M2 baseline covers representative backend, frontend, package-manager, database, test-tool, and infrastructure evidence across multiple stacks.
- Language recognition is extension-based; content sniffing for arbitrary source files is out of scope.
- The implemented M2-03/M2-04 language detector recognizes only the extensions and package-manager markers listed above; other languages and manager markers are not claimed by code.
- M2-05 framework and test-tool support is limited to the exact declarations and configuration basenames in its table. Other framework/package-manager combinations remain undetected until their manifest formats have documented bounded readers.
- M2-06 database and infrastructure support is limited to the exact dependency names and path signals in its table; provider-specific configuration contents and additional cloud markers are not inspected.
- Manifest support is intentionally narrow. An unrecognized manifest, dependency alias, generated source file, or dynamic declaration may be missed.
- A successful profile is not proof that all repository technologies were identified. Warnings and confidence qualify the evidence collected.
- There is no persistence, incremental detection, runtime observation, code structure analysis, or AI inference in this milestone.
