# SPRINT 9 IMPORT SPECIFICATION — OIL Dashboard Data Import Pipeline

**Version:** 1.0.0
**Status:** DESIGN (Not yet implemented)
**Phase:** 9A — CSV/Excel Import Only (PDF parser deferred to 9B)
**Last Updated:** 2026-02-12
**Designed By:** Claude CLI Orchestrator

---

## 1. OBJECTIVE

Enable Oranjehoen to import real production and sales data into the OIL Dashboard, replacing demo/seed data with actual business data from three primary sources:

1. **CSV/Excel from Storteboom** — Slaughter reports (yields, weights, batch metadata)
2. **CSV/Excel from Storteboom** — Delivery notes (pakbonnen with SKU, weight, customer)
3. **Excel export from Exact Online** — Sales invoices and cost invoices

**Success criteria:**
- Data flows from external sources into the dashboard with full audit trail
- All imports validated against business rules before acceptance
- Mapping layer handles external codes (PLU, item codes) → internal SKUs
- Zero data loss or silent failures
- Full traceability from source file to database record

---

## 2. SCOPE (Phase 9A ONLY)

### IN SCOPE (Phase 9A)
- ✅ CSV/Excel upload UI for slaughter reports (replaces PDF parser temporarily)
- ✅ CSV/Excel upload UI for delivery notes (pakbonnen)
- ✅ Excel export import from Exact Online (invoices)
- ✅ Mapping management UI (PLU → SKU, Exact item codes → SKU)
- ✅ Import validation with user-facing error messages
- ✅ Idempotency (duplicate detection and prevention)
- ✅ Audit trail (import_logs table)
- ✅ Preview + confirmation workflow (no automatic writes)

### OUT OF SCOPE (Deferred to 9B or later)
- ❌ PDF parsing (Storteboom slaughter PDFs)
- ❌ Real-time API integration with Exact Online
- ❌ Automated scheduling (cron-based imports)
- ❌ Batch reconciliation automation
- ❌ Multi-user concurrent imports
- ❌ Import rollback/undo functionality

### RATIONALE
Phase 9A focuses on **manual, supervised imports** via CSV/Excel to establish the data pipeline infrastructure, validation rules, and audit trail. PDF parsing and API integrations are deferred to Phase 9B once the core pipeline is proven stable.

---

## 3. NON-GOALS

**This sprint does NOT:**
- Provide price advice or optimization
- Automatically calculate costs without user confirmation
- Overwrite existing data (append-only principle)
- Auto-correct invalid data (surfaces errors, requires user decision)
- Replace manual batch input (Batch Input v1 remains as fallback)
- Integrate with Flow Automation directly (Excel exports only)
- Support real-time streaming (batch-oriented uploads)

---

## 4. DATA CONTRACT — Import File Structures

### 4.1 Slaughter Report CSV/Excel

**Purpose:** Replace PDF uploads temporarily. Contains batch metadata, live weights, yields per anatomical part.

**File format:** CSV or Excel (.xlsx)

**Required columns:**

| Column Name | Type | Description | Mandatory | Example |
|-------------|------|-------------|-----------|---------|
| `lot_number` | TEXT | Batch reference (unique) | Yes | P2520210 |
| `slaughter_date` | DATE | Date of slaughter | Yes | 2026-02-10 |
| `live_weight_kg` | DECIMAL | Total live weight | Yes | 10450.5 |
| `bird_count` | INTEGER | Number of birds | Yes | 4200 |
| `cat2_kg` | DECIMAL | Category 2 losses (DOA, condemned) | Yes | 125.0 |
| `cat3_kg` | DECIMAL | Category 3 waste (blood, feathers) | Yes | 890.0 |
| `griller_weight_kg` | DECIMAL | Usable griller weight | Yes | 9435.5 |
| `breast_cap_kg` | DECIMAL | Breast cap yield | Yes | 3285.0 |
| `leg_quarter_kg` | DECIMAL | Leg quarter yield | Yes | 4095.0 |
| `wings_kg` | DECIMAL | Wings yield | Yes | 1010.0 |
| `back_carcass_kg` | DECIMAL | Back/carcass yield | Yes | 717.5 |
| `offal_kg` | DECIMAL | Offal yield | Yes | 328.0 |
| `production_date` | DATE | Production/cutting date | Optional | 2026-02-11 |
| `expiry_date` | DATE | THT (best before) | Optional | 2026-02-21 |

**Validation rules:**
- `lot_number` must be unique (no duplicate imports of same batch)
- Mass balance: `live_weight_kg ≈ griller_weight_kg + cat2_kg + cat3_kg` (±2% tolerance)
- Part yields: `breast_cap + leg_quarter + wings + back_carcass + offal ≈ griller_weight_kg` (±5% unaccounted allowed)
- All weights must be ≥ 0
- `slaughter_date` ≤ `production_date` ≤ `expiry_date` (if provided)

**Mapping to database:**
- Creates/updates `production_batches` record (batch_ref = lot_number)
- Creates `slaughter_reports` record (source_document_id = uploaded filename)
- Creates 5 `batch_yields` records (one per anatomical part)

---

### 4.2 Delivery Note (Pakbon) CSV/Excel

**Purpose:** Import commercial deliveries with SKU codes, weights, customers.

**File format:** CSV or Excel (.xlsx)

**Required columns:**

