# Pull Request Review Engine

**Version:** 1.0

## 1. Goal

Review a code change using its exact diff plus relevant repository context. The same review core serves local changes first and GitHub pull requests later. Detect likely defects, regressions, security issues, maintainability problems, and violations of confirmed project rules.

## 2. Review workflow

1. An input adapter creates a normalized review request: local base plus local changes, or a GitHub PR base/head pair.
2. Identify and freeze the exact source snapshot; local dirty worktrees need a content identity in addition to any Git commit SHA.
3. For GitHub, verify webhook signatures, deduplicate delivery, and confirm the requested head SHA.
4. Confirm a project snapshot/profile exists for the repository.
5. Obtain changed files and patches from the adapter.
6. Map changed lines to symbols and modules.
7. Retrieve related callers, dependencies, tests, configuration, and approved knowledge.
8. Run deterministic checks and supported analyzers.
9. Ask the AI investigator to inspect bounded questions.
10. Validate each proposed finding against exact source in the frozen review snapshot.
11. Apply severity, confidence, and output policy.
12. Emit a structured local report or publish GitHub inline comments/review summary.
13. Persist the review and finding lifecycle when persistence is available.
14. Re-run when the local change set or PR head changes.

## 3. What to inspect

- Bugs and incorrect logic.
- Regressions in callers or dependent modules.
- Data integrity and transaction behavior.
- Authentication and authorization.
- Input validation and security boundaries.
- Error handling and failure modes.
- Performance concerns supported by evidence.
- Tests missing for risky behavior.
- Violations of confirmed architecture or business rules.
- API contract and frontend/backend integration mismatches.

Do not report style preferences as blockers unless the repository has a confirmed rule and the violation is meaningful.

## 4. Context retrieval

For every changed file, retrieve as applicable:
- enclosing class/function/method
- imported symbols and referenced constants
- callers and downstream consumers
- related services, models, controllers, routes, jobs
- relevant frontend components and API clients
- tests and fixtures
- database schema and migrations
- approved project rules
- previous findings on the same PR

Do not send the whole repository to the model. Build a bounded context packet and let the investigator request additional evidence through controlled tools.

## 5. Finding format

A finding should include:

```json
{
  "title": "Potential duplicate payment capture",
  "category": "correctness",
  "severity": "high",
  "blocking": true,
  "confidence": 0.91,
  "filePath": "app/services/payment_capture.rb",
  "startLine": 42,
  "endLine": 48,
  "summary": "The retry path can submit the same capture twice.",
  "impact": "A customer may be charged more than once.",
  "evidence": [
    {
      "filePath": "app/services/payment_capture.rb",
      "startLine": 42,
      "endLine": 48,
      "snapshotId": "EXACT_REVIEW_SNAPSHOT_ID"
    }
  ],
  "suggestedFix": "Use an idempotency key for the capture operation."
}
```

The example is illustrative only. A real finding must be grounded in actual repository code.

## 6. Evidence validation

Before emitting or publishing:
- Confirm the file exists in the frozen review snapshot.
- Confirm the cited lines or symbol still exist in that snapshot.
- Confirm the code excerpt supports the stated claim.
- Verify dependency/call relationships where the claim relies on them.
- Distinguish a definite defect from a possible risk.
- Do not fabricate test results.
- Do not claim a test was run unless it was actually run.

If evidence is weak, ask for more context or omit the finding.

## 7. Severity and publication policy

Suggested levels:
- Critical: severe security or data-loss issue with strong evidence.
- High: likely major defect or serious regression.
- Medium: meaningful bug or risk requiring attention.
- Low: limited impact or maintainability concern.
- Informational: useful observation, not a defect.

Severity and confidence are separate. A high-impact hypothesis with weak evidence should not automatically block a PR.

Initial policy:
- Publish inline comments for actionable findings.
- Use request-changes only for configured blocking findings that pass evidence and confidence thresholds.
- Do not approve or merge automatically.
- Keep policy configurable at repository level.

## 8. Finding lifecycle

Possible states:
- `open`
- `investigating`
- `still_open`
- `resolved`
- `reintroduced`
- `dismissed`
- `not_verifiable`

When a new commit arrives:
- Reassess prior findings against the new head.
- Check the original behavior, not just the old line number.
- Mark resolved only when evidence supports the fix.
- Mark reintroduced if a previously fixed issue returns.
- Preserve the history and rationale for status transitions.

Use a stable fingerprint based on normalized finding concept, relevant symbol/path, and category. Do not rely on line number alone.

## 9. Review quality controls

Track:
- accepted findings
- developer-disputed findings
- false positives
- missed defects discovered later
- duplicate findings
- resolved correctly after fix commits
- reviewer latency and model cost

Use this data to improve prompts, retrieval, analyzers, and project knowledge. Do not optimize only for number of comments.
