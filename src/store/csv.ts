import type { Order, Product } from "../types.js";

/** Small CSV parser (handles quotes and commas inside fields). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== "")) rows.push(row);
  return rows;
}

export const csvCell = (v: unknown) => {
  const s = v === undefined || v === null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const ORDER_COLS = ["id", "created_at", "phone", "customer", "items", "fulfillment", "address", "due", "total", "notes", "status"] as const;

export function orderToRow(o: Order): (string | number)[] {
  return [
    o.id, o.created_at, o.phone, o.customer,
    o.items.map((i) => `${i.quantity} ${i.product}`).join("; "),
    o.fulfillment, o.address ?? "", o.due ?? "",
    o.total ?? "", o.notes ?? "", o.status,
  ];
}

export function rowToOrder(r: string[]): Order {
  const [id, created_at, phone, customer, items, fulfillment, address, due, total, notes, status] = r;
  return {
    id, created_at, phone, customer,
    items: (items ?? "").split(";").map((s) => s.trim()).filter(Boolean).map((s) => {
      const m = s.match(/^(\d+)\s+(.+)$/);
      return m ? { quantity: Number(m[1]), product: m[2] } : { quantity: 1, product: s };
    }),
    fulfillment, address: address || undefined, due: due || undefined,
    total: total ? Number(total) : null, notes: notes || undefined, status: status || "new",
  };
}

/** Header aliases, so a catalog can be written in English or Spanish. */
const ALIASES: Record<keyof Product, string[]> = {
  id: ["id", "sku", "codigo"],
  name: ["name", "product", "nombre", "producto"],
  unit: ["unit", "size", "presentacion", "unidad"],
  price: ["price", "precio"],
  available: ["available", "in_stock", "stock", "disponible"],
  notes: ["notes", "note", "notas", "nota"],
};
const NO = ["no", "false", "0", "out", "sold out", "agotado"];

const norm = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "_");

/** Catalog rows → products. Flexible headers (see ALIASES). */
export function rowsToCatalog(rows: string[][]): Product[] {
  if (!rows.length) return [];
  const head = rows[0].map(norm);
  const col = (k: keyof Product) => head.findIndex((h) => ALIASES[k].includes(h));
  const idx = Object.fromEntries((Object.keys(ALIASES) as (keyof Product)[]).map((k) => [k, col(k)])) as Record<keyof Product, number>;
  return rows.slice(1).map((r) => {
    const get = (k: keyof Product) => (idx[k] >= 0 ? (r[idx[k]] ?? "").trim() : "");
    const priceRaw = get("price").replace(/[^\d.]/g, "");
    return {
      id: get("id") || get("name").toLowerCase().replace(/\s+/g, "-"),
      name: get("name"),
      unit: get("unit") || undefined,
      price: priceRaw ? Number(priceRaw) : null,
      available: !NO.includes(get("available").toLowerCase()),
      notes: get("notes") || undefined,
    };
  }).filter((p) => p.name);
}
