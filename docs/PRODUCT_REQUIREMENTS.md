# Product Requirements — RepoMind

**Version:** 1.2  
**Status:** Initial product definition

## 1. Overview

RepoMind is a universal, repository-aware AI code reviewer. It first builds a structured understanding of a software repository, then uses that project context to review GitHub pull requests.

The product should investigate more than changed lines. It should identify relevant modules, symbols, dependencies, conventions, business rules, and possible downstream effects before deciding whether a change introduces a defect or violates an established rule.

## 2. Problem

A diff-only reviewer may miss:
- Effects on callers and dependent modules.
- Existing project conventions and architectural boundaries.
- Business rules encoded in models, services, routes, tests, and UI flows.
- Regressions caused by changes outside the directly edited lines.
- Whether a previously reported issue was actually fixed in a later commit.

A generic AI reviewer may also produce plausible but incorrect comments when it lacks reliable project context.

## 3. Vision

> Connect RepoMind to a supported software repository. Let it understand the project first. Then let it review code with the context of the entire application.

The goal is not to claim perfect understanding of every language. The goal is an extensible platform whose core workflow is technology-agnostic and whose language support grows through analyzer adapters.

## 4. Initial user and pilot

- Initial user: one developer.
- Initial deployment: personal tool.
- Initial repository: one GitHub repository.
- Pilot application: a friend's Ruby on Rails + React POS application.
- Initial PR platform: GitHub.
- Initial usage: manual/automated PR review with comments and review status.
- No multi-tenant SaaS, billing, organization administration, or public marketplace in the MVP.

## 5. Product principles

1. **Repository-aware:** understand the project before reviewing a PR.
2. **Evidence-led:** every actionable finding must point to exact source evidence.
3. **Conservative:** prefer fewer high-confidence findings over noisy speculation.
4. **Technology-extensible:** common interfaces with language-specific analyzers.
5. **Incremental:** update knowledge when commits change relevant files.
6. **Explainable:** state why a finding matters and what could break.
7. **Human-governed:** developers can correct the reviewer; accepted feedback is versioned and auditable.
8. **Secure by default:** repository code is untrusted and must not be executed during discovery.

## 6. Supported technology direction

The design should allow adapters for:

- Backend: Ruby/Rails, Node/Express/NestJS, Python/Django/FastAPI, Java/Spring, Go, .NET, PHP/Laravel.
- Frontend: React, Next.js, Angular, Vue, Svelte.
- Mobile: React Native, Flutter, native Android/iOS.
- Databases: PostgreSQL, MySQL, MongoDB, SQLite.
- Infrastructure: Docker, Kubernetes, Terraform, AWS, Azure.
- Tests and quality: RSpec, Minitest, Jest, Vitest, Playwright, Cypress, language-specific linters.

This is a compatibility target, not a promise that all technologies are deeply analyzed in the first release. The first useful implementation should prioritize the pilot's Ruby and TypeScript/JavaScript code.

## 7. Functional requirements

### 7.1 Repository connection and onboarding

- Connect to GitHub with least-privilege permissions.
- Fetch a repository snapshot for an exact commit SHA.
- Inventory files and directories safely.
- Detect languages, frameworks, package managers, databases, test tools, and infrastructure tools from manifests and configuration.
- Identify modules, important symbols, imports, and dependency relationships where supported.
- Infer architecture and business domains with evidence and confidence labels.
- Persist a project profile tied to the analyzed commit.
- Allow a developer to correct or confirm important project knowledge.

### 7.2 PR review

- Receive GitHub PR webhook events.
- Fetch base and head commit information and the changed-file diff.
- Retrieve relevant project knowledge and related source code.
- Analyze changed code and likely impact paths.
- Use deterministic checks and language analyzers where available.
- Ask an AI model to investigate bounded questions using repository tools.
- Publish findings as GitHub review comments.
- Optionally request changes when configured policy and severity justify it.
- Never approve or merge automatically.

### 7.3 Review findings

Each finding should include:
- Stable finding ID.
- Category and severity.
- Blocking status.
- Confidence.
- Short title and detailed explanation.
- Exact file and line range where GitHub supports it.
- Evidence references tied to the PR head SHA.
- Why the issue matters and a suggested fix.
- Status and review history.

### 7.4 Re-review after new commits

- Reassess existing findings after a new PR head commit.
- Determine whether each finding is still present, resolved, reintroduced, or no longer verifiable.
- Avoid duplicate comments.
- Do not mark a finding resolved merely because its line moved or its text changed.
- Re-check the exact current source and relevant behavior.

### 7.5 Developer feedback

- Capture author replies and reviewer discussions.
- Associate replies with findings when possible.
- Distinguish factual correction, intentional design explanation, additional context, disagreement, and unclear feedback.
- Allow validated feedback to become repository-specific knowledge.
- Keep provenance, author, timestamp, evidence, and approval status.
- Do not automatically treat every developer statement as a permanent rule.

## 8. Non-functional requirements

- Exact commit identity for repository snapshots and reviews.
- Idempotent webhook and worker processing.
- Bounded file sizes, prompt sizes, execution time, and model calls.
- Safe handling of secrets and untrusted repository text.
- Structured logs and traceable review runs.
- Retryable background stages.
- Clear behavior when a language is unsupported.
- Reasonable latency and cost for a personal tool.

## 9. MVP scope

### In scope
- One GitHub repository.
- Local repository ingestion for early development.
- GitHub repository snapshot acquisition.
- File inventory and deterministic technology detection.
- Initial Ruby and TypeScript/JavaScript analysis.
- Basic module and dependency mapping.
- Persistent project profile.
- PR diff review with relevant context retrieval.
- Evidence-backed findings.
- GitHub inline comments.
- Finding lifecycle across new commits.
- Manual validation of developer feedback before it becomes durable knowledge.

### Out of scope initially
- Multi-tenant SaaS.
- Billing and subscriptions.
- Automatic merge or approval.
- Full support for every language.
- Automatic dependency installation during onboarding.
- Running arbitrary tests without a hardened sandbox.
- Training or fine-tuning a foundation model from PR conversations.
- Autonomous changes to production code.
- Guaranteed detection of all regressions.

## 10. Success criteria

The MVP is useful when it can:
1. Analyze the pilot repository at a known commit.
2. Produce a technology and module profile with evidence.
3. Review a PR using changed files plus relevant surrounding code.
4. Publish a small number of useful, reproducible findings.
5. Avoid stale findings after a fix commit.
6. Record a developer correction and apply an approved repository-specific rule to a later review.
7. Explain the evidence behind both findings and learned rules.
