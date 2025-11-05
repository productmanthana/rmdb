/**
 * External PostgreSQL Database Connection
 * Connects to Supabase external database
 */

import { Pool } from "pg";

let externalPool: Pool | null = null;

export function getExternalDbPool(): Pool {
  if (!externalPool) {
    externalPool = new Pool({
      host: process.env.EXTERNAL_DB_HOST || "aws-1-us-east-1.pooler.supabase.com",
      port: parseInt(process.env.EXTERNAL_DB_PORT || "6543"),
      database: process.env.EXTERNAL_DB_NAME || "postgres",
      user: process.env.EXTERNAL_DB_USER || "postgres.jlhkysdsahtnygjawwvt",
      password: process.env.EXTERNAL_DB_PASSWORD || "Vyaasai@rmone",
      ssl: {
        rejectUnauthorized: false
      },
      connectionTimeoutMillis: 10000,
      max: 20,
      idleTimeoutMillis: 30000,
    });

    externalPool.on("error", (err) => {
      console.error("Unexpected error on external database client", err);
    });
  }

  return externalPool;
}

export async function queryExternalDb(sql: string, params?: any[]): Promise<any[]> {
  const pool = getExternalDbPool();
  const client = await pool.connect();

  try {
    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function closeExternalDb(): Promise<void> {
  if (externalPool) {
    await externalPool.end();
    externalPool = null;
  }
}
