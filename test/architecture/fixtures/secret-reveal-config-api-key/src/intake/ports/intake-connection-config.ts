export interface IntakeConnectionConfig {
  read(): Promise<{ kapso: { apiKey: string | null; webhookSecret: Secret | null } }>;
}
interface Secret { reveal(): string }