| Column Name | Type | Description | Mandatory | Example |
|-------------|------|-------------|-----------|---------|
| `delivery_number` | TEXT | Pakbon/delivery ID | Yes | PAK-2026-0042 |
| `delivery_date` | DATE | Date of delivery | Yes | 2026-02-12 |
| `storteboom_plu` | TEXT | Storteboom PLU code | Yes | 12345 |
| `net_weight_kg` | DECIMAL | Net weight delivered | Yes | 125.5 |
| `customer_code` | TEXT | Customer ID (Exact code) | Yes | DEB1001 |
| `lot_number` | TEXT | Batch reference | Optional | P2520210 |

**Validation rules:**
- `delivery_number` + `storteboom_plu` + `delivery_date` must be unique (prevents duplicate import)
- `storteboom_plu` must exist in `import_mapping_rules` OR trigger mapping UI
- `net_weight_kg` must be > 0
- `customer_code` validated against `customers` table (warning if not found, not blocking)
- `lot_number` validated against `production_batches` if provided (nullable)

**Mapping to database:**
- Creates `delivery_notes` record per row
- Resolves `storteboom_plu` → `sku` via `import_mapping_rules`
- Links to `batch_id` if `lot_number` found in `production_batches`

---

### 4.3 Exact Online Invoice Export (Excel)

**Purpose:** Import sales invoices with revenue, costs, customers.

**File format:** Excel export from Exact Online (.xlsx)

**Required columns:**

| Column Name | Type | Description | Mandatory | Example |
|-------------|------|-------------|-----------|---------|
| `invoice_number` | TEXT | Factuurnummer | Yes | 2026-INV-0123 |
| `invoice_date` | DATE | Invoice date | Yes | 2026-02-08 |
| `customer_code` | TEXT | Debtor code | Yes | DEB1001 |
| `item_code` | TEXT | Exact item code | Yes | EXACT-FILET-001 |
| `quantity_kg` | DECIMAL | Quantity in kg | Yes | 50.0 |
| `unit_price` | DECIMAL | Price per kg | Yes | 12.50 |
| `line_total` | DECIMAL | Total line value | Yes | 625.00 |
| `cost_price` | DECIMAL | Allocated cost (if available) | Optional | 437.50 |

**Validation rules:**
- `invoice_number` + `item_code` must be unique (prevents re-import)
- `item_code` must exist in `import_mapping_rules` OR trigger mapping UI
- `quantity_kg` > 0, `unit_price` ≥ 0, `line_total` ≥ 0
- `line_total` should equal `quantity_kg × unit_price` (warning if mismatch >1%)
- `customer_code` validated against `customers` (warning if not found)

**Mapping to database:**
- Creates `sales_transactions` record per invoice line
- Resolves `item_code` → `product_id` via `import_mapping_rules`
- `allocated_cost` set to `cost_price × quantity_kg` if provided, else NULL

---

## 5. REQUIRED FIELDS (Per Cost Engine)

Based on canonical-cost.ts analysis, the following fields are MANDATORY for cost engine to compute:

### For SVASO Allocation (Level 3)
- `live_weight_kg` — Live input weight
- `griller_weight_kg` — Usable griller weight
- `breast_cap_kg`, `leg_quarter_kg`, `wings_kg` — Joint product weights
- `shadow_price_per_kg` per part — Market prices (from `std_prices` table)

**Import impact:** Slaughter report CSV MUST include all 5 anatomical part weights.

### For Mass Balance Validation
- `live_weight_kg`, `griller_weight_kg`, `cat2_kg`, `cat3_kg` — Level 1 balance
- All 5 part weights (breast, legs, wings, back, offal) — Level 2 balance

**Import impact:** Missing part weights → batch marked NEEDS_REVIEW, cannot compute costs.

### For Cost Pool (Level 1)
- `live_price_per_kg` — Live bird purchase price
- `slaughter_fee_per_head` — Per-bird slaughter cost

**Import impact:** These come from Exact Online cost invoices (future), not slaughter reports.

---

## 6. OPTIONAL FIELDS

**Fields that enhance data quality but are not blocking:**

- `production_date` — If missing, defaults to slaughter_date + 1 day
- `expiry_date` — If missing, calculated as production_date + 10 days (default THT)
- `cost_price` in Exact export — If missing, `allocated_cost` = NULL, margin cannot be calculated
- `lot_number` in delivery notes — If missing, delivery not linked to batch (acceptable for external sales)
- `customer_code` in delivery notes — If missing, delivery marked as "unknown customer" (warning)

---

## 7. MAPPING RULES

### 7.1 PLU → SKU Mapping (Storteboom)

**Source:** `import_mapping_rules` table

**Lookup logic:**
1. Check if `storteboom_plu` exists in `import_mapping_rules` WHERE `source_type = 'storteboom_plu'`
2. If found: Use `target_sku` and `target_part_code`
3. If NOT found:
   - Mark row as "unmapped" in import preview
   - Surface to user: "Unknown PLU: {code} — Please map to SKU"
   - User selects from dropdown of existing SKUs OR creates new SKU
   - New mapping stored in `import_mapping_rules` with `confidence = 'manual'`

**Mapping confidence levels:**
- `manual` — User explicitly mapped via UI
- `verified` — User confirmed auto-inferred mapping
- `inferred` — System guessed based on product description (low confidence)

**UI requirement:** Mapping Beheer screen at `/oil/import/mappings` shows all rules, allows editing.

---

### 7.2 Exact Item Code → SKU Mapping

**Source:** `import_mapping_rules` table

**Lookup logic:**
1. Check if `item_code` exists in `import_mapping_rules` WHERE `source_type = 'exact_itemcode'`
2. If found: Use `target_sku`
3. If NOT found: Same unmapped flow as PLU mapping

