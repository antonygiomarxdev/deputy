import { parseChatId } from "../../shared/chat-id";
import type { Clock } from "../../shared/clock";
import type { OwnerLease } from "../../shared/owner-lease";
import { blankLogEntry, type NewLogEntry } from "../domain/log-entry";
import type { ApproveOrderCommand, Outcome } from "../ports/inbound";
import { ORDER_FIELDS } from "../domain/order-fields";
import type { CustomerTextCheck } from "../ports/chat";
import type { OrderChanger } from "../ports/orders";
import type { UnitOfWork } from "../ports/store";
import { checkOwnerWords } from "./check-owner-words";
import { refuse, refusalOfError } from "./refusal-of-error";

type Input = Parameters<ApproveOrderCommand["run"]>[0];
type Value = Extract<Awaited<ReturnType<ApproveOrderCommand["run"]>>, { ok: true }>["value"];

const refused = (reason: string) => refuse({ code: "order_command_refused", reason });

export class ApproveOrderCommandUseCase implements ApproveOrderCommand {
  constructor(
    private readonly deps: { clock: Clock; lease: OwnerLease; unitOfWork: UnitOfWork; customerText: CustomerTextCheck; changer: OrderChanger },
  ) {}

  async run(input: Input): Promise<Outcome<Value>> {
    const { clock, lease, unitOfWork, changer } = this.deps;
    if (!(await lease.isOwner())) return refuse({ code: "not_owner" });
    const words = await checkOwnerWords(this.deps, input.ownerWords, null);
    if (words) return refuse(words);

    // a delete that is not confirmed asks Orders what it would do and logs nothing
    if (input.command === "delete" && !input.confirm) {
      const answer = await changer.delete(input.orderRef, input.ownerWords, false);
      if ("pending" in answer) return { ok: true, value: { approved: false, pendingDelete: answer.pending } };
      return answer.ok ? refused("delete needs confirmation") : refused(answer.reason);
    }

    // only field names reach the log, so a value (a customer name, an address) never can
    const keys = input.command === "change" ? Object.keys(input.change) : [];
    if (keys.some((k) => !(ORDER_FIELDS as readonly string[]).includes(k))) return refused("unknown field");
    const chat = parseChatId((await changer.chatOf(input.orderRef)) ?? "");
    if (chat === null) return refused("unknown order");

    const entry = blankLogEntry({
      at: clock.now(), kind: "order_command", chat,
      reason: input.command === "change" ? `changed: ${keys.join(", ")}` : "delete",
      ownerWords: input.ownerWords, orderRef: input.orderRef,
    });
    let logEntryId: number | undefined;
    try {
      // the entry is written first: a log that cannot be written stops the change
      [logEntryId] = await unitOfWork.run((tx) => tx.log.append([entry]));
    } catch (e) {
      return refusalOfError(e);
    }
    if (logEntryId === undefined) return refuse({ code: "log_unavailable" });
    // the lease may have been lost since the first check: another process owns the data now, and no Orders method is called
    if (!(await lease.isOwner())) return refuse({ code: "not_owner" });

    const answer =
      input.command === "change"
        ? await changer.change(input.orderRef, input.change, input.ownerWords)
        : await changer.delete(input.orderRef, input.ownerWords, true);
    if ("pending" in answer) return { ok: true, value: { approved: false, pendingDelete: answer.pending } };
    if (!answer.ok) await this.logFailure(input.orderRef, chat, entry.at);
    return { ok: true, value: { approved: true, logEntryId, result: answer } };
  }

  /** Orders refused after the command was logged: a `failed` entry follows. Its loss never hides Orders' answer. */
  private async logFailure(orderRef: string, chat: NewLogEntry["chat"], at: number): Promise<void> {
    const failed = blankLogEntry({ at, kind: "failed", chat, reason: "order_command_failed", orderRef });
    try {
      await this.deps.unitOfWork.run((tx) => tx.log.append([failed]));
    } catch (e) {
      console.error(`deputy: the failed order command could not be logged (${e instanceof Error ? e.name : "unknown error"})`);
    }
  }
}
