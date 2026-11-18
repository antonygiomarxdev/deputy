import type { PhoneNumber } from "../../shared/phone-number";
import type { ProviderName } from "../../shared/provider-name";
import type { Source } from "../../shared/source";
import type { OwnerNumbers } from "./owner-numbers";

// Text, sender name and origin are never inputs (FR-INTAKE-04-3, FR-INTAKE-04-12).
export function classifySource(i: {
  matchesSend: boolean;
  sender: PhoneNumber | null;
  owners: OwnerNumbers;
  provider: ProviderName;
  devOwnerMark: boolean;
}): Source {
  if (i.matchesSend) return "sent_through_deputy";
  if (i.owners.has(i.sender) || (i.provider === "dev" && i.devOwnerMark)) return "owner_app";
  return "customer";
}