**Edge case:** One Exact item code may map to multiple SKUs (e.g., different pack sizes). Rule: Use first match, log warning if ambiguous.

---

### 7.3 Customer Code Mapping

**Source:** `customers` table (no mapping layer needed)

**Lookup logic:**
1. Check if `customer_code` exists in `customers.customer_code`
2. If found: Use `customer_id`
3. If NOT found:
   - Warning (not blocking): "Unknown customer: {code}"
   - Option: Create new customer record OR mark delivery as "external/unknown"

**Rationale:** Customer codes are stable (Exact Online is source of truth), no complex mapping needed.

---

## 8. VALIDATION RULES

### 8.1 File-Level Validation

**Before parsing:**
- File size < 10 MB (reject if larger)
- File format matches expected (CSV, XLSX)
- File not empty (> 0 bytes)
- Filename matches pattern (optional: regex validation)

**After parsing:**
- At least 1 row present (excluding header)
- All required columns present
- No completely empty rows

**Rejection:** File-level validation failure → import stopped, user shown error, file not processed.

---

### 8.2 Row-Level Validation

**Per row (slaughter report):**
- `lot_number` not already imported (check `production_batches.batch_ref`)
- All numeric fields parseable as DECIMAL
- All date fields parseable as DATE
- Mass balance within tolerance:
  - Level 1: `|live_weight - (griller + cat2 + cat3)| / live_weight ≤ 2%`
  - Level 2: `|griller - sum(parts)| / griller ≤ 5%`
- All weights ≥ 0
- `bird_count` > 0

**Per row (delivery note):**
- `delivery_number` + `storteboom_plu` + `delivery_date` unique (check `delivery_notes`)
- `net_weight_kg` > 0
- `storteboom_plu` exists in mapping rules OR flagged for mapping
- `lot_number` exists in `production_batches` if provided (warning if not)

**Per row (Exact invoice):**
- `invoice_number` + `item_code` unique (check `sales_transactions.invoice_number`)
- `quantity_kg` > 0, `unit_price` ≥ 0
- `line_total ≈ quantity_kg × unit_price` (warning if >1% deviation)
- `item_code` exists in mapping rules OR flagged for mapping

**Rejection strategy:**
- **Blocking errors:** Duplicate, invalid data type, negative weight → row excluded
- **Warnings:** Unknown customer, missing lot_number, mass balance >2% → row included with warning flag

**Output:** Import preview shows:
- ✅ Valid rows (count)
- ⚠️ Warning rows (count + details)
- ❌ Invalid rows (count + error messages)

User must acknowledge warnings before proceeding.

---

### 8.3 Business Rule Validation

**SVASO allocation integrity:**
- If batch is imported, all 3 joint product weights (breast_cap, legs, wings) must be > 0
- If any joint product weight = 0 → batch marked NEEDS_REVIEW, cost allocation fails

**Append-only enforcement:**
- If `lot_number` already exists in `production_batches`:
  - Reject import OR
  - Create correction record with new source_document_id
  - User must choose: "Skip duplicate" or "Import as correction"

**Cost engine readiness check:**
- After slaughter report import, check if batch has std_prices for the period
- If no std_prices → warning: "Cannot compute SVASO until std_prices populated for period {YYYY-MM}"

---

## 9. IDEMPOTENCY MODEL

**Goal:** Re-uploading the same file should not create duplicate records.

### 9.1 File-Level Deduplication

**Strategy:** SHA256 hash of file contents

**Implementation:**
1. On upload, compute `file_hash = SHA256(file_content)`
2. Check `import_logs` table: `SELECT * WHERE file_hash = {computed_hash} AND status = 'imported'`
3. If match found:
   - **Action:** Show user: "This file was already imported on {date} (Import ID: {id}). Upload cancelled."
   - **Result:** No processing, no database writes
4. If no match:
   - Proceed with validation and preview

**Edge case:** User uploads identical file twice intentionally (e.g., re-import after deletion).
- **Solution:** "Force re-import" checkbox bypasses hash check (logs as `forced_reimport = true`)

---

### 9.2 Row-Level Deduplication (Slaughter Reports)

**Strategy:** Unique constraint on `production_batches.batch_ref`

**Implementation:**
1. For each row, check: `SELECT id FROM production_batches WHERE batch_ref = {lot_number}`
2. If exists:
   - **Action:** Mark row as duplicate in preview
   - **User choice:**
     - "Skip duplicate" (default)
     - "Import as correction" (creates new slaughter_reports record with same batch_id, different source_document_id)
3. If not exists:
   - Create new `production_batches` record + `slaughter_reports` record

**Rationale:** Lot numbers are unique per batch. If lot number exists, it's either a duplicate upload or a correction.

---

### 9.3 Row-Level Deduplication (Delivery Notes)

**Strategy:** Unique constraint on `(delivery_number, sku, delivery_date)`

**Implementation:**
1. For each row after PLU mapping: `SELECT id FROM delivery_notes WHERE delivery_number = {num} AND sku = {sku} AND delivery_date = {date}`
2. If exists:
   - **Action:** Skip row (log as duplicate)
   - **Result:** Not added to import
3. If not exists:
   - Create new `delivery_notes` record

**Edge case:** Same delivery number, different SKUs → allowed (multiple lines per pakbon).

---

### 9.4 Row-Level Deduplication (Exact Invoices)

**Strategy:** Unique constraint on `sales_transactions(invoice_number, product_id)`

