import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { config } from "../config.js";
import type { Order, Store } from "../types.js";
import { ORDER_COLS, orderToRow, rowToOrder, rowsToCatalog } from "./csv.js";

/**
 * Google Sheets through a service account (free). Share the sheet with the
 * service account's email as Editor. Tabs: "Catalog" and "Orders".
 */
export function createSheetsStore(): Store {
  const sheetId = config.req("SHEETS_ID");
  const key = JSON.parse(readFileSync(config.req("GOOGLE_SERVICE_ACCOUNT_FILE"), "utf8"));
  const catalogTab = config.env("SHEETS_CATALOG_TAB", "Catalog")!;
  const ordersTab = config.env("SHEETS_ORDERS_TAB", "Orders")!;
  let token: { value: string; exp: number } | null = null;

  async function accessToken() {
    if (token && token.exp > Date.now() + 60_000) return token.value;
    const now = Math.floor(Date.now() / 1000);
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
      iss: key.client_email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })}`;
    const sig = createSign("RSA-SHA256").update(unsigned).sign(key.private_key, "base64url");
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }),
    });
    const j: any = await res.json();
    if (!res.ok) throw new Error(`Google OAuth: ${JSON.stringify(j).slice(0, 300)}`);
    token = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 };
    return token.value;
  }

  async function api(path: string, init?: RequestInit) {
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    const j: any = await res.json();
    if (!res.ok) throw new Error(`Sheets ${res.status}: ${JSON.stringify(j).slice(0, 300)}`);
    return j;
  }

  const range = (tab: string) => encodeURIComponent(`'${tab}'!A:Z`);
  const values = async (tab: string): Promise<string[][]> => (await api(`/values/${range(tab)}`)).values ?? [];

  return {
    name: "sheets",
    async catalog() {
      return rowsToCatalog(await values(catalogTab));
    },
    async createOrder(o: Order) {
      const current = await values(ordersTab);
      const rows: string[][] = current.length ? [] : [[...ORDER_COLS]];
      rows.push(orderToRow(o).map(String));
      await api(`/values/${range(ordersTab)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
        method: "POST",
        body: JSON.stringify({ values: rows }),
      });
    },
    async orders() {
      return (await values(ordersTab)).slice(1).map(rowToOrder);
    },
  };
}
