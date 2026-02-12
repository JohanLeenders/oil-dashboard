# ORCHESTRATOR_START_PROTOCOL (OIL Dashboard)

## Purpose

This protocol makes multi-agent work deterministic, regression-resistant, and sprint-governed.
It ensures every session starts from the same clean, non-contaminated baseline and uses
specialized agents as "fresh context notebooks" to prevent drift.

## Scope

- Applies to: OIL Dashboard repository work (Next.js + Supabase).
- Applies to: Claude Desktop and Claude CLI.
- Priority: This file is the operational contract for orchestration.
- Canon priority order (highest to lowest):
  1) AGENT_RULES.md (non-negotiable canon/business rails)
  2) UNIFIED_DEFINITION_OF_DONE.md (definition of completion)
  3) ORCHESTRATOR_START_PROTOCOL.md (this file: how we operate)
  4) SYSTEM_STATE.md (current status / truth snapshot)
  5) SPRINT docs + SPRINT_QUEUE.md (deliverables & dependencies)
  6) Everything else

## Non-Negotiable Rails

- STOP-PER-SPRINT is the default. Never proceed to the next sprint without explicit user GO.
- Always read canon docs BEFORE writing code.
- Always run git status BEFORE making changes.
- Always run validation gates (tests + build) BEFORE reporting done.
- Never change canonical cost math unless the sprint explicitly targets it and user gives GO.
- No "mega migration merge" and no "execute SQL via API" hacks.
- Prefer minimal, reversible changes.
- Never silently alter env secrets; request user action if secrets are required.

## Session Start Checklist (Must Follow In Order)

### 0) Declare Session Intent

- Write 2–5 bullets: what you will do this session, what you will NOT do.

### 1) Read Canon & Governance (READ-ONLY)

Must read fully (minimum set):

- AGENT_RULES.md
- AGENT_MODE.md
- SYSTEM_STATE.md (if missing, create stub only with "UNKNOWN" fields and ask GO)
- SPRINT_LOG.md
- SPRINT_QUEUE.md (or equivalent sprint dependency list)
- The sprint spec(s) you are working on

### 2) Repo State (Terminal: PowerShell on Windows, repo root)

Run and record outputs:

- git status
- git branch --show-current
- node -v
- npm -v

If repo is dirty:

- Summarize changes.
- Ask user GO before discarding/stashing, unless changes are clearly leftover debug noise.

### 3) Determine Target Sprint + STOP Gate

- Identify the active sprint (single sprint only).
- Confirm dependencies are satisfied per SPRINT_QUEUE.md.
- If dependencies not satisfied: STOP and propose the minimal unblock plan. Ask GO.

### 4) Plan Work as Parallel Agent Tasks

Spawn agents with clean scope and no overlapping file ownership.

Recommended agent roles:

- **Explore Agent:** inventory, locate files, map dependencies, identify risk
- **Builder Agent:** implement changes (limited file set)
- **Scribe Agent:** documentation updates only
- **Validator Agent:** run tests/build, verify invariants, report failures

File ownership rule:

- Never allow two agents to edit the same file tree concurrently.
  Example:
  - Builder owns `src/...`
  - Scribe owns `docs/...`
  - DB Builder owns `supabase/...`

### 5) Implement (Builder/Scribe)

- Small commits mentally (even if not committing): change in tight loops.
- Keep changes minimal.
- Prefer adding observability (better logs/errors) over guessing.

### 6) Validate (Validator)

Must run:

- npm test
- npm run build

Also run any sprint-specific gates, e.g.:

- DB: schema existence checks
- Costing: invariant checks / reconciliation

If failures:

- Fix → rerun gates (max 3 loops).
- If still failing, STOP and report.

### 7) Report + GO/NO-GO

Return a short report:

- What changed (files)
- Why it's safe (canon alignment)
- Gate results (tests/build)
- Known issues / follow-ups

End every session with an explicit GO/NO-GO question:

- "GO to proceed to next sprint?" or "GO to start Phase X?"

## Standard Output Template (Use Every Time)

- Status Overview (Problem → Cause → Fix)
- Changes (file list)
- Validation (tests/build results)
- Risks / Assumptions
- GO/NO-GO question

## Appendix: Safe Defaults for Multi-Agent Work

- Default to STOP unless sprint explicitly says continue.
- Default to READ-ONLY on canon docs unless sprint is "docs governance".
- Default to "explain then prompt": short rationale per step, then one copy-paste block for user.
