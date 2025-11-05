import { z } from "zod";
import { pgTable, varchar, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// ═══════════════════════════════════════════════════════════════
// DATABASE TABLES (Drizzle ORM)
// ═══════════════════════════════════════════════════════════════

export const chats = pgTable("chats", {
  id: varchar("id").primaryKey(),
  session_id: varchar("session_id").notNull(),
  title: text("title").notNull(),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey(),
  chat_id: varchar("chat_id").notNull(),
  type: varchar("type").notNull(),
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  response: jsonb("response"),
});

export const insertChatSchema = createInsertSchema(chats).omit({ 
  created_at: true, 
  updated_at: true 
});

export const insertMessageSchema = createInsertSchema(messages).omit({ 
  timestamp: true 
});

export type Chat = typeof chats.$inferSelect;
export type InsertChat = z.infer<typeof insertChatSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

// ═══════════════════════════════════════════════════════════════
// QUERY TYPES
// ═══════════════════════════════════════════════════════════════

export const QueryRequestSchema = z.object({
  question: z.string().min(1, "Question is required"),
  previousContext: z.object({
    question: z.string(),
    function_name: z.string(),
    arguments: z.record(z.string(), z.any()),
  }).optional(),
});

export type QueryRequest = z.infer<typeof QueryRequestSchema>;

// ═══════════════════════════════════════════════════════════════
// CHART CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const ChartPointSchema = z.object({
  x: z.number(),
  y: z.number(),
  r: z.number().optional(),
});

export const ChartDatasetSchema = z.object({
  label: z.string().optional(),
  data: z.union([
    z.array(z.number()),
    z.array(ChartPointSchema),
  ]),
  backgroundColor: z.union([z.string(), z.array(z.string())]).optional(),
  borderColor: z.union([z.string(), z.array(z.string())]).optional(),
  borderWidth: z.number().optional(),
});

export const ChartConfigSchema = z.object({
  type: z.enum(["bar", "line", "pie", "doughnut", "scatter", "area", "radar", "bubble"]),
  title: z.string(),
  labels: z.array(z.string()),
  datasets: z.array(ChartDatasetSchema),
  tooltipFormat: z.enum(["currency", "percentage", "number", "custom"]).optional(),
  showLegend: z.boolean().optional(),
  legendPosition: z.enum(["top", "bottom", "left", "right"]).optional(),
  colorScheme: z.enum(["default", "vibrant", "pastel", "monochrome"]).optional(),
});

export type ChartDataset = z.infer<typeof ChartDatasetSchema>;
export type ChartConfig = z.infer<typeof ChartConfigSchema>;

// ═══════════════════════════════════════════════════════════════
// QUERY RESPONSE
// ═══════════════════════════════════════════════════════════════

export const SummaryStatsSchema = z.object({
  total_records: z.number().optional(),
  total_value: z.number().optional(),
  avg_fee: z.number().optional(),
  median_fee: z.number().optional(),
  min_fee: z.number().optional(),
  max_fee: z.number().optional(),
  avg_win_rate: z.number().optional(),
  status_breakdown: z.record(z.string(), z.number()).optional(),
  top_companies: z.record(z.string(), z.number()).optional(),
});

export type SummaryStats = z.infer<typeof SummaryStatsSchema>;

export const QueryResponseSchema = z.object({
  success: z.boolean(),
  question: z.string().optional(),
  function_name: z.string().optional(),
  arguments: z.record(z.string(), z.any()).optional(),
  data: z.array(z.record(z.string(), z.any())),
  row_count: z.number().optional(),
  summary: SummaryStatsSchema.optional(),
  chart_config: ChartConfigSchema.nullable().optional(),
  message: z.string().optional(),
  error: z.string().optional(),
  traceback: z.string().optional(),
  sql_query: z.string().optional(),
  sql_params: z.array(z.any()).optional(),
  ai_insights: z.string().optional(),
});

export type QueryResponse = z.infer<typeof QueryResponseSchema>;

// ═══════════════════════════════════════════════════════════════
// CHAT HISTORY (Full conversations with messages)
// ═══════════════════════════════════════════════════════════════

export const ChatHistorySchema = z.object({
  id: z.string(),
  title: z.string(),
  created_at: z.date(),
  updated_at: z.date(),
});

export const ChatMessageSchema = z.object({
  id: z.string(),
  chat_id: z.string(),
  type: z.enum(["user", "bot"]),
  content: z.string(),
  timestamp: z.date(),
  response: QueryResponseSchema.optional(),
});

export type ChatHistory = z.infer<typeof ChatHistorySchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

// ═══════════════════════════════════════════════════════════════
// QUERY HISTORY (In-Memory Storage - Legacy)
// ═══════════════════════════════════════════════════════════════

export interface QueryHistoryItem {
  id: string;
  question: string;
  timestamp: Date;
  success: boolean;
  row_count?: number;
  function_name?: string;
}

// ═══════════════════════════════════════════════════════════════
// PERCENTILE DATA (for ProjectSizeCalculator cache)
// ═══════════════════════════════════════════════════════════════

export interface PercentileData {
  p20: number;
  p40: number;
  p60: number;
  p80: number;
  min: number;
  max: number;
  total_projects: number;
  calculated_at: string;
}

// ═══════════════════════════════════════════════════════════════
// AZURE OPENAI TYPES
// ═══════════════════════════════════════════════════════════════

export interface AzureOpenAIConfig {
  endpoint: string;
  apiKey: string;
  apiVersion: string;
  deployment: string;
}

// ═══════════════════════════════════════════════════════════════
// EXTERNAL DATABASE CONFIG
// ═══════════════════════════════════════════════════════════════

export interface ExternalDBConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  connectTimeout?: number;
}
