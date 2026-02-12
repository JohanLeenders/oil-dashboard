# STEP 5 — Advanced Sprint Definition (USER INPUT REQUIRED)

**Status:** AWAITING USER INPUT
**Purpose:** Define the final sprint sequence and custom requirements

---

## INSTRUCTIONS FOR USER

This file is a placeholder for STEP 5 configuration.

The agent has prepared:
- Sprints 1-5 with concrete decision-driven goals
- Placeholder slots 6-10 for user-defined work

### To Complete STEP 5:

1. **Review Sprints 1-5** in SPRINT_QUEUE.md
   - Modify order if needed
   - Adjust scope if needed
   - Remove if not needed

2. **Define Sprints 6-10** (or add more)
   Use this template for each sprint:

```markdown
### Sprint [N]: [NAME]
**Status:** READY
**Decision Supported:** [What commercial decision does this enable?]

**Tasks:**
1. [Task 1]
2. [Task 2]
3. [Task 3]

**Acceptance Criteria:**
- [Criterion 1]
- [Criterion 2]

**Files to Create/Modify:**
- [file1.ts]
- [file2.tsx]
```

3. **Set Priority Order**
   Update the SPRINT EXECUTION ORDER section

4. **Identify Blockers**
   Note any external dependencies (API access, credentials, etc.)

---

## PLACEHOLDER SPRINT SLOTS

### Sprint 6: ________________________________
**Decision Supported:**

**Tasks:**
1.
2.
3.

### Sprint 7: ________________________________
**Decision Supported:**

**Tasks:**
1.
2.
3.

### Sprint 8: ________________________________
**Decision Supported:**

**Tasks:**
1.
2.
3.

### Sprint 9: Exact Online Integration (Predefined)
**Decision Supported:** Automated data synchronization
**Blocked By:** API credentials, endpoint documentation

### Sprint 10: ________________________________
**Decision Supported:**

**Tasks:**
1.
2.
3.

---

## QUESTIONS FOR USER (Optional)

If you want to customize the dashboard focus, consider:

1. **Customer Focus**
   - Should we add customer segmentation views?
   - Do you need customer comparison features?

2. **Time Dimension**
   - Do you need week-over-week comparisons?
   - Are there specific reporting periods to support?

3. **Alerts & Notifications**
   - Should the dashboard generate alerts for specific conditions?
   - Email notifications? In-app only?

4. **Data Export**
   - Do you need Excel/CSV export capabilities?
   - Report generation features?

5. **Access Control**
   - Will there be multiple users?
   - Different permission levels?

---

## AGENT ACTION

Once user provides input:

1. Agent will update SPRINT_QUEUE.md with defined sprints
2. Agent will validate against AGENT_RULES.md
3. Agent will proceed with execution

**Until STEP 5 is defined:**
- Agent will execute Sprints 1-5 only
- Agent will STOP at Sprint 6 placeholder
- Agent will await user input

---

*Delete this file or mark as COMPLETE after user provides STEP 5 input.*
