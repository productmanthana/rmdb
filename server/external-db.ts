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
      connectionTimeoutMillis: 30000, // Increased from 10s to 30s
      query_timeout: 60000, // 60 second query timeout
      max: 20,
      idleTimeoutMillis: 30000,
    });

    externalPool.on("error", (err) => {
      console.error("Unexpected error on external database client", err);
    });
  }

  return externalPool;
}

export async function queryExternalDb(sql: string, params?: any[], retries = 2): Promise<any[]> {
  const pool = getExternalDbPool();
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    let client;
    try {
      client = await pool.connect();
      const result = await client.query(sql, params);
      return result.rows;
    } catch (error: any) {
      // Release client if we got one
      if (client) {
        client.release();
      }
      
      // Check if it's a transient error that we should retry
      const isTransientError = 
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'ECONNREFUSED' ||
        error.message?.includes('timeout') ||
        error.message?.includes('Connection terminated') ||
        error.name === 'AggregateError';
      
      // If it's the last attempt or not a transient error, throw
      if (attempt === retries || !isTransientError) {
        console.error(`Database query failed after ${attempt + 1} attempt(s):`, error);
        throw error;
      }
      
      // Log retry attempt
      console.warn(`Database connection attempt ${attempt + 1} failed, retrying...`, error.message);
      
      // Wait a bit before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.min(1000 * (attempt + 1), 3000)));
    }
  }
  
  throw new Error('Query failed after all retry attempts');
}

export async function closeExternalDb(): Promise<void> {
  if (externalPool) {
    await externalPool.end();
    externalPool = null;
  }
}
