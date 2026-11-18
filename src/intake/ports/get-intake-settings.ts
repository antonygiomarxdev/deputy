export interface GetIntakeSettings {
  execute(): Promise<{ catchUpMinutes: number; country: string | null }>;
}
