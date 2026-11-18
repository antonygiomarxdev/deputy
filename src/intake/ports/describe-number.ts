/** A pure read: no lease. Setup shows a typed number back with it. */
export interface DescribeNumber {
  execute(q: { raw: string; defaultCountry: string | null }): Promise<
    | { e164: string; isOwnerNumber: boolean; customerMessages: number }
    | { invalid: "unparseable" | "needs_country_code" }
  >;
}