**Implementation:**
1. For each row after item_code mapping: `SELECT id FROM sales_transactions WHERE invoice_number = {num} AND product_id = {mapped_id}`
2. If exists:
   - **Action:** Skip row (log as duplicate)
3. If not exists:
   - Create new `sales_transactions` record

**Edge case:** Invoice number + item code combination is unique. Same invoice with different items = multiple rows (allowed).

---

## 10. AUDIT TRAIL MODEL

**Requirement:** Every import must be fully traceable.

### 10.1 import_logs Table

**Purpose:** Master log of all import operations

**Schema:**
```sql
CREATE TABLE import_logs (
  import_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_type VARCHAR(50) NOT NULL CHECK (import_type IN ('slaughter_csv', 'delivery_csv', 'exact_excel', 'manual')),
  source_filename VARCHAR(255) NOT NULL,
  file_hash VARCHAR(64), -- SHA256 hex
  file_size_bytes BIGINT,
  import_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  imported_by VARCHAR(100), -- User ID or email
  record_count_total INTEGER NOT NULL DEFAULT 0,
  record_count_imported INTEGER NOT NULL DEFAULT 0,
  record_count_skipped INTEGER NOT NULL DEFAULT 0,
  record_count_errors INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'validated', 'imported', 'error', 'cancelled')),
  error_details JSONB, -- Array of {row, error_code, error_message}
  audit_trail JSONB NOT NULL, -- {uploaded_at, validated_at, imported_at, user_agent, ip_address}
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_import_logs_status ON import_logs(status);
CREATE INDEX idx_import_logs_type ON import_logs(import_type);
CREATE INDEX idx_import_logs_date ON import_logs(import_date DESC);
CREATE INDEX idx_import_logs_hash ON import_logs(file_hash); -- For deduplication
```

**Lifecycle:**
1. `pending` — File uploaded, not yet validated
2. `validated` — Validation passed, awaiting user confirmation
3. `imported` — Records written to database successfully
4. `error` — Validation or write failed
5. `cancelled` — User cancelled during preview

**audit_trail JSONB structure:**
```json
{
  "uploaded_at": "2026-02-12T10:15:00Z",
  "validated_at": "2026-02-12T10:15:02Z",
  "imported_at": "2026-02-12T10:15:30Z",
  "user_agent": "Mozilla/5.0...",
  "ip_address": "192.168.1.100",
  "user_email": "user@oranjehoen.nl"
}
```

**error_details JSONB structure:**
```json
[
  {"row": 5, "error_code": "DUPLICATE_LOT", "error_message": "Lot P2520210 already exists"},
  {"row": 12, "error_code": "MASS_BALANCE_FAIL", "error_message": "Mass balance deviation 3.2% exceeds 2% tolerance"}
]
```

---

### 10.2 Linking Imported Records to import_logs

**Pattern:** Foreign key `import_id` added to target tables

**Affected tables:**
- `slaughter_reports.import_id` (FK to import_logs)
- `delivery_notes.import_id` (FK to import_logs)
- `sales_transactions.import_id` (FK to import_logs)

**Benefit:** Query which import created a specific record:
```sql
SELECT sl.*, il.source_filename, il.imported_by, il.import_date
FROM slaughter_reports sl
JOIN import_logs il ON sl.import_id = il.import_id
WHERE sl.batch_id = 'batch-uuid';
```

**Migration required:** Add `import_id UUID REFERENCES import_logs(import_id)` to existing tables.

---

### 10.3 Audit Query Examples

**Find all imports by a user:**
```sql
SELECT * FROM import_logs WHERE imported_by = 'user@oranjehoen.nl' ORDER BY import_date DESC;
```

**Find all failed imports:**
```sql
SELECT import_id, source_filename, error_details
FROM import_logs
WHERE status = 'error'
ORDER BY import_date DESC;
```

**Find which import created a specific batch:**
```sql
SELECT il.*
FROM production_batches pb
JOIN slaughter_reports sr ON pb.id = sr.batch_id
JOIN import_logs il ON sr.import_id = il.import_id
WHERE pb.batch_ref = 'P2520210';
```

---

## 11. UI FLOW (Minimal)

### 11.1 Import Dashboard (`/oil/import`)

**Purpose:** Central hub for all imports

**Components:**
- Recent imports table (last 20)
  - Columns: Date, Type, Filename, Status, Records (imported/total), User, Actions
  - Actions: View details, Download original file (if stored), Re-import (if error)
- Upload buttons:
  - "Upload Slaughter Report (CSV/Excel)"
  - "Upload Delivery Notes (CSV/Excel)"
  - "Upload Exact Invoices (Excel)"
- Link to "Manage Mappings" (`/oil/import/mappings`)

**Data source:** `SELECT * FROM import_logs ORDER BY import_date DESC LIMIT 20`

---

### 11.2 Upload Flow (All Import Types)

**Step 1: File Selection**
- File input field
- Accepted formats shown (CSV, XLSX)
- Max file size warning (10 MB)
- Button: "Upload & Validate"

**Step 2: Validation & Preview**
- Loading spinner while file parsed
- Validation results:
  - ✅ "File valid: {total_rows} rows found"
  - ⚠️ "Warnings: {warning_count} rows" (expandable list)
  - ❌ "Errors: {error_count} rows" (expandable list with details)
- Preview table: First 10 rows with mapped values shown
- Unknown mappings highlighted in yellow
- Button: "Edit Mappings" (opens mapping modal)
- Button: "Cancel" or "Proceed to Confirmation"

