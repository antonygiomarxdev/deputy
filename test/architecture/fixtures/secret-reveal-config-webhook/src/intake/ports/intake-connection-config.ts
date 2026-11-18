export interface IntakeConnectionConfig {
  read(): Promise<{ kapso: { apiKey: Secret | null; webhookSecret: string | null } }>;
}
interface Secret { reveal(): string }
