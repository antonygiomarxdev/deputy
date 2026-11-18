-- When a rate-limited send may be tried again (the time its first call finished plus the provider's wait).
ALTER TABLE outgoing ADD COLUMN retry_at INTEGER;
