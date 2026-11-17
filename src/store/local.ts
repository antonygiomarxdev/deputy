import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "../config.js";
import type { Order, Store } from "../types.js";
import { ORDER_COLS, csvCell, orderToRow, parseCsv, rowToOrder, rowsToCatalog } from "./csv.js";

/** Default store: local CSV files. Catalog in business/catalog.csv, orders in data/orders.csv. */
export function createLocalStore(): Store {
  const catalogPath = resolve(config.businessDir, "catalog.csv");
  const ordersPath = resolve(config.dataDir, "orders.csv");
  mkdirSync(config.dataDir, { recursive: true });
  if (!existsSync(ordersPath)) writeFileSync(ordersPath, ORDER_COLS.join(",") + "\n");

  return {
    name: "local",
    async catalog() {
      if (!existsSync(catalogPath)) return [];
      return rowsToCatalog(parseCsv(readFileSync(catalogPath, "utf8")));
    },
    async createOrder(o: Order) {
      appendFileSync(ordersPath, orderToRow(o).map(csvCell).join(",") + "\n");
    },
    async orders() {
      return parseCsv(readFileSync(ordersPath, "utf8")).slice(1).map(rowToOrder);
    },
  };
}
