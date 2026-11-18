import type { OwnerLease } from "../../../shared/owner-lease";
import type { SqlDatabase } from "../../../shared/sql-database";
import { LeaseLostError, type IntakeRepos, type IntakeUnitOfWork } from "../../ports/intake-unit-of-work";
import { createSqliteIntakeRepos } from "./sqlite-intake-repos";

export class SqliteIntakeUnitOfWork implements IntakeUnitOfWork {
  constructor(
    private readonly db: SqlDatabase,
    private readonly lease: OwnerLease,
  ) {}

  run<T>(work: (r: IntakeRepos) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      if (!(await this.lease.isOwner(tx))) throw new LeaseLostError("the owner lease is not ours");
      return work(createSqliteIntakeRepos(tx));
    });
  }
}
