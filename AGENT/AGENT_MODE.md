# AGENT_MODE.md — Autonomous Execution Protocol

**Version:** 1.2.0
**Status:** ACTIVE
**Default State:** STOP-PER-SPRINT (see §2 override)
**Operational Contract:** [docs/ORCHESTRATOR_START_PROTOCOL.md](../docs/ORCHESTRATOR_START_PROTOCOL.md)

> **Note:** The ORCHESTRATOR_START_PROTOCOL is the operational contract for all orchestration sessions (Desktop and CLI). STOP-PER-SPRINT is the default. Every session must follow the Session Start Checklist before writing code.

---

## 1. OPERATING PRINCIPLES

### 1.1 Default Behavior
- **STOP-PER-SPRINT** is the default state (aligned with SPRINT_QUEUE.md §EXECUTION RULES).
- Agent completes ONE sprint, then STOPS and waits for user instruction.
- Permission to modify files and run commands is GRANTED within the active sprint.
- Questions are avoided unless domain ambiguity blocks progress.
- **Override:** User may explicitly say "CONTINUE" to enable multi-sprint auto-proceed.

### 1.2 Autonomy Level
- **READ:** Full access to all repository files (src/, AGENT/, supabase/, config files).
- **WRITE:** Create, modify, delete files within project scope (`src/`, `supabase/migrations/`).
- **AGENT/ directory:** READ always. WRITE only to SPRINT_LOG.md and SYSTEM_STATE.md.
  - Canon documents (AGENT_RULES.md, DOMAIN_MODEL.md, DATA_CONTRACTS.md, KPI_DEFINITIONS.md, CANON_*.md) are **READ-ONLY** unless user explicitly requests changes.
- Execute shell commands as needed (npm, git, file operations).
- Make architectural decisions within AGENT_RULES.md constraints.

---

## 2. WORK LOOP

```
┌─────────────────────────────────────────┐
│           AGENT WORK LOOP               │
└─────────────────────────────────────────┘

1. READ current sprint from SPRINT_QUEUE.md
   └─ If no active sprint → COMPLETE (all done)

2. EXECUTE sprint tasks
   └─ Follow AGENT_RULES.md
   └─ Log progress to SPRINT_LOG.md

3. VERIFY sprint completion
   └─ npm test (must pass)
   └─ npm run build (must succeed)
   └─ npm run lint (no errors)

4. EVALUATE verification result
   ├─ PASS → Mark sprint complete → go to step 5
   └─ FAIL → Attempt fix (max 3 retries)
            └─ If still failing → STOP with blocker

5. UPDATE SPRINT_QUEUE.md
   └─ Mark completed sprint as DONE

6. CHECK SPRINT_QUEUE.md for sprint-specific STOP rules
   ├─ If sprint says "STOP after completion" → STOP, report to user
   ├─ If user set CONTINUE mode → Activate next sprint, LOOP to step 1
   └─ Default → STOP, wait for user instruction
```

---

## 3. STOP CONDITIONS

The agent MUST STOP when:

### 3.1 Explicit Stop
- User sends "STOP" command.
- User requests pause or review.

### 3.2 Rule Conflict
- Action would violate AGENT_RULES.md.
- Domain definition missing from DOMAIN_MODEL.md.
- Locked threshold change requested without explicit override.

### 3.3 Verification Failure
- `npm test` fails after 3 fix attempts.
- `npm run build` fails after 3 fix attempts.
- Consecutive verification failures (2x in a row).

### 3.4 Ambiguity Block
- Business logic question that cannot be resolved from DOMAIN_MODEL.md.
- Schema change with unclear intent.
- External dependency unavailable.

### 3.5 Completion
- All sprints in SPRINT_QUEUE.md marked DONE.
- No remaining work items.

---

## 4. COMMUNICATION RULES

### 4.1 Do NOT Ask
- Permission to modify files.
- Permission to run commands.
- "Is this approach okay?"
- "Should I proceed?"
- High-level architectural questions (make decision + document rationale).

### 4.2 DO Communicate
- Sprint start/completion status.
- Blockers that trigger STOP.
- Decisions made with rationale.
- Verification results.

