CREATE TABLE drafts_log (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  at                TEXT NOT NULL,
  kind              TEXT NOT NULL CHECK (kind IN
    ('proposed','replaced','text_changed','approved','approval_voided','rejected','held',
     'owner_choice','sending','sent','failed','unknown','recorded','order_command','order_deleted')),
  draft_number      INTEGER REFERENCES drafts(number),
  draft_kind        TEXT CHECK (draft_kind IN ('reply','order')),
  chat              TEXT NOT NULL,
  proposed_text     TEXT,
  final_text        TEXT,
  reason            TEXT,
  owner_words       TEXT,
  approval_entry_id INTEGER REFERENCES drafts_log(id),
  send_id           TEXT,
  order_ref         TEXT,
  scrubbed          INTEGER NOT NULL DEFAULT 0,
  CHECK (draft_number IS NOT NULL OR order_ref IS NOT NULL),
  CHECK (draft_kind IS NOT 'order' OR (proposed_text IS NULL AND final_text IS NULL))
);
CREATE INDEX drafts_log_by_chat  ON drafts_log (chat, id);
CREATE INDEX drafts_log_by_draft ON drafts_log (draft_number, id);
CREATE INDEX drafts_log_by_order ON drafts_log (order_ref);

CREATE TRIGGER drafts_log_no_delete BEFORE DELETE ON drafts_log
BEGIN SELECT RAISE(ABORT, 'drafts_log is append-only'); END;

CREATE TRIGGER drafts_log_scrub_only BEFORE UPDATE ON drafts_log
WHEN NOT (
      OLD.scrubbed = 0 AND NEW.scrubbed = 1
  AND (NEW.owner_words IS OLD.owner_words OR NEW.owner_words = 'deleted')
  AND (OLD.draft_kind IS 'order' OR OLD.kind IN ('order_command','order_deleted'))
  AND NEW.id IS OLD.id AND NEW.at IS OLD.at AND NEW.kind IS OLD.kind
  AND NEW.draft_number IS OLD.draft_number AND NEW.draft_kind IS OLD.draft_kind
  AND NEW.chat IS OLD.chat AND NEW.proposed_text IS OLD.proposed_text
  AND NEW.final_text IS OLD.final_text AND NEW.reason IS OLD.reason
  AND NEW.approval_entry_id IS OLD.approval_entry_id AND NEW.send_id IS OLD.send_id
  AND NEW.order_ref IS OLD.order_ref
)
BEGIN SELECT RAISE(ABORT, 'drafts_log is append-only'); END;
