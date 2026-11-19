import { afterEach, describe, expect, test } from "bun:test";
import { DEV_SIGNATURE_HEADER, signDevBody } from "../../../src/intake/adapters/dev/dev-delivery";
import { DevProvider } from "../../../src/intake/adapters/dev/dev-provider";
import { openSqliteSubject } from "../../support/intake-subjects";
import { FakeClock } from "../../support/fake-clock";

const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const c of cleanups.splice(0)) c();
});

function signed(body: object) {
  const raw = new TextEncoder().encode(JSON.stringify(body));
  return { rawBody: raw, headers: new Map([[DEV_SIGNATURE_HEADER, signDevBody(raw)]]) };
}

describe("DevProvider keeps the delivered type", () => {
  test("FR-INTAKE-01-5: a non-text delivery keeps its type when held and when parsed, not forced to text", async () => {
    const subject = await openSqliteSubject();
    cleanups.push(() => subject.cleanup());
    const dev = new DevProvider({ db: subject.db, clock: new FakeClock(1_000) });
    const body = { chat: "50581112222", from: "50581112222", text: "", type: "image", providerMessageId: "img-1" };

    const parsed = dev.verifyAndParse(signed(body));
    expect(parsed.kind).toBe("ok");
    if (parsed.kind === "ok") expect(parsed.events[0]).toMatchObject({ kind: "message", message: { type: "image" } });

    await dev.hold(body);
    const page = await dev.listMessages({ scope: { conversationRef: "50581112222" }, cursor: null, limit: 10 });
    expect(page.items.map((m) => m.type)).toEqual(["image"]);
  });

  test("the direction of a parsed owner delivery is outbound, and an inbound one is inbound", async () => {
    const subject = await openSqliteSubject();
    cleanups.push(() => subject.cleanup());
    const dev = new DevProvider({ db: subject.db, clock: new FakeClock(1_000) });
    const owner = dev.verifyAndParse(signed({ chat: "50581112222", from: "50581112222", text: "sent by me", owner: true, providerMessageId: "o-1" }));
    const customer = dev.verifyAndParse(signed({ chat: "50581112222", from: "50581112222", text: "hello", providerMessageId: "i-1" }));
    expect(owner.kind === "ok" && owner.events[0]?.kind === "message" ? owner.events[0].message.direction : null).toBe("outbound");
    expect(customer.kind === "ok" && customer.events[0]?.kind === "message" ? customer.events[0].message.direction : null).toBe("inbound");
  });
});
