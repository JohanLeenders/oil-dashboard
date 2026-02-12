CREATE TRIGGER trg_signals_updated
  BEFORE UPDATE ON commercial_signals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
