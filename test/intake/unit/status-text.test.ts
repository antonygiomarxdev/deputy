import { describe, expect, test } from "bun:test";
import { formatInstant, reasonText } from "../../../src/intake/domain/status-text";
import type { SyncReason } from "../../../src/intake/domain/sync-state";

const REASONS: SyncReason[] = [
  "not_yet_run", "unreachable", "credentials", "quota", "usage_limit", "timeout", "bad_response", "possible_gap", "catching_up", "storage",
];
const gap = { storedAt: Date.UTC(2026, 10, 1), returnedAt: Date.UTC(2026, 10, 3) };
const newest = Date.UTC(2026, 10, 17, 12);

describe("reasonText", () => {
  test("FR-INTAKE-03-7: every reason has its sentence and the newest-time sentence", () => {
    for (const r of REASONS) {
      const text = reasonText(r, { newestStoredAt: newest, gap: r === "possible_gap" ? gap : null });
      expect(text.endsWith(` The newest message I have is from ${formatInstant(newest)}.`)).toBe(true);
    }
    expect(reasonText("unreachable", { newestStoredAt: null, gap: null })).toBe("Could not reach Kapso. I have no messages yet.");
  });

  test("possible_gap names both times and the WhatsApp Business app", () => {
    const text = reasonText("possible_gap", { newestStoredAt: newest, gap });
    expect(text).toContain(formatInstant(gap.storedAt));
    expect(text).toContain(formatInstant(gap.returnedAt));
    expect(text).toContain("WhatsApp Business app");
  });

  test("no text carries provider words, an http mention or a status code", () => {
    for (const r of REASONS) {
      const text = reasonText(r, { newestStoredAt: null, gap: r === "possible_gap" ? gap : null }).toLowerCase();
      expect(text).not.toContain("error");
      expect(text).not.toContain("http");
      expect(text).not.toMatch(/\b[1-5]\d\d\b/);
    }
  });
});
