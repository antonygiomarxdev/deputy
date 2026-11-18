export interface ApplyPendingChanges {
  execute(): Promise<{ applied: number } | { refused: "not_owner" }>;
}
