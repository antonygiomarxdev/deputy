import { lineChatId } from "../../shared/chat-id";
import type { DescribeNumber } from "../ports/describe-number";
import type { MessageRepository } from "../ports/message-repository";
import type { OwnerNumbersRepository } from "../ports/owner-numbers-repository";
import type { PhoneNumberParser } from "../ports/phone-number-parser";

export class DescribeNumberUseCase implements DescribeNumber {
  constructor(
    private readonly d: { parser: PhoneNumberParser; owners: OwnerNumbersRepository; messages: Pick<MessageRepository, "countCustomerMessages"> },
  ) {}

  async execute(q: { raw: string; defaultCountry: string | null }) {
    const parsed = this.d.parser.parse(q.raw, q.defaultCountry);
    if (!parsed.ok) return { invalid: parsed.invalid };
    return {
      e164: parsed.number.e164,
      isOwnerNumber: (await this.d.owners.load()).has(parsed.number),
      customerMessages: await this.d.messages.countCustomerMessages(lineChatId(parsed.number)),
    };
  }
}
