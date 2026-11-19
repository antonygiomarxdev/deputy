import type { Clock } from "../shared/clock";
import type { ProviderName } from "../shared/provider-name";
import type { SqlDatabase } from "../shared/sql-database";
import { DevProvider } from "../intake/adapters/dev/dev-provider";
import { KapsoProvider } from "../intake/adapters/kapso/kapso-provider";
import { LibphonenumberParser } from "../intake/adapters/phone/libphonenumber-parser";
import type { IntakeConnectionConfig, Provider } from "../intake/index";

export type Connection = Awaited<ReturnType<IntakeConnectionConfig["read"]>>;

export type ChosenProvider =
  | { ok: true; name: ProviderName; provider: Provider; devProvider: DevProvider | null }
  | { ok: false; message: string };

/** The dev provider, or Kapso built from the connection file. ResolveProviderSettings already refused a missing key or phone number id. */
export function chooseProvider(name: ProviderName, connection: Connection, kapsoBaseUrl: string, db: SqlDatabase, clock: Clock): ChosenProvider {
  if (name === "dev") {
    const devProvider = new DevProvider({ db, clock });
    return { ok: true, name, provider: devProvider, devProvider };
  }
  if (connection.kapso.apiKey === null || connection.kapso.phoneNumberId === null) {
    return { ok: false, message: "Kapso needs its api key and phone number id. Run Setup." };
  }
  return {
    ok: true,
    name,
    devProvider: null,
    provider: new KapsoProvider({
      baseUrl: kapsoBaseUrl,
      graphVersion: "v24.0",
      apiKey: connection.kapso.apiKey,
      phoneNumberId: connection.kapso.phoneNumberId,
      clock,
      parser: new LibphonenumberParser(),
    }),
  };
}
