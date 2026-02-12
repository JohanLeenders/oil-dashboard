# AGENT_RULES.md — Oranjehoen Commercieel Dashboard

**Version:** 1.0.0
**Status:** ACTIVE
**Last Updated:** 2026-01-24

---

## 1. CORE PRINCIPLES

### 1.1 Data Immutability
- **APPEND-ONLY**: Source data is NEVER overwritten. Corrections create new records that reference the original.
- **No silent recalculations**: Any recalculation must be triggered explicitly and logged.
- **Historical integrity**: Past data states must be reconstructable at any point in time.

### 1.2 Simulation vs Actuals Separation
- **Actuals** are read-only facts from source systems (Storteboom, Exact Online).
- **Simulations** are ephemeral what-if scenarios that NEVER persist to actuals tables.
- **Projections** are forward-looking estimates clearly labeled as such.
- Simulations use separate memory/state, never pollute production views.

### 1.3 Source of Truth Hierarchy
```
1. External source (Storteboom invoices, Exact Online)
2. v_effective_* views (corrections resolved)
3. computed_snapshots (cached, invalidate-on-change)
4. UI display values (derived, never stored)
```

---

## 2. BUSINESS LOGIC RULES

### 2.1 Pricing & Margin
- **SVASO (Sales Value at Split-off)**: Cost allocation based on market value proportion, NOT weight.
- Formula: `allocated_cost = total_batch_cost × (market_value_share / total_market_value)`
- Margin = Revenue - Allocated Cost (SVASO)
- Margin % = (Margin / Revenue) × 100
- NEVER allocate costs by weight alone.

### 2.2 Yield Calculations
- **Griller Yield** = (Griller Weight / Live Weight) × 100
- **Cut-up Yield** = (Part Weight / Griller Weight) × 100
- Target yields are sourced from Hubbard JA757 spec sheet (LOCKED).
- Delta = Actual Yield - Target Midpoint

### 2.3 THT (Houdbaarheidsdatum) Logic
- **LOCKED THRESHOLDS** (Blueprint Spec):
  - Green: < 70% elapsed
  - Orange: 70-90% elapsed
  - Red: > 90% elapsed
- THT pressure = aggregated risk score based on inventory age distribution.
- NO changes to these thresholds without explicit user override.

### 2.4 CO2 / Sustainability (Future)
- Reserved for Phase 4+.
- Placeholder: CO2 per kg = f(transport, feed, processing).
- NOT implemented until domain model is validated.

### 2.5 Cherry-Picker Detection
- Threshold: Customer revenue > €10,000 YTD.
- Alert: Filet share > 30% of total (anatomically ~24% available).
- Balance Score: 0-100, higher = more balanced mix.

---

## 3. SEPARATION OF CONCERNS

### 3.1 Domain Logic (src/lib/engine/)
- Pure functions, no side effects.
- Input: typed data structures.
- Output: calculated results.
- NO database calls inside engine functions.
- NO UI concerns (colors, labels, formatting).

### 3.2 Data Access (src/lib/actions/ or src/app/*/actions.ts)
- Server Actions for data fetching.
- Read from v_effective_* views ONLY.
- NO direct table reads that bypass correction resolution.
- NO writes without explicit user action.

### 3.3 UI Layer (src/components/, src/app/)
- Presentation only.
- Receives pre-calculated data.
- NEVER contains business logic.
- NEVER performs calculations that affect commercial decisions.

### 3.4 Projections Layer (Future)
- Separate from actuals.
- Clearly labeled in UI.
- Uses same engine functions with projected inputs.

---

## 4. ANTI-REGRESSION RULES

### 4.1 Schema Changes
- NO column renames without migration.
- NO type changes without explicit version bump.
- NO default value changes that affect existing data.
- All schema changes via numbered migrations.

### 4.2 Calculation Changes
- Changes to margin/yield/THT formulas require:
  1. Update to DOMAIN_MODEL.md
  2. Update to relevant test files
  3. Version comment in engine file
- NO silent formula changes.

### 4.3 Threshold Changes
- THT thresholds (70/90): LOCKED unless user explicitly requests.
- Cherry-picker threshold (30%): LOCKED unless user explicitly requests.
- Revenue thresholds: Document in DOMAIN_MODEL.md before changing.

### 4.4 Test Coverage
- Engine functions MUST have unit tests.
- Tests MUST verify edge cases.
- `npm test` MUST pass before sprint completion.
- `npm run build` MUST succeed before sprint completion.

---

## 5. CODE QUALITY RULES

### 5.1 TypeScript
- Strict mode enabled.
- No `any` unless technically unavoidable (document reason).
- Nullable types handled explicitly.

### 5.2 File Organization
```
src/
├── app/                 # Next.js routes & Server Actions
├── components/          # React components (UI only)
├── lib/
│   ├── engine/          # Business logic (pure functions)
│   ├── supabase/        # Database client
│   └── types/           # TypeScript definitions
└── types/               # Shared type definitions
```

### 5.3 Naming Conventions
- Engine functions: verb + noun (calculateMargin, validateMassBalance)
- Components: PascalCase descriptive (BatchDetailView, ThtThermometer)
- Database views: v_prefix (v_effective_batch_yields)
- Types: PascalCase (BatchMassBalance, CustomerProductMix)

---

## 6. PROHIBITED ACTIONS

The agent MUST NOT:

1. **Overwrite historical data** in source tables.
2. **Change locked thresholds** without explicit user request.
3. **Add UI logic** that performs commercial calculations.
4. **Create cyclic dependencies** between layers.
5. **Skip test verification** before marking sprint complete.
6. **Modify schema** without migration file.
7. **Guess domain definitions** not in DOMAIN_MODEL.md.
8. **Auto-correct data** without user confirmation.
9. **Store simulation results** in production tables.
10. **Remove append-only protections** from batch_yields or batch_costs.

---

## 7. MANDATORY CHECKS

Before completing any sprint:

```bash
npm test          # All tests MUST pass
npm run build     # Build MUST succeed
npm run lint      # No errors (warnings acceptable)
```

If any check fails:
1. Fix the issue.
2. Re-run checks.
3. Maximum 3 retry attempts.
4. If still failing, log blocker and STOP.

---

## 8. LOGGING & AUDIT

- All significant actions logged to SPRINT_LOG.md.
- Schema changes documented in SYSTEM_STATE.md.
- Business logic changes documented in DOMAIN_MODEL.md.
- No silent modifications.

---

*This document is authoritative. Conflicts with other files resolve in favor of AGENT_RULES.md.*
