import { z } from "zod";

// ═══════════════════════════════════════════════════════════════
// QUERY TYPES
// ═══════════════════════════════════════════════════════════════

export const QueryRequestSchema = z.object({
  question: z.string().min(1, "Question is required"),
});

export type QueryRequest = z.infer<typeof QueryRequestSchema>;

// ═══════════════════════════════════════════════════════════════
// CHART CONFIGURATION
// ═══════════════════════════════════════════════════════════════

export const ChartDatasetSchema = z.object({
  label: z.string().optional(),
  data: z.array(z.number()),
  backgroundColor: z.union([z.string(), z.array(z.string())]).optional(),
  borderColor: z.union([z.string(), z.array(z.string())]).optional(),
  borderWidth: z.number().optional(),
});

export const ChartConfigSchema = z.object({
  type: z.enum(["bar", "line", "pie"]),
  title: z.string(),
  labels: z.array(z.string()),
  datasets: z.array(ChartDatasetSchema),
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
