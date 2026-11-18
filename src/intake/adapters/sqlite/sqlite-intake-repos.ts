import type { SqlDatabase, SqlExecutor } from "../../../shared/sql-database";
import type { IntakeRepos } from "../../ports/intake-unit-of-work";
import { createSqliteChatStateRepository } from "./sqlite-chat-state-repository";
import { createSqliteMessageRepository } from "./sqlite-message-repository";
import { createSqliteOutgoingRepository } from "./sqlite-outgoing-repository";
import { createSqliteOwnerNumbersRepository } from "./sqlite-owner-numbers-repository";
import { createSqliteRejectionRepository } from "./sqlite-rejection-repository";
import { createSqliteSyncStateRepository } from "./sqlite-sync-state-repository";

export function createSqliteIntakeRepos(ex: SqlExecutor): IntakeRepos {
  // Inside a unit of work the owner repository joins the open transaction instead of starting one.
  const joined: SqlDatabase = { query: (s, p) => ex.query(s, p), run: (s, p) => ex.run(s, p), transaction: (work) => work(ex) };
  return {
    messages: createSqliteMessageRepository(ex),
    chats: createSqliteChatStateRepository(ex),
    rejections: createSqliteRejectionRepository(ex),
    syncState: createSqliteSyncStateRepository(ex),
    outgoing: createSqliteOutgoingRepository(ex),
    owners: createSqliteOwnerNumbersRepository(joined),
  };
}
