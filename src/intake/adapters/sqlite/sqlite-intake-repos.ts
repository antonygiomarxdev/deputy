import type { SqlDatabase, SqlExecutor } from "../../../shared/sql-database";
import type { IntakeRepos } from "../../ports/intake-unit-of-work";
import { SqliteChatStateRepository } from "./sqlite-chat-state-repository";
import { SqliteMessageRepository } from "./sqlite-message-repository";
import { SqliteOutgoingRepository } from "./sqlite-outgoing-repository";
import { SqlitePendingChangesReader } from "./sqlite-pending-changes-reader";
import { SqliteOwnerNumbersRepository } from "./sqlite-owner-numbers-repository";
import { SqliteRejectionRepository } from "./sqlite-rejection-repository";
import { SqliteSyncStateRepository } from "./sqlite-sync-state-repository";

export function createSqliteIntakeRepos(ex: SqlExecutor): IntakeRepos {
  // Inside a unit of work the owner repository joins the open transaction instead of starting one.
  const joined: SqlDatabase = { query: (s, p) => ex.query(s, p), run: (s, p) => ex.run(s, p), transaction: (work) => work(ex) };
  return {
    messages: new SqliteMessageRepository(ex),
    chats: new SqliteChatStateRepository(ex),
    rejections: new SqliteRejectionRepository(ex),
    syncState: new SqliteSyncStateRepository(ex),
    outgoing: new SqliteOutgoingRepository(ex),
    owners: new SqliteOwnerNumbersRepository(joined),
    pending: new SqlitePendingChangesReader(ex),
  };
}
