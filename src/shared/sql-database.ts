export type SqlValue = string | number | null | Uint8Array;
export type SqlRow = Readonly<Record<string, SqlValue>>;

export interface SqlExecutor {
  query(sql: string, params?: readonly SqlValue[]): Promise<SqlRow[]>;
  run(sql: string, params?: readonly SqlValue[]): Promise<{ changes: number; lastInsertId: number }>;
}

export interface SqlDatabase extends SqlExecutor {
  /** One transaction at a time (BEGIN IMMEDIATE). Inside `work`, use only `tx`. A throw rolls back and rethrows. */
  transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T>;
}
