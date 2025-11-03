// This file is kept for potential future use (user sessions, chat history, etc.)
// Currently NOT required for production deployment
// The app only uses external Supabase database for project queries

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Make DATABASE_URL optional - not required for current functionality
const DATABASE_URL = process.env.DATABASE_URL;

export const pool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL }) : null;
export const db = pool ? drizzle({ client: pool, schema }) : null;
