CREATE OR REPLACE FUNCTION prevent_yield_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.actual_weight_kg != NEW.actual_weight_kg OR
     OLD.anatomical_part != NEW.anatomical_part OR
     OLD.batch_id != NEW.batch_id THEN
    RAISE EXCEPTION 'APPEND-ONLY: Cannot modify yield core fields. Create a correction record instead.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
