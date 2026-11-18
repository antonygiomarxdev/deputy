import { num, str } from "../../../adapters/sqlite/row";
import type { ProviderName } from "../../../shared/provider-name";
import { parseSendId, type SendId } from "../../../shared/send-id";
import type { SqlExecutor } from "../../../shared/sql-database";
import type { OutgoingRepository } from "../../ports/outgoing-repository";

export class SqliteOutgoingRepository implements OutgoingRepository {
  constructor(private readonly ex: SqlExecutor) {}

  async findByProviderId(
    provider: ProviderName,
    providerMessageId: string,
  ): Promise<{ sendId: SendId; part: number } | null> {
    const [r] = await this.ex.query(
      "SELECT send_id, part FROM outgoing_parts WHERE provider = ? AND provider_message_id = ?",
      [provider, providerMessageId],
    );
    if (r === undefined) return null;
    const sendId = parseSendId(str(r, "send_id"));
    if (sendId === null) throw new Error("stored send id is invalid");
    return { sendId, part: num(r, "part") };
  }
}
