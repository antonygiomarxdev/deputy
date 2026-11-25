import { afterEach, describe, expect, test } from "bun:test";
import { DevDeliveries } from "../../../src/intake/adapters/dev/dev-deliveries";
import { DevProvider } from "../../../src/intake/adapters/dev/dev-provider";
import { RecordingEventPublisher } from "../../../src/intake/adapters/memory/recording-event-publisher";
import { createIntakeRuntime } from "../../../src/intake/index";
import type { Provider } from "../../../src/intake/ports/provider";
import { parseChatId } from "../../../src/shared/chat-id";
import { FakeClock } from "../../support/fake-clock";
import { FakeProvider } from "../../support/fake-provider";
import { providerMessage } from "../../support/intake-fixtures";
import { openSqliteSubject } from "../../support/intake-subjects";

const CHAT = (() => {
  const c = parseChatId("+12125550111");
  if (!c) throw new Error("chat");
  return c;
})();
const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const c of cleanups.splice(0)) c();
});

async function world() {
  const subject = await openSqliteSubject();
  cleanups.push(() => subject.cleanup());
  const clock = new FakeClock(5_000_000);
  const dev = new DevProvider({ db: subject.db, clock });
  const events = new RecordingEventPublisher();
  const runtime = (provider: Provider, devDeliveries: DevDeliveries | null, receiving: "live" | "catch_up" = "live") =>
    createIntakeRuntime({
      repos: subject.repos,
      unitOfWork: subject.unitOfWork,
      events,
      clock,
      lease: { isOwner: async () => true },
      provider,
      receiving,
      webhookSecret: null,
      settings: subject.settings,
      devDeliveries,
    });
  return { subject, clock, dev, events, runtime, devRuntime: () => runtime(dev, new DevDeliveries(dev)) };
}