### 4.3 Output Format
```
## Sprint: [NAME]
Status: [STARTED|IN_PROGRESS|COMPLETED|BLOCKED]

### Actions Taken
- [Action 1]
- [Action 2]

### Verification
- npm test: [PASS|FAIL]
- npm run build: [PASS|FAIL]
- npm run lint: [PASS|FAIL]

### Next
[Auto-proceeding to Sprint X | STOPPED: reason]
```

---

## 5. SELF-VERIFICATION EXPECTATIONS

### 5.1 Code Quality
- TypeScript compiles without errors.
- No new `any` types without documentation.
- Business logic in engine/, not components/.

### 5.2 Test Coverage
- New engine functions have tests.
- Existing tests still pass.
- Edge cases covered.

### 5.3 Documentation
- SPRINT_LOG.md updated.
- SYSTEM_STATE.md updated if schema changed.
- Code comments for non-obvious logic.

### 5.4 Regression Check
- No locked thresholds modified.
- No historical data overwritten.
- Append-only pattern preserved.

---

## 6. DECISION FRAMEWORK

When facing a choice:

```
1. Check AGENT_RULES.md
   └─ If rule exists → Follow rule

2. Check DOMAIN_MODEL.md
   └─ If definition exists → Use definition

3. Check existing codebase patterns
   └─ If pattern exists → Follow pattern

4. Make decision + document rationale
   └─ Log in SPRINT_LOG.md
   └─ Proceed with implementation
```

### 6.1 Acceptable Decisions
- Choosing between equivalent implementation approaches.
- File organization within established patterns.
- Test structure and naming.
- Component composition.

### 6.2 Requires User Input
- New business logic definitions.
- Changes to locked thresholds.
- External system integrations (Exact Online, etc.).
- Production deployment decisions.

---

## 7. ERROR HANDLING

### 7.1 Test Failure
```
1. Read error message
2. Identify root cause
3. Apply fix
4. Re-run tests
5. If fail again, try alternative fix
6. After 3 attempts, STOP with detailed error log
```

### 7.2 Build Failure
```
1. Read TypeScript errors
2. Fix type issues
3. Re-run build
4. If fail again, check for circular dependencies
5. After 3 attempts, STOP with build log
```

### 7.3 Rule Conflict
```
1. Identify conflicting rule
2. Document conflict
3. STOP immediately
4. Do NOT proceed with violating action
```

---

## 8. SPRINT LIFECYCLE

### 8.1 Sprint Start
```
1. Read sprint definition from SPRINT_QUEUE.md
2. Log "Sprint [NAME] STARTED" to SPRINT_LOG.md
3. Create mental model of required changes
4. Begin implementation
```

### 8.2 Sprint Execution
```
1. Implement changes file by file
2. Run tests incrementally
3. Fix issues as they arise
4. Update documentation as needed
```

### 8.3 Sprint Completion
```
1. Run full verification suite
2. Update SPRINT_LOG.md with results
3. Mark sprint DONE in SPRINT_QUEUE.md
4. Auto-proceed to next sprint
```

---

## 9. LOGGING PROTOCOL

### 9.1 SPRINT_LOG.md Format
```markdown
## [TIMESTAMP] - Sprint: [NAME]

### Status: [COMPLETED|BLOCKED]

### Changes
- [File]: [Description]
- [File]: [Description]

### Verification
- Tests: [PASS|FAIL]
- Build: [PASS|FAIL]
- Lint: [PASS|FAIL]

### Notes
[Any decisions made, rationale, or issues encountered]

---
```

### 9.2 Append-Only
- NEVER delete previous log entries.
- ALWAYS append new entries at the bottom.
- Include timestamp for each entry.

---

## 10. ENTERING AGENT MODE

To activate AGENT MODE:

```
1. Verify AGENT_RULES.md exists and is valid
2. Verify DOMAIN_MODEL.md exists and is valid
3. Verify SPRINT_QUEUE.md has active sprints
4. Create/verify SPRINT_LOG.md exists
5. Announce: "AGENT MODE ACTIVE"
6. Begin work loop
```

---

*AGENT MODE is now the default operational state for this project.*
