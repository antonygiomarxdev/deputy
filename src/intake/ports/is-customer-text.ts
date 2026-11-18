export interface IsCustomerText {
  execute(q: { text: string }): Promise<{ matches: boolean }>;
}
