# Claude Operating Contract — Oranjehoen Intelligence Layer (OIL)

This document defines the non-negotiable operating rules for Claude acting as a
local development agent and mini-CI for the Oranjehoen Intelligence Layer (OIL).

By continuing work in this repository, Claude explicitly agrees to follow these rules.

---

## 1. Role & Authority

1. Claude operates as a **local development agent with MCP access**.
2. Claude may read and write files **ONLY** within the repository root.
3. Claude may execute shell commands **ONLY** relevant to this project:
   - `npm`, `node`
   - `supabase`
   - `git` (read-only: status, diff)
4. Claude is **NOT allowed** to push commits or modify git history.

---

## 2. Definition of DONE (HARD GATE)

A task is ONLY considered **DONE** when **ALL** of the following are true:

- `npm test` → PASS
- `npm run build` → PASS
- `npm run lint` → PASS
- If database schema, functions, or views were changed:
  - `supabase db reset` **OR**
  - `supabase migration up`
  → PASS
- No failing tests, lint errors, warnings, or build errors remain.

No exceptions.  
No “should pass” statements.

---

## 3. Mandatory Self-Correction Loop (Self-Healing Mode)

After **EVERY** significant change (UI, engine, database, views):

1. Run required commands:
   - `npm test`
   - `npm run build`
   - `npm run lint`
2. If any command FAILS:
   - Capture and report the **exact terminal error output**
   - Identify the root cause (spec mismatch, regression, typing issue, server/client boundary, etc.)
   - Apply the **smallest possible fix**
   - Re-run the **same command**
3. Loop limit:
   - Maximum **3 fix attempts** per failing command
   - After 3 failures: **STOP** and report the blocker explicitly

Claude may **NOT** skip tests, suppress errors, or downgrade failures.

---

## 4. Strict Typing & Code Discipline (“Code Police”)

1. Claude may **NOT** use `any` types in TypeScript unless technically unavoidable.
2. Any unavoidable `any` usage MUST be:
   - explicitly justified
   - documented in the response
3. All TypeScript interfaces MUST:
   - align with database schemas
   - match Supabase-generated types where applicable
4. Type safety takes precedence over speed or convenience.

---

## 5. Append-Only & Data Integrity (SACRED)

1. Source data tables are **append-only**.
2. **NO** `UPDATE` or `DELETE` on source records.
3. Corrections or adjustments MUST:
   - be new rows
   - reference a parent record explicitly
4. UI and business logic MUST read from **effective views** (`v_effective_*`) only.
5. Mass balance mismatches MUST:
   - surface an explicit `NEEDS_REVIEW` signal
   - never be silently ignored, zeroed, or averaged.

Violating append-only principles is a **critical failure**.

---

## 6. Specification Lock (Non-Negotiable Business Truths)

The following rules are **LOCKED** unless explicitly instructed otherwise:

- THT thresholds:
  - GREEN `< 70%`
  - ORANGE `70–90%`
  - RED `> 90%`
- Cost allocation method: **SVASO only**
- SKU definitions and provenance via `technical_definitions`
- Mass balance validation is mandatory

Claude may **NOT** reinterpret, “optimize”, or silently adjust these rules.

---

## 7. Environment Variable & Security Safety

1. Claude may **NEVER** overwrite `.env` files.
2. Claude may **NEVER** hardcode secrets or sensitive keys
   (e.g. Supabase Service Role keys).
3. All configuration MUST use:
   - `.env.local`
   - `process.env`

Any violation is considered a **critical security incident**.

---

## 8. System State as Source of Truth

1. `SYSTEM_STATE.md` represents the **authoritative system state**.
2. Claude is responsible for keeping `SYSTEM_STATE.md`:
   - accurate
   - consistent with the repository
3. If documented state ≠ actual repository state:
   - fixing this mismatch is the **highest priority**
   - no new work may proceed until resolved.

---

## 9. Transparency, Intent & Reporting (MANDATORY)

Every response that changes code MUST end with **all sections below**.

### 9.1 Health Check (MANDATORY)

Claude MUST report the system health using the following table format:

Checkpoint | Status | Verification Method
--- | --- | ---
SVASO Logic | 🟢 / 🔴 | Allocation matches H3.1 formulas
THT Thresholds | 🟢 / 🔴 | Thresholds still 70 / 90
Append-Only | 🟢 / 🔴 | No UPDATE / DELETE used in SQL
Mass Balance | 🟢 / 🔴 | validateMassBalance() = PASS
Build Gate | 🟢 / 🔴 | `npm run build` exit code = 0
Test Suite | 🟢 / 🔴 | Passed tests: X / Y
Lint Gate | 🟢 / 🔴 | `npm run lint` exit code = 0
State Sync | 🟢 / 🔴 | SYSTEM_STATE.md up-to-date
Migration Gate | 🟢 / 🔴 | supabase migration/reset exit code = 0 (if applicable)

If any checkpoint is 🔴, the task may NOT be marked as DONE.

---

### 9.2 Sessie Overdracht & Validatie

- **What changed**  
  (exact files + purpose)
- **Commands executed (real)**  
  (with exit codes)
- **Results**  
  (PASS / FAIL)
- **Log of Intent**  
  (why each fix is correct and does NOT violate SVASO or business logic)
- **Regression check**  
  (SVASO / append-only / THT confirmed)
- **Context for next prompt**  
  (copy-paste ready)
- **claude_rules.md acknowledged**  
  YES

---

## 10. Enforcement

If Claude:
- cannot access files
- cannot execute commands
- or lacks required permissions

Claude MUST stop immediately and report the limitation.  
Guessing, simulating results, or claiming success without proof is forbidden.

---

**This contract is binding for all further work in this repository.**
