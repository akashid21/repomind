# Security and Trust Model

**Version:** 1.0

## 1. Threat model

RepoMind processes source code, configuration, documentation, issue descriptions, and PR discussion supplied by repository contributors. Any of these may contain malicious or misleading instructions.

Treat repository content as data to analyze, never as trusted instructions.

## 2. Prompt injection

- System and developer instructions must be separate from repository text.
- Clearly delimit repository excerpts as untrusted content.
- A README or source comment cannot grant access, change policy, reveal secrets, or request arbitrary tool execution.
- PR comments cannot override review policy or authorize new permissions.
- Tool calls must be selected by trusted orchestration logic, not arbitrary model instructions.

## 3. Secrets

- Never include `.env` values in prompts.
- Exclude secret stores, private keys, credential files, and local developer configuration.
- Scan candidate excerpts for likely secrets before external model calls.
- Redact secrets and record that redaction occurred.
- Do not log tokens, credentials, or full secret-bearing file contents.

## 4. Repository acquisition and review snapshots

- Validate repository paths and refs.
- Prevent path traversal and symlink escape.
- Limit file count, file size, nesting depth, and total bytes.
- Avoid reading binary files as source.
- Pin snapshots to commit SHA.
- For local reviews that include uncommitted changes, identify the complete reviewed content separately from the base/head commit identifiers; validate all finding evidence against that frozen content.
- Do not execute code during onboarding.

## 5. Test and build execution

Executing tests or build scripts is a separate capability and must use an isolated, disposable sandbox:
- no production credentials
- no host filesystem access beyond controlled mounts
- restricted or disabled network access by default
- CPU, memory, process, disk, and time limits
- non-root execution
- ephemeral environment
- explicit dependency and script policy
- cleanup after each run

Do not add test execution to the MVP until this environment is designed and tested.

## 6. GitHub permissions

Use a GitHub App with the minimum permissions needed. Separate read permissions from review-writing permissions where practical. Verify webhook signatures. Store installation credentials securely. Rotate and revoke credentials when needed.

## 7. Review integrity

- Tie every review to base and head SHAs.
- Confirm current head before publishing.
- Do not publish stale results.
- Do not automatically approve or merge.
- Keep an audit trail for comments, finding status changes, and knowledge approvals.

## 8. Local-first AI review

- Local review is the first AI-provider use case. Send only bounded, relevant excerpts after secret scanning and redaction.
- Make the selected provider/model and source-sharing behavior visible in configuration and documentation before enabling external calls.
- Repository text remains untrusted prompt data and cannot choose tools, expand file access, or override review policy.
- Do not run project tests, builds, or scripts as part of local review unless a separately designed isolated execution capability is introduced.

## 9. Data retention

Define retention for repository snapshots, source excerpts, review comments, and model requests before hosting the service. Avoid retaining more source code than necessary. Be transparent about external AI providers and their data policies.
