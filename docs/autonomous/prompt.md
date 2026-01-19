# Ralph Mode: Conversation Logging

You are executing Ralph Mode via Amp handoffs. Follow these rules strictly.

**IMPORTANT: Set thread visibility to private at the start of each iteration.**

## Execution Steps (In Order)

1. **Set visibility to private** — Run: `amp threads share <current-thread-id> --visibility private`
2. **Read progress.txt FIRST** — Check "Codebase Patterns" section at top
3. **Read prd.json** — Find current state
4. **Check iteration limit** — If `current_iteration >= max_iterations`, output `<promise>COMPLETE</promise>` and STOP
5. **Check branch** — Ensure on `autonomous/conversation-logging`, checkout if needed
6. **Pick next story** — First story where `passes: false` (lowest priority number)
7. **Implement ONE story** — Complete all acceptance criteria
8. **Run quality checks** — Typecheck/tests from acceptance criteria
9. **Update AGENTS.md** — If patterns discovered, add to relevant AGENTS.md
10. **Commit** — `git add -A && git commit -m "feat: [US-XXX] - title"`
11. **Update prd.json** — Set `passes: true`, add notes
12. **Update progress.txt** — Increment counter, append log entry
13. **Check completion**:
    - If ALL stories pass → output `<promise>COMPLETE</promise>` and STOP
    - If `current_iteration >= max_iterations` → output `<promise>COMPLETE</promise>` and STOP
    - Otherwise → handoff to fresh thread

## Handoff Format

When handing off, use this goal:
```
Execute Ralph Mode for conversation-logging. Read docs/autonomous/prompt.md for instructions.
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
| packages/convex/schema.ts | Convex schema definition |
| packages/convex/users.ts | User identity patterns |
| apps/application/src/transcriptionFlow.ts | Main transcription handler |
| apps/application/src/core/displayQueue.ts | Display queue patterns |
| apps/application/src/core/convex.ts | Convex client setup |

## Quality Requirements

- ALL commits must pass typecheck
- Do NOT commit broken code
- Must pass bun run database to pass Convex codegen
- Keep changes focused and minimal
- Follow existing patterns in codebase
- Use `userId: v.id("users")` for user references
- Fire-and-forget pattern for logging (void promises)
