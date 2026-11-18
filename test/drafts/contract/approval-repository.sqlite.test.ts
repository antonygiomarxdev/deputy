import { afterEach } from "bun:test";
import { approvalRepositoryContract } from "./approval-repository.contract";
import { closeSqliteUnitsOfWork, sqliteUnitOfWork } from "./sqlite-unit-of-work";

afterEach(closeSqliteUnitsOfWork);

approvalRepositoryContract("SQLite", sqliteUnitOfWork);
