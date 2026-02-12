CREATE OR REPLACE FUNCTION calc_tht_status(
  production_date DATE,
  expiry_date DATE,
  check_date DATE DEFAULT CURRENT_DATE
) RETURNS tht_status AS $$
DECLARE
  total_days INTEGER;
  elapsed_days INTEGER;
  pct_elapsed DECIMAL;
BEGIN
  IF expiry_date IS NULL OR production_date IS NULL THEN
    RETURN 'green';
  END IF;

  total_days := expiry_date - production_date;
  elapsed_days := check_date - production_date;

  IF total_days <= 0 THEN
    RETURN 'red';
  END IF;

  pct_elapsed := (elapsed_days::DECIMAL / total_days) * 100;

  -- Blueprint Spec: Green <70%, Orange 70-90%, Red >90%
  IF pct_elapsed >= 90 THEN
    RETURN 'red';
  ELSIF pct_elapsed >= 70 THEN
    RETURN 'orange';
  ELSE
    RETURN 'green';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
