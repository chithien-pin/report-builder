import duckdb from "duckdb";

export function openConnection(): duckdb.Connection {
  const db = new duckdb.Database(":memory:");
  return db.connect();
}

export function run(conn: duckdb.Connection, sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    conn.run(sql, (err) => (err ? reject(err) : resolve()));
  });
}

export function all<T = unknown>(conn: duckdb.Connection, sql: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    conn.all(sql, (err, rows) => (err ? reject(err) : resolve(rows as T[])));
  });
}

export function close(conn: duckdb.Connection): Promise<void> {
  return new Promise((resolve) => {
    conn.close(() => resolve());
  });
}

export async function withConnection<T>(fn: (conn: duckdb.Connection) => Promise<T>): Promise<T> {
  const conn = openConnection();
  try {
    return await fn(conn);
  } finally {
    await close(conn);
  }
}

export function sqlPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/'/g, "''");
}
