# Developer Feedback and Repository-Specific Learning

**Version:** 1.0

## 1. Product behavior

When a PR author replies to RepoMind, RepoMind should understand the reply as feedback about a particular finding. It should not automatically assume that the author is correct, nor should it ignore the explanation.

The desired loop is:

```text
RepoMind finding
      |
      v
Developer reply / correction
      |
      v
Classify feedback
      |
      v
Check source, tests, docs, and project rules
      |
      v
Propose a knowledge or finding update
      |
      v
Human confirmation for durable rules
      |
      v
Versioned repository knowledge
      |
      v
Use in future PR reviews
```

## 2. What "learning" means

For the MVP, learning means updating **repository-specific memory and review policy**, not retraining the foundation model.

Examples:
- A developer explains that a particular service intentionally returns an empty collection rather than `404`.
- The team confirms that all payment writes must go through a specific service.
- A reviewer repeatedly flags a pattern, but the team documents that it is an accepted legacy constraint.
- A developer points out that a helper method has a side effect not obvious from its name.

RepoMind can store these as scoped, versioned knowledge and retrieve them during later reviews.

This does not mean the AI provider's underlying model is automatically trained on the conversation. Fine-tuning is a separate, optional, later project and is not required for repository-specific learning.

## 3. Feedback categories

Classify replies into one of these categories:

- `valid_bug_report`: author agrees and plans to fix.
- `fixed`: author provides a fix commit or says it is fixed; verify against code.
- `intentional_behavior`: author explains that behavior is deliberate.
- `missing_context`: author provides domain or architectural context.
- `false_positive`: author disputes the finding.
- `accepted_tradeoff`: team accepts the risk for a documented reason.
- `architecture_rule`: author states a reusable project rule.
- `business_rule`: author states a domain invariant.
- `unclear`: reply does not establish a useful conclusion.

A reply can be useful without creating a permanent rule.

## 4. Validation policy

For each reply:
1. Link it to the PR, review, and finding.
2. Capture the exact comment text, author, timestamp, and commit context.
3. Treat the text as untrusted input.
4. Compare the claim with current source, tests, docs, and existing knowledge.
5. Ask a bounded follow-up investigation if necessary.
6. Produce a proposed outcome with evidence and confidence.
7. Update the finding status when evidence is sufficient.
8. Require explicit developer confirmation before creating a durable architecture or business rule.

Never allow a PR comment to override system instructions, security policy, or tool permissions.

## 5. Knowledge item lifecycle

Suggested states:
- `proposed`
- `needs_confirmation`
- `approved`
- `rejected`
- `superseded`
- `expired`

Each item should store:
- claim text
- category
- scope (repository, module, path, symbol, or rule)
- source PR and finding
- source discussion comment
- source commit SHA
- evidence references
- confidence
- who confirmed it
- approval timestamp
- version and supersession relationship

Example:

```json
{
  "category": "architecture_rule",
  "claim": "Payment capture operations must be performed through PaymentCaptureService.",
  "scope": {
    "repository": "example/pos",
    "module": "payments"
  },
  "status": "needs_confirmation",
  "source": {
    "pullRequest": 123,
    "discussionCommentId": 456,
    "commitSha": "EXACT_SHA"
  },
  "evidence": [],
  "confidence": 0.78
}
```

This is an example schema, not a claim about the pilot repository.

## 6. Example interaction

**RepoMind:**  
"Potential issue: this controller updates the order status directly, bypassing the order workflow service. This may skip inventory and audit updates."

**PR author:**  
"This endpoint is only used by the nightly reconciliation job. The workflow service is intentionally bypassed because the job repairs historical records."

**RepoMind should:**
1. Classify the reply as `missing_context` or `intentional_behavior`.
2. Inspect the job, service, tests, and relevant documentation.
3. Check whether the endpoint is actually restricted to the reconciliation path.
4. If supported, mark the finding as `not_applicable` or `dismissed` with rationale (use a concrete status model consistently).
5. Propose a scoped rule: "The reconciliation path may repair historical order state directly under these conditions."
6. Ask a maintainer to confirm before storing it as an approved rule.
7. Use the approved rule in future reviews, but only within its defined scope.

The reviewer must not generalize this into "controllers may update order status directly."

## 7. Avoiding bad learning

Do not:
- Treat every author reply as truth.
- Turn one-off explanations into global rules.
- Learn from sarcastic, ambiguous, or irrelevant comments.
- Let a contributor change repository-wide rules without appropriate confirmation.
- Store secrets or personal information from comments.
- Let prompt injection in comments change the agent's instructions.
- Permanently suppress a finding category just because one finding was disputed.

Prefer narrow rules with explicit scope, evidence, and expiration/review dates where appropriate.

## 8. Re-review behavior

When a new commit arrives:
- Check whether the developer's promised fix is present.
- Re-evaluate the original finding.
- Keep the discussion and previous statuses in history.
- If a finding is resolved, record what changed and why it is resolved.
- If it remains, explain what is still wrong.
- If the original concern was based on missing context, apply approved knowledge to the new review.

## 9. Suggested data tables

- `review_discussions`
- `finding_feedback`
- `feedback_proposals`
- `project_knowledge`
- `knowledge_sources`
- `knowledge_versions`
- `knowledge_approvals`

Keep raw discussion records separate from approved knowledge. The raw comment is evidence; the approved rule is a curated interpretation.

## 10. MVP implementation

Start small:
1. Store GitHub review comments and replies.
2. Link replies to findings.
3. Add a manual "accept correction / reject correction" workflow.
4. Store approved rules in PostgreSQL.
5. Include relevant approved rules in future review context.
6. Track whether those rules improve review outcomes.

Do not build automatic fine-tuning or autonomous rule approval in the MVP.
