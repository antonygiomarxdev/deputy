import type { GetOwnerNumbers, OwnerNumbersView } from "../ports/get-owner-numbers";
import type { OwnerNumbersRepository } from "../ports/owner-numbers-repository";

export class GetOwnerNumbersUseCase implements GetOwnerNumbers {
  constructor(private readonly owners: OwnerNumbersRepository) {}

  async execute(q: { withLog?: boolean }): Promise<OwnerNumbersView> {
    const numbers = (await this.owners.load()).entries().map((e) => ({
      number: e.number.e164,
      kind: e.kind,
      label: e.label,
      addedAt: e.addedAt,
    }));
    if (q.withLog !== true) return { numbers };
    const log = (await this.owners.log()).map((l) => ({ at: l.at, action: l.action, number: l.number, kind: l.kind, command: l.command }));
    return { numbers, log };
  }
}
