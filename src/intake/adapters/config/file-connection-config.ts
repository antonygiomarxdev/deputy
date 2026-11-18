import { readConfigFile } from "../../../adapters/config/config-file";
import type { SecretStore } from "../../../adapters/secrets/secret-store";
import { Secret } from "../../domain/secret";
import type { IntakeConnectionConfig } from "../../ports/intake-connection-config";

const text = (v: unknown): string | null => (typeof v === "string" ? v : null);

export class FileConnectionConfig implements IntakeConnectionConfig {
  constructor(private readonly d: { configDir: string; secrets: SecretStore }) {}

  async read() {
    const file = await readConfigFile(this.d.configDir);
    const secret = async (name: string): Promise<Secret | null> => {
      const found = await this.d.secrets.get(name);
      return found === null ? null : new Secret(found.value);
    };
    return {
      provider: text(file["provider"]),
      receivingMode: text(file["receiving_mode"]),
      kapso: {
        apiKey: await secret("kapso-api-key"),
        phoneNumberId: text(file["kapso_phone_number_id"]),
        webhookSecret: await secret("kapso-webhook-secret"),
      },
    };
  }
}