describe("DeliverDevMessage", () => {
  test("FR-INTAKE-01-3: a delivery is stored with every field and ReadChat returns it", async () => {
    const w = await world();
    const rt = w.devRuntime();
    expect(await rt.deliverDevMessage.execute({ chat: "12125550111", from: "12125550111", text: "How much is the cake?" })).toEqual({
      ok: true,
      result: "stored",
    });
    const view = await rt.readChat.execute({ chat: CHAT });
    expect(view?.messages).toHaveLength(1);
    expect(view?.messages[0]).toMatchObject({
      chat: CHAT,
      sender: "+12125550111",
      type: "text",
      readable: true,
      text: "How much is the cake?",
      readerText: "How much is the cake?",
      source: "customer",
      history: false,
      dev: true,
      deletedBySender: false,
      mark: "normal",
    });
    expect(view?.messages[0]?.id.provider).toBe("dev");
    expect(view?.messages[0]?.id.providerMessageId).toMatch(/^dev-in-/);
  });

  test("a message delivered twice with the same id is a duplicate and one row", async () => {
    const w = await world();
    const rt = w.devRuntime();
    const body = { chat: "12125550111", from: "12125550111", text: "once", providerMessageId: "dev-fixed" };
    expect(await rt.deliverDevMessage.execute(body)).toEqual({ ok: true, result: "stored" });
    expect(await rt.deliverDevMessage.execute(body)).toEqual({ ok: true, result: "duplicate" });
    expect((await rt.readChat.execute({ chat: CHAT }))?.messages).toHaveLength(1);
  });

  test("a chat or sender that is not a number is refused and nothing is held or stored", async () => {
    const w = await world();
    const rt = w.devRuntime();
    expect(await rt.deliverDevMessage.execute({ chat: "not-a-number", from: "12125550111", text: "x" })).toEqual({ ok: false, reason: "invalid_chat" });
    expect(await rt.deliverDevMessage.execute({ chat: "12125550111", from: "abc", text: "x" })).toEqual({ ok: false, reason: "invalid_from" });
    expect(await rt.readChat.execute({ chat: CHAT })).toBeNull();
    const held = await w.subject.db.query("SELECT COUNT(*) AS n FROM dev_holdings");
    expect(held[0]?.["n"]).toBe(0);
  });

  test("a storage failure is reported as storage_failed", async () => {
    const w = await world();
    const failing = createIntakeRuntime({
      repos: w.subject.repos,
      unitOfWork: { run: () => Promise.reject(new Error("disk full")) },
      events: w.events,
      clock: w.clock,
      lease: { isOwner: async () => true },
      provider: w.dev,
      receiving: "live",
      webhookSecret: null,
      settings: w.subject.settings,
      devDeliveries: new DevDeliveries(w.dev),
    });
    expect(await failing.deliverDevMessage.execute({ chat: "12125550111", from: "12125550111", text: "x" })).toEqual({
      ok: false,
      reason: "storage_failed",
    });
  });

  test("an owner reply and a history message keep their marks", async () => {
    const w = await world();
    const rt = w.devRuntime();
    await rt.deliverDevMessage.execute({ chat: "12125550111", from: "12125550111", text: "mine", owner: true, providerMessageId: "o-1" });
    await rt.deliverDevMessage.execute({ chat: "12125550111", from: "12125550111", text: "old", history: true, sentAt: 10, providerMessageId: "h-1" });
    const byId = new Map((await rt.readChat.execute({ chat: CHAT }))?.messages.map((m) => [m.id.providerMessageId, m]));
    expect(byId.get("o-1")?.source).toBe("owner_app");
    expect(byId.get("h-1")).toMatchObject({ history: true, source: "customer" });
  });

  test("FR-INTAKE-01-9: under Kapso it is refused, nothing is stored and a dev_entry_refused note is kept", async () => {
    const w = await world();
    const rt = w.runtime(new FakeProvider("kapso"), null);
    expect(await rt.deliverDevMessage.execute({ chat: "12125550111", from: "12125550111", text: "hi" })).toEqual({ ok: false, reason: "not_dev" });
    expect(await rt.readChat.execute({ chat: CHAT })).toBeNull();
    const { notes } = await w.subject.repos.rejections.list();
    expect(notes.map((n) => n.reason)).toEqual(["dev_entry_refused"]);
    // even with a dev source at hand, the provider decides
    const guarded = w.runtime(new FakeProvider("kapso"), new DevDeliveries(w.dev));
    expect(await guarded.deliverDevMessage.execute({ chat: "12125550111", from: "12125550111", text: "hi" })).toMatchObject({ reason: "not_dev" });
    expect(await w.subject.db.query("SELECT COUNT(*) AS n FROM dev_holdings")).toEqual([{ n: 0 }]);
  });

  test("FR-INTAKE-01-4: a dev message and a Kapso message show the same fields and the same source meaning", async () => {
    const w = await world();
    await w.devRuntime().deliverDevMessage.execute({ chat: "12125550111", from: "12125550111", text: "same words", providerMessageId: "dev-a" });
    const fake = new FakeProvider("kapso");
    fake.deliver(providerMessage({ providerMessageId: "wamid.K1", from: "12125550111", counterpart: "12125550111", text: "same words", sentAt: 2_000 }));
    const kapso = w.runtime(fake, null);
    expect((await kapso.receiveLiveDelivery.execute({ rawBody: new Uint8Array(), headers: new Map() })).kind).toBe("stored");
    const messages = (await kapso.readChat.execute({ chat: CHAT }))?.messages ?? [];
    const devOne = messages.find((m) => m.id.provider === "dev");
    const kapsoOne = messages.find((m) => m.id.provider === "kapso");
    expect(devOne).toBeDefined();
    expect(kapsoOne).toBeDefined();
    expect(Object.keys(devOne ?? {}).sort()).toEqual(Object.keys(kapsoOne ?? {}).sort());
    expect([devOne?.source, devOne?.mark, devOne?.readerText]).toEqual([kapsoOne?.source, kapsoOne?.mark, kapsoOne?.readerText]);
    expect([devOne?.dev, kapsoOne?.dev]).toEqual([true, false]);
  });

  test("FR-INTAKE-01-7 and 01-10: after a switch to Kapso the dev messages are kept, marked dev, hidden from the chat list, and announce nothing", async () => {
    const w = await world();
    await w.devRuntime().deliverDevMessage.execute({ chat: "12125550111", from: "12125550111", text: "unanswered" });
    const before = (await w.subject.db.query("SELECT COUNT(*) AS n FROM messages"))[0]?.["n"];
    w.events.published.length = 0;

    const kapso = w.runtime(new FakeProvider("kapso"), null);
    const view = await kapso.readChat.execute({ chat: CHAT });
    expect(view?.messages.map((m) => m.dev)).toEqual([true]);
    expect(await kapso.listChats.execute({})).toEqual([]);
    expect((await w.subject.db.query("SELECT COUNT(*) AS n FROM messages"))[0]?.["n"]).toBe(before);
    expect(w.events.published).toEqual([]);
  });
});
