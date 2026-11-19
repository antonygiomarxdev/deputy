import { describe, expect, test } from "bun:test";
import { InMemoryIntakeStore } from "../../../src/intake/adapters/memory/in-memory-intake-store";
import { SendTextUseCase } from "../../../src/intake/application/send-text";
import { StoreMessages } from "../../../src/intake/application/store-messages";
import { OwnerNumbers } from "../../../src/intake/domain/owner-numbers";
import type { IntakeRepos, IntakeUnitOfWork } from "../../../src/intake/ports/intake-unit-of-work";
import { lineChatId, type ChatId } from "../../../src/shared/chat-id";
import { PhoneNumber } from "../../../src/shared/phone-number";
import { parseSendId, type SendId } from "../../../src/shared/send-id";
import { FakeClock } from "../../support/fake-clock";
import { FakeProvider } from "../../support/fake-provider";
import { InMemoryOwnerLease, type LeaseHolder } from "../../support/in-memory-owner-lease";
import { providerMessage } from "../../support/intake-fixtures";

const CUSTOMER = "5491123456789";
const BUSINESS = "5491100000001";
const NOW = 10_000;
const phone = (raw: string): PhoneNumber => {
  const n = PhoneNumber.fromInternational(raw);
  if (n === null) throw new Error(raw);
  return n;
};
const chat: ChatId = lineChatId(phone(CUSTOMER));
const sid = (s: string): SendId => {
  const id = parseSendId(s);
  if (id === null) throw new Error(s);
  return id;
};
// three parts: a text this long is split at MAX_PART
const LONG = "a".repeat(9_000);

/** A lease the owner check answers "yes" to only once it is armed, and only for the first ask after that. */
class LosesAfterOneCheck extends InMemoryOwnerLease {
  armed = false;
  private asks = 0;
  override async isOwner(): Promise<boolean> {
    if (!this.armed) return super.isOwner();
    this.asks++;
    return this.asks === 1 && (await super.isOwner());
  }
}

/** Owner, store and a customer message that gives the chat its destination. */
async function arrange(lease: InMemoryOwnerLease) {
  const clock = new FakeClock(NOW);
  const store = new InMemoryIntakeStore(lease);
  const service = new StoreMessages({ clock });
  const provider = new FakeProvider("kapso");
  provider.serverTime = 20_000;
  await store.repos.owners.save(OwnerNumbers.of([{ number: phone(BUSINESS), kind: "business", label: "", addedAt: 1 }]), []);
  await store.unitOfWork.run((r) =>
    service.store(r, {
      provider: "kapso",
      events: [{ kind: "message", message: providerMessage({ from: CUSTOMER, counterpart: CUSTOMER }) }],
    }),
  );
  return { clock, store, service, provider };
}

describe("send safety", () => {
  test("a part recorded with an error after the provider accepted it: no later part is sent", async () => {
    const holder: LeaseHolder = { token: "me", heartbeat: 1 };
    const lease = new InMemoryOwnerLease(holder, new FakeClock(NOW), "me");
    const { clock, store, service, provider } = await arrange(lease);
    // run 1 is the begin transaction, run 2 records part 1: that one fails, the ones after it succeed
    let runs = 0;
    const flaky: IntakeUnitOfWork = {
      run: <T>(work: (r: IntakeRepos) => Promise<T>): Promise<T> => {
        runs++;
        return runs === 2 ? Promise.reject(new Error("disk full")) : store.unitOfWork.run(work);
      },
    };
    const send = new SendTextUseCase({ lease, provider, unitOfWork: flaky, store: service, clock });

    const r = await send.execute({ sendId: sid("rec"), chat, text: LONG });

    expect(r.kind).toBe("unknown");
    expect(provider.sent).toHaveLength(1);
    expect((await store.repos.outgoing.find(sid("rec")))?.props.parts.map((p) => p.state)).toEqual(["unknown", "failed", "failed"]);
  });

  test("the lease is lost between the owner check and the begin transaction: refused not_owner, nothing sent or recorded", async () => {
    const lease = new LosesAfterOneCheck({ token: "me", heartbeat: 1 }, new FakeClock(NOW), "me");
    const { clock, store, service, provider } = await arrange(lease);
    const send = new SendTextUseCase({ lease, provider, unitOfWork: store.unitOfWork, store: service, clock });
    lease.armed = true;

    expect(await send.execute({ sendId: sid("late"), chat, text: "Hello" })).toEqual({ kind: "refused", reason: "not_owner" });
    expect(provider.sent).toEqual([]);
    expect(await store.repos.outgoing.find(sid("late"))).toBeNull();
  });
});
