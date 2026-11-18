import type { SecretStore } from "../../src/adapters/secrets/secret-store";

export class FakeSecretStore implements SecretStore {
  constructor(private readonly values: Readonly<Record<string, string>> = {}) {}

  async get(name: string) {
    const value = this.values[name];
    return value === undefined ? null : { value, where: "file" as const };
  }
}
