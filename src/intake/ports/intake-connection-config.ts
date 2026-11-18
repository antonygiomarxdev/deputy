import type { Secret } from "../domain/secret";

export interface IntakeConnectionConfig {
  read(): Promise<{
    provider: string | null;
    receivingMode: string | null;
    kapso: { apiKey: Secret | null; phoneNumberId: string | null; webhookSecret: Secret | null };
  }>;
}