**Step 3: Mapping Review (if unmapped codes exist)**
- Modal dialog: "Unknown Codes Detected"
- Table of unmapped codes:
  - Columns: Source Code, Source Type, Suggested SKU (dropdown), Confidence
  - User selects SKU from dropdown or types new
  - Button: "Save Mappings"
- After save: Return to Step 2 preview with updated mappings

**Step 4: Confirmation**
- Summary:
  - "Ready to import {valid_count} records"
  - "Skip {duplicate_count} duplicates"
  - "Warnings: {warning_count}"
- Checkbox: "I confirm this data is correct"
- Button: "Import Now" (disabled until checkbox checked)

**Step 5: Result**
- Success message: "Import completed: {imported_count} records added"
- Link to import log details
- Link to view imported batches/deliveries/invoices
- Button: "Import Another File"

**Error handling:**
- If import fails during write: Status = 'error', show error details from `import_logs.error_details`
- User can retry or cancel

---

### 11.3 Mapping Management (`/oil/import/mappings`)

**Purpose:** Manage all PLU → SKU and Item Code → SKU mappings

**Components:**
- Filter dropdown: "Source Type" (Storteboom PLU / Exact Item Code)
- Search box: Filter by source code or target SKU
- Table:
  - Columns: Source Type, Source Code, Target SKU, Target Part Code, Confidence, Created Date, Notes, Actions
  - Actions: Edit, Delete
- Button: "Add New Mapping"

**Add/Edit modal:**
- Fields:
  - Source Type (dropdown)
  - Source Code (text input)
  - Target SKU (dropdown from `products` table)
  - Target Part Code (auto-filled from SKU, editable)
  - Confidence (dropdown: manual/verified/inferred)
  - Notes (textarea)
- Button: "Save"

**Data source:** `SELECT * FROM import_mapping_rules ORDER BY created_date DESC`

---

## 12. ERROR HANDLING & OBSERVABILITY

### 12.1 Error Categories

**File-Level Errors (Blocking):**
- `FILE_TOO_LARGE` — File exceeds 10 MB limit
- `INVALID_FORMAT` — Not a valid CSV/XLSX file
- `EMPTY_FILE` — File has 0 rows or is corrupted
- `MISSING_COLUMNS` — Required columns not found

**Row-Level Errors (Blocking per row):**
- `DUPLICATE_LOT` — Lot number already imported
- `INVALID_NUMBER` — Cannot parse numeric field
- `INVALID_DATE` — Cannot parse date field
- `NEGATIVE_WEIGHT` — Weight value < 0
- `ZERO_BIRDS` — bird_count = 0
- `MASS_BALANCE_FAIL` — Mass balance deviation exceeds tolerance

**Row-Level Warnings (Non-blocking):**
- `UNKNOWN_PLU` — PLU code not in mapping rules (requires user mapping)
- `UNKNOWN_CUSTOMER` — Customer code not in customers table
- `MISSING_LOT` — Delivery note missing lot_number (allowed)
- `MASS_BALANCE_WARNING` — Mass balance deviation 1-2% (marginal)
- `LINE_TOTAL_MISMATCH` — Invoice line total ≠ qty × price (>1% diff)

---

### 12.2 Error Messages (User-Facing)

**Guidelines:**
- Clear, actionable language (Dutch)
- Include row number and field name
- Suggest fix where possible

**Examples:**

| Error Code | Message (NL) | Suggested Fix |
|------------|--------------|---------------|
| `DUPLICATE_LOT` | "Rij {row}: Lotnummer {lot} is al geïmporteerd op {date}." | "Sla deze rij over of importeer als correctie." |
| `MASS_BALANCE_FAIL` | "Rij {row}: Massabalans klopt niet. Verschil: {delta_pct}% (max. 2%)." | "Controleer gewichten in bronbestand." |
| `UNKNOWN_PLU` | "Rij {row}: PLU-code {plu} is onbekend." | "Koppel deze code aan een SKU in de mapping beheer." |
| `INVALID_NUMBER` | "Rij {row}: Veld '{field}' bevat geen geldig getal: '{value}'." | "Corrigeer waarde in bronbestand." |
| `NEGATIVE_WEIGHT` | "Rij {row}: Gewicht kan niet negatief zijn: {value} kg." | "Verwijder of corrigeer deze rij." |

---

### 12.3 Logging & Monitoring

**Server-side logging:**
- Use `logSupabaseError()` helper (from Phase 2A) for all database errors
- Log structure:
  ```typescript
  {
    operation: 'import_slaughter_report',
    import_id: 'uuid',
    filename: 'slaughter_2026-02.csv',
    error_code: 'MASS_BALANCE_FAIL',
    error_message: 'Row 5: Mass balance deviation 3.2%',
    context: { row: 5, lot_number: 'P2520210', delta_pct: 3.2 }
  }
  ```

**Client-side error handling:**
- All upload API calls wrapped in try/catch
- Network errors shown to user: "Upload failed. Check your connection and try again."
- Validation errors shown in preview step (not thrown)

**Observability metrics (future):**
- Import success rate (%)
- Average import time per file type
- Most common error codes
- Unmapped PLU/item code count (trending)

---

## 13. INTEGRATION WITH CANONICAL COST ENGINE

### 13.1 Data Flow: Import → Cost Calculation

**Sequence:**
1. **Import slaughter report** → Creates `production_batches` + `slaughter_reports` + `batch_yields`
2. **Mass balance validation** → Marks batch as COMPLETE or NEEDS_REVIEW
3. **Cost import (future)** → Creates `batch_costs` with live bird purchase cost
4. **SVASO allocation (manual trigger)** → User clicks "Calculate Costs" on batch detail page
5. **Canonical cost engine** → Reads batch data, std_prices, cost_drivers → Computes allocated costs

