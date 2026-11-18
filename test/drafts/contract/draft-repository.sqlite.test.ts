import { afterEach } from "bun:test";
import { draftRepositoryContract } from "./draft-repository.contract";
import { closeSqliteUnitsOfWork, sqliteUnitOfWork } from "./sqlite-unit-of-work";

afterEach(closeSqliteUnitsOfWork);

draftRepositoryContract("SQLite", sqliteUnitOfWork);
