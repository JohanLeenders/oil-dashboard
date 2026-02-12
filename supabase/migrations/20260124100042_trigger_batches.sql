CREATE TRIGGER trg_batches_updated
  BEFORE UPDATE ON production_batches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
