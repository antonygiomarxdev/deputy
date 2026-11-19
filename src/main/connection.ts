import { createSecretStore } from "../adapters/secrets/secret-store";
import { FileConnectionConfig } from "../intake/adapters/config/file-connection-config";

/** The connection config file and its secrets, read from the OS secret store (under secretService when set). */
export function connectionConfig(configDir: string, secretService: string | null): FileConnectionConfig {
  return new FileConnectionConfig({
    configDir,
    secrets: createSecretStore({ os: { get: (service, name) => Bun.secrets.get({ service: secretService ?? service, name }) }, configDir }),
  });
}
