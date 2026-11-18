export interface CheckProviderAccess {
  execute(): Promise<
    | { ok: true; businessNumber: string | null } // E.164
    | { ok: false; reason: "credentials" | "unreachable" | "quota" | "usage_limit" | "timeout" }
  >;
}
