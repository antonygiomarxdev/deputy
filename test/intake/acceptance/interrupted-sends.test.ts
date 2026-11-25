// covers: intake/FRD-04/EX-15
// covers: intake/FRD-04/EX-16
// covers: intake/FRD-04/EX-17
// covers: intake/FRD-04/EX-18
import { beforeEach, describe, expect, test } from "bun:test";
import { InMemoryIntakeStore } from "../../../src/intake/adapters/memory/in-memory-intake-store";
import { FindOutgoingUseCase } from "../../../src/intake/application/find-outgoing";
import { MarkInterruptedSendsUseCase } from "../../../src/intake/application/mark-interrupted-sends";
import { SendTextUseCase } from "../../../src/intake/application/send-text";
import { StoreMessages } from "../../../src/intake/application/store-messages";
import { MAX_PART } from "../../../src/intake/domain/constants";
import { OutgoingSend } from "../../../src/intake/domain/outgoing-send";
import { OwnerNumbers } from "../../../src/intake/domain/owner-numbers";
import { lineChatId } from "../../../src/shared/chat-id";
import { PhoneNumber } from "../../../src/shared/phone-number";
import { parseSendId, type SendId } from "../../../src/shared/send-id";
import { FakeClock } from "../../support/fake-clock";
import { FakeProvider } from "../../support/fake-provider";
import { InMemoryOwnerLease, type LeaseHolder } from "../../support/in-memory-owner-lease";
import { providerMessage } from "../../support/intake-fixtures";

const CUSTOMER = "5491123456789";
const BUSINESS = "5491100000001";
const NOW = 100_000;
const phone = (raw: string): PhoneNumber => {
  const n = PhoneNumber.fromInternational(raw);
  if (n === null) throw new Error(raw);
  return n;
};
const chat = lineChatId(phone(CUSTOMER));
const sid = (s: string): SendId => {
  const id = parseSendId(s);
  if (id === null) throw new Error(s);
  return id;
};

let holder: LeaseHolder;
let clock: FakeClock;
let store: InMemoryIntakeStore;
let service: StoreMessages;
let lease: InMemoryOwnerLease;
let mark: MarkInterruptedSendsUseCase;
let send: SendTextUseCase;

beforeEach(async () => {
  holder = { token: "me", heartbeat: 1 };
  clock = new FakeClock(NOW);
  lease = new InMemoryOwnerLease(holder, clock, "me");
  store = new InMemoryIntakeStore(lease);
  service = new StoreMessages({ clock });
  mark = new MarkInterruptedSendsUseCase({ lease, unitOfWork: store.unitOfWork });
  send = new SendTextUseCase({ lease, provider: new FakeProvider("kapso"), unitOfWork: store.unitOfWork, store: service, clock });
  await store.repos.owners.save(OwnerNumbers.of([{ number: phone(BUSINESS), kind: "business", label: "", addedAt: 1 }]), []);
  await store.unitOfWork.run((r) =>
    service.store(r, { provider: "kapso", events: [{ kind: "message", message: providerMessage({ from: CUSTOMER, counterpart: CUSTOMER }) }] }),
  );
});

/** A send as a restart finds it: inserted, and nothing else recorded. */
const leftPending = async (id: string, text = "Hello") => {
  await store.unitOfWork.run((r) => r.outgoing.insert(OutgoingSend.create({ sendId: sid(id), chat, text, createdAt: NOW - 5_000 })));
};

describe("MarkInterruptedSends", () => {
  test("FR-INTAKE-04-6: a pending send and its pending parts become unknown, and a repeated SendText answers unknown", async () => {
    await leftPending("s1", "a".repeat(MAX_PART + 5));
    expect(await mark.execute()).toEqual({ marked: 1 });
    const rec = await store.repos.outgoing.find(sid("s1"));
    expect(rec?.props.state).toBe("unknown");
    expect(rec?.props.parts.map((p) => p.state)).toEqual(["unknown", "unknown"]);
    expect(await send.execute({ sendId: sid("s1"), chat, text: "a".repeat(MAX_PART + 5) })).toEqual({ kind: "unknown", partsSent: 0, partsTotal: 2 });
  });

  test("a send that is already settled is left alone and not counted", async () => {
    await leftPending("pending");
    const done = OutgoingSend.create({ sendId: sid("done"), chat, text: "Hello", createdAt: NOW });
    done.failNothingAccepted("quota", NOW);
    await store.unitOfWork.run(async (r) => {
      await r.outgoing.insert(done);
      await r.outgoing.saveSend(done);
    });
    expect(await mark.execute()).toEqual({ marked: 1 });
    expect((await store.repos.outgoing.find(sid("done")))?.props.state).toBe("failed");
    expect(await mark.execute()).toEqual({ marked: 0 });
  });

  test("FR-INTAKE-04-7: after a crash between the provider accepting a part and storing its id, the part is unknown, a catch-up stores the echo as owner_app, and FindOutgoing links it", async () => {
    await leftPending("s1"); // the provider accepted "Hello", the process died before the id was stored
    await mark.execute();
    expect((await store.repos.outgoing.find(sid("s1")))?.props.parts[0]?.state).toBe("unknown");

    const echo = providerMessage({ providerMessageId: "wamid.GONE", direction: "outbound", from: BUSINESS, counterpart: CUSTOMER, text: "Hello", sentAt: NOW - 4_000 });
    await store.unitOfWork.run((r) => service.store(r, { provider: "kapso", events: [{ kind: "message", message: echo }] }));
    expect((await store.repos.messages.find({ provider: "kapso", providerMessageId: "wamid.GONE" }))?.props.source).toBe("owner_app");

    const find = new FindOutgoingUseCase({ lease, unitOfWork: store.unitOfWork, clock });
    expect(await find.execute({ sendId: sid("s1"), chat, since: NOW - 5_000, text: "Hello" })).toEqual({ kind: "found", providerMessageIds: ["wamid.GONE"] });
    expect((await store.repos.messages.find({ provider: "kapso", providerMessageId: "wamid.GONE" }))?.props.source).toBe("sent_through_deputy");
    expect((await store.repos.outgoing.find(sid("s1")))?.props.state).toBe("sent");
  });

  test("a send left unknown with no part sent is still unknown", async () => {
    await leftPending("s1");
    await mark.execute();
    expect(await send.execute({ sendId: sid("s1"), chat, text: "Hello" })).toEqual({ kind: "unknown", partsSent: 0, partsTotal: 1 });
  });

  test("without the lease nothing is marked", async () => {
    await leftPending("s1");
    holder.token = "someone else";
    expect(await mark.execute()).toEqual({ marked: 0 });
    let opened = 0;
    const counting = new MarkInterruptedSendsUseCase({ lease, unitOfWork: { run: (work) => (opened++, store.unitOfWork.run(work)) } });
    expect(await counting.execute()).toEqual({ marked: 0 });
    expect(opened).toBe(0); // no write transaction is even opened
    holder.token = "me";
    expect((await store.repos.outgoing.find(sid("s1")))?.props.state).toBe("pending");
  });

  test("a lease lost between the check and the write marks nothing", async () => {
    await leftPending("s1");
    let losing = true;
    const racing = new MarkInterruptedSendsUseCase({
      lease: { isOwner: async () => true },
      unitOfWork: {
        run: async (work) => {
          if (losing) {
            holder.token = "someone else";
            losing = false;
          }
          return store.unitOfWork.run(work);
        },
      },
    });
    expect(await racing.execute()).toEqual({ marked: 0 });
    holder.token = "me";
    expect((await store.repos.outgoing.find(sid("s1")))?.props.state).toBe("pending");
  });
});
