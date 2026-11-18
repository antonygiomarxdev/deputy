import { InMemoryDrafts } from "../../../src/drafts/adapters/memory/in-memory-drafts";
import { approvalRepositoryContract } from "./approval-repository.contract";

approvalRepositoryContract("in memory", (lease) => new InMemoryDrafts(lease).unitOfWork);
