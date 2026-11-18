import type { Instant } from "../../shared/instant";

export const toIso = (at: Instant): string => new Date(at).toISOString();
export const fromIso = (text: string): Instant => Date.parse(text);
