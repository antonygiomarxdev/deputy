import type { SqlRow, SqlValue } from "../../shared/sql-database";

export class RowError extends Error {
  constructor(column: string, expected: string, got: SqlValue | undefined) {
    super(`column ${column}: expected ${expected}, got ${got === undefined ? "missing" : typeof got}`);
  }
}

export function str(r: SqlRow, c: string): string {
  const v = r[c];
  if (typeof v !== "string") throw new RowError(c, "string", v);
  return v;
}

export function strOrNull(r: SqlRow, c: string): string | null {
  const v = r[c];
  if (v === null) return null;
  return str(r, c);
}

export function num(r: SqlRow, c: string): number {
  const v = r[c];
  if (typeof v !== "number") throw new RowError(c, "number", v);
  return v;
}

export function numOrNull(r: SqlRow, c: string): number | null {
  const v = r[c];
  if (v === null) return null;
  return num(r, c);
}

export function flag(r: SqlRow, c: string): boolean {
  const v = num(r, c);
  if (v !== 0 && v !== 1) throw new RowError(c, "0 or 1", v);
  return v === 1;
}
