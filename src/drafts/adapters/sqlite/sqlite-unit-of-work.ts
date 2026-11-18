import type { OwnerLease } from "../../../shared/owner-lease";
import type { SqlDatabase } from "../../../shared/sql-database";
import { LeaseLost } from "../../domain/errors";
import type { ReadTransaction, Transaction, UnitOfWork } from "../../ports/outbound";
import { SqliteApprovalRepository } from "./sqlite-approval-repository";
import { SqliteDraftLogRepository } from "./sqlite-draft-log-repository";
import { SqliteDraftRepository } from "./sqlite-draft-repository";

export class SqliteUnitOfWork implements UnitOfWork {
  constructor(
    private readonly db: SqlDatabase,
    private readonly lease: OwnerLease,
  ) {}

  read<T>(work: (tx: ReadTransaction) => Promise<T>): Promise<T> {
    return work({ drafts: new SqliteDraftRepository(this.db) });
  }

  run<T>(work: (tx: Transaction) => Promise<T>, options?: { requireLease?: boolean }): Promise<T> {
    return this.db.transaction(async (tx) => {
      if ((options?.requireLease ?? true) && !(await this.lease.isOwner(tx))) throw new LeaseLost();
      return work({
        drafts: new SqliteDraftRepository(tx),
        approvals: new SqliteApprovalRepository(tx),
        log: new SqliteDraftLogRepository(tx),
      });
    });
  }
}
