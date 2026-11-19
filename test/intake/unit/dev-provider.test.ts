import { afterEach, describe, expect, test } from "bun:test";
import { DEV_SIGNATURE_HEADER, signDevBody } from "../../../src/intake/adapters/dev/dev-delivery";
import { DevProvider } from "../../../src/intake/adapters/dev/dev-provider";
import { openSqliteSubject } from "../../support/intake-subjects";
import { FakeClock } from "../../support/fake-clock";

const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const c of cleanups.splice(0)) c();
});

describe("DevProvider keeps the delivered type", () => {
  test("FR-INTAKE-01-5: a non-text delivery keeps its type when held and when parsed, not forced to text", async () => {
    const subject = await openSqliteSubject();
    cleanups.push(() => subject.cleanup());
    const dev = new DevProvider({ db: subject.db, clock: new FakeClock(1_000) });
    const body = { chat: "50581112222", from: "50581112222", text: "", type: "image", providerMessageId: "img-1" };

    const raw = new TextEncoder().encode(JSON.stringify(body));
    const parsed = dev.verifyAndParse({ rawBody: raw, headers: new Map([[DEV_SIGNATURE_HEADER, signDevBody(raw)]]) });
    expect(parsed.kind).toBe("ok");
    if (parsed.kind === "ok") expect(parsed.events[0]).toMatchObject({ kind: "message", message: { type: "image" } });

    await dev.hold(body);
    const page = await dev.listMessages({ scope: { conversationRef: "50581112222" }, cursor: null, limit: 10 });
    expect(page.items.map((m) => m.type)).toEqual(["image"]);
  });
});