**Critical:** Import does NOT auto-trigger cost calculations. User must explicitly confirm cost calculation.

---

### 13.2 Cost Engine Readiness Checks

**Before SVASO can run, batch must have:**
- ✅ All 5 anatomical part yields > 0 (breast_cap, legs, wings, back, offal)
- ✅ Mass balance COMPLETE status (±2% tolerance)
- ✅ `std_prices` record for the batch's period (e.g., `2026-02`)
- ✅ At least one `batch_costs` record with `cost_type = 'live_bird_purchase'`

**Import impact:**
- Slaughter report import provides yields
- Exact invoice import (future) provides batch costs
- `std_prices` populated separately (Sprint 7 admin UI, not import-driven)

**Validation on batch detail page:**
- If batch missing cost engine inputs: Show warning: "Cannot calculate costs yet. Missing: {list}"
- Button "Calculate Costs" disabled until all inputs ready

---

### 13.3 Data Reconciliation (Slaughter vs Delivery)

**View:** `v_batch_output_vs_pakbon`

**Purpose:** Compare technical output (slaughter report yields) vs commercial output (delivery notes)

**Formula:**
- Technical weight (from `batch_yields`) vs Commercial weight (from `delivery_notes` linked to batch)
- Delta = Commercial - Technical

**Expected result:** Delta ≈ 0 (within ±2%)

**Import impact:**
- Slaughter report creates technical output
- Delivery note import creates commercial output
- View auto-updates as imports happen

**UI integration:** Batch detail page shows reconciliation status:
- ✅ "Reconciled: Technical {X} kg, Commercial {Y} kg, Delta {Z}%"
- ⚠️ "Not reconciled: No delivery notes linked to this batch"

---

## 14. TEST STRATEGY (Unit + Integration)

### 14.1 Unit Tests (Engine Functions)

**Target:** Import validation logic

**Test cases:**

**Mass balance validation:**
- ✅ Valid mass balance (±1% deviation) → PASS
- ❌ Invalid mass balance (>2% deviation) → FAIL
- ⚠️ Marginal mass balance (1-2% deviation) → WARNING

**File parsing:**
- ✅ Valid CSV with all columns → Parsed correctly
- ❌ CSV missing required column → Error
- ❌ CSV with invalid date format → Error per row
- ✅ Excel with multiple sheets → Only first sheet parsed

**Idempotency:**
- ✅ Upload same file twice → Second upload blocked (file hash match)
- ✅ Upload file with same lot number → Duplicate row flagged

**Mapping resolution:**
- ✅ Known PLU → Resolves to SKU
- ❌ Unknown PLU → Flagged for user mapping
- ✅ After user maps → Resolves correctly

---

### 14.2 Integration Tests (End-to-End)

**Test case 1: Slaughter report import (happy path)**
1. Upload valid slaughter report CSV
2. Validation passes with 0 errors, 0 warnings
3. Preview shows all rows
4. Confirm import
5. Verify:
   - `import_logs` record created with status='imported'
   - `production_batches` record created
   - `slaughter_reports` record created
   - 5 `batch_yields` records created
   - Mass balance view shows COMPLETE status

**Test case 2: Slaughter report with mass balance error**
1. Upload CSV with mass balance deviation >2%
2. Validation shows error on affected row
3. Preview excludes invalid row
4. Confirm import
5. Verify: Valid rows imported, invalid row logged in `import_logs.error_details`

**Test case 3: Delivery note with unknown PLU**
1. Upload delivery note CSV with unmapped PLU code
2. Validation shows warning: "Unknown PLU: {code}"
3. User clicks "Edit Mappings"
4. User maps PLU → SKU
5. Preview refreshes with resolved SKU
6. Confirm import
7. Verify:
   - `import_mapping_rules` record created
   - `delivery_notes` record created with resolved SKU

**Test case 4: Duplicate file upload**
1. Upload slaughter report CSV (file hash X)
2. Import succeeds
3. Upload same file again
4. System detects duplicate (file hash match)
5. User shown: "File already imported on {date}"
6. Import cancelled, no records created

**Test case 5: Exact invoice import**
1. Upload Exact export Excel
2. All item codes already mapped
3. Validation passes
4. Confirm import
5. Verify: `sales_transactions` records created with correct product_id

---

### 14.3 Performance Tests

**Load scenario:**
- Upload CSV with 500 rows (typical weekly batch)
- Expected time: <5 seconds parsing + validation
- Expected time: <10 seconds write to database

**Stress scenario:**
- Upload CSV with 5,000 rows (annual data dump)
- Expected time: <30 seconds parsing + validation
- Expected time: <60 seconds write to database

**Constraint:** If file >10 MB, reject before processing (file size check).

---

## 15. ROLLOUT PLAN

### Phase 9A.1: Foundation (Week 1-2)

**Deliverables:**
- `import_logs` table migration
- `import_mapping_rules` table migration
- Add `import_id` FK to `slaughter_reports`, `delivery_notes`, `sales_transactions`
- File upload API endpoint (multipart/form-data)
- CSV/Excel parser utility functions
- Validation engine (mass balance, field types, uniqueness)

**Testing:** Unit tests for validation engine

---

### Phase 9A.2: Slaughter Report Import (Week 3)

**Deliverables:**
- Slaughter report CSV parsing
- Mass balance validation integration
- Import preview UI component
- Import confirmation flow
- `import_logs` write logic

**Testing:** Integration test — slaughter report happy path

