import type { SqlDatabase } from "../shared/sql-database";
import type { Clock } from "../shared/clock";
import type { LeaseControl } from "../shared/owner-lease";
import { Sha256Digest } from "../drafts/adapters/crypto/sha256-digest";
import { UuidIds } from "../drafts/adapters/crypto/uuid-ids";
import { IntakeChatReader } from "../drafts/adapters/intake/intake-chat-reader";
import { IntakeCustomerTextCheck } from "../drafts/adapters/intake/intake-customer-text-check";
import { IntakeSender } from "../drafts/adapters/intake/intake-sender";
import { UnavailableOrderChanger } from "../drafts/adapters/orders/unavailable-order-changer";
import { UnavailableOrderPreparer } from "../drafts/adapters/orders/unavailable-order-preparer";
import { UnavailableOrderRecorder } from "../drafts/adapters/orders/unavailable-order-recorder";
import { SqliteUnitOfWork } from "../drafts/adapters/sqlite/sqlite-unit-of-work";
import { createApprovals, createDrafts } from "../drafts/index";
import type { IntakeRuntime } from "../intake/index";

/** Drafts and the approvals, sharing one unit of work. Both read the chats and send only through Intake. */
export function draftsWiring(d: { db: SqlDatabase; lease: LeaseControl; clock: Clock; intake: IntakeRuntime }) {
  const unitOfWork = new SqliteUnitOfWork(d.db, d.lease);
  const drafts = createDrafts({
    clock: d.clock,
    lease: d.lease,
    sessionStartedAt: d.clock.now(),
    unitOfWork,
    chats: new IntakeChatReader({ chatExists: d.intake.chatExists, readChat: d.intake.readChat }),
    orders: new UnavailableOrderPreparer(),
  });
  const approvals = createApprovals({
    clock: d.clock,
    lease: d.lease,
    unitOfWork,
    customerText: new IntakeCustomerTextCheck({ isCustomerText: d.intake.isCustomerText }),
    sender: new IntakeSender({ sendText: d.intake.sendText }),
    orderRecorder: new UnavailableOrderRecorder(),
    orderChanger: new UnavailableOrderChanger(),
    digest: new Sha256Digest(),
    ids: new UuidIds(),
  });
  return { drafts, approvals };
}
