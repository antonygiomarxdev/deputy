import { InMemoryDraftLog } from "../../../src/drafts/adapters/memory/in-memory-draft-log";
import { draftLogRepositoryContract } from "./draft-log-repository.contract";

draftLogRepositoryContract("in memory", () => new InMemoryDraftLog());
