# RepoMind

**Universal, repository-aware AI code reviewer**

RepoMind connects to a software repository, builds an evidence-backed understanding of its structure and conventions, and uses that context to review GitHub pull requests.

## Documentation map

- [`docs/PRODUCT_REQUIREMENTS.md`](docs/PRODUCT_REQUIREMENTS.md) — product vision, users, scope, requirements, and MVP.
- [`docs/SYSTEM_ARCHITECTURE.md`](docs/SYSTEM_ARCHITECTURE.md) — components, data flow, storage, security, and proposed stack.
- [`docs/REPOSITORY_ONBOARDING.md`](docs/REPOSITORY_ONBOARDING.md) — repository discovery and persistent project knowledge.
- [`docs/LOCAL_INVENTORY_CONTRACT.md`](docs/LOCAL_INVENTORY_CONTRACT.md) — local inventory CLI contract, JSON report, exclusions, and safety limits.
- [`docs/TECHNOLOGY_DETECTION_CONTRACT.md`](docs/TECHNOLOGY_DETECTION_CONTRACT.md) — technology profile schema, evidence rules, and bounded detection inputs.
- [`docs/PR_REVIEW_ENGINE.md`](docs/PR_REVIEW_ENGINE.md) — PR review workflow, evidence, findings, and re-review.
- [`docs/DEVELOPER_FEEDBACK_AND_LEARNING.md`](docs/DEVELOPER_FEEDBACK_AND_LEARNING.md) — how the reviewer should handle developer replies and learn repository-specific conventions.
- [`docs/IMPLEMENTATION_ROADMAP.md`](docs/IMPLEMENTATION_ROADMAP.md) — staged implementation plan and acceptance criteria.
- [`docs/SECURITY_AND_TRUST.md`](docs/SECURITY_AND_TRUST.md) — untrusted repository content, sandboxing, secrets, and permissions.
- [`AGENTS.md`](AGENTS.md) — working instructions for Codex and other coding agents.

## Product decisions

- Initial use: one developer, one GitHub repository, and a friend's Rails + React POS application as the pilot.
- Long-term direction: support arbitrary technology stacks through a technology-agnostic core and language-specific analyzer adapters.
- Initial PR platform: GitHub.
- Initial product is a personal tool, not a multi-tenant SaaS.
- The reviewer must be evidence-led and conservative. It must not approve or merge PRs autonomously.
- Developer feedback can become repository-specific knowledge only after validation and explicit recording.
- Exact source code at a specific commit is the source of truth. AI summaries and embeddings are supporting indexes, not authoritative facts.

## How to use with Codex

1. Put this folder's contents in the root of your RepoMind Git repository.
2. Open the repository in VS Code.
3. Start Codex with: **"Read `AGENTS.md` and the docs in `docs/`. Follow them as the source of truth. Implement only the next milestone in `docs/IMPLEMENTATION_ROADMAP.md`."**
4. Keep these docs updated as architecture and product decisions change.
5. Commit documentation and implementation changes together when appropriate.

## Local development foundation

Requirements: Node.js 22 or newer and PostgreSQL 15 or newer.

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and adjust `DATABASE_URL` for your local PostgreSQL instance.
3. Run `npm run dev` to start the foundation process, or `npm run db:check` to verify the PostgreSQL connection.
4. Use `npm run build`, `npm test`, `npm run lint`, and `npm run format:check` for local checks.

TypeScript application code lives in `src/`; tests live in `tests/`; forward-only SQL migration conventions are documented in `migrations/README.md`. The foundation does not yet define application tables or a migration runner.

## Local repository inventory

From the RepoMind project root, run the inventory CLI against a local repository:

```sh
npm run --silent inventory -- ../path-to-repository
```

The command writes a stable JSON report to stdout. Save it to a file with shell redirection if useful:

```sh
npm run --silent inventory -- ../path-to-repository > inventory.json
```

The report lists repository-relative file paths and filesystem sizes, included directories, totals, and counts of excluded entries. It contains no file contents, absolute root path, timestamps, or technology claims. See [`docs/LOCAL_INVENTORY_CONTRACT.md`](docs/LOCAL_INVENTORY_CONTRACT.md) for the schema, exclusion rules, fixed limits, and error behavior.

Inventory is metadata-only: it does not open file contents, run repository scripts, install dependencies, or execute builds and tests. Symlinks and configured secret/local credential paths are skipped. Secret protection in this milestone is based on names and paths; it does not scan contents for arbitrary secret values. A successful inventory therefore does not certify that the repository contains no secrets.

Environment values are validated at startup. Keep `.env` local and never commit it. The structured logger redacts common credential fields; application code should avoid logging configuration objects or database connection strings.

## Documentation maintenance

When a decision changes:
- Update the relevant document.
- Update `AGENTS.md` if the change affects how coding agents should work.
- Add an entry to the decision log in `docs/IMPLEMENTATION_ROADMAP.md`.
- Do not silently change product scope or security rules.
