import type { IntakeRepos } from "../ports/intake-unit-of-work";
import type { ListRejections } from "../ports/list-rejections";

export class ListRejectionsUseCase implements ListRejections {
  constructor(private readonly repos: Pick<IntakeRepos, "rejections">) {}

  async execute() {
    const { notes, prunedCount, unrecovered } = await this.repos.rejections.list();
    return {
      notes: notes.map((n) => ({ at: n.at, reason: n.reason, recoverable: n.recoverable, resolved: n.resolvedAt !== null })),
      prunedCount,
      unrecovered,
    };
  }
}
