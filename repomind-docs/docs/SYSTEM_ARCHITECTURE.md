# System Architecture — RepoMind

**Version:** 1.0  
**Status:** Proposed architecture

## 1. Architectural overview

RepoMind is composed of a technology-agnostic orchestration core and replaceable adapters for GitHub, languages, storage, and AI providers.

```text
GitHub App / Local CLI
        |
        v
API + Webhook Receiver
        |
        v
Job Orchestrator / Queue
        |
        +-----------------------+
        |                       |
        v                       v
Repository Onboarding      PR Review Pipeline
        |                       |
        v                       v
Inventory + Detectors      Diff + Context Retrieval
        |                       |
        v                       v
Language Analyzers         Static Checks + AI Investigation
        |                       |
        v                       v
Project Knowledge          Findings + Reassessment
        |                       |
        +-----------+-----------+
                    |
                    v
             PostgreSQL Store
                    |
                    v
             GitHub Review API
```

## 2. Proposed initial stack

| Concern | Initial choice | Notes |
|---|---|---|
| Runtime | Node.js + TypeScript | Shared ecosystem for GitHub APIs and parsers |
| GitHub | GitHub App + Octokit | Use least-privilege installation permissions |
| API | Fastify or Express | Choose one; avoid premature framework complexity |
| Database | PostgreSQL | Durable project, snapshot, review, and feedback records |
| ORM | Prisma or Drizzle | Choose one after a small schema spike; do not mix |
| Queue | BullMQ + Redis | Add when background processing is needed |
| Ruby parsing | Prism | Ruby AST and source locations |
| TypeScript/JS | TypeScript Compiler API | Symbols, imports, exports, and references |
| Other languages | Tree-sitter adapters | Expand incrementally |
| AI | Provider abstraction | Start with a free-tier provider or local Ollama model |
| Retrieval | PostgreSQL queries first; pgvector optional | Do not start with a separate vector database |
| Isolation | Docker or equivalent sandbox | Required before executing repo code/tests |

A local CLI can be used before building a full GitHub App. It should call the same onboarding services as the future API.

## 3. Major components

### 3.1 GitHub integration
- GitHub App authentication.
- Repository and commit metadata.
- PR webhook receiver.
- Changed-file and patch retrieval.
- Review comment and review-state publishing.
- Webhook signature verification and idempotency.

### 3.2 Repository acquisition
- Fetch or clone an exact commit.
- Store immutable snapshot metadata.
- Prevent path traversal and unsafe symlink handling.
- Exclude generated and irrelevant directories.
- Never load secret values from environment files.

### 3.3 Repository intelligence
- File inventory.
- Technology detection.
- Language-specific AST extraction.
- Symbol and dependency graph.
- Module and architecture discovery.
- Business domain discovery.
- Project knowledge profile.

### 3.4 Review orchestrator
- Parse PR diff.
- Retrieve affected symbols, callers, dependencies, tests, and relevant project rules.
- Run deterministic checks.
- Ask the model to investigate a bounded task.
- Validate evidence and finding structure.
- Publish only findings that pass validation and policy.

### 3.5 Feedback and knowledge service
- Capture developer discussion.
- Link feedback to a finding and PR commit.
- Classify feedback.
- Validate claims against source and tests when possible.
- Propose a knowledge update.
- Require explicit approval for durable rules.
- Version and audit accepted knowledge.

## 4. Core data model

Suggested entities (not a final migration):

- `projects`: connected repositories and settings.
- `repository_snapshots`: repository commit SHA, branch, indexing status, timestamps.
- `technology_profiles`: languages, frameworks, databases, tools, evidence.
- `project_modules`: logical modules and their boundaries.
- `code_symbols`: classes, methods, functions, types, routes, and source ranges.
- `code_dependencies`: imports, calls, references, and module dependencies.
- `project_knowledge`: versioned summaries, conventions, architecture rules, and business rules.
- `pull_requests`: repository, PR number, base SHA, current head SHA, author.
- `reviews`: review runs, model/provider, prompt/version, status, target head SHA.
- `review_findings`: finding lifecycle and evidence.
- `review_discussions`: comments and replies associated with a PR or finding.
- `feedback_proposals`: proposed repository knowledge derived from discussion.
- `knowledge_sources`: provenance for every accepted knowledge item.
- `webhook_events`: delivery IDs and processing status for idempotency.

All repository-derived records should be scoped to a project and, where relevant, a commit SHA.

## 5. AI provider abstraction

Do not couple business logic to one provider. Define a small interface such as:

```ts
export interface AIProvider {
  generate(input: {
    system: string;
    prompt: string;
    maxOutputTokens?: number;
  }): Promise<{ text: string; model: string }>;
}
```

Add structured-output support when needed. Keep provider-specific request formats inside adapters.

Possible experimentation options include free tiers from hosted providers and local models through Ollama. Quotas, model availability, privacy terms, and commercial-use conditions change; verify them before selecting a provider. Never assume a free tier is unlimited or appropriate for private source code.

## 6. Retrieval strategy

Start with:
1. Changed file and diff.
2. Symbols intersecting changed line ranges.
3. Imports, callers, and direct dependencies.
4. Relevant tests.
5. Related routes, models, services, UI components, and configuration.
6. Explicit project rules and approved feedback.
7. Exact source excerpts at the target commit.

Add embeddings only if lexical, structural, and metadata retrieval cannot find relevant context. Keep exact source as the authority.

## 7. Processing and consistency

- Every review is bound to `base_sha` and `head_sha`.
- Every onboarding snapshot is bound to a commit SHA.
- A worker must verify that the PR head is still current before publishing.
- Webhook delivery IDs must be unique.
- Stage jobs should be idempotent using project + commit SHA + stage.
- Preserve historical snapshots and reviews rather than overwriting them.
- Do not let stale workers publish comments for an outdated PR head.

## 8. Initial API outline

- `POST /api/projects/connect` — connect or register a repository.
- `GET /api/projects/:projectId/onboarding` — onboarding progress.
- `GET /api/projects/:projectId/profile` — project knowledge profile.
- `PATCH /api/projects/:projectId/knowledge` — confirm or edit approved knowledge.
- `POST /api/projects/:projectId/reindex` — request re-indexing.
- `POST /api/webhooks/github` — receive GitHub events.
- `GET /api/pull-requests/:id/reviews` — inspect review history.
- `POST /api/reviews/:id/feedback` — record feedback or a correction.

These are design suggestions, not contracts until implemented.

## 9. Deployment evolution

Start locally:
- CLI + local checkout.
- PostgreSQL.
- No queue until needed.
- Mock GitHub publishing during development.

Then add:
- GitHub App and webhook endpoint.
- Redis/BullMQ workers.
- Isolated test execution service.
- Hosted deployment only when local usage is reliable.
