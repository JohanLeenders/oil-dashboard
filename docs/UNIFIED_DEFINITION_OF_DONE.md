# UNIFIED_DEFINITION_OF_DONE.md — OIL Dashboard

**Version:** 1.0.0
**Status:** ACTIVE
**Last Updated:** 2026-02-12
**Applies to:** All sprints (8–10+), all agents (Desktop + CLI)

---

## Purpose

A single, authoritative checklist that defines when a sprint is DONE.
Every sprint must satisfy ALL applicable gates before completion.
No sprint may be marked DONE unless every required gate passes.

---

## 1. CODE GATES (Required)

| # | Gate | Pass Criteria | Verified By |
|---|------|---------------|-------------|
| C1 | **TypeScript compiles** | `npm run build` exits 0, zero type errors | Validator Agent |
| C2 | **All tests pass** | `npm test` (vitest) exits 0, zero failures | Validator Agent |
| C3 | **No new `any` types** | No new `as any` without documented reason in code comment | Builder Agent |
| C4 | **Lint clean** | `npm run lint` exits 0, zero errors (warnings acceptable) | Validator Agent |
| C5 | **No regressions** | Existing test count ≥ previous sprint's count | Validator Agent |

---

## 2. BUSINESS LOGIC GATES (Required)

| # | Gate | Pass Criteria | Verified By |
|---|------|---------------|-------------|
| B1 | **Canon alignment** | Changes consistent with AGENT_RULES.md and CANON_Poultry_Cost_Accounting.md | Builder Agent |
| B2 | **Locked values untouched** | THT (70/90), DSI (14/28), cherry-picker (30%), SVASO method unchanged | Validator Agent |
| B3 | **Append-only preserved** | No UPDATE/DELETE on batch_yields or batch_costs tables | Validator Agent |
| B4 | **Engine purity** | `src/lib/engine/` contains only pure functions, no DB calls, no UI | Builder Agent |
| B5 | **SVASO not weight** | Cost allocation uses market value proportion, never weight | Builder Agent |

---

## 3. DOCUMENTATION GATES (Required)

| # | Gate | Pass Criteria | Verified By |
|---|------|---------------|-------------|
| D1 | **SPRINT_LOG.md updated** | Sprint entry appended with status, changes, verification results | Scribe Agent |
| D2 | **SYSTEM_STATE.md updated** | If schema changed: tables/views updated. If routes changed: routes updated | Scribe Agent |
| D3 | **Sprint-specific DoD** | All items from sprint contract's "Definition of Done" section checked | Builder Agent |

---

## 4. SCHEMA GATES (If Applicable)

| # | Gate | Pass Criteria | Verified By |
|---|------|---------------|-------------|
| S1 | **Migration files only** | All schema changes via numbered migration in `supabase/migrations/` | DB Builder |
| S2 | **No column renames** | Column renames require explicit version bump in DATA_CONTRACTS.md | DB Builder |
| S3 | **Migration applies clean** | `supabase db push` succeeds without errors | Validator Agent |
| S4 | **DATA_CONTRACTS.md updated** | New tables/views documented with schema and purpose | Scribe Agent |

---

## 5. ORCHESTRATION GATES (Required)

| # | Gate | Pass Criteria | Verified By |
|---|------|---------------|-------------|
| O1 | **Session Start Checklist followed** | ORCHESTRATOR_START_PROTOCOL.md checklist completed at session start | Orchestrator |
| O2 | **STOP-PER-SPRINT respected** | Sprint marked DONE, agent STOPs, user asked GO/NO-GO | Orchestrator |
| O3 | **No file ownership conflicts** | No two agents edited the same file tree concurrently | Orchestrator |
| O4 | **Report delivered** | Standard Output Template used (Status, Changes, Validation, Risks, GO/NO-GO) | Orchestrator |

---

## 6. SPRINT-SPECIFIC OVERRIDES

Individual sprint contracts may ADD gates but never REMOVE universal gates.

Examples:
- Sprint 8 (Canon Audit): Adds "Audit report as deliverable"
- Sprint 9 (Data Import): Adds "PDF parse success on sample file"
- Sprint 10 (Scenario Engine): Adds "Scenario vs base comparison renders"

Sprint-specific gates are listed in the sprint contract's "Definition of Done" section.

---

## 7. FAILURE PROTOCOL

If any gate fails:

1. **Fix** the issue (max 3 attempts per gate).
2. **Re-run** all gates from scratch.
3. If still failing after 3 attempts: **STOP** with detailed blocker report.
4. Do NOT mark sprint as DONE.
5. Do NOT proceed to next sprint.

---

## 8. COMPLETION CHECKLIST TEMPLATE

Copy this for each sprint completion:

```markdown
## Sprint [N] — [Name] Completion

### Code Gates
- [ ] C1: npm run build — PASS
- [ ] C2: npm test — PASS ([X] tests)
- [ ] C3: No new `as any` without reason
- [ ] C4: npm run lint — PASS
- [ ] C5: Test count ≥ [previous count]

### Business Logic Gates
- [ ] B1: Canon alignment verified
- [ ] B2: Locked values untouched
- [ ] B3: Append-only preserved
- [ ] B4: Engine purity maintained
- [ ] B5: SVASO not weight

### Documentation Gates
- [ ] D1: SPRINT_LOG.md updated
- [ ] D2: SYSTEM_STATE.md updated
- [ ] D3: Sprint-specific DoD items checked

### Schema Gates (if applicable)
- [ ] S1: Migration files only
- [ ] S2: No column renames
- [ ] S3: Migration applies clean
- [ ] S4: DATA_CONTRACTS.md updated

### Orchestration Gates
- [ ] O1: Session Start Checklist followed
- [ ] O2: STOP-PER-SPRINT respected
- [ ] O3: No file ownership conflicts
- [ ] O4: Report delivered

### Sprint-Specific Gates
- [ ] [From sprint contract]

### Result: [DONE / BLOCKED]
```

---

*This document is authoritative for sprint completion criteria. Conflicts resolve in favor of AGENT_RULES.md (business logic) and this document (process).*
