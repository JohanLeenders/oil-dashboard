CREATE OR REPLACE FUNCTION prevent_cost_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.amount != NEW.amount OR
     OLD.cost_type != NEW.cost_type OR
     OLD.batch_id != NEW.batch_id THEN
    RAISE EXCEPTION 'APPEND-ONLY: Cannot modify cost core fields. Create an adjustment record instead.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
