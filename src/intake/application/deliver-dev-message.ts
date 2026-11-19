import type { Clock } from "../../shared/clock";
import { PhoneNumber } from "../../shared/phone-number";
import type { DeliverDevMessage, DevDeliverySource, DevMessageInput } from "../ports/deliver-dev-message";
import type { IntakeUnitOfWork } from "../ports/intake-unit-of-work";
import type { ReceiveLiveDelivery } from "../ports/receive-live-delivery";

export interface DeliverDevMessageDeps {
  /** The provider in use: dev entry points exist only under the dev provider. */
  provider: "kapso" | "dev";
  /** Null under Kapso, where there is nothing to hold at. */
  source: DevDeliverySource | null;
  receive: ReceiveLiveDelivery;
  unitOfWork: IntakeUnitOfWork;
  clock: Clock;
}

type Result = Awaited<ReturnType<DeliverDevMessage["execute"]>>;

export class DeliverDevMessageUseCase implements DeliverDevMessage {
  constructor(private readonly d: DeliverDevMessageDeps) {}

  async execute(q: DevMessageInput): Promise<Result> {
    if (this.d.provider !== "dev" || this.d.source === null) {
      await this.refuse();
      return { ok: false, reason: "not_dev" };
    }
    if (PhoneNumber.fromInternational(q.chat) === null) return { ok: false, reason: "invalid_chat" };
    if (PhoneNumber.fromInternational(q.from) === null) return { ok: false, reason: "invalid_from" };

    const { rawBody, headers } = await this.d.source.signedDelivery(q);
    const result = await this.d.receive.execute({ rawBody, headers });
    if (result.kind === "stored") return { ok: true, result: result.stored > 0 ? "stored" : "duplicate" };
    // a dev delivery is signed with the dev secret and verified by the dev provider: anything but stored is a storage-side failure
    return { ok: false, reason: "storage_failed" };
  }

  /** An entry point used outside dev is a refused request, kept as a note with no content. */
  async refuse(): Promise<void> {
    await this.d.unitOfWork.run((r) => r.rejections.add(this.d.clock.now(), "dev_entry_refused", false));
  }
}