---

### Phase 9A.3: Delivery Note Import (Week 4)

**Deliverables:**
- Delivery note CSV parsing
- PLU → SKU mapping resolution
- Unknown PLU detection and flagging
- Mapping management UI (`/oil/import/mappings`)
- Import preview with mapping highlight

**Testing:** Integration test — delivery note with unknown PLU

---

### Phase 9A.4: Exact Invoice Import (Week 5)

**Deliverables:**
- Exact Excel export parsing
- Item code → SKU mapping resolution
- Invoice deduplication logic
- Sales transactions write

**Testing:** Integration test — Exact invoice import

---

### Phase 9A.5: UI Polish & Observability (Week 6)

**Deliverables:**
- Import dashboard (`/oil/import`)
- Error message localization (Dutch)
- Audit trail query UI
- Structured error logging integration
- User documentation (import guide)

**Testing:** E2E test suite, performance test

---

### Phase 9A.6: Production Deployment (Week 7)

**Pre-deployment checklist:**
- ✅ All migrations applied (import_logs, import_mapping_rules, FK additions)
- ✅ All tests passing (unit, integration, E2E)
- ✅ User acceptance testing with real Storteboom files
- ✅ Rollback plan documented (can drop import_logs, revert FKs)

**Deployment steps:**
1. Apply migrations to production database
2. Deploy Next.js application
3. Smoke test: Upload test CSV, verify import_logs created
4. Monitor error logs for 24 hours

**Rollback criteria:**
- >10% import failure rate
- Data corruption detected (mass balance violations)
- User-reported critical bugs

---

## 16. RISK ANALYSIS

### 16.1 Data Quality Risks

**Risk:** Imported data has silent errors (e.g., swapped columns)

**Mitigation:**
- Preview step shows parsed data before write
- Mass balance validation catches weight errors
- User confirmation required before write

**Residual risk:** LOW (mitigated by preview + validation)

---

**Risk:** Mapping layer introduces incorrect SKU assignments

**Mitigation:**
- Mapping confidence levels tracked (manual/verified/inferred)
- Mapping beheer UI allows review and correction
- Audit trail: import_id links back to mapping used

**Residual risk:** MEDIUM (requires user vigilance)

---

### 16.2 Technical Risks

**Risk:** Large files (>10 MB) cause timeout or memory issues

**Mitigation:**
- File size limit enforced (10 MB)
- Streaming parser for large CSVs (if needed)
- Pagination in preview (show first 100 rows)

**Residual risk:** LOW (file size limit enforced)

---

**Risk:** Concurrent imports by multiple users cause race conditions

**Mitigation:**
- Unique constraints prevent duplicate writes
- Idempotency via file hash and row-level uniqueness
- Import status transitions (pending → validated → imported) atomic

**Residual risk:** LOW (constraints + idempotency)

---

**Risk:** Database write failure during import (partial write)

**Mitigation:**
- Wrap import in database transaction (all-or-nothing)
- If transaction fails: rollback, status = 'error', error_details logged
- User shown error, can retry

**Residual risk:** LOW (transaction guarantees atomicity)

---

### 16.3 Business Risks

**Risk:** Users bypass import validation by direct database writes

**Mitigation:**
- Database permissions: Read-only for non-admin users
- Import is the ONLY write path for production data
- Audit trail (import_logs) required for all writes

**Residual risk:** LOW (permissions enforced)

---

**Risk:** Import workflow too slow, users revert to manual entry

**Mitigation:**
- Performance targets: <10 sec for 500 rows
- Batch upload option (upload multiple files at once)
- Parallel processing (if needed)

**Residual risk:** MEDIUM (depends on user adoption)

---

**Risk:** Storteboom changes file format, import breaks

**Mitigation:**
- Flexible column mapping (user can remap columns in UI)
- Version import spec document with known formats
- Monitor for parsing errors, alert on spike

**Residual risk:** MEDIUM (external dependency)

---

### 16.4 Compliance Risks

**Risk:** Imported data contains PII, GDPR violation

**Mitigation:**
- No PII in slaughter reports (only lot numbers, weights)
- Customer codes are business identifiers, not personal data
- Exact invoices contain customer codes (legitimate business interest)

**Residual risk:** LOW (no PII imported)

---

**Risk:** Audit trail insufficient for financial audit

**Mitigation:**
- `import_logs` provides source file, user, timestamp
- `import_id` FK links every record to its import
- Original files stored (optional, if compliance requires)

**Residual risk:** LOW (audit trail comprehensive)

---

## 17. SCHEMA CHANGES REQUIRED (Summary)

**Two new tables:**

1. **import_logs** — Audit trail for all imports
2. **import_mapping_rules** — PLU/item code → SKU mappings

**Modifications to existing tables:**

1. `slaughter_reports` — Add `import_id UUID REFERENCES import_logs`
2. `delivery_notes` — Add `import_id UUID REFERENCES import_logs`
3. `sales_transactions` — Add `import_id UUID REFERENCES import_logs`

**Migrations required:**
- `119_table_import_logs.sql`
- `120_table_import_mapping_rules.sql`
- `121_alter_slaughter_reports_add_import_id.sql`
- `122_alter_delivery_notes_add_import_id.sql`
- `123_alter_sales_transactions_add_import_id.sql`

**No changes to:**
- Canonical cost engine (src/lib/engine/)
- AGENT_RULES.md (append-only, SVASO, THT thresholds unchanged)
- Existing views (mass balance, SVASO, etc.)

---

## 18. DEFINITION OF DONE (Phase 9A)

