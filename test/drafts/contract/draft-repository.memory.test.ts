import { InMemoryDrafts } from "../../../src/drafts/adapters/memory/in-memory-drafts";
import { draftRepositoryContract } from "./draft-repository.contract";

draftRepositoryContract("in memory", (lease) => new InMemoryDrafts(lease).unitOfWork);
