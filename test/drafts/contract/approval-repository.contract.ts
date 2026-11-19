import { describe, expect, test } from "bun:test";
import type { Approval } from "../../../src/drafts/domain/approval";
import { StaleDraft } from "../../../src/drafts/domain/errors";
import type { UnitOfWork } from "../../../src/drafts/ports/store";
import type { ChatId } from "../../../src/shared/chat-id";
import type { OwnerLease } from "../../../src/shared/owner-lease";
import { normalizeText } from "../../../src/shared/text";
import { FakeClock } from "../../support/fake-clock";
import { InMemoryOwnerLease } from "../../support/in-memory-owner-lease";
import { newDraft } from "./draft-repository.contract";

export const approval = (over: Partial<Approval> = {}): Approval => ({
  id: "ap1",
  draftNumber: 1,
  textVersion: 1,
  text: "  Exact text á\n",
  textHash: "hash1",
  ownerWords: " go on 1 🍰",
  approvedAt: 2_000,
  usedAt: 2_000,
  sendId: "deputy:ap1",
  voidedAt: null,
  voidReason: null,
  ...over,
});

export function approvalRepositoryContract(name: string, make: (lease: OwnerLease) => UnitOfWork): void {
  const setup = async () => {
    const uow = make(new InMemoryOwnerLease({ token: "me", heartbeat: 1 }, new FakeClock(1), "me"));
    await uow.run(async (tx) => {
      await tx.drafts.save(newDraft(await tx.drafts.nextNumber(), "reply", "chat-a" as ChatId));
    });
    return uow;
  };

  describe(`ApprovalRepository: ${name}`, () => {
    test("FR-DRAFTS-02-3: an inserted approval reads back byte for byte", async () => {
      const uow = await setup();
      await uow.run((tx) => tx.approvals.insert(approval()));
      expect(await uow.run((tx) => tx.approvals.forDraft(1))).toEqual([approval()]);
      expect(await uow.run((tx) => tx.approvals.forDraft(2))).toEqual([]);
    });

    test("FR-DRAFTS-02-8: an approval is born used, and a second insert with the same sendId throws", async () => {
      const uow = await setup();
      await expect(uow.run((tx) => tx.approvals.insert(approval({ usedAt: null })))).rejects.toThrow();
      await uow.run((tx) => tx.approvals.insert(approval()));
      await expect(uow.run((tx) => tx.approvals.insert(approval({ id: "ap2" })))).rejects.toThrow();
      expect((await uow.run((tx) => tx.approvals.forDraft(1))).map((a) => a.id)).toEqual(["ap1"]);
    });

    test("FR-DRAFTS-02-12: of two transactions that approve the same revision, the second throws StaleDraft and leaves no approval row", async () => {
      const uow = await setup();
      const first = await uow.run((tx) => tx.drafts.get(1));
      const second = await uow.run((tx) => tx.drafts.get(1));
      if (!first || !second) throw new Error("missing");
      await uow.run(async (tx) => {
        await tx.drafts.save(first);
        await tx.approvals.insert(approval({ id: "ap1", sendId: "deputy:ap1" }));
      });
      await expect(
        uow.run(async (tx) => {
          await tx.approvals.insert(approval({ id: "ap2", sendId: "deputy:ap2" }));
          await tx.drafts.save(second);
        }),
      ).rejects.toBeInstanceOf(StaleDraft);
      expect((await uow.run((tx) => tx.approvals.forDraft(1))).map((a) => a.id)).toEqual(["ap1"]);
    });

    test("FR-DRAFTS-02-3: void marks every live approval of the draft and leaves the row", async () => {
      const uow = await setup();
      await uow.run(async (tx) => {
        await tx.approvals.insert(approval({ id: "ap1", sendId: "s1" }));
        await tx.approvals.insert(approval({ id: "ap2", sendId: "s2" }));
      });
      await uow.run((tx) => tx.approvals.void(1, "changed", 3_000));
      const rows = await uow.run((tx) => tx.approvals.forDraft(1));
      expect(rows.map((a) => [a.voidedAt, a.voidReason])).toEqual([[3_000, "changed"], [3_000, "changed"]]);
      await uow.run((tx) => tx.approvals.void(1, "rejected", 4_000));
      expect((await uow.run((tx) => tx.approvals.forDraft(1))).map((a) => a.voidReason)).toEqual(["changed", "changed"]);
    });

    test("FR-DRAFTS-02-6: hasDraftText is true for the proposed and the current normalized text of any draft, false otherwise", async () => {
      const uow = await setup();
      await uow.run(async (tx) => {
        const d = await tx.drafts.get(1);
        if (!d) throw new Error("missing");
        d.changeText({ text: "Changed Text!", orderPayload: null, ownerWords: "w", now: 5_000 });
        d.reject({ ownerWords: "no", now: 6_000 });
        await tx.drafts.save(d);
      });
      const has = (text: string) => uow.run((tx) => tx.drafts.hasDraftText(normalizeText(text)), { requireLease: false });
      expect(await has("hello")).toBe(true);
      expect(await has("Changed text")).toBe(true);
      expect(await has("something else")).toBe(false);
    });
  });
}
