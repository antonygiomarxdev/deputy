import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createSqliteOwnerLease } from "../../../src/adapters/sqlite/sqlite-owner-lease";
import { DevDeliveries } from "../../../src/intake/adapters/dev/dev-deliveries";
import { DevProvider } from "../../../src/intake/adapters/dev/dev-provider";
import { RecordingEventPublisher } from "../../../src/intake/adapters/memory/recording-event-publisher";
import { SqliteIntakeUnitOfWork } from "../../../src/intake/adapters/sqlite/sqlite-intake-unit-of-work";
import { MarkInterruptedSendsUseCase } from "../../../src/intake/application/mark-interrupted-sends";
import { OutgoingSend } from "../../../src/intake/domain/outgoing-send";
import { OwnerNumbers } from "../../../src/intake/domain/owner-numbers";
import { createIntakeRuntime, type IntakeRuntime } from "../../../src/intake/index";
import { lineChatId } from "../../../src/shared/chat-id";
import { PhoneNumber } from "../../../src/shared/phone-number";
import { parseSendId, type SendId } from "../../../src/shared/send-id";
import { FakeClock } from "../../support/fake-clock";
import { openSqliteSubject, ownsLease } from "../../support/intake-subjects";

const CUSTOMER = "5491123456789";
const BUSINESS = "5491100000001";
const NOW = 1_000_000;
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

let s: Awaited<ReturnType<typeof openSqliteSubject>>;
let clock: FakeClock;
let provider: DevProvider;
let events: RecordingEventPublisher;
let intake: IntakeRuntime;

beforeEach(async () => {
  s = await openSqliteSubject();
  clock = new FakeClock(NOW);
  provider = new DevProvider({ db: s.db, clock });
  events = new RecordingEventPublisher();
  intake = createIntakeRuntime({
    repos: s.repos,
    unitOfWork: s.unitOfWork,
    events,
    clock,
    lease: ownsLease,
    provider,
    receiving: "catch_up",
    webhookSecret: null,
    settings: s.settings,
    devDeliveries: new DevDeliveries(provider),
  });
  const business = phone(BUSINESS);
  await s.repos.owners.save(OwnerNumbers.of([{ number: business, kind: "business", label: "", addedAt: 1 }]), []);
  // the customer wrote first: this gives the chat its destination
  await provider.hold({ chat: CUSTOMER, from: CUSTOMER, text: "Are you open?", sentAt: NOW - 5_000, providerMessageId: "dev-in-1" });
  await intake.catchUp.execute({ trigger: "asked" });
});
afterEach(() => s.cleanup());

const messages = async () => s.repos.messages.listChat(chat, {});

describe("send and echo, on SQLite with the dev provider", () => {
  test("FR-INTAKE-04-6 and 04-7: a send through the dev provider is found again by catch-up and stays one message sent_through_deputy", async () => {
    const sent = await intake.sendText.execute({ sendId: sid("s1"), chat, text: "Yes, until 6 pm." });
    expect(sent.kind).toBe("sent");
    const before = await messages();
    const mine = before.filter((m) => m.props.source === "sent_through_deputy");
    expect(mine).toHaveLength(1);

    clock.advance(1_000);
    const again = await intake.catchUp.execute({ trigger: "asked" });
    expect(again.kind).toBe("finished");
    const after = await messages();
    expect(after).toHaveLength(before.length);
    expect(after.filter((m) => m.props.source === "sent_through_deputy")).toHaveLength(1);
    expect(after.filter((m) => m.props.source === "owner_app")).toHaveLength(0);
    // no signal was emitted for Deputy's own words (the only announcement is the customer's first message)
    expect(events.published.filter((e) => e.name === "MessageStored")).toHaveLength(1);
  });

  test("FR-INTAKE-04-13: the owner's echo with the text of an unknown send is linked by FindOutgoing after a catch-up", async () => {
    const send = OutgoingSend.create({ sendId: sid("s9"), chat, text: "Yes, until 6 pm.", createdAt: NOW });
    send.markPendingUnknown();
    await s.unitOfWork.run(async (r) => {
      await r.outgoing.insert(send);
      await r.outgoing.savePart(send, 1, "dev");
      await r.outgoing.saveSend(send);
    });
    // the provider took the send, the process died, and the reply reached the provider as the owner's own message
    await provider.hold({ chat: CUSTOMER, from: BUSINESS, text: "Yes, until 6 pm.", owner: true, sentAt: NOW + 500, providerMessageId: "dev-out-echo" });
    await intake.catchUp.execute({ trigger: "asked" });
    const echo = () => s.repos.messages.find({ provider: "dev", providerMessageId: "dev-out-echo" });
    expect((await echo())?.props.source).toBe("owner_app");

    const found = await intake.findOutgoing.execute({ sendId: sid("s9"), chat, since: NOW, text: "Yes, until 6 pm." });
    expect(found).toEqual({ kind: "found", providerMessageIds: ["dev-out-echo"] });
    expect((await echo())?.props.source).toBe("sent_through_deputy");
    expect((await s.repos.outgoing.find(sid("s9")))?.props.state).toBe("sent");
    expect(await s.sourceChanges()).toHaveLength(1);
  });

  test("crash (ADR-011): a send left pending in the file is unknown once a new process takes the lease and runs MarkInterruptedSends", async () => {
    await s.unitOfWork.run((r) => r.outgoing.insert(OutgoingSend.create({ sendId: sid("s2"), chat, text: "Yes", createdAt: NOW })));
    expect((await s.repos.outgoing.find(sid("s2")))?.props.state).toBe("pending");

    // a new process: its own lease over the same file, its own unit of work
    const lease = createSqliteOwnerLease(s.db, clock, () => "new-process");
    expect(await lease.tryAcquire()).toBe(true);
    const restarted = new MarkInterruptedSendsUseCase({ lease, unitOfWork: new SqliteIntakeUnitOfWork(s.db, lease) });
    expect(await restarted.execute()).toEqual({ marked: 1 });

    const rec = await s.repos.outgoing.find(sid("s2"));
    expect(rec?.props.state).toBe("unknown");
    expect(rec?.props.parts.map((p) => p.state)).toEqual(["unknown"]);
    expect(await intake.sendText.execute({ sendId: sid("s2"), chat, text: "Yes" })).toEqual({ kind: "unknown", partsSent: 0, partsTotal: 1 });
  });
});
