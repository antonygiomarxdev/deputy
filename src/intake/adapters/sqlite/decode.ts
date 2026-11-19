import { str } from "../../../adapters/sqlite/row";
import type { ProviderName } from "../../../shared/provider-name";
import type { SqlRow } from "../../../shared/sql-database";
import type { Source } from "../../../shared/source";
import type { Mark } from "../../domain/message";
import type { SendState } from "../../domain/outgoing-send";

export function providerOf(r: SqlRow): ProviderName {
  const p = str(r, "provider");
  if (p !== "kapso" && p !== "dev") throw new Error(`provider '${p}'`);
  return p;
}

export function sourceOf(r: SqlRow): Source {
  const s = str(r, "source");
  if (s !== "customer" && s !== "owner_app" && s !== "sent_through_deputy") throw new Error(`source '${s}'`);
  return s;
}

export function markOf(r: SqlRow): Mark {
  const m = str(r, "mark");
  if (m !== "normal" && m !== "group_chat" && m !== "sender_unknown" && m !== "not_attributable") {
    throw new Error(`mark '${m}'`);
  }
  return m;
}

export function stateOf(r: SqlRow): SendState {
  const s = str(r, "state");
  if (s !== "pending" && s !== "sent" && s !== "failed" && s !== "unknown") throw new Error(`send state '${s}'`);
  return s;
}
