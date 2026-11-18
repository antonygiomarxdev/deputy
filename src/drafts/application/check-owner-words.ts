import { normalizeText } from "../../shared/text";
import { ownerWordsShape } from "../domain/owner-words";
import type { Refusal } from "../domain/refusals";
import type { CustomerTextCheck, UnitOfWork } from "../ports/outbound";

/**
 * OwnerWordsPolicy, steps in order, stopping at the first failure: the shape (empty or too long, then the draft
 * number as a whole token; number null for an order command), then a copy of a draft text, then a copy of a
 * customer message. Returns null when the words pass.
 */
export async function checkOwnerWords(
  deps: { unitOfWork: UnitOfWork; customerText: CustomerTextCheck },
  words: string,
  number: number | null,
): Promise<Refusal | null> {
  const shape = ownerWordsShape(words, number);
  if (!shape.ok) return shape.code === "words_empty" ? { code: "words_empty" } : { code: "words_missing_number", number: number ?? 0 };
  if (await deps.unitOfWork.read((tx) => tx.drafts.hasDraftText(normalizeText(words)))) return { code: "words_copied", copied: "draft" };
  // outside any transaction: Intake is another slice
  if (await deps.customerText.isCustomerText(words)) return { code: "words_copied", copied: "customer" };
  return null;
}
