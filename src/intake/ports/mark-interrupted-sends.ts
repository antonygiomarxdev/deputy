export interface MarkInterruptedSends {
  execute(): Promise<{ marked: number }>;
}
