import { test } from "bun:test";
import assert from "node:assert/strict";
import { parseCsv, rowsToCatalog, orderToRow, rowToOrder } from "../src/store/csv.ts";
import { splitText } from "../src/providers/graph.ts";

test("catalog accepts English headers, quoted fields and currency prices", () => {
  const cat = rowsToCatalog(parseCsv('Name,Unit,Price,Available\n"Tamale, large",Each,$ 4.50,yes\nCider,Bottle,,sold out\n'));
  assert.equal(cat[0].name, "Tamale, large");
  assert.equal(cat[0].unit, "Each");
  assert.equal(cat[0].price, 4.5);
  assert.equal(cat[0].available, true);
  assert.equal(cat[1].price, null);
  assert.equal(cat[1].available, false);
});

test("catalog accepts Spanish headers with accents", () => {
  const cat = rowsToCatalog(parseCsv("Nombre,Presentación,Precio,Disponible\nNacatamal,Unidad,C$ 150,sí\nRompope,Botella,,agotado\n"));
  assert.equal(cat[0].unit, "Unidad");
  assert.equal(cat[0].price, 150);
  assert.equal(cat[0].available, true);
  assert.equal(cat[1].available, false);
});

test("order round-trips through CSV", () => {
  const o = { id: "a1", created_at: "2026-12-01", phone: "505", customer: "Ana", items: [{ product: "tamale", quantity: 10 }, { product: "cider", quantity: 2 }], fulfillment: "pickup", total: 1500, status: "new" };
  const back = rowToOrder(orderToRow(o).map(String));
  assert.deepEqual(back.items, o.items);
  assert.equal(back.total, 1500);
});

test("splitText respects WhatsApp's length limit", () => {
  const parts = splitText("word ".repeat(2000), 4000);
  assert.ok(parts.length >= 3);
  assert.ok(parts.every((p) => p.length <= 4000));
});
