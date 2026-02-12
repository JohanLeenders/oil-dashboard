-- =============================================================================
-- Sprint 5: Customer Contract Deviation View
-- =============================================================================
-- Purpose: Compare actual customer intake vs contractual agreements.
-- Shows where customers deviate from agreed share ranges.
--
-- IMPORTANT: This view provides ANALYTICAL data for commercial conversations.
-- It does NOT judge customers or recommend actions.
--
-- Deviation flags are DESCRIPTIVE, not prescriptive:
-- - WITHIN_RANGE: Actual is within agreed range
-- - BELOW_RANGE: Actual is below agreed minimum
-- - ABOVE_RANGE: Actual is above agreed maximum
-- - NO_CONTRACT: No contract exists for this combination
-- =============================================================================

CREATE OR REPLACE VIEW v_customer_contract_deviation AS
WITH
-- Get actual intake from v_customer_intake_profile (Sprint 4)
actual_intake AS (
  SELECT
    cip.customer_id,
    cip.customer_name,
    cip.customer_code,
    cip.part_code,
    cip.quantity_kg,
    cip.share_of_total_pct AS actual_share,
    cip.customer_total_kg,
    cip.reference_period
  FROM v_customer_intake_profile cip
),

-- Get active contracts
active_contracts AS (
  SELECT
    cc.customer_id,
    cc.part_code,
    cc.agreed_share_min,
    cc.agreed_share_max,
    cc.price_tier,
    cc.notes AS contract_notes,
    cc.contract_start_date,
    cc.contract_end_date
  FROM customer_contracts cc
  WHERE cc.contract_end_date IS NULL
     OR cc.contract_end_date >= CURRENT_DATE
),

-- Join actual intake with contracts
intake_with_contracts AS (
  SELECT
    ai.customer_id,
    ai.customer_name,
    ai.customer_code,
    ai.part_code,
    ai.quantity_kg,
    ai.actual_share,
    ai.customer_total_kg,
    ai.reference_period,
    ac.agreed_share_min,
    ac.agreed_share_max,
    ac.price_tier,
    ac.contract_notes,
    ac.contract_start_date
  FROM actual_intake ai
  LEFT JOIN active_contracts ac
    ON ac.customer_id = ai.customer_id
    AND ac.part_code = ai.part_code::text
)

SELECT
  iwc.customer_id,
  iwc.customer_name,
  iwc.customer_code,
  iwc.part_code,

  -- Actual intake
  iwc.quantity_kg,
  iwc.actual_share,
  iwc.customer_total_kg,

  -- Contract range (NULL if no contract)
  iwc.agreed_share_min,
  iwc.agreed_share_max,
  CASE
    WHEN iwc.agreed_share_min IS NOT NULL
    THEN CONCAT(iwc.agreed_share_min::text, '% - ', iwc.agreed_share_max::text, '%')
    ELSE NULL
  END AS agreed_range,

  -- Deviation calculation
  CASE
    WHEN iwc.agreed_share_min IS NULL THEN NULL
    WHEN iwc.actual_share < iwc.agreed_share_min THEN iwc.actual_share - iwc.agreed_share_min
    WHEN iwc.actual_share > iwc.agreed_share_max THEN iwc.actual_share - iwc.agreed_share_max
    ELSE 0
  END AS deviation_pct,

  -- Deviation flag (DESCRIPTIVE, not prescriptive)
  CASE
    WHEN iwc.agreed_share_min IS NULL THEN 'NO_CONTRACT'
    WHEN iwc.actual_share < iwc.agreed_share_min THEN 'BELOW_RANGE'
    WHEN iwc.actual_share > iwc.agreed_share_max THEN 'ABOVE_RANGE'
    ELSE 'WITHIN_RANGE'
  END AS deviation_flag,

  -- Dutch explanation (for UI display)
  CASE
    WHEN iwc.agreed_share_min IS NULL THEN
      'Geen contract voor dit onderdeel.'
    WHEN iwc.actual_share < iwc.agreed_share_min THEN
      CONCAT('Afname (', ROUND(iwc.actual_share, 1)::text, '%) is lager dan afgesproken minimum (',
             iwc.agreed_share_min::text, '%).')
    WHEN iwc.actual_share > iwc.agreed_share_max THEN
      CONCAT('Afname (', ROUND(iwc.actual_share, 1)::text, '%) is hoger dan afgesproken maximum (',
             iwc.agreed_share_max::text, '%).')
    ELSE
      CONCAT('Afname (', ROUND(iwc.actual_share, 1)::text, '%) valt binnen afgesproken bandbreedte.')
  END AS explanation,

  -- Contract context
  iwc.price_tier,
  iwc.contract_notes,
  iwc.contract_start_date,

  -- Reference period
  iwc.reference_period,

  -- Data quality
  CASE
    WHEN iwc.agreed_share_min IS NOT NULL THEN 'CONTRACT_EXISTS'
    ELSE 'NO_CONTRACT'
  END AS contract_status

FROM intake_with_contracts iwc
ORDER BY iwc.customer_name, iwc.part_code;
