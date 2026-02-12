CREATE INDEX idx_snapshots_stale ON computed_snapshots(is_stale) WHERE is_stale = true;
