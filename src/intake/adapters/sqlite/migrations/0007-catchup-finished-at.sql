-- local clock: set when a run's end is saved, cleared when the next run begins. A crashed run leaves it null, so rule A does not trust its marks.
ALTER TABLE catchup_status ADD COLUMN finished_at INTEGER;
