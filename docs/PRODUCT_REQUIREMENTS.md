# Product Requirements — RepoMind

**Version:** 1.3
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

> Connect RepoMind to a software repository across technology stacks. Let it understand the project first. Then let it review code with the context of the entire application.

The goal is not to claim perfect understanding of every language. RepoMind's core workflow must be technology-agnostic: inventory, evidence-backed technology profiling, project understanding, review, and developer feedback must work independently of a particular framework. Detection and analysis coverage will grow through declarative rules and replaceable analyzer adapters. Support claims must distinguish basic detection from deeper code analysis.

## 4. Initial user and pilot

- Initial user: one developer.
- Initial deployment: personal tool.
- Initial repository: one GitHub repository.
- Validation pilot: a friend's Ruby on Rails + React POS application. This repository is a test case, not the product's supported-stack boundary or the sole driver of architecture.
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

This is a compatibility direction, not a promise that every technology is deeply analyzed in the first release. Initial detection should cover representative technologies across these families rather than only the pilot stack. Deeper analysis will be added through language/framework adapters and must be explicitly listed as supported. The pilot is used to validate the end-to-end workflow while additional fixtures and repositories validate stack neutrality.

### Support levels

- **Inventoried:** files and paths are collected safely, regardless of language.
- **Detected:** recognized language, framework, package-manager, database, or infrastructure evidence is reported with paths and confidence.
- **Analyzed:** a supported adapter extracts structures or performs technology-specific checks.
- **Reviewed:** the general review workflow can use available evidence and clearly state analysis gaps; a repository is not excluded merely because some files lack a specialized analyzer.

RepoMind must not imply that detection means deep analysis or runtime use. Unsupported or partially supported technologies remain visible as unknown/limited coverage rather than being silently treated as supported.

| Planned stage | Initial coverage target |
|---|---|
| M2 detection baseline | Ruby, JavaScript/TypeScript, Python, Java, Go, PHP, and C#/.NET; representative frameworks, package managers, test tools, databases, and infrastructure from the supported technology direction above |
| M3 deeper code analysis | Ruby, JavaScript/TypeScript, and Python analyzer adapters behind one shared interface; other detected languages remain inventoried and available to generic review with explicit analysis-gap reporting |

This is a staged starting set, not a permanent limit. Additional technologies should be prioritized from real repository needs and added through detector rules or analyzer adapters with fixtures. The first end-to-end validation targets include both the Rails + React pilot and a Node/Express + React fixture/repository.

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
- Extensible analyzer interfaces and a documented initial support matrix spanning representative backend, frontend, and other common ecosystems.
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
1. Analyze repositories from different technology stacks at known commits, including the pilot repository.
2. Produce a technology and module profile with evidence.
3. Review a PR using changed files plus relevant surrounding code.
4. Publish a small number of useful, reproducible findings.
5. Avoid stale findings after a fix commit.
6. Record a developer correction and apply an approved repository-specific rule to a later review.
7. Explain the evidence behind both findings and learned rules.