- ✅ `import_logs` and `import_mapping_rules` tables created via migrations
- ✅ CSV/Excel upload works for slaughter reports (all required fields parsed)
- ✅ CSV/Excel upload works for delivery notes (PLU mapping functional)
- ✅ Excel export import works for Exact Online invoices
- ✅ File-level and row-level validation implemented
- ✅ Idempotency: duplicate file/row detection works
- ✅ Audit trail: All imports logged in `import_logs` with full context
- ✅ Mapping management UI functional (`/oil/import/mappings`)
- ✅ Preview + confirmation workflow implemented
- ✅ Unknown PLU/item codes flagged, not silently skipped
- ✅ Append-only principle enforced (no overwrites)
- ✅ Integration with canonical cost engine verified (batch readiness checks)
- ✅ Mass balance validation integrated (NEEDS_REVIEW signals work)
- ✅ Error messages localized (Dutch) and actionable
- ✅ Unit tests: Validation logic (≥80% coverage)
- ✅ Integration tests: Import workflows (slaughter, delivery, invoice)
- ✅ Performance test: 500 rows in <10 seconds
- ✅ npm test PASS (all existing + new tests)
- ✅ npm run build PASS
- ✅ npm run lint PASS
- ✅ Documentation updated:
  - DATA_CONTRACTS.md (import_logs and import_mapping_rules schemas added)
  - SYSTEM_STATE.md (Sprint 9 status updated)
  - User guide created (import workflow documentation)

---

## 19. OUT-OF-SCOPE FOR PHASE 9A (Future Work)

**Deferred to Phase 9B or later:**
- PDF parsing (Storteboom slaughter PDFs)
- Real-time Exact Online API integration
- Automated import scheduling (cron jobs)
- Batch cost reconciliation automation
- Multi-file batch upload
- Import rollback/undo functionality
- Advanced mapping inference (ML-based PLU suggestions)
- File storage (original files archived in blob storage)

**Rationale:** Phase 9A establishes the core import infrastructure. Advanced features added incrementally after user validation of core workflow.

---

## APPENDIX A: Database Schema Definitions

### import_logs

```sql
CREATE TABLE import_logs (
  import_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_type VARCHAR(50) NOT NULL CHECK (import_type IN ('slaughter_csv', 'delivery_csv', 'exact_excel', 'manual')),
  source_filename VARCHAR(255) NOT NULL,
  file_hash VARCHAR(64),
  file_size_bytes BIGINT,
  import_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  imported_by VARCHAR(100),
  record_count_total INTEGER NOT NULL DEFAULT 0,
  record_count_imported INTEGER NOT NULL DEFAULT 0,
  record_count_skipped INTEGER NOT NULL DEFAULT 0,
  record_count_errors INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'validated', 'imported', 'error', 'cancelled')),
  error_details JSONB,
  audit_trail JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_import_logs_status ON import_logs(status);
CREATE INDEX idx_import_logs_type ON import_logs(import_type);
CREATE INDEX idx_import_logs_date ON import_logs(import_date DESC);
CREATE INDEX idx_import_logs_hash ON import_logs(file_hash);

COMMENT ON TABLE import_logs IS 'Audit trail for all import operations (Sprint 9)';
COMMENT ON COLUMN import_logs.file_hash IS 'SHA256 hash for deduplication';
COMMENT ON COLUMN import_logs.audit_trail IS 'JSONB: {uploaded_at, validated_at, imported_at, user_agent, ip_address, user_email}';
COMMENT ON COLUMN import_logs.error_details IS 'JSONB array: [{row, error_code, error_message}]';
```

### import_mapping_rules

```sql
CREATE TABLE import_mapping_rules (
  rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('storteboom_plu', 'exact_itemcode')),
  source_code VARCHAR(100) NOT NULL,
  target_sku VARCHAR(100) NOT NULL,
  target_part_code VARCHAR(50),
  confidence VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (confidence IN ('manual', 'verified', 'inferred')),
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_type, source_code)
);

CREATE INDEX idx_mapping_source ON import_mapping_rules(source_type, source_code);
CREATE INDEX idx_mapping_target ON import_mapping_rules(target_sku);

COMMENT ON TABLE import_mapping_rules IS 'PLU/item code to SKU mapping rules (Sprint 9)';
COMMENT ON COLUMN import_mapping_rules.confidence IS 'manual=user-created, verified=user-confirmed auto, inferred=system guess';
```

---

## APPENDIX B: API Endpoints (Draft)

**POST /api/import/slaughter**
- Body: multipart/form-data with file
- Returns: `{import_id, validation_results, preview_data}`

**POST /api/import/delivery**
- Body: multipart/form-data with file
- Returns: `{import_id, validation_results, preview_data, unmapped_codes}`

**POST /api/import/exact**
- Body: multipart/form-data with file
- Returns: `{import_id, validation_results, preview_data}`

**POST /api/import/confirm**
- Body: `{import_id, user_confirmation: true}`
- Returns: `{status: 'imported', record_count, errors}`

**GET /api/import/logs**
- Query: `?limit=20&offset=0&status=imported`
- Returns: `{logs: [...], total_count}`

**GET /api/import/mappings**
- Query: `?source_type=storteboom_plu`
- Returns: `{mappings: [...], total_count}`

**POST /api/import/mappings**
- Body: `{source_type, source_code, target_sku, confidence, notes}`
- Returns: `{rule_id, created}`

---

**END OF SPRINT 9 IMPORT SPECIFICATION**

*This specification is authoritative for Phase 9A implementation. All code must conform to this design.*
