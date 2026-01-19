# Ralph Mode: Remove Payment Gating

You are executing Ralph Mode via Amp handoffs. Follow these rules strictly.

## Context

The Mantra platform CTO confirmed WebView-based payment processing is not possible. We are removing all payment gating from the application layer so all features are free. Backend Convex schema and Polar webhooks remain intact for potential future use.

## Execution Steps (In Order)

1. **Read progress.txt FIRST** — Check "Codebase Patterns" section at top
2. **Read prd.json** — Find current state
3. **Check iteration limit** — If `current_iteration >= max_iterations`, output `<promise>COMPLETE</promise>` and STOP
4. **Check branch** — Ensure on `autonomous/remove-payment-gating`, checkout if needed
5. **Pick next story** — First story where `passes: false` (lowest priority number)
6. **Implement ONE story** — Complete all acceptance criteria
7. **Run quality checks** — `bun run build` and `bun run check`
8. **Update AGENTS.md** — If patterns discovered, add to relevant AGENTS.md
9. **Commit** — `git add -A && git commit -m "feat: [US-XXX] - title"`
10. **Update prd.json** — Set `passes: true`, add notes
11. **Update progress.txt** — Increment counter, append log entry
12. **Check completion**:
    - If ALL stories pass → output `<promise>COMPLETE</promise>` and STOP
    - If `current_iteration >= max_iterations` → output `<promise>COMPLETE</promise>` and STOP
    - Otherwise → handoff to fresh thread

## Handoff Format

When handing off, use this goal:
```
Execute Ralph Mode for remove-payment-gating. Read docs/autonomous/prompt.md for instructions.
```

## Progress Report Format

APPEND to progress.txt (never replace existing content):

```markdown
---

## YYYY-MM-DD | US-XXX | T-<thread-id>
**Changes:** Brief description of what was implemented
**Files:** file1.ts, file2.ts
**Learnings:** Patterns discovered for future iterations
```

## Stop Conditions

Output `<promise>COMPLETE</promise>` when:
- All stories have `passes: true`
- `current_iteration >= max_iterations`
- Unrecoverable error (document in progress.txt first)

## Reference Files

| File | Purpose |
|------|---------|
| apps/application/src/core/convex.ts | checkUserIsPro() function (US-001) |
| packages/convex/dailySummaries.ts | getForUser query with isPro gate (US-002) |
| packages/convex/sessionSummaries.ts | upsert mutation with subscription gate (US-003) |
| apps/web/src/components/SettingsPage.tsx | Billing section to comment out (US-004) |
| apps/web/src/components/MemoryPage.tsx | isPro upgrade prompt to remove (US-005) |
| apps/web/src/components/HomePage.tsx | FEATURES array and Free/Pro UI (US-006) |

## Quality Requirements

- ALL commits must pass typecheck (`bun run build`)
- ALL commits must pass lint (`bun run check`)
- Do NOT commit broken code
- Keep changes focused and minimal
- Follow existing patterns in codebase
