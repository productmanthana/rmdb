/**
 * Query Engine - Comprehensive Natural Language Database Query System
 * Ported from Python with ALL backend logic preserved
 */

import { QueryResponse, ChartConfig, SummaryStats } from "@shared/schema";
import { AzureOpenAIClient, FunctionDefinition } from "./azure-openai";
import { SemanticTimeParser, NumberCalculator, ProjectSizeCalculator } from "./query-utils";

interface QueryTemplate {
  sql: string;
  params: string[];
  param_types: string[];
  optional_params?: string[];
  chart_type: "bar" | "line" | "pie";
  chart_field?: string;
}

export class QueryEngine {
  private openaiClient: AzureOpenAIClient;
  private timeParser: SemanticTimeParser;
  private sizeCalculator: ProjectSizeCalculator;
  private queryTemplates: Record<string, QueryTemplate>;
  private functionDefinitions: FunctionDefinition[];

  constructor(openaiClient: AzureOpenAIClient) {
    this.openaiClient = openaiClient;
    this.timeParser = new SemanticTimeParser();
    this.sizeCalculator = new ProjectSizeCalculator();
    this.queryTemplates = this.initializeQueryTemplates();
    this.functionDefinitions = this.initializeFunctionDefinitions();
  }

  private initializeQueryTemplates(): Record<string, QueryTemplate> {
    return {
      // ═══════════════════════════════════════════════════════════════
      // BASIC DATE QUERIES
      // ═══════════════════════════════════════════════════════════════
      
      get_projects_by_year: {
        sql: `SELECT * FROM "Sample" 
              WHERE EXTRACT(YEAR FROM "Start Date") = $1
              AND "Start Date" > '2000-01-01'
              {additional_filters}
              ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC) DESC NULLS LAST
              {limit_clause}`,
        params: ["year"],
        param_types: ["int"],
        optional_params: ["size", "status", "state_code", "company", "client", "categories", "tags", "min_fee", "max_fee", "min_win", "max_win", "limit"],
        chart_type: "bar",
        chart_field: "Fee",
      },

      get_projects_by_date_range: {
        sql: `SELECT * FROM "Sample" 
              WHERE "Start Date" >= $1::date 
              AND "Start Date" <= $2::date
              AND "Start Date" > '2000-01-01'
              {additional_filters}
              ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC) DESC NULLS LAST
              {limit_clause}`,
        params: ["start_date", "end_date"],
        param_types: ["str", "str"],
        optional_params: ["size", "status", "state_code", "company", "client", "categories", "tags", "min_fee", "max_fee", "min_win", "max_win", "limit"],
        chart_type: "bar",
        chart_field: "Fee",
      },

      get_projects_by_quarter: {
        sql: `SELECT * FROM "Sample" 
              WHERE EXTRACT(YEAR FROM "Start Date") = $1
              AND EXTRACT(QUARTER FROM "Start Date") = $2
              AND "Start Date" > '2000-01-01'
              {additional_filters}
              ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC) DESC NULLS LAST
              {limit_clause}`,
        params: ["year", "quarter"],
        param_types: ["int", "int"],
        optional_params: ["size", "status", "state_code", "company", "client", "categories", "tags", "min_fee", "max_fee", "min_win", "max_win", "limit"],
        chart_type: "bar",
        chart_field: "Fee",
      },

      get_projects_by_years: {
        sql: `SELECT * FROM "Sample" 
              WHERE EXTRACT(YEAR FROM "Start Date") = ANY($1)
              AND "Start Date" > '2000-01-01'
              {additional_filters}
              ORDER BY "Start Date", CAST(NULLIF("Fee", '') AS NUMERIC) DESC NULLS LAST
              {limit_clause}`,
        params: ["years"],
        param_types: ["array"],
        optional_params: ["size", "status", "state_code", "company", "client", "categories", "tags", "min_fee", "max_fee", "min_win", "max_win", "limit"],
        chart_type: "bar",
        chart_field: "Fee",
      },

      // ═══════════════════════════════════════════════════════════════
      // RANKING QUERIES
      // ═══════════════════════════════════════════════════════════════

      get_largest_projects: {
        sql: `SELECT * FROM "Sample" 
              WHERE "Fee" IS NOT NULL AND "Fee" != ''
              {date_filter}
              {additional_filters}
              ORDER BY CAST("Fee" AS NUMERIC) DESC
              {limit_clause}`,
        params: [],
        param_types: [],
        optional_params: ["start_year", "end_year", "limit", "start_date", "end_date", "size", "status", "state_code", "company", "client", "categories", "tags", "min_win", "max_win"],
        chart_type: "bar",
        chart_field: "Fee",
      },

      get_smallest_projects: {
        sql: `SELECT * FROM "Sample" 
              WHERE "Fee" IS NOT NULL AND "Fee" != ''
              AND CAST("Fee" AS NUMERIC) > 0
              {date_filter}
              {additional_filters}
              ORDER BY CAST("Fee" AS NUMERIC) ASC
              {limit_clause}`,
        params: [],
        param_types: [],
        optional_params: ["start_year", "end_year", "limit", "start_date", "end_date", "size", "status", "state_code", "company", "client", "categories", "tags", "min_win", "max_win"],
        chart_type: "bar",
        chart_field: "Fee",
      },

      get_largest_in_region: {
        sql: `SELECT * FROM "Sample" 
              WHERE "State Lookup" = $1::text
              AND "Fee" IS NOT NULL AND "Fee" != ''
              {additional_filters}
              ORDER BY CAST("Fee" AS NUMERIC) DESC
              {limit_clause}`,
        params: ["state_code"],
        param_types: ["str"],
        optional_params: ["limit", "size", "status", "company", "client", "categories", "tags", "min_fee", "max_fee", "min_win", "max_win", "start_date", "end_date"],
        chart_type: "bar",
        chart_field: "Fee",
      },

      get_largest_by_category: {
        sql: `SELECT * FROM "Sample" 
              WHERE "Request Category" ILIKE $1
              AND "Fee" IS NOT NULL AND "Fee" != ''
              {additional_filters}
              ORDER BY CAST("Fee" AS NUMERIC) DESC
              {limit_clause}`,
        params: ["category"],
        param_types: ["str"],
        optional_params: ["limit", "size", "status", "state_code", "company", "client", "tags", "min_fee", "max_fee", "min_win", "max_win", "start_date", "end_date"],
        chart_type: "bar",
        chart_field: "Fee",
      },

      // ═══════════════════════════════════════════════════════════════
      // CATEGORY / TYPE QUERIES
      // ═══════════════════════════════════════════════════════════════

      get_projects_by_category: {
        sql: `SELECT * FROM "Sample" 
              WHERE "Request Category" ILIKE $1
              {additional_filters}
              ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC) DESC NULLS LAST
              {limit_clause}`,
        params: ["category"],
        param_types: ["str"],
        optional_params: ["size", "status", "state_code", "company", "client", "tags", "min_fee", "max_fee", "min_win", "max_win", "start_date", "end_date", "limit"],
        chart_type: "bar",
        chart_field: "Fee",
      },

      get_projects_by_project_type: {
        sql: `SELECT * FROM "Sample" 
              WHERE "Project Type" ILIKE $1
              {additional_filters}
              ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC) DESC NULLS LAST
              {limit_clause}`,
        params: ["project_type"],
        param_types: ["str"],
        optional_params: ["size", "status", "state_code", "company", "client", "categories", "tags", "min_fee", "max_fee", "min_win", "max_win", "start_date", "end_date", "limit"],
        chart_type: "bar",
        chart_field: "Fee",
      },

      get_projects_by_multiple_categories: {
        sql: `SELECT * FROM "Sample" 
              WHERE "Request Category" ILIKE ANY($1)
              {additional_filters}
              ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC) DESC NULLS LAST
              {limit_clause}`,
        params: ["categories"],
        param_types: ["array"],
        optional_params: ["size", "status", "state_code", "company", "client", "tags", "min_fee", "max_fee", "min_win", "max_win", "start_date", "end_date", "limit"],
        chart_type: "bar",
        chart_field: "Fee",
      },

      // ═══════════════════════════════════════════════════════════════
      // TAG QUERIES
      // ═══════════════════════════════════════════════════════════════

      get_largest_by_tags: {
        sql: `SELECT * FROM "Sample" 
              WHERE "Tags" ILIKE $1
              AND "Fee" IS NOT NULL AND "Fee" != ''
              {additional_filters}
              ORDER BY CAST("Fee" AS NUMERIC) DESC
              {limit_clause}`,
        params: ["tag"],
        param_types: ["str"],
        optional_params: ["limit", "size", "status", "state_code", "company", "client", "categories", "min_fee", "max_fee", "min_win", "max_win", "start_date", "end_date"],
        chart_type: "bar",
        chart_field: "Fee",
      },

      get_projects_by_tags: {
        sql: `SELECT * FROM "Sample" 
              WHERE "Tags" ILIKE $1
              {additional_filters}
              ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC) DESC NULLS LAST
              {limit_clause}`,
        params: ["tag"],
        param_types: ["str"],
        optional_params: ["size", "status", "state_code", "company", "client", "categories", "min_fee", "max_fee", "min_win", "max_win", "start_date", "end_date", "limit"],
        chart_type: "bar",
        chart_field: "Fee",
      },

      get_projects_by_multiple_tags: {
        sql: `SELECT * FROM "Sample" 
              WHERE "Tags" IS NOT NULL 
              AND "Tags" != ''
              {tag_conditions}
              ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC) DESC NULLS LAST
              {limit_clause}`,
        params: [],
        param_types: [],
        optional_params: ["tag1", "tag2", "tag3", "tag4", "tag5", "limit"],
        chart_type: "bar",
        chart_field: "Fee",
      },

      get_top_tags: {
        sql: `WITH tag_data AS (
                SELECT TRIM(UNNEST(string_to_array("Tags", ','))) as tag,
                       CAST(NULLIF("Fee", '') AS NUMERIC) as fee
                FROM "Sample"
                WHERE "Tags" IS NOT NULL AND "Tags" != ''
              )
              SELECT tag,
                     COUNT(*) as project_count,
                     SUM(fee) as total_value
              FROM tag_data
              WHERE tag != ''
              GROUP BY tag
              ORDER BY total_value DESC NULLS LAST
              {limit_clause}`,
        params: [],
        param_types: [],
        optional_params: ["limit"],
        chart_type: "bar",
        chart_field: "total_value",
      },

      // ═══════════════════════════════════════════════════════════════
      // COMPANY / OPCO QUERIES
      // ═══════════════════════════════════════════════════════════════

      get_projects_by_company: {
        sql: `SELECT * FROM "Sample" 
              WHERE "Company" ILIKE $1
              {additional_filters}
              ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC) DESC NULLS LAST
              {limit_clause}`,
        params: ["company"],
        param_types: ["str"],
        optional_params: ["size", "status", "state_code", "client", "categories", "tags", "min_fee", "max_fee", "min_win", "max_win", "start_date", "end_date", "limit"],
        chart_type: "bar",
        chart_field: "Fee",
      },

      compare_companies: {
        sql: `SELECT "Company",
              COUNT(*) as project_count,
              SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_revenue,
              AVG(CAST(NULLIF("Fee", '') AS NUMERIC)) as avg_project_size,
              AVG(CAST(NULLIF("Win %", '') AS NUMERIC)) as avg_win_rate
              FROM "Sample"
              WHERE "Company" IS NOT NULL AND "Company" != ''
              GROUP BY "Company"
              ORDER BY total_revenue DESC NULLS LAST`,
        params: [],
        param_types: [],
        chart_type: "bar",
        chart_field: "total_revenue",
      },

      compare_opco_revenue: {
        sql: `SELECT "Company",
              COUNT(*) as project_count,
              SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_revenue,
              SUM(CAST(NULLIF("Fee", '') AS NUMERIC) * CAST(NULLIF("Win %", '') AS NUMERIC) / 100) as predicted_revenue,
              AVG(CAST(NULLIF("Win %", '') AS NUMERIC)) as avg_win_rate
              FROM "Sample"
              WHERE ("Company" ILIKE ANY($1))
              AND "Status" NOT IN ('Won', 'Lost')
              GROUP BY "Company"
              ORDER BY predicted_revenue DESC NULLS LAST`,
        params: ["companies"],
        param_types: ["array"],
        chart_type: "bar",
        chart_field: "predicted_revenue",
      },

      // ═══════════════════════════════════════════════════════════════
      // CLIENT QUERIES
      // ═══════════════════════════════════════════════════════════════

      get_projects_by_client: {
        sql: `SELECT * FROM "Sample" 
              WHERE "Client" ILIKE $1
              {additional_filters}
              ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC) DESC NULLS LAST
              {limit_clause}`,
        params: ["client"],
        param_types: ["str"],
        optional_params: ["size", "status", "state_code", "company", "categories", "tags", "min_fee", "max_fee", "min_win", "max_win", "start_date", "end_date", "limit"],
        chart_type: "bar",
        chart_field: "Fee",
      },

      get_projects_by_client_and_fee_range: {
        sql: `SELECT * FROM "Sample" 
              WHERE "Client" ILIKE $1
              AND CAST(NULLIF("Fee", '') AS NUMERIC) >= $2
              AND CAST(NULLIF("Fee", '') AS NUMERIC) <= $3
              ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC) DESC`,
        params: ["client", "min_fee", "max_fee"],
        param_types: ["str", "float", "float"],
        chart_type: "bar",
        chart_field: "Fee",
      },

      // ═══════════════════════════════════════════════════════════════
      // STATUS QUERIES
      // ═══════════════════════════════════════════════════════════════

      get_projects_by_status: {
        sql: `SELECT * FROM "Sample" 
              WHERE "Status" ILIKE $1
              {additional_filters}
              ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC) DESC NULLS LAST
              {limit_clause}`,
        params: ["status"],
        param_types: ["str"],
        optional_params: ["size", "state_code", "company", "client", "categories", "tags", "min_fee", "max_fee", "min_win", "max_win", "start_date", "end_date", "limit"],
        chart_type: "bar",
        chart_field: "Fee",
      },

      get_projects_by_status_and_win_rate: {
        sql: `SELECT * FROM "Sample" 
              WHERE "Status" ILIKE $1
              AND CAST(NULLIF("Win %", '') AS NUMERIC) >= $2
              ORDER BY CAST(NULLIF("Win %", '') AS NUMERIC) DESC,
                       CAST(NULLIF("Fee", '') AS NUMERIC) DESC NULLS LAST`,
        params: ["status", "min_win"],
        param_types: ["str", "int"],
        chart_type: "bar",
        chart_field: "Fee",
      },

      get_status_breakdown: {
        sql: `SELECT "Status",
              COUNT(*) as project_count,
              SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_value
              FROM "Sample"
              WHERE "Status" IS NOT NULL AND "Status" != ''
              GROUP BY "Status"
              ORDER BY total_value DESC NULLS LAST`,
        params: [],
        param_types: [],
        chart_type: "pie",
        chart_field: "project_count",
      },

      get_overoptimistic_losses: {
        sql: `SELECT * FROM "Sample" 
              WHERE "Status" ILIKE 'lost'
              AND CAST(NULLIF("Win %", '') AS NUMERIC) > 70
              ORDER BY CAST(NULLIF("Win %", '') AS NUMERIC) DESC,
                       CAST(NULLIF("Fee", '') AS NUMERIC) DESC NULLS LAST`,
        params: [],
        param_types: [],
        chart_type: "bar",
        chart_field: "Fee",
      },

      get_top_predicted_wins: {
        sql: `SELECT * FROM "Sample" 
              WHERE "Status" NOT IN ('Won', 'Lost')
              AND "Win %" IS NOT NULL
              {date_filter}
              {additional_filters}
              ORDER BY CAST("Win %" AS NUMERIC) DESC,
                       CAST(NULLIF("Fee", '') AS NUMERIC) DESC NULLS LAST
              LIMIT $1`,
        params: ["limit"],
        param_types: ["int"],
        optional_params: ["min_fee", "max_fee", "min_win", "max_win", "size", "status", "state_code", "company", "client", "categories", "tags"],
        chart_type: "bar",
        chart_field: "Fee",
      },

      // ═══════════════════════════════════════════════════════════════
      // WIN RATE QUERIES
      // ═══════════════════════════════════════════════════════════════

      get_project_win_rate: {
        sql: `SELECT *, "Win %" as win_rate FROM "Sample" 
              WHERE "Project Name"::text ILIKE $1
              LIMIT 1`,
        params: ["project_name"],
        param_types: ["str"],
        chart_type: "bar",
        chart_field: "win_rate",
      },

      get_projects_by_win_range: {
        sql: `SELECT * FROM "Sample" 
              WHERE CAST(NULLIF("Win %", '') AS NUMERIC) >= $1
              AND CAST(NULLIF("Win %", '') AS NUMERIC) <= $2
              ORDER BY CAST(NULLIF("Win %", '') AS NUMERIC) DESC,
                       CAST(NULLIF("Fee", '') AS NUMERIC) DESC NULLS LAST`,
        params: ["min_win", "max_win"],
        param_types: ["int", "int"],
        chart_type: "bar",
        chart_field: "Fee",
      },

      get_projects_by_category_and_win_range: {
        sql: `SELECT * FROM "Sample" 
              WHERE "Request Category" ILIKE $1
              AND CAST(NULLIF("Win %", '') AS NUMERIC) >= $2
              {max_win_filter}
              ORDER BY CAST(NULLIF("Win %", '') AS NUMERIC) DESC,
                       CAST(NULLIF("Fee", '') AS NUMERIC) DESC NULLS LAST`,
        params: ["category", "min_win"],
        param_types: ["str", "int"],
        optional_params: ["max_win"],
        chart_type: "bar",
        chart_field: "Fee",
      },

      get_projects_by_client_status_win_range: {
        sql: `SELECT * FROM "Sample" 
              WHERE "Client" ILIKE $1
              AND "Status" ILIKE $2
              AND CAST(NULLIF("Win %", '') AS NUMERIC) >= $3
              AND CAST(NULLIF("Win %", '') AS NUMERIC) <= $4
              ORDER BY CAST(NULLIF("Win %", '') AS NUMERIC) DESC,
                       CAST(NULLIF("Fee", '') AS NUMERIC) DESC NULLS LAST`,
        params: ["client", "status", "min_win", "max_win"],
        param_types: ["str", "str", "int", "int"],
        chart_type: "bar",
        chart_field: "Fee",
      },

      get_clients_by_highest_win_rate: {
        sql: `SELECT "Client",
              COUNT(*) as project_count,
              AVG(CAST(NULLIF("Win %", '') AS NUMERIC)) as avg_win_rate,
              SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_value
              FROM "Sample"
              WHERE "Status" NOT IN ('Won', 'Lost')
              AND "Win %" IS NOT NULL AND "Win %" != ''
              AND "Client" IS NOT NULL AND "Client" != ''
              GROUP BY "Client"
              ORDER BY avg_win_rate DESC NULLS LAST
              LIMIT 20`,
        params: [],
        param_types: [],
        chart_type: "bar",
        chart_field: "avg_win_rate",
      },

      get_top_projects_by_win_rate: {
        sql: `SELECT * FROM "Sample"
              WHERE "Win %" IS NOT NULL AND "Win %" != ''
              ORDER BY CAST(NULLIF("Win %", '') AS NUMERIC) DESC,
                       CAST(NULLIF("Fee", '') AS NUMERIC) DESC NULLS LAST
              {limit_clause}`,
        params: [],
        param_types: [],
        optional_params: ["limit"],
        chart_type: "bar",
        chart_field: "Win %",
      },

      get_clients_by_status_count: {
        sql: `SELECT "Client",
              COUNT(*) as project_count,
              SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_value,
              AVG(CAST(NULLIF("Win %", '') AS NUMERIC)) as avg_win_rate
              FROM "Sample"
              WHERE "Status" ILIKE $1
              AND "Client" IS NOT NULL AND "Client" != ''
              GROUP BY "Client"
              ORDER BY project_count DESC
              {limit_clause}`,
        params: ["status"],
        param_types: ["str"],
        optional_params: ["limit"],
        chart_type: "bar",
        chart_field: "project_count",
      },

      // ═══════════════════════════════════════════════════════════════
      // FEE/SIZE QUERIES
      // ═══════════════════════════════════════════════════════════════

      get_projects_by_fee_range: {
        sql: `SELECT * FROM "Sample" 
              WHERE CAST(NULLIF("Fee", '') AS NUMERIC) >= $1
              {max_fee_filter}
              ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC) DESC`,
        params: ["min_fee"],
        param_types: ["float"],
        optional_params: ["max_fee"],
        chart_type: "bar",
        chart_field: "Fee",
      },

      get_projects_by_size: {
        sql: `SELECT * FROM "Sample" 
              WHERE {size_condition}
              AND "Fee" IS NOT NULL AND "Fee" != ''
              ORDER BY CAST("Fee" AS NUMERIC) DESC`,
        params: ["size"],
        param_types: ["str"],
        chart_type: "bar",
        chart_field: "Fee",
      },

      get_size_distribution: {
        sql: `SELECT {size_case} as size_tier,
              COUNT(*) as project_count,
              SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_value
              FROM "Sample"
              WHERE "Fee" IS NOT NULL AND "Fee" != ''
              AND CAST(NULLIF("Fee", '') AS NUMERIC) > 0
              GROUP BY size_tier
              ORDER BY MIN(CAST(NULLIF("Fee", '') AS NUMERIC))`,
        params: [],
        param_types: [],
        chart_type: "pie",
        chart_field: "project_count",
      },

      // ═══════════════════════════════════════════════════════════════
      // REGION QUERIES
      // ═══════════════════════════════════════════════════════════════

      get_projects_by_state: {
        sql: `SELECT * FROM "Sample" 
              WHERE "State Lookup" = $1::text
              {additional_filters}
              ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC) DESC NULLS LAST
              {limit_clause}`,
        params: ["state_code"],
        param_types: ["str"],
        optional_params: ["size", "status", "company", "client", "categories", "tags", "min_fee", "max_fee", "min_win", "max_win", "start_date", "end_date", "limit"],
        chart_type: "bar",
        chart_field: "Fee",
      },

      // ═══════════════════════════════════════════════════════════════
      // COMBINED FILTERS
      // ═══════════════════════════════════════════════════════════════

      get_projects_by_combined_filters: {
        sql: `SELECT * FROM "Sample" 
              WHERE 1=1
              {filters}
              ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC) DESC NULLS LAST
              {limit_clause}`,
        params: [],
        param_types: [],
        optional_params: [
          "size",
          "categories",
          "tags",
          "status",
          "company",
          "state_code",
          "min_fee",
          "max_fee",
          "min_win",
          "max_win",
          "start_date",
          "end_date",
          "limit",
        ],
        chart_type: "bar",
        chart_field: "Fee",
      },

      // ═══════════════════════════════════════════════════════════════
      // AGGREGATION QUERIES
      // ═══════════════════════════════════════════════════════════════

      get_revenue_by_category: {
        sql: `SELECT "Request Category",
              COUNT(*) as project_count,
              SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_revenue
              FROM "Sample"
              WHERE "Request Category" ILIKE $1
              {status_filter}
              GROUP BY "Request Category"`,
        params: ["category"],
        param_types: ["str"],
        optional_params: ["status"],
        chart_type: "bar",
        chart_field: "total_revenue",
      },

      get_weighted_revenue_projection: {
        sql: `SELECT "Status",
              COUNT(*) as project_count,
              SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_value,
              SUM(CAST(NULLIF("Fee", '') AS NUMERIC) * CAST(NULLIF("Win %", '') AS NUMERIC) / 100) as weighted_revenue
              FROM "Sample"
              WHERE "Status" NOT IN ('Won', 'Lost')
              GROUP BY "Status"
              ORDER BY weighted_revenue DESC NULLS LAST`,
        params: [],
        param_types: [],
        chart_type: "bar",
        chart_field: "weighted_revenue",
      },

      compare_years: {
        sql: `SELECT 
              EXTRACT(YEAR FROM "Start Date") as year,
              COUNT(*) as project_count,
              SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_revenue,
              AVG(CAST(NULLIF("Fee", '') AS NUMERIC)) as avg_fee
              FROM "Sample"
              WHERE EXTRACT(YEAR FROM "Start Date") IN ($1, $2)
              GROUP BY year
              ORDER BY year`,
        params: ["year1", "year2"],
        param_types: ["int", "int"],
        chart_type: "bar",
        chart_field: "total_revenue",
      },

      // ═══════════════════════════════════════════════════════════════
      // POC (POINT OF CONTACT) ANALYSIS
      // ═══════════════════════════════════════════════════════════════

      get_top_pocs: {
        sql: `SELECT "Point Of Contact" as poc,
              COUNT(*) as project_count,
              SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_value,
              AVG(CAST(NULLIF("Fee", '') AS NUMERIC)) as avg_project_value,
              AVG(CAST(NULLIF("Win %", '') AS NUMERIC)) as avg_win_rate,
              COUNT(CASE WHEN "Status" = 'Won' THEN 1 END) as won_count,
              COUNT(CASE WHEN "Status" = 'Lost' THEN 1 END) as lost_count
              FROM "Sample"
              WHERE "Point Of Contact" IS NOT NULL AND "Point Of Contact" != ''
              GROUP BY "Point Of Contact"
              ORDER BY total_value DESC NULLS LAST
              {limit_clause}`,
        params: [],
        param_types: [],
        optional_params: ["limit"],
        chart_type: "bar",
        chart_field: "total_value",
      },

      get_projects_by_poc: {
        sql: `SELECT * FROM "Sample" 
              WHERE "Point Of Contact" ILIKE $1
              {additional_filters}
              ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC) DESC NULLS LAST
              {limit_clause}`,
        params: ["poc"],
        param_types: ["str"],
        optional_params: ["size", "status", "state_code", "company", "client", "categories", "tags", "min_fee", "max_fee", "min_win", "max_win", "start_date", "end_date", "limit"],
        chart_type: "bar",
        chart_field: "Fee",
      },

      get_projects_with_same_attribute: {
        sql: `-- This is a two-step query handled specially in executeQuery
              -- Step 1: Look up reference project
              -- Step 2: Find all projects with matching attribute`,
        params: ["reference_pid", "attribute"],
        param_types: ["str", "str"],
        optional_params: ["min_fee", "max_fee", "start_date", "end_date"],
        chart_type: "bar",
        chart_field: "Fee",
      },

      compare_pocs: {
        sql: `SELECT 
              "Point Of Contact" as poc,
              COUNT(*) as project_count,
              SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_value,
              AVG(CAST(NULLIF("Fee", '') AS NUMERIC)) as avg_project_value,
              AVG(CAST(NULLIF("Win %", '') AS NUMERIC)) as avg_win_rate,
              COUNT(CASE WHEN "Status" = 'Won' THEN 1 END) as won_count,
              COUNT(CASE WHEN "Status" = 'Lost' THEN 1 END) as lost_count
              FROM "Sample"
              WHERE "Point Of Contact" ILIKE $1 OR "Point Of Contact" ILIKE $2
              GROUP BY "Point Of Contact"
              ORDER BY total_value DESC NULLS LAST`,
        params: ["poc1", "poc2"],
        param_types: ["str", "str"],
        optional_params: ["start_date", "end_date", "status", "company", "state_code"],
        chart_type: "bar",
        chart_field: "total_value",
      },

      // ═══════════════════════════════════════════════════════════════
      // DESCRIPTION SEARCH
      // ═══════════════════════════════════════════════════════════════

      search_description: {
        sql: `SELECT * FROM "Sample" 
              WHERE "Description" ILIKE $1
              {additional_filters}
              ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC) DESC NULLS LAST
              {limit_clause}`,
        params: ["keyword"],
        param_types: ["str"],
        optional_params: ["size", "status", "state_code", "company", "client", "categories", "tags", "min_fee", "max_fee", "min_win", "max_win", "start_date", "end_date", "limit"],
        chart_type: "bar",
        chart_field: "Fee",
      },

      // ═══════════════════════════════════════════════════════════════
      // MONTH-BASED QUERIES
      // ═══════════════════════════════════════════════════════════════

      get_projects_by_month: {
        sql: `SELECT * FROM "Sample" 
              WHERE EXTRACT(YEAR FROM "Start Date") = $1
              AND EXTRACT(MONTH FROM "Start Date") = $2
              AND "Start Date" > '2000-01-01'
              {additional_filters}
              ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC) DESC NULLS LAST
              {limit_clause}`,
        params: ["year", "month"],
        param_types: ["int", "int"],
        optional_params: ["size", "status", "state_code", "company", "client", "categories", "tags", "min_fee", "max_fee", "min_win", "max_win", "limit"],
        chart_type: "bar",
        chart_field: "Fee",
      },

      get_revenue_by_month: {
        sql: `SELECT 
              EXTRACT(YEAR FROM "Start Date") as year,
              EXTRACT(MONTH FROM "Start Date") as month,
              COUNT(*) as project_count,
              SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_revenue,
              AVG(CAST(NULLIF("Fee", '') AS NUMERIC)) as avg_fee
              FROM "Sample"
              WHERE EXTRACT(YEAR FROM "Start Date") = $1
              AND "Start Date" > '2000-01-01'
              GROUP BY year, month
              ORDER BY month`,
        params: ["year"],
        param_types: ["int"],
        chart_type: "line",
        chart_field: "total_revenue",
      },

      // ═══════════════════════════════════════════════════════════════
      // TREND ANALYSIS
      // ═══════════════════════════════════════════════════════════════

      get_yoy_growth: {
        sql: `WITH yearly_stats AS (
                SELECT 
                  EXTRACT(YEAR FROM "Start Date") as year,
                  COUNT(*) as project_count,
                  SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_revenue,
                  AVG(CAST(NULLIF("Fee", '') AS NUMERIC)) as avg_fee
                FROM "Sample"
                WHERE EXTRACT(YEAR FROM "Start Date") IN ($1, $2)
                AND "Start Date" > '2000-01-01'
                GROUP BY year
              )
              SELECT 
                year,
                project_count,
                total_revenue,
                avg_fee,
                LAG(total_revenue) OVER (ORDER BY year) as prev_year_revenue,
                CASE 
                  WHEN LAG(total_revenue) OVER (ORDER BY year) > 0 
                  THEN ((total_revenue - LAG(total_revenue) OVER (ORDER BY year)) / LAG(total_revenue) OVER (ORDER BY year)) * 100
                  ELSE NULL
                END as yoy_growth_pct
              FROM yearly_stats
              ORDER BY year`,
        params: ["year1", "year2"],
        param_types: ["int", "int"],
        chart_type: "bar",
        chart_field: "total_revenue",
      },

      // ═══════════════════════════════════════════════════════════════
      // REGIONAL PERFORMANCE
      // ═══════════════════════════════════════════════════════════════

      get_revenue_by_state: {
        sql: `SELECT "State Lookup" as state,
              COUNT(*) as project_count,
              SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_revenue,
              AVG(CAST(NULLIF("Fee", '') AS NUMERIC)) as avg_project_value,
              AVG(CAST(NULLIF("Win %", '') AS NUMERIC)) as avg_win_rate,
              COUNT(CASE WHEN "Status" = 'Won' THEN 1 END) as won_count
              FROM "Sample"
              WHERE "State Lookup" IS NOT NULL AND "State Lookup" != ''
              GROUP BY "State Lookup"
              ORDER BY total_revenue DESC NULLS LAST
              {limit_clause}`,
        params: [],
        param_types: [],
        optional_params: ["limit"],
        chart_type: "bar",
        chart_field: "total_revenue",
      },

      // ═══════════════════════════════════════════════════════════════
      // CLIENT ANALYSIS
      // ═══════════════════════════════════════════════════════════════

      get_repeat_clients: {
        sql: `SELECT "Client",
              COUNT(*) as project_count,
              SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_value,
              AVG(CAST(NULLIF("Fee", '') AS NUMERIC)) as avg_project_value,
              MIN("Start Date") as first_project,
              MAX("Start Date") as latest_project
              FROM "Sample"
              WHERE "Client" IS NOT NULL AND "Client" != ''
              GROUP BY "Client"
              HAVING COUNT(*) > 1
              ORDER BY project_count DESC
              {limit_clause}`,
        params: [],
        param_types: [],
        optional_params: ["limit"],
        chart_type: "bar",
        chart_field: "total_value",
      },

      // ═══════════════════════════════════════════════════════════════
      // RISK ANALYSIS
      // ═══════════════════════════════════════════════════════════════

      get_high_risk_opportunities: {
        sql: `SELECT * FROM "Sample" 
              WHERE CAST(NULLIF("Fee", '') AS NUMERIC) > $1
              AND CAST(NULLIF("Win %", '') AS NUMERIC) < $2
              AND "Status" NOT IN ('Won', 'Lost')
              ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC) DESC
              {limit_clause}`,
        params: ["min_fee", "max_win"],
        param_types: ["float", "int"],
        optional_params: ["limit"],
        chart_type: "bar",
        chart_field: "Fee",
      },

      // ═══════════════════════════════════════════════════════════════
      // PROJECT TYPE ANALYSIS
      // ═══════════════════════════════════════════════════════════════

      get_revenue_by_project_type: {
        sql: `SELECT "Project Type",
              COUNT(*) as project_count,
              SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_revenue,
              AVG(CAST(NULLIF("Fee", '') AS NUMERIC)) as avg_fee,
              AVG(CAST(NULLIF("Win %", '') AS NUMERIC)) as avg_win_rate
              FROM "Sample"
              WHERE "Project Type" IS NOT NULL AND "Project Type" != ''
              GROUP BY "Project Type"
              ORDER BY total_revenue DESC NULLS LAST`,
        params: [],
        param_types: [],
        chart_type: "bar",
        chart_field: "total_revenue",
      },

      // ═══════════════════════════════════════════════════════════════
      // UTILITY QUERIES
      // ═══════════════════════════════════════════════════════════════

      get_all_projects: {
        sql: `SELECT * FROM "Sample" 
              ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC) DESC NULLS LAST
              LIMIT 100`,
        params: [],
        param_types: [],
        chart_type: "bar",
        chart_field: "Fee",
      },

      get_project_by_id: {
        sql: `SELECT * FROM "Sample" 
              WHERE "Project Name"::text ILIKE $1
              OR "Internal Id"::text ILIKE $1
              LIMIT 1`,
        params: ["project_name"],
        param_types: ["str"],
        chart_type: "bar",
        chart_field: "Fee",
      },

      // ═══════════════════════════════════════════════════════════════
      // PHASE 1: HIGH-VALUE COMPARISONS
      // ═══════════════════════════════════════════════════════════════

      compare_states: {
        sql: `SELECT "State Lookup" as state,
              COUNT(*) as project_count,
              SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_value,
              AVG(CAST(NULLIF("Fee", '') AS NUMERIC)) as avg_project_value,
              AVG(CAST(NULLIF("Win %", '') AS NUMERIC)) as avg_win_rate,
              COUNT(CASE WHEN "Status" = 'Won' THEN 1 END) as won_count,
              COUNT(CASE WHEN "Status" = 'Lost' THEN 1 END) as lost_count
              FROM "Sample"
              WHERE "State Lookup" = ANY($1)
              {additional_filters}
              GROUP BY "State Lookup"
              ORDER BY total_value DESC NULLS LAST`,
        params: ["states"],
        param_types: ["array"],
        optional_params: ["start_date", "end_date", "status", "company", "categories"],
        chart_type: "bar",
        chart_field: "total_value",
      },

      compare_categories: {
        sql: `SELECT "Request Category" as category,
              COUNT(*) as project_count,
              SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_value,
              AVG(CAST(NULLIF("Fee", '') AS NUMERIC)) as avg_project_value,
              AVG(CAST(NULLIF("Win %", '') AS NUMERIC)) as avg_win_rate,
              COUNT(CASE WHEN "Status" = 'Won' THEN 1 END) as won_count,
              COUNT(CASE WHEN "Status" = 'Lost' THEN 1 END) as lost_count
              FROM "Sample"
              WHERE "Request Category" ILIKE ANY($1)
              {additional_filters}
              GROUP BY "Request Category"
              ORDER BY total_value DESC NULLS LAST`,
        params: ["categories"],
        param_types: ["array"],
        optional_params: ["start_date", "end_date", "status", "state_code", "company"],
        chart_type: "bar",
        chart_field: "total_value",
      },

      compare_clients: {
        sql: `SELECT "Client",
              COUNT(*) as project_count,
              SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_value,
              AVG(CAST(NULLIF("Fee", '') AS NUMERIC)) as avg_project_value,
              AVG(CAST(NULLIF("Win %", '') AS NUMERIC)) as avg_win_rate,
              COUNT(CASE WHEN "Status" = 'Won' THEN 1 END) as won_count,
              COUNT(CASE WHEN "Status" = 'Lost' THEN 1 END) as lost_count,
              MAX("Start Date") as latest_project
              FROM "Sample"
              WHERE "Client" ILIKE ANY($1)
              {additional_filters}
              GROUP BY "Client"
              ORDER BY total_value DESC NULLS LAST`,
        params: ["clients"],
        param_types: ["array"],
        optional_params: ["start_date", "end_date", "status", "state_code", "company"],
        chart_type: "bar",
        chart_field: "total_value",
      },

      compare_quarters: {
        sql: `SELECT 
              EXTRACT(YEAR FROM "Start Date") as year,
              EXTRACT(QUARTER FROM "Start Date") as quarter,
              CONCAT('Q', EXTRACT(QUARTER FROM "Start Date"), ' ', EXTRACT(YEAR FROM "Start Date")) as period,
              COUNT(*) as project_count,
              SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_revenue,
              AVG(CAST(NULLIF("Fee", '') AS NUMERIC)) as avg_fee,
              AVG(CAST(NULLIF("Win %", '') AS NUMERIC)) as avg_win_rate
              FROM "Sample"
              WHERE (EXTRACT(YEAR FROM "Start Date") = $1 AND EXTRACT(QUARTER FROM "Start Date") = $2)
                 OR (EXTRACT(YEAR FROM "Start Date") = $3 AND EXTRACT(QUARTER FROM "Start Date") = $4)
              AND "Start Date" > '2000-01-01'
              {additional_filters}
              GROUP BY year, quarter
              ORDER BY year, quarter`,
        params: ["year1", "quarter1", "year2", "quarter2"],
        param_types: ["int", "int", "int", "int"],
        optional_params: ["status", "company", "state_code", "categories"],
        chart_type: "bar",
        chart_field: "total_revenue",
      },

      compare_months_across_years: {
        sql: `SELECT 
              EXTRACT(YEAR FROM "Start Date") as year,
              EXTRACT(MONTH FROM "Start Date") as month,
              TO_CHAR("Start Date", 'Mon YYYY') as period,
              COUNT(*) as project_count,
              SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_revenue,
              AVG(CAST(NULLIF("Fee", '') AS NUMERIC)) as avg_fee
              FROM "Sample"
              WHERE EXTRACT(MONTH FROM "Start Date") = $1
              AND EXTRACT(YEAR FROM "Start Date") = ANY($2)
              AND "Start Date" > '2000-01-01'
              {additional_filters}
              GROUP BY year, month
              ORDER BY year`,
        params: ["month", "years"],
        param_types: ["int", "array"],
        optional_params: ["status", "company", "state_code"],
        chart_type: "bar",
        chart_field: "total_revenue",
      },

      compare_to_average: {
        sql: `WITH segment_stats AS (
                SELECT 
                  CASE 
                    WHEN $1 = 'company' THEN "Company"
                    WHEN $1 = 'state' THEN "State Lookup"
                    WHEN $1 = 'category' THEN "Request Category"
                    WHEN $1 = 'poc' THEN "Point Of Contact"
                  END as segment,
                  COUNT(*) as project_count,
                  SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_value,
                  AVG(CAST(NULLIF("Fee", '') AS NUMERIC)) as avg_project_value,
                  AVG(CAST(NULLIF("Win %", '') AS NUMERIC)) as avg_win_rate
                FROM "Sample"
                WHERE CASE 
                  WHEN $1 = 'company' THEN "Company" IS NOT NULL
                  WHEN $1 = 'state' THEN "State Lookup" IS NOT NULL
                  WHEN $1 = 'category' THEN "Request Category" IS NOT NULL
                  WHEN $1 = 'poc' THEN "Point Of Contact" IS NOT NULL
                END
                GROUP BY segment
              ),
              overall_avg AS (
                SELECT 
                  AVG(avg_project_value) as overall_avg_value,
                  AVG(avg_win_rate) as overall_avg_win_rate
                FROM segment_stats
              )
              SELECT 
                s.segment,
                s.project_count,
                s.total_value,
                s.avg_project_value,
                s.avg_win_rate,
                o.overall_avg_value,
                o.overall_avg_win_rate,
                ROUND(((s.avg_project_value - o.overall_avg_value) / NULLIF(o.overall_avg_value, 0) * 100)::numeric, 2) as pct_diff_from_avg
              FROM segment_stats s, overall_avg o
              WHERE s.segment ILIKE $2
              ORDER BY s.total_value DESC`,
        params: ["dimension", "value"],
        param_types: ["str", "str"],
        chart_type: "bar",
        chart_field: "total_value",
      },

      rank_all_pocs: {
        sql: `WITH poc_stats AS (
                SELECT 
                  "Point Of Contact" as poc,
                  COUNT(*) as project_count,
                  SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_value,
                  AVG(CAST(NULLIF("Fee", '') AS NUMERIC)) as avg_project_value,
                  AVG(CAST(NULLIF("Win %", '') AS NUMERIC)) as avg_win_rate,
                  COUNT(CASE WHEN "Status" = 'Won' THEN 1 END) as won_count,
                  COUNT(CASE WHEN "Status" = 'Lost' THEN 1 END) as lost_count,
                  ROUND((COUNT(CASE WHEN "Status" = 'Won' THEN 1 END)::numeric / 
                         NULLIF(COUNT(CASE WHEN "Status" IN ('Won', 'Lost') THEN 1 END), 0) * 100)::numeric, 2) as actual_win_rate
                FROM "Sample"
                WHERE "Point Of Contact" IS NOT NULL AND "Point Of Contact" != ''
                {additional_filters}
                GROUP BY "Point Of Contact"
              )
              SELECT 
                ROW_NUMBER() OVER (ORDER BY total_value DESC) as rank,
                poc,
                project_count,
                total_value,
                avg_project_value,
                avg_win_rate,
                won_count,
                lost_count,
                actual_win_rate
              FROM poc_stats
              ORDER BY total_value DESC
              {limit_clause}`,
        params: [],
        param_types: [],
        optional_params: ["start_date", "end_date", "company", "state_code", "limit"],
        chart_type: "bar",
        chart_field: "total_value",
      },

      get_state_performance_ranking: {
        sql: `WITH state_stats AS (
                SELECT 
                  "State Lookup" as state,
                  COUNT(*) as project_count,
                  SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_value,
                  AVG(CAST(NULLIF("Fee", '') AS NUMERIC)) as avg_project_value,
                  AVG(CAST(NULLIF("Win %", '') AS NUMERIC)) as avg_win_rate,
                  COUNT(CASE WHEN "Status" = 'Won' THEN 1 END) as won_count
                FROM "Sample"
                WHERE "State Lookup" IS NOT NULL AND "State Lookup" != ''
                {additional_filters}
                GROUP BY "State Lookup"
              )
              SELECT 
                ROW_NUMBER() OVER (ORDER BY total_value DESC) as rank,
                state,
                project_count,
                total_value,
                avg_project_value,
                avg_win_rate,
                won_count
              FROM state_stats
              ORDER BY total_value DESC
              {limit_clause}`,
        params: [],
        param_types: [],
        optional_params: ["start_date", "end_date", "company", "status", "limit"],
        chart_type: "bar",
        chart_field: "total_value",
      },

      get_client_lifetime_value: {
        sql: `SELECT "Client",
              COUNT(*) as project_count,
              SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as lifetime_value,
              AVG(CAST(NULLIF("Fee", '') AS NUMERIC)) as avg_project_value,
              MIN("Start Date") as first_project_date,
              MAX("Start Date") as latest_project_date,
              EXTRACT(DAYS FROM (MAX("Start Date") - MIN("Start Date"))) as relationship_days,
              COUNT(CASE WHEN "Status" = 'Won' THEN 1 END) as won_count
              FROM "Sample"
              WHERE "Client" IS NOT NULL AND "Client" != ''
              {additional_filters}
              GROUP BY "Client"
              ORDER BY lifetime_value DESC NULLS LAST
              {limit_clause}`,
        params: [],
        param_types: [],
        optional_params: ["start_date", "end_date", "company", "state_code", "limit"],
        chart_type: "bar",
        chart_field: "lifetime_value",
      },

      get_client_win_rate_by_type: {
        sql: `SELECT 
              CASE 
                WHEN project_count >= 10 THEN 'Enterprise'
                WHEN project_count >= 5 THEN 'Mid-Market'
                ELSE 'Small'
              END as client_tier,
              COUNT(DISTINCT "Client") as client_count,
              SUM(project_count) as total_projects,
              AVG(avg_win_rate) as avg_win_rate,
              SUM(total_value) as total_value
              FROM (
                SELECT 
                  "Client",
                  COUNT(*) as project_count,
                  SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_value,
                  AVG(CAST(NULLIF("Win %", '') AS NUMERIC)) as avg_win_rate
                FROM "Sample"
                WHERE "Client" IS NOT NULL AND "Client" != ''
                GROUP BY "Client"
              ) client_stats
              GROUP BY client_tier
              ORDER BY 
                CASE client_tier 
                  WHEN 'Enterprise' THEN 1 
                  WHEN 'Mid-Market' THEN 2 
                  ELSE 3 
                END`,
        params: [],
        param_types: [],
        chart_type: "bar",
        chart_field: "total_value",
      },

      get_poc_efficiency: {
        sql: `SELECT 
              "Point Of Contact" as poc,
              COUNT(*) as project_count,
              SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_value,
              ROUND((SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) / NULLIF(COUNT(*), 0))::numeric, 2) as revenue_per_project,
              AVG(CAST(NULLIF("Win %", '') AS NUMERIC)) as avg_win_rate,
              COUNT(CASE WHEN "Status" = 'Won' THEN 1 END) as won_count,
              COUNT(CASE WHEN "Status" = 'Lost' THEN 1 END) as lost_count
              FROM "Sample"
              WHERE "Point Of Contact" IS NOT NULL AND "Point Of Contact" != ''
              {additional_filters}
              GROUP BY "Point Of Contact"
              ORDER BY revenue_per_project DESC NULLS LAST
              {limit_clause}`,
        params: [],
        param_types: [],
        optional_params: ["start_date", "end_date", "company", "state_code", "limit"],
        chart_type: "bar",
        chart_field: "revenue_per_project",
      },

      get_poc_win_rate_trend: {
        sql: `SELECT 
              "Point Of Contact" as poc,
              EXTRACT(YEAR FROM "Start Date") as year,
              EXTRACT(QUARTER FROM "Start Date") as quarter,
              COUNT(*) as project_count,
              AVG(CAST(NULLIF("Win %", '') AS NUMERIC)) as avg_predicted_win_rate,
              COUNT(CASE WHEN "Status" = 'Won' THEN 1 END) as won_count,
              COUNT(CASE WHEN "Status" IN ('Won', 'Lost') THEN 1 END) as closed_count,
              ROUND((COUNT(CASE WHEN "Status" = 'Won' THEN 1 END)::numeric / 
                     NULLIF(COUNT(CASE WHEN "Status" IN ('Won', 'Lost') THEN 1 END), 0) * 100)::numeric, 2) as actual_win_rate
              FROM "Sample"
              WHERE "Point Of Contact" ILIKE $1
              AND "Start Date" > '2000-01-01'
              GROUP BY "Point Of Contact", year, quarter
              ORDER BY year DESC, quarter DESC`,
        params: ["poc"],
        param_types: ["str"],
        chart_type: "line",
        chart_field: "actual_win_rate",
      },

      get_top_bottom_performers: {
        sql: `WITH poc_performance AS (
                SELECT 
                  "Point Of Contact" as poc,
                  COUNT(*) as project_count,
                  SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_value,
                  AVG(CAST(NULLIF("Fee", '') AS NUMERIC)) as avg_project_value,
                  AVG(CAST(NULLIF("Win %", '') AS NUMERIC)) as avg_win_rate
                FROM "Sample"
                WHERE "Point Of Contact" IS NOT NULL AND "Point Of Contact" != ''
                {additional_filters}
                GROUP BY "Point Of Contact"
                HAVING COUNT(*) >= 3
              ),
              ranked AS (
                SELECT 
                  poc,
                  project_count,
                  total_value,
                  avg_project_value,
                  avg_win_rate,
                  ROW_NUMBER() OVER (ORDER BY total_value DESC) as rank_desc,
                  ROW_NUMBER() OVER (ORDER BY total_value ASC) as rank_asc
                FROM poc_performance
              )
              SELECT 
                poc,
                project_count,
                total_value,
                avg_project_value,
                avg_win_rate,
                CASE WHEN rank_desc <= 5 THEN 'Top Performer'
                     WHEN rank_asc <= 5 THEN 'Needs Improvement'
                     ELSE 'Average'
                END as performance_tier
              FROM ranked
              WHERE rank_desc <= 5 OR rank_asc <= 5
              ORDER BY total_value DESC`,
        params: [],
        param_types: [],
        optional_params: ["start_date", "end_date", "company", "state_code"],
        chart_type: "bar",
        chart_field: "total_value",
      },

      get_category_by_state_matrix: {
        sql: `SELECT 
              "State Lookup" as state,
              "Request Category" as category,
              COUNT(*) as project_count,
              SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_value,
              AVG(CAST(NULLIF("Win %", '') AS NUMERIC)) as avg_win_rate
              FROM "Sample"
              WHERE "State Lookup" IS NOT NULL AND "State Lookup" != ''
              AND "Request Category" IS NOT NULL AND "Request Category" != ''
              {additional_filters}
              GROUP BY "State Lookup", "Request Category"
              ORDER BY total_value DESC NULLS LAST
              {limit_clause}`,
        params: [],
        param_types: [],
        optional_params: ["start_date", "end_date", "company", "status", "limit"],
        chart_type: "bar",
        chart_field: "total_value",
      },

      get_status_by_category_matrix: {
        sql: `SELECT 
              "Request Category" as category,
              "Status",
              COUNT(*) as project_count,
              SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_value,
              AVG(CAST(NULLIF("Win %", '') AS NUMERIC)) as avg_win_rate,
              ROUND((COUNT(*)::numeric / SUM(COUNT(*)) OVER (PARTITION BY "Request Category") * 100)::numeric, 2) as pct_of_category
              FROM "Sample"
              WHERE "Request Category" IS NOT NULL AND "Request Category" != ''
              AND "Status" IS NOT NULL AND "Status" != ''
              {additional_filters}
              GROUP BY "Request Category", "Status"
              ORDER BY "Request Category", total_value DESC NULLS LAST`,
        params: [],
        param_types: [],
        optional_params: ["start_date", "end_date", "company", "state_code"],
        chart_type: "bar",
        chart_field: "total_value",
      },

      // ═══════════════════════════════════════════════════════════════
      // PHASE 2: TREND & FORECASTING
      // ═══════════════════════════════════════════════════════════════

      get_quarterly_trends: {
        sql: `WITH quarterly_data AS (
                SELECT 
                  EXTRACT(YEAR FROM "Start Date") as year,
                  EXTRACT(QUARTER FROM "Start Date") as quarter,
                  CONCAT('Q', EXTRACT(QUARTER FROM "Start Date"), ' ', EXTRACT(YEAR FROM "Start Date")) as period,
                  COUNT(*) as project_count,
                  SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_revenue,
                  AVG(CAST(NULLIF("Win %", '') AS NUMERIC)) as avg_win_rate
                FROM "Sample"
                WHERE "Start Date" > '2000-01-01'
                {additional_filters}
                GROUP BY year, quarter
              ),
              with_lag AS (
                SELECT 
                  period,
                  year,
                  quarter,
                  project_count,
                  total_revenue,
                  avg_win_rate,
                  LAG(total_revenue) OVER (ORDER BY year, quarter) as prev_revenue
                FROM quarterly_data
              )
              SELECT 
                period,
                year,
                quarter,
                project_count,
                total_revenue,
                avg_win_rate,
                prev_revenue,
                ROUND(((total_revenue - prev_revenue) / NULLIF(prev_revenue, 0) * 100)::numeric, 2) as growth_rate_pct
              FROM with_lag
              ORDER BY year DESC, quarter DESC
              {limit_clause}`,
        params: [],
        param_types: [],
        optional_params: ["start_date", "end_date", "company", "state_code", "status", "limit"],
        chart_type: "line",
        chart_field: "total_revenue",
      },

      get_best_worst_quarters: {
        sql: `WITH quarterly_revenue AS (
                SELECT 
                  EXTRACT(YEAR FROM "Start Date") as year,
                  EXTRACT(QUARTER FROM "Start Date") as quarter,
                  CONCAT('Q', EXTRACT(QUARTER FROM "Start Date"), ' ', EXTRACT(YEAR FROM "Start Date")) as period,
                  SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_revenue,
                  COUNT(*) as project_count
                FROM "Sample"
                WHERE "Start Date" > '2000-01-01'
                {additional_filters}
                GROUP BY year, quarter
              ),
              ranked AS (
                SELECT 
                  period,
                  total_revenue,
                  project_count,
                  ROW_NUMBER() OVER (ORDER BY total_revenue DESC) as rank_desc,
                  ROW_NUMBER() OVER (ORDER BY total_revenue ASC) as rank_asc
                FROM quarterly_revenue
              )
              SELECT 
                period,
                total_revenue,
                project_count,
                CASE 
                  WHEN rank_desc <= 3 THEN 'Peak Quarter'
                  WHEN rank_asc <= 3 THEN 'Trough Quarter'
                END as quarter_type
              FROM ranked
              WHERE rank_desc <= 3 OR rank_asc <= 3
              ORDER BY total_revenue DESC`,
        params: [],
        param_types: [],
        optional_params: ["start_date", "end_date", "company", "state_code"],
        chart_type: "bar",
        chart_field: "total_revenue",
      },

      get_monthly_momentum: {
        sql: `WITH monthly_data AS (
                SELECT 
                  EXTRACT(YEAR FROM "Start Date") as year,
                  EXTRACT(MONTH FROM "Start Date") as month,
                  TO_CHAR("Start Date", 'Mon YYYY') as period,
                  SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_revenue,
                  COUNT(*) as project_count
                FROM "Sample"
                WHERE "Start Date" > '2000-01-01'
                {additional_filters}
                GROUP BY year, month
              ),
              with_lag AS (
                SELECT 
                  period,
                  year,
                  month,
                  total_revenue,
                  project_count,
                  LAG(total_revenue, 1) OVER (ORDER BY year, month) as prev_month_revenue,
                  LAG(total_revenue, 2) OVER (ORDER BY year, month) as two_months_ago_revenue
                FROM monthly_data
              )
              SELECT 
                period,
                total_revenue,
                project_count,
                prev_month_revenue,
                ROUND(((total_revenue - prev_month_revenue) / NULLIF(prev_month_revenue, 0) * 100)::numeric, 2) as mom_growth_pct,
                CASE 
                  WHEN total_revenue > prev_month_revenue AND prev_month_revenue > two_months_ago_revenue THEN 'Accelerating'
                  WHEN total_revenue < prev_month_revenue AND prev_month_revenue < two_months_ago_revenue THEN 'Decelerating'
                  WHEN total_revenue > prev_month_revenue THEN 'Growing'
                  WHEN total_revenue < prev_month_revenue THEN 'Declining'
                  ELSE 'Stable'
                END as momentum
              FROM with_lag
              WHERE prev_month_revenue IS NOT NULL
              ORDER BY year DESC, month DESC
              {limit_clause}`,
        params: [],
        param_types: [],
        optional_params: ["start_date", "end_date", "company", "state_code", "limit"],
        chart_type: "line",
        chart_field: "total_revenue",
      },

      get_seasonal_patterns: {
        sql: `SELECT 
              EXTRACT(MONTH FROM "Start Date") as month,
              TO_CHAR("Start Date", 'Month') as month_name,
              COUNT(*) as total_projects,
              SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_revenue,
              AVG(CAST(NULLIF("Fee", '') AS NUMERIC)) as avg_project_value,
              COUNT(DISTINCT EXTRACT(YEAR FROM "Start Date")) as years_of_data
              FROM "Sample"
              WHERE "Start Date" > '2000-01-01'
              {additional_filters}
              GROUP BY month, month_name
              ORDER BY month`,
        params: [],
        param_types: [],
        optional_params: ["start_date", "end_date", "company", "state_code", "status"],
        chart_type: "bar",
        chart_field: "total_revenue",
      },

      get_revenue_trend_by_category: {
        sql: `WITH category_quarterly AS (
                SELECT 
                  "Request Category" as category,
                  EXTRACT(YEAR FROM "Start Date") as year,
                  EXTRACT(QUARTER FROM "Start Date") as quarter,
                  CONCAT('Q', EXTRACT(QUARTER FROM "Start Date"), ' ', EXTRACT(YEAR FROM "Start Date")) as period,
                  SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_revenue,
                  COUNT(*) as project_count
                FROM "Sample"
                WHERE "Request Category" ILIKE $1
                AND "Start Date" > '2000-01-01'
                {additional_filters}
                GROUP BY category, year, quarter
              ),
              with_lag AS (
                SELECT 
                  category,
                  period,
                  total_revenue,
                  project_count,
                  LAG(total_revenue) OVER (PARTITION BY category ORDER BY year, quarter) as prev_revenue
                FROM category_quarterly
              )
              SELECT 
                category,
                period,
                total_revenue,
                project_count,
                ROUND(((total_revenue - prev_revenue) / NULLIF(prev_revenue, 0) * 100)::numeric, 2) as growth_rate_pct
              FROM with_lag
              ORDER BY period DESC`,
        params: ["category"],
        param_types: ["str"],
        optional_params: ["start_date", "end_date", "company", "state_code"],
        chart_type: "line",
        chart_field: "total_revenue",
      },

      get_revenue_trend_by_state: {
        sql: `WITH state_quarterly AS (
                SELECT 
                  "State Lookup" as state,
                  EXTRACT(YEAR FROM "Start Date") as year,
                  EXTRACT(QUARTER FROM "Start Date") as quarter,
                  CONCAT('Q', EXTRACT(QUARTER FROM "Start Date"), ' ', EXTRACT(YEAR FROM "Start Date")) as period,
                  SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_revenue,
                  COUNT(*) as project_count
                FROM "Sample"
                WHERE "State Lookup" = $1
                AND "Start Date" > '2000-01-01'
                {additional_filters}
                GROUP BY state, year, quarter
              ),
              with_lag AS (
                SELECT 
                  state,
                  period,
                  year,
                  quarter,
                  total_revenue,
                  project_count,
                  LAG(total_revenue) OVER (PARTITION BY state ORDER BY year, quarter) as prev_revenue
                FROM state_quarterly
              )
              SELECT 
                state,
                period,
                total_revenue,
                project_count,
                ROUND(((total_revenue - prev_revenue) / NULLIF(prev_revenue, 0) * 100)::numeric, 2) as growth_rate_pct
              FROM with_lag
              ORDER BY year DESC, quarter DESC`,
        params: ["state_code"],
        param_types: ["str"],
        optional_params: ["start_date", "end_date", "company", "status"],
        chart_type: "line",
        chart_field: "total_revenue",
      },

      get_revenue_trend_by_client: {
        sql: `WITH client_quarterly AS (
                SELECT 
                  "Client",
                  EXTRACT(YEAR FROM "Start Date") as year,
                  EXTRACT(QUARTER FROM "Start Date") as quarter,
                  CONCAT('Q', EXTRACT(QUARTER FROM "Start Date"), ' ', EXTRACT(YEAR FROM "Start Date")) as period,
                  SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_revenue,
                  COUNT(*) as project_count
                FROM "Sample"
                WHERE "Client" ILIKE $1
                AND "Start Date" > '2000-01-01'
                {additional_filters}
                GROUP BY "Client", year, quarter
              ),
              with_lag AS (
                SELECT 
                  "Client",
                  period,
                  year,
                  quarter,
                  total_revenue,
                  project_count,
                  LAG(total_revenue) OVER (PARTITION BY "Client" ORDER BY year, quarter) as prev_revenue
                FROM client_quarterly
              )
              SELECT 
                "Client",
                period,
                total_revenue,
                project_count,
                ROUND(((total_revenue - prev_revenue) / NULLIF(prev_revenue, 0) * 100)::numeric, 2) as growth_rate_pct,
                CASE 
                  WHEN total_revenue > prev_revenue THEN 'Growing'
                  WHEN total_revenue < prev_revenue THEN 'Declining'
                  ELSE 'Stable'
                END as trend
              FROM with_lag
              ORDER BY year DESC, quarter DESC`,
        params: ["client"],
        param_types: ["str"],
        optional_params: ["start_date", "end_date", "company", "state_code"],
        chart_type: "line",
        chart_field: "total_revenue",
      },

      get_pipeline_velocity: {
        sql: `SELECT 
              "Status",
              COUNT(*) as project_count,
              AVG(EXTRACT(DAYS FROM (CURRENT_DATE - "Start Date"))) as avg_days_in_pipeline,
              MIN(EXTRACT(DAYS FROM (CURRENT_DATE - "Start Date"))) as min_days,
              MAX(EXTRACT(DAYS FROM (CURRENT_DATE - "Start Date"))) as max_days,
              PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(DAYS FROM (CURRENT_DATE - "Start Date"))) as median_days
              FROM "Sample"
              WHERE "Status" IN ('Won', 'Lost', 'In Progress', 'On Hold')
              {additional_filters}
              GROUP BY "Status"
              ORDER BY avg_days_in_pipeline DESC`,
        params: [],
        param_types: [],
        optional_params: ["start_date", "end_date", "company", "state_code", "categories"],
        chart_type: "bar",
        chart_field: "avg_days_in_pipeline",
      },

      get_conversion_rate_trend: {
        sql: `WITH quarterly_conversions AS (
                SELECT 
                  EXTRACT(YEAR FROM "Start Date") as year,
                  EXTRACT(QUARTER FROM "Start Date") as quarter,
                  CONCAT('Q', EXTRACT(QUARTER FROM "Start Date"), ' ', EXTRACT(YEAR FROM "Start Date")) as period,
                  COUNT(CASE WHEN "Status" = 'Won' THEN 1 END) as won_count,
                  COUNT(CASE WHEN "Status" = 'Lost' THEN 1 END) as lost_count,
                  COUNT(CASE WHEN "Status" IN ('Won', 'Lost') THEN 1 END) as closed_count,
                  ROUND((COUNT(CASE WHEN "Status" = 'Won' THEN 1 END)::numeric / 
                         NULLIF(COUNT(CASE WHEN "Status" IN ('Won', 'Lost') THEN 1 END), 0) * 100)::numeric, 2) as win_rate
                FROM "Sample"
                WHERE "Start Date" > '2000-01-01'
                {additional_filters}
                GROUP BY year, quarter
              ),
              with_lag AS (
                SELECT 
                  period,
                  year,
                  quarter,
                  won_count,
                  lost_count,
                  closed_count,
                  win_rate,
                  LAG(win_rate) OVER (ORDER BY year, quarter) as prev_win_rate
                FROM quarterly_conversions
              )
              SELECT 
                period,
                won_count,
                lost_count,
                closed_count,
                win_rate,
                prev_win_rate,
                ROUND((win_rate - prev_win_rate)::numeric, 2) as win_rate_change
              FROM with_lag
              ORDER BY year DESC, quarter DESC
              {limit_clause}`,
        params: [],
        param_types: [],
        optional_params: ["start_date", "end_date", "company", "state_code", "categories", "limit"],
        chart_type: "line",
        chart_field: "win_rate",
      },

      get_deal_cycle_analysis: {
        sql: `WITH sized_deals AS (
                SELECT 
                  CASE 
                    WHEN CAST(NULLIF("Fee", '') AS NUMERIC) < 50000 THEN 'Small (<50K)'
                    WHEN CAST(NULLIF("Fee", '') AS NUMERIC) < 200000 THEN 'Medium (50-200K)'
                    WHEN CAST(NULLIF("Fee", '') AS NUMERIC) < 500000 THEN 'Large (200-500K)'
                    ELSE 'Mega (500K+)'
                  END as deal_size,
                  "Request Category" as category,
                  COUNT(*) as project_count,
                  AVG(EXTRACT(DAYS FROM (CURRENT_DATE - "Start Date"))) as avg_cycle_days,
                  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(DAYS FROM (CURRENT_DATE - "Start Date"))) as median_cycle_days
                FROM "Sample"
                WHERE "Fee" IS NOT NULL AND "Fee" != ''
                AND CAST(NULLIF("Fee", '') AS NUMERIC) > 0
                AND "Status" IN ('Won', 'Lost')
                {additional_filters}
                GROUP BY deal_size, category
              )
              SELECT * FROM sized_deals
              ORDER BY 
                CASE deal_size
                  WHEN 'Mega (500K+)' THEN 1
                  WHEN 'Large (200-500K)' THEN 2
                  WHEN 'Medium (50-200K)' THEN 3
                  ELSE 4
                END,
                category`,
        params: [],
        param_types: [],
        optional_params: ["start_date", "end_date", "company", "state_code"],
        chart_type: "bar",
        chart_field: "avg_cycle_days",
      },

      get_pipeline_coverage: {
        sql: `WITH pipeline_stats AS (
                SELECT 
                  COUNT(*) as total_opportunities,
                  COUNT(CASE WHEN "Status" NOT IN ('Won', 'Lost') THEN 1 END) as open_opportunities,
                  SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_pipeline_value,
                  SUM(CASE WHEN "Status" NOT IN ('Won', 'Lost') 
                      THEN CAST(NULLIF("Fee", '') AS NUMERIC) * CAST(NULLIF("Win %", '') AS NUMERIC) / 100 
                      END) as weighted_pipeline_value,
                  AVG(CAST(NULLIF("Win %", '') AS NUMERIC)) as avg_win_probability
                FROM "Sample"
                WHERE "Start Date" > '2000-01-01'
                {additional_filters}
              )
              SELECT 
                total_opportunities,
                open_opportunities,
                total_pipeline_value,
                weighted_pipeline_value,
                avg_win_probability,
                ROUND((open_opportunities::numeric / NULLIF(total_opportunities, 0) * 100)::numeric, 2) as pct_still_open
              FROM pipeline_stats`,
        params: [],
        param_types: [],
        optional_params: ["start_date", "end_date", "company", "state_code", "categories"],
        chart_type: "bar",
        chart_field: "weighted_pipeline_value",
      },

      get_pipeline_quality: {
        sql: `WITH tiered_pipeline AS (
                SELECT 
                  CASE 
                    WHEN CAST(NULLIF("Win %", '') AS NUMERIC) >= 70 THEN 'High Probability (70%+)'
                    WHEN CAST(NULLIF("Win %", '') AS NUMERIC) >= 40 THEN 'Medium Probability (40-70%)'
                    ELSE 'Low Probability (<40%)'
                  END as probability_tier,
                  COUNT(*) as opportunity_count,
                  SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_value,
                  AVG(CAST(NULLIF("Fee", '') AS NUMERIC)) as avg_deal_size,
                  SUM(CAST(NULLIF("Fee", '') AS NUMERIC) * CAST(NULLIF("Win %", '') AS NUMERIC) / 100) as weighted_value
                FROM "Sample"
                WHERE "Status" NOT IN ('Won', 'Lost')
                AND "Win %" IS NOT NULL AND "Win %" != ''
                {additional_filters}
                GROUP BY probability_tier
              )
              SELECT * FROM tiered_pipeline
              ORDER BY 
                CASE probability_tier
                  WHEN 'High Probability (70%+)' THEN 1
                  WHEN 'Medium Probability (40-70%)' THEN 2
                  ELSE 3
                END`,
        params: [],
        param_types: [],
        optional_params: ["start_date", "end_date", "company", "state_code", "categories"],
        chart_type: "pie",
        chart_field: "opportunity_count",
      },

      // ═══════════════════════════════════════════════════════════════
      // PHASE 3: CLIENT INTELLIGENCE & PHASE 4: RISK/PERFORMANCE
      // ═══════════════════════════════════════════════════════════════

      get_clients_by_value_tier: {
        sql: `WITH client_stats AS (
                SELECT 
                  "Client",
                  COUNT(*) as project_count,
                  SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_value,
                  AVG(CAST(NULLIF("Fee", '') AS NUMERIC)) as avg_project_value,
                  MAX("Start Date") as latest_project
                FROM "Sample"
                WHERE "Client" IS NOT NULL AND "Client" != ''
                {additional_filters}
                GROUP BY "Client"
              )
              SELECT 
                "Client",
                project_count,
                total_value,
                avg_project_value,
                latest_project,
                CASE 
                  WHEN total_value >= 1000000 THEN 'Platinum (1M+)'
                  WHEN total_value >= 500000 THEN 'Gold (500K-1M)'
                  WHEN total_value >= 100000 THEN 'Silver (100K-500K)'
                  ELSE 'Bronze (<100K)'
                END as client_tier
              FROM client_stats
              ORDER BY total_value DESC
              {limit_clause}`,
        params: [],
        param_types: [],
        optional_params: ["start_date", "end_date", "company", "state_code", "limit"],
        chart_type: "bar",
        chart_field: "total_value",
      },

      get_client_retention_rate: {
        sql: `WITH client_years AS (
                SELECT 
                  "Client",
                  COUNT(DISTINCT EXTRACT(YEAR FROM "Start Date")) as years_active,
                  MIN(EXTRACT(YEAR FROM "Start Date")) as first_year,
                  MAX(EXTRACT(YEAR FROM "Start Date")) as last_year,
                  COUNT(*) as total_projects
                FROM "Sample"
                WHERE "Client" IS NOT NULL AND "Client" != ''
                AND "Start Date" > '2000-01-01'
                GROUP BY "Client"
              ),
              categorized AS (
                SELECT 
                  CASE 
                    WHEN years_active = 1 THEN 'One-Time Client'
                    WHEN years_active >= 5 THEN 'Long-Term (5+ years)'
                    WHEN years_active >= 3 THEN 'Established (3-4 years)'
                    ELSE 'Repeat (2 years)'
                  END as retention_category,
                  COUNT(*) as client_count,
                  SUM(total_projects) as total_projects,
                  ROUND(AVG(total_projects)::numeric, 2) as avg_projects_per_client
                FROM client_years
                GROUP BY retention_category
              )
              SELECT * FROM categorized
              ORDER BY 
                CASE retention_category
                  WHEN 'Long-Term (5+ years)' THEN 1
                  WHEN 'Established (3-4 years)' THEN 2
                  WHEN 'Repeat (2 years)' THEN 3
                  ELSE 4
                END`,
        params: [],
        param_types: [],
        chart_type: "pie",
        chart_field: "client_count",
      },

      get_dormant_clients: {
        sql: `WITH client_last_activity AS (
                SELECT 
                  "Client",
                  MAX("Start Date") as last_project_date,
                  EXTRACT(DAYS FROM (CURRENT_DATE - MAX("Start Date"))) as days_since_last_project,
                  COUNT(*) as total_projects,
                  SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as lifetime_value
                FROM "Sample"
                WHERE "Client" IS NOT NULL AND "Client" != ''
                GROUP BY "Client"
              )
              SELECT 
                "Client",
                last_project_date,
                days_since_last_project,
                total_projects,
                lifetime_value,
                CASE 
                  WHEN days_since_last_project > 730 THEN 'Dormant (2+ years)'
                  WHEN days_since_last_project > 365 THEN 'At Risk (1-2 years)'
                  ELSE 'Recent (<1 year)'
                END as client_status
              FROM client_last_activity
              WHERE days_since_last_project > 365
              ORDER BY lifetime_value DESC
              {limit_clause}`,
        params: [],
        param_types: [],
        optional_params: ["limit"],
        chart_type: "bar",
        chart_field: "lifetime_value",
      },

      get_at_risk_clients: {
        sql: `WITH client_trends AS (
                SELECT 
                  "Client",
                  COUNT(*) as total_projects,
                  SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as lifetime_value,
                  MAX("Start Date") as last_project,
                  EXTRACT(DAYS FROM (CURRENT_DATE - MAX("Start Date"))) as days_inactive,
                  COUNT(CASE WHEN "Start Date" >= CURRENT_DATE - INTERVAL '365 days' THEN 1 END) as projects_last_year,
                  COUNT(CASE WHEN "Start Date" >= CURRENT_DATE - INTERVAL '730 days' AND "Start Date" < CURRENT_DATE - INTERVAL '365 days' THEN 1 END) as projects_prior_year
                FROM "Sample"
                WHERE "Client" IS NOT NULL AND "Client" != ''
                GROUP BY "Client"
                HAVING COUNT(*) > 1
              ),
              risk_assessed AS (
                SELECT 
                  "Client",
                  total_projects,
                  lifetime_value,
                  last_project,
                  days_inactive,
                  projects_last_year,
                  projects_prior_year,
                  CASE 
                    WHEN projects_last_year < projects_prior_year AND days_inactive > 180 THEN 'High Risk'
                    WHEN projects_last_year < projects_prior_year THEN 'Medium Risk'
                    WHEN days_inactive > 365 THEN 'Medium Risk'
                    ELSE 'Low Risk'
                  END as risk_level
                FROM client_trends
                WHERE projects_last_year < projects_prior_year OR days_inactive > 180
              )
              SELECT * FROM risk_assessed
              ORDER BY 
                CASE risk_level
                  WHEN 'High Risk' THEN 1
                  WHEN 'Medium Risk' THEN 2
                  ELSE 3
                END,
                lifetime_value DESC
              {limit_clause}`,
        params: [],
        param_types: [],
        optional_params: ["limit"],
        chart_type: "bar",
        chart_field: "lifetime_value",
      },

      get_client_expansion_opportunities: {
        sql: `WITH client_categories AS (
                SELECT 
                  "Client",
                  array_agg(DISTINCT "Request Category") as categories_purchased,
                  COUNT(DISTINCT "Request Category") as category_count,
                  SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_value,
                  COUNT(*) as project_count
                FROM "Sample"
                WHERE "Client" IS NOT NULL AND "Client" != ''
                AND "Request Category" IS NOT NULL
                GROUP BY "Client"
                HAVING COUNT(DISTINCT "Request Category") < 3
              )
              SELECT 
                "Client",
                category_count,
                categories_purchased,
                total_value,
                project_count,
                CASE 
                  WHEN category_count = 1 THEN 'High Expansion Potential'
                  WHEN category_count = 2 THEN 'Medium Expansion Potential'
                  ELSE 'Low Expansion Potential'
                END as expansion_opportunity
              FROM client_categories
              ORDER BY total_value DESC
              {limit_clause}`,
        params: [],
        param_types: [],
        optional_params: ["limit"],
        chart_type: "bar",
        chart_field: "total_value",
      },

      get_portfolio_diversity: {
        sql: `WITH concentration_metrics AS (
                SELECT 
                  COUNT(DISTINCT "Client") as total_clients,
                  COUNT(DISTINCT "State Lookup") as total_states,
                  COUNT(DISTINCT "Request Category") as total_categories,
                  COUNT(DISTINCT "Company") as total_companies,
                  SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_revenue
                FROM "Sample"
                WHERE "Start Date" > '2000-01-01'
                {additional_filters}
              ),
              top_clients AS (
                SELECT 
                  SUM(client_value) as top_10_client_revenue
                FROM (
                  SELECT 
                    SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as client_value
                  FROM "Sample"
                  WHERE "Client" IS NOT NULL
                  GROUP BY "Client"
                  ORDER BY client_value DESC
                  LIMIT 10
                ) top_10
              )
              SELECT 
                c.total_clients,
                c.total_states,
                c.total_categories,
                c.total_companies,
                c.total_revenue,
                t.top_10_client_revenue,
                ROUND((t.top_10_client_revenue / NULLIF(c.total_revenue, 0) * 100)::numeric, 2) as top_10_concentration_pct
              FROM concentration_metrics c, top_clients t`,
        params: [],
        param_types: [],
        optional_params: ["start_date", "end_date", "company", "state_code"],
        chart_type: "bar",
        chart_field: "total_revenue",
      },

      get_client_concentration: {
        sql: `WITH ranked_clients AS (
                SELECT 
                  "Client",
                  SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as client_revenue,
                  COUNT(*) as project_count,
                  SUM(SUM(CAST(NULLIF("Fee", '') AS NUMERIC))) OVER () as total_revenue,
                  ROW_NUMBER() OVER (ORDER BY SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) DESC) as revenue_rank
                FROM "Sample"
                WHERE "Client" IS NOT NULL AND "Client" != ''
                {additional_filters}
                GROUP BY "Client"
              )
              SELECT 
                revenue_rank,
                "Client",
                client_revenue,
                project_count,
                ROUND((client_revenue / NULLIF(total_revenue, 0) * 100)::numeric, 2) as pct_of_total_revenue,
                SUM(client_revenue) OVER (ORDER BY revenue_rank) as cumulative_revenue,
                ROUND((SUM(client_revenue) OVER (ORDER BY revenue_rank) / NULLIF(total_revenue, 0) * 100)::numeric, 2) as cumulative_pct
              FROM ranked_clients
              WHERE revenue_rank <= 20
              ORDER BY revenue_rank`,
        params: [],
        param_types: [],
        optional_params: ["start_date", "end_date", "company", "state_code"],
        chart_type: "bar",
        chart_field: "client_revenue",
      },

      get_declining_win_rates: {
        sql: `WITH quarterly_win_rates AS (
                SELECT 
                  EXTRACT(YEAR FROM "Start Date") as year,
                  EXTRACT(QUARTER FROM "Start Date") as quarter,
                  CONCAT('Q', EXTRACT(QUARTER FROM "Start Date"), ' ', EXTRACT(YEAR FROM "Start Date")) as period,
                  ROUND((COUNT(CASE WHEN "Status" = 'Won' THEN 1 END)::numeric / 
                         NULLIF(COUNT(CASE WHEN "Status" IN ('Won', 'Lost') THEN 1 END), 0) * 100)::numeric, 2) as win_rate,
                  COUNT(CASE WHEN "Status" IN ('Won', 'Lost') THEN 1 END) as closed_deals
                FROM "Sample"
                WHERE "Start Date" > '2000-01-01'
                {additional_filters}
                GROUP BY year, quarter
                HAVING COUNT(CASE WHEN "Status" IN ('Won', 'Lost') THEN 1 END) >= 3
              ),
              with_lag AS (
                SELECT 
                  period,
                  year,
                  quarter,
                  win_rate,
                  closed_deals,
                  LAG(win_rate) OVER (ORDER BY year, quarter) as prev_win_rate,
                  LAG(win_rate, 2) OVER (ORDER BY year, quarter) as two_quarters_ago_win_rate
                FROM quarterly_win_rates
              )
              SELECT 
                period,
                win_rate,
                prev_win_rate,
                closed_deals,
                ROUND((win_rate - prev_win_rate)::numeric, 2) as win_rate_change
              FROM with_lag
              WHERE win_rate < prev_win_rate 
              AND prev_win_rate < two_quarters_ago_win_rate
              ORDER BY year DESC, quarter DESC
              {limit_clause}`,
        params: [],
        param_types: [],
        optional_params: ["start_date", "end_date", "company", "state_code", "categories", "limit"],
        chart_type: "line",
        chart_field: "win_rate",
      },

      get_underperforming_segments: {
        sql: `WITH segment_performance AS (
                SELECT 
                  $1 as dimension,
                  CASE 
                    WHEN $1 = 'category' THEN "Request Category"
                    WHEN $1 = 'state' THEN "State Lookup"
                    WHEN $1 = 'company' THEN "Company"
                  END as segment_name,
                  COUNT(*) as project_count,
                  SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_value,
                  AVG(CAST(NULLIF("Fee", '') AS NUMERIC)) as avg_project_value,
                  ROUND((COUNT(CASE WHEN "Status" = 'Won' THEN 1 END)::numeric / 
                         NULLIF(COUNT(CASE WHEN "Status" IN ('Won', 'Lost') THEN 1 END), 0) * 100)::numeric, 2) as win_rate
                FROM "Sample"
                WHERE CASE 
                  WHEN $1 = 'category' THEN "Request Category" IS NOT NULL
                  WHEN $1 = 'state' THEN "State Lookup" IS NOT NULL
                  WHEN $1 = 'company' THEN "Company" IS NOT NULL
                END
                {additional_filters}
                GROUP BY segment_name
                HAVING COUNT(*) >= 5
              ),
              averages AS (
                SELECT 
                  AVG(avg_project_value) as overall_avg_value,
                  AVG(win_rate) as overall_avg_win_rate
                FROM segment_performance
              )
              SELECT 
                s.segment_name,
                s.project_count,
                s.total_value,
                s.avg_project_value,
                s.win_rate,
                a.overall_avg_value,
                a.overall_avg_win_rate,
                ROUND(((s.avg_project_value - a.overall_avg_value) / NULLIF(a.overall_avg_value, 0) * 100)::numeric, 2) as pct_below_avg_value,
                ROUND((s.win_rate - a.overall_avg_win_rate)::numeric, 2) as pct_below_avg_win_rate
              FROM segment_performance s, averages a
              WHERE s.avg_project_value < a.overall_avg_value 
              OR s.win_rate < a.overall_avg_win_rate
              ORDER BY s.total_value ASC
              {limit_clause}`,
        params: ["dimension"],
        param_types: ["str"],
        optional_params: ["start_date", "end_date", "company", "state_code", "limit"],
        chart_type: "bar",
        chart_field: "total_value",
      },

      get_stalled_deals: {
        sql: `SELECT 
              "Project Name",
              "Client",
              "State Lookup" as state,
              "Request Category" as category,
              "Status",
              "Start Date",
              CAST(NULLIF("Fee", '') AS NUMERIC) as fee,
              CAST(NULLIF("Win %", '') AS NUMERIC) as win_probability,
              EXTRACT(DAYS FROM (CURRENT_DATE - "Start Date")) as days_in_pipeline,
              "Point Of Contact" as poc
              FROM "Sample"
              WHERE "Status" NOT IN ('Won', 'Lost')
              AND EXTRACT(DAYS FROM (CURRENT_DATE - "Start Date")) > $1
              AND "Fee" IS NOT NULL
              {additional_filters}
              ORDER BY EXTRACT(DAYS FROM (CURRENT_DATE - "Start Date")) DESC
              {limit_clause}`,
        params: ["min_days_stalled"],
        param_types: ["int"],
        optional_params: ["company", "state_code", "categories", "limit"],
        chart_type: "bar",
        chart_field: "fee",
      },
    };
  }

  private initializeFunctionDefinitions(): FunctionDefinition[] {
    return [
      // Combined filters - most flexible
      {
        name: "get_projects_by_combined_filters",
        description:
          "Get projects matching MULTIPLE filters simultaneously. Use for complex queries with size, tags, status, dates, etc. DO NOT use for ranking/sorting queries like 'top by win rate' or 'sorted by fee' - use specific ranking functions instead. Use 'tags' parameter ONLY when user explicitly mentions 'tags' or 'tagged'. For general keywords without 'tags' mention, use get_projects_by_category instead. For CLID (Client ID), use 'client' field, NOT 'company'. DO NOT use this for person names - use get_projects_by_poc instead.",
        parameters: {
          type: "object",
          properties: {
            size: {
              type: "string",
              description: "Size category: Micro, Small, Medium, Large, Mega",
            },
            categories: {
              type: "array",
              items: { type: "string" },
              description: "Request Category values (use single category with get_projects_by_category instead)",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Keywords/tags ONLY when user explicitly says 'tags' or 'tagged' (e.g., 'show tags: Rail, Transit'). For general category queries without 'tags' keyword, use get_projects_by_category instead.",
            },
            status: { type: "string", description: "Project status" },
            client: { type: "string", description: "Client name or CLID (e.g., 'CLID 1573'). Use this for Client IDs, NOT company." },
            company: { type: "string", description: "Company/OPCO operating company name (NOT for CLID)" },
            state_code: { type: "string", description: "State lookup code" },
            min_fee: { type: "number", description: "Minimum fee amount" },
            max_fee: { type: "number", description: "Maximum fee amount" },
            min_win: { type: "integer", description: "Minimum win percentage" },
            max_win: { type: "integer", description: "Maximum win percentage" },
            time_reference: {
              type: "string",
              description:
                "Natural language time reference. Extract EXACT user phrase: 'next ten months', 'last 6 months', 'Q1 2026', 'soon', etc.",
            },
            limit: { type: "integer", description: "Result limit" },
          },
          required: [],
        },
      },

      // Rankings
      {
        name: "get_largest_projects",
        description: "Get largest/highest/biggest/top projects by fee",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "integer" },
            time_reference: { type: "string" },
          },
          required: [],
        },
      },

      {
        name: "get_smallest_projects",
        description: "Get smallest/lowest projects by fee",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "integer" },
            time_reference: { type: "string" },
          },
          required: [],
        },
      },

      {
        name: "get_largest_in_region",
        description: "Get largest pursuits in specific region/state",
        parameters: {
          type: "object",
          properties: {
            state_code: { type: "string" },
            limit: { type: "integer" },
          },
          required: ["state_code"],
        },
      },

      {
        name: "get_largest_by_category",
        description:
          "Get largest projects in REQUEST CATEGORY field. DO NOT use if user explicitly mentions 'tags'.",
        parameters: {
          type: "object",
          properties: {
            category: { type: "string" },
            limit: { type: "integer" },
          },
          required: ["category"],
        },
      },

      // Category/Type
      {
        name: "get_projects_by_category",
        description: "Get projects by Request Category field. Use for project categories like 'Transportation', 'Healthcare', 'Corporate', 'Education', etc. Use this function when user asks for category/type WITHOUT the word 'tags'. If user explicitly mentions 'tags', use get_projects_by_combined_filters instead.",
        parameters: {
          type: "object",
          properties: {
            category: { type: "string", description: "Request Category value (e.g., 'Transportation', 'Healthcare', 'Corporate')" },
          },
          required: ["category"],
        },
      },

      {
        name: "get_projects_by_project_type",
        description: "Get projects by project type",
        parameters: {
          type: "object",
          properties: {
            project_type: { type: "string" },
          },
          required: ["project_type"],
        },
      },

      {
        name: "get_projects_by_multiple_categories",
        description: "Get projects in multiple categories",
        parameters: {
          type: "object",
          properties: {
            categories: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["categories"],
        },
      },

      // Tags
      {
        name: "get_largest_by_tags",
        description:
          "Get largest/top/biggest projects with specific TAGS. Use when user explicitly mentions 'tags'.",
        parameters: {
          type: "object",
          properties: {
            tag: { type: "string" },
            limit: { type: "integer" },
          },
          required: ["tag"],
        },
      },

      {
        name: "get_projects_by_status_and_win_rate",
        description:
          "Get projects by specific status combined with win percentage threshold. Use when user asks for BOTH status AND win rate.",
        parameters: {
          type: "object",
          properties: {
            status: { type: "string" },
            min_win: { type: "integer" },
          },
          required: ["status", "min_win"],
        },
      },

      {
        name: "get_projects_by_multiple_tags",
        description:
          "Get projects that match ANY of the specified tags (OR logic). Use when user asks for projects with specific tags like 'projects with tag Expansion and Emergency', 'Rail and Transit tags', 'tagged Healthcare or Medical', or lists multiple tags with 'and'/commas.",
        parameters: {
          type: "object",
          properties: {
            tags: {
              type: "array",
              items: { type: "string" },
              description: "List of tags. Projects matching ANY tag will be returned (OR logic). Extract each tag name from the query.",
            },
          },
          required: ["tags"],
        },
      },

      {
        name: "get_projects_by_tags",
        description:
          "Get ALL projects with specific tags. Use when user asks for 'projects with X tag' without mentioning 'largest'.",
        parameters: {
          type: "object",
          properties: {
            tag: { type: "string" },
          },
          required: ["tag"],
        },
      },

      {
        name: "get_top_tags",
        description: "Get most frequently used tags across all projects, ranked by total value or count. Use for queries like 'show top 5 tags', 'most common tags', 'tag frequency', 'which tags are used most', or 'popular tags'.",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Number of tags to return (default 10)" },
          },
          required: [],
        },
      },

      // Company/OPCO
      {
        name: "get_projects_by_company",
        description: "Get projects by company/OPCO",
        parameters: {
          type: "object",
          properties: {
            company: { type: "string" },
          },
          required: ["company"],
        },
      },

      {
        name: "compare_companies",
        description: "Compare all companies by revenue, count, win rate",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },

      {
        name: "compare_opco_revenue",
        description: "Compare predicted revenue between specific OPCOs/companies",
        parameters: {
          type: "object",
          properties: {
            companies: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["companies"],
        },
      },

      // Client
      {
        name: "get_projects_by_client",
        description: "Get all projects for specific CLIENT ID (CLID). Use for client ID numbers like 'CLID 4885', '5057', etc. DO NOT use for person names like 'Amy Wincko' - use get_projects_by_poc for person names instead.",
        parameters: {
          type: "object",
          properties: {
            client: { type: "string", description: "Client ID number or CLID (e.g., '4885', 'CLID 5057'). NOT for person names." },
          },
          required: ["client"],
        },
      },

      {
        name: "get_projects_by_client_and_fee_range",
        description: "Get projects for CLIENT ID (CLID) within fee range. Use for client IDs like 'CLID 4885', '5057', etc. DO NOT use for person names - use get_projects_by_poc for person names.",
        parameters: {
          type: "object",
          properties: {
            client: { type: "string", description: "Client ID number or CLID (e.g., '4885', 'CLID 5057'). NOT for person names." },
            min_fee: { type: "number" },
            max_fee: { type: "number" },
          },
          required: ["client", "min_fee", "max_fee"],
        },
      },

      // Status
      {
        name: "get_projects_by_status",
        description: "Get projects by status",
        parameters: {
          type: "object",
          properties: {
            status: { type: "string" },
          },
          required: ["status"],
        },
      },

      {
        name: "get_status_breakdown",
        description: "Get breakdown of all projects by status",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },

      {
        name: "get_overoptimistic_losses",
        description:
          "Get LOST projects where win percentage was above 70%. ONLY use when user specifically asks about 'overoptimistic losses'.",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },

      {
        name: "get_top_predicted_wins",
        description: "Get top N projects predicted to win",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "integer" },
          },
          required: ["limit"],
        },
      },

      // Win Rate
      {
        name: "get_project_win_rate",
        description: "Get win rate for specific project",
        parameters: {
          type: "object",
          properties: {
            project_name: { type: "string" },
          },
          required: ["project_name"],
        },
      },

      {
        name: "get_projects_by_win_range",
        description: "Get projects with win percentage in range",
        parameters: {
          type: "object",
          properties: {
            min_win: { type: "integer" },
            max_win: { type: "integer" },
          },
          required: ["min_win", "max_win"],
        },
      },

      {
        name: "get_projects_by_category_and_win_range",
        description: "Get projects in specific category with win percentage above threshold. Use when user asks for category AND win rate together.",
        parameters: {
          type: "object",
          properties: {
            category: { type: "string" },
            min_win: { type: "integer" },
            max_win: { type: "integer", description: "Optional maximum win percentage" },
          },
          required: ["category", "min_win"],
        },
      },

      {
        name: "get_projects_by_client_status_win_range",
        description: "Get projects for specific CLIENT or CLID (Client ID) with status and win percentage range. Use when user asks for CLID (like 'CLID 1573'), status, AND win rate range. Use 'client' parameter for CLID.",
        parameters: {
          type: "object",
          properties: {
            client: { type: "string", description: "Client name or CLID (e.g., 'CLID 1573')" },
            status: { type: "string" },
            min_win: { type: "integer" },
            max_win: { type: "integer" },
          },
          required: ["client", "status", "min_win", "max_win"],
        },
      },

      {
        name: "get_clients_by_highest_win_rate",
        description: "Get clients ranked by their average win rate across upcoming projects. Use when user asks 'which clients have highest win rate' or 'clients by win probability'.",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },

      {
        name: "get_top_projects_by_win_rate",
        description: "RANKING/SORTING QUERY: Get projects RANKED/SORTED BY win percentage/win rate from highest to lowest. ALWAYS use this when user asks to 'list', 'show', 'top', 'rank', or 'sort' projects BY win percentage/rate. Examples: 'list top 20 projects by win percentage', 'show highest win rate projects', 'projects sorted by win %', 'rank by win rate', 'best win percentage', 'top 10 by win rate'.",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Number of results to return (default 20)" },
          },
          required: [],
        },
      },

      {
        name: "get_clients_by_status_count",
        description: "Get clients ranked by number of projects with a specific status. Use for queries like 'which clients lost most projects', 'clients with most won projects', 'clients by number of losses/wins', or 'clients ranked by status count'.",
        parameters: {
          type: "object",
          properties: {
            status: { type: "string", description: "Project status: 'Lost', 'Won', 'Submitted', etc." },
            limit: { type: "integer", description: "Number of clients to return (default 20)" },
          },
          required: ["status"],
        },
      },

      // Region
      {
        name: "get_projects_by_state",
        description: "Get projects in specific state/region",
        parameters: {
          type: "object",
          properties: {
            state_code: { type: "string" },
          },
          required: ["state_code"],
        },
      },

      // Fee/Size
      {
        name: "get_projects_by_fee_range",
        description: "Get projects within fee range",
        parameters: {
          type: "object",
          properties: {
            min_fee: { type: "number" },
            max_fee: { type: "number" },
          },
          required: ["min_fee"],
        },
      },

      {
        name: "get_projects_by_size",
        description:
          "Get projects by DYNAMIC size category calculated from percentiles. Size: 'Micro', 'Small', 'Medium', 'Large', or 'Mega'.",
        parameters: {
          type: "object",
          properties: {
            size: {
              type: "string",
              description: "Size category: 'Micro', 'Small', 'Medium', 'Large', or 'Mega'",
            },
          },
          required: ["size"],
        },
      },

      {
        name: "get_size_distribution",
        description:
          "Get distribution of projects by DYNAMIC size tiers calculated from actual fee percentiles.",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },

      // Revenue Aggregation
      {
        name: "get_revenue_by_category",
        description:
          "Get total revenue aggregated by category. Use when user asks 'total revenue in X', 'value of X projects'.",
        parameters: {
          type: "object",
          properties: {
            category: { type: "string" },
            status: { type: "string", description: "Optional: filter by status" },
          },
          required: ["category"],
        },
      },

      // What-If Projections
      {
        name: "get_weighted_revenue_projection",
        description:
          "Get weighted revenue projections based on win probability. Use for 'what if', 'predicted revenue', 'expected value'.",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },

      // Year Comparisons
      {
        name: "compare_years",
        description: "Compare two specific years side-by-side. Use for 'compare 2025 vs 2026', 'year over year'.",
        parameters: {
          type: "object",
          properties: {
            year1: { type: "integer" },
            year2: { type: "integer" },
          },
          required: ["year1", "year2"],
        },
      },

      // POC (Point of Contact)
      {
        name: "get_top_pocs",
        description: "Get top performing project managers/POCs by total value, project count, or win rate. Use for questions like 'best POCs', 'top project managers', 'who handles most projects'.",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Number of POCs to return" },
          },
          required: [],
        },
      },

      {
        name: "get_projects_by_poc",
        description: "Get all projects managed by specific Point of Contact/POC/project manager - USE FOR PERSON NAMES ONLY. Examples: 'Amy Wincko', 'Michael Luciani', 'John Smith'. When user says 'projects with Amy Wincko' or 'Amy Wincko projects' or 'Amy Wincko projects with fee between X and Y', use THIS function, NOT get_projects_by_client. Supports optional filters like fee ranges, dates, status, etc. DO NOT use for client IDs or company names.",
        parameters: {
          type: "object",
          properties: {
            poc: { type: "string", description: "Person's full name (first and last name, e.g., 'Amy Wincko'). NOT for CLID or numbers." },
            min_fee: { type: "number", description: "Minimum fee amount (optional)" },
            max_fee: { type: "number", description: "Maximum fee amount (optional)" },
            size: { type: "string", description: "Size filter (optional)" },
            status: { type: "string", description: "Status filter (optional)" },
            start_date: { type: "string", description: "Start date filter (optional)" },
            end_date: { type: "string", description: "End date filter (optional)" },
          },
          required: ["poc"],
        },
      },

      {
        name: "compare_pocs",
        description: "Compare performance metrics between two Points of Contact/POCs/project managers. Use when user wants to compare two people, their performance, projects, or results. Returns aggregated metrics for both POCs.",
        parameters: {
          type: "object",
          properties: {
            poc1: { type: "string", description: "Name of the first Point of Contact/POC" },
            poc2: { type: "string", description: "Name of the second Point of Contact/POC" },
          },
          required: ["poc1", "poc2"],
        },
      },

      {
        name: "get_projects_with_same_attribute",
        description: "Find all projects that share the same attribute value as a reference project. Use when user asks 'same X as PID Y' or 'projects with same X as project Y'. Examples: 'same point of contact as PID 7', 'same category as project 123', 'same client as PID 456'. This function looks up the reference project first, then finds all projects matching that attribute.",
        parameters: {
          type: "object",
          properties: {
            reference_pid: { type: "string", description: "The Project ID (PID) or project name to use as reference" },
            attribute: { type: "string", enum: ["poc", "category", "client", "status", "company"], description: "Which attribute to match: 'poc' for Point of Contact, 'category' for Category, 'client' for Client ID, 'status' for Status, 'company' for Company" },
            min_fee: { type: "number", description: "Minimum fee filter (optional)" },
            max_fee: { type: "number", description: "Maximum fee filter (optional)" },
            start_date: { type: "string", description: "Start date filter (optional)" },
            end_date: { type: "string", description: "End date filter (optional)" },
          },
          required: ["reference_pid", "attribute"],
        },
      },

      // Description Search
      {
        name: "search_description",
        description: "Search for projects by keyword in project description. Use when user wants to find projects 'mentioning', 'containing', 'about', or 'describing' specific topics.",
        parameters: {
          type: "object",
          properties: {
            keyword: { type: "string", description: "Keyword or phrase to search for in descriptions" },
          },
          required: ["keyword"],
        },
      },

      // Month-based Queries
      {
        name: "get_projects_by_month",
        description: "Get projects starting in specific month. Use when user asks for 'January projects', 'March 2024', etc.",
        parameters: {
          type: "object",
          properties: {
            year: { type: "integer", description: "Year (e.g., 2024)" },
            month: { type: "integer", description: "Month number 1-12 (1=Jan, 12=Dec)" },
          },
          required: ["year", "month"],
        },
      },

      {
        name: "get_revenue_by_month",
        description: "Get monthly revenue breakdown for a specific year. Use for 'monthly revenue', 'revenue by month', 'monthly trends'.",
        parameters: {
          type: "object",
          properties: {
            year: { type: "integer", description: "Year to analyze" },
          },
          required: ["year"],
        },
      },

      // Trend Analysis
      {
        name: "get_yoy_growth",
        description: "Calculate year-over-year growth between two years. Use for 'YoY growth', 'compare 2023 vs 2024', 'year over year'.",
        parameters: {
          type: "object",
          properties: {
            year1: { type: "integer", description: "First year (earlier)" },
            year2: { type: "integer", description: "Second year (later)" },
          },
          required: ["year1", "year2"],
        },
      },

      // Regional Analysis
      {
        name: "get_revenue_by_state",
        description: "Get revenue breakdown by state/region. Use for 'revenue by state', 'regional performance', 'market share by geography'.",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Number of states to return" },
          },
          required: [],
        },
      },

      // Client Analysis
      {
        name: "get_repeat_clients",
        description: "Get clients with multiple projects (repeat customers). Use for 'repeat clients', 'returning customers', 'client loyalty'.",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Number of clients to return" },
          },
          required: [],
        },
      },

      // Risk Analysis
      {
        name: "get_high_risk_opportunities",
        description: "Find high-value projects with low win rates (risky opportunities). Use for 'high risk', 'risky projects', 'low confidence high value'.",
        parameters: {
          type: "object",
          properties: {
            min_fee: { type: "number", description: "Minimum project value to consider" },
            max_win: { type: "integer", description: "Maximum win percentage (low confidence threshold)" },
            limit: { type: "integer", description: "Number of projects to return" },
          },
          required: ["min_fee", "max_win"],
        },
      },

      // Project Type Analysis
      {
        name: "get_revenue_by_project_type",
        description: "Get revenue breakdown by project type (Design, Construction, etc.). Use for 'revenue by project type', 'which types are most profitable'.",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },

      // ═══════════════════════════════════════════════════════════════
      // PHASE 1: HIGH-VALUE COMPARISONS
      // ═══════════════════════════════════════════════════════════════

      {
        name: "compare_states",
        description: "Compare performance metrics between 2 or more states. Use when user wants side-by-side state comparison. Examples: 'compare CA and TX', 'compare California, Texas, and Florida'.",
        parameters: {
          type: "object",
          properties: {
            states: {
              type: "array",
              items: { type: "string" },
              description: "List of state codes to compare (e.g., ['CA', 'TX', 'FL'])",
            },
          },
          required: ["states"],
        },
      },

      {
        name: "compare_categories",
        description: "Compare performance metrics between 2 or more request categories. Use when user wants side-by-side category comparison. Examples: 'compare Design and Construction', 'compare these categories: X, Y, Z'.",
        parameters: {
          type: "object",
          properties: {
            categories: {
              type: "array",
              items: { type: "string" },
              description: "List of categories to compare",
            },
          },
          required: ["categories"],
        },
      },

      {
        name: "compare_clients",
        description: "Compare performance metrics between 2 or more clients. Use when user wants side-by-side client comparison. Examples: 'compare Client A and Client B', 'compare CLID 1573 and CLID 3507'.",
        parameters: {
          type: "object",
          properties: {
            clients: {
              type: "array",
              items: { type: "string" },
              description: "List of clients to compare (can be client names or CLIDs)",
            },
          },
          required: ["clients"],
        },
      },

      {
        name: "compare_quarters",
        description: "Compare two specific quarters (e.g., Q1 2024 vs Q1 2023, or Q4 2024 vs Q3 2024). Use when user wants quarter-over-quarter comparison.",
        parameters: {
          type: "object",
          properties: {
            year1: { type: "integer", description: "First quarter's year" },
            quarter1: { type: "integer", description: "First quarter (1-4)" },
            year2: { type: "integer", description: "Second quarter's year" },
            quarter2: { type: "integer", description: "Second quarter (1-4)" },
          },
          required: ["year1", "quarter1", "year2", "quarter2"],
        },
      },

      {
        name: "compare_months_across_years",
        description: "Compare the same month across different years (e.g., December 2023 vs December 2024). Use when user wants month-over-month year-over-year comparison.",
        parameters: {
          type: "object",
          properties: {
            month: { type: "integer", description: "Month number (1-12)" },
            years: {
              type: "array",
              items: { type: "integer" },
              description: "List of years to compare",
            },
          },
          required: ["month", "years"],
        },
      },

      {
        name: "compare_to_average",
        description: "Compare a specific entity (company, state, category, or POC) to the overall average. Use when user asks 'how does X compare to average?', 'is X above/below average?'.",
        parameters: {
          type: "object",
          properties: {
            dimension: {
              type: "string",
              enum: ["company", "state", "category", "poc"],
              description: "What dimension to compare (company, state, category, or poc)",
            },
            value: { type: "string", description: "The specific value to compare (e.g., 'CA', 'Design', 'Michael Luciani')" },
          },
          required: ["dimension", "value"],
        },
      },

      {
        name: "rank_all_pocs",
        description: "Get complete ranking/leaderboard of all POCs by performance. Use when user asks for 'POC rankings', 'leaderboard', 'who are the top POCs', 'rank all project managers'.",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Maximum number of POCs to return (optional)" },
          },
          required: [],
        },
      },

      {
        name: "get_state_performance_ranking",
        description: "Get complete ranking of all states by performance. Use when user asks for 'state rankings', 'which states perform best', 'rank states by revenue'.",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Maximum number of states to return (optional)" },
          },
          required: [],
        },
      },

      {
        name: "get_client_lifetime_value",
        description: "Get total lifetime value of clients including first/last project dates, relationship duration. Use when user asks about 'client lifetime value', 'total value per client', 'client history'.",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Maximum number of clients to return (optional)" },
          },
          required: [],
        },
      },

      {
        name: "get_client_win_rate_by_type",
        description: "Segment clients into Enterprise/Mid-Market/Small tiers and show win rates by tier. Use when user asks about 'client segmentation', 'win rates by client size', 'enterprise vs small clients'.",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },

      {
        name: "get_poc_efficiency",
        description: "Calculate revenue per project for each POC (efficiency metric). Use when user asks about 'POC efficiency', 'revenue per project by POC', 'most efficient project managers'.",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Maximum number of POCs to return (optional)" },
          },
          required: [],
        },
      },

      {
        name: "get_poc_win_rate_trend",
        description: "Show how a specific POC's win rate has changed over time by quarter. Use when user asks about 'POC performance over time', 'is X improving?', 'POC trend analysis'.",
        parameters: {
          type: "object",
          properties: {
            poc: { type: "string", description: "Name of the Point of Contact" },
          },
          required: ["poc"],
        },
      },

      {
        name: "get_top_bottom_performers",
        description: "Identify top 5 and bottom 5 performing POCs. Use when user asks about 'best and worst performers', 'who's struggling', 'star performers and underperformers'.",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },

      {
        name: "get_category_by_state_matrix",
        description: "Multi-dimensional analysis showing how each category performs in each state. Use when user asks about 'category performance by state', 'which categories work best in which states', 'geographic category analysis'.",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Maximum number of results (optional)" },
          },
          required: [],
        },
      },

      {
        name: "get_status_by_category_matrix",
        description: "Multi-dimensional analysis showing status distribution within each category. Use when user asks about 'win rates by category', 'how each category is performing', 'category conversion rates'.",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },

      // ═══════════════════════════════════════════════════════════════
      // PHASE 2: TREND & FORECASTING
      // ═══════════════════════════════════════════════════════════════

      {
        name: "get_quarterly_trends",
        description: "Show quarterly revenue trends with quarter-over-quarter growth rates. Use when user asks about 'quarterly trends', 'QoQ growth', 'quarter performance over time'.",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Number of quarters to show (optional)" },
          },
          required: [],
        },
      },

      {
        name: "get_best_worst_quarters",
        description: "Identify the top 3 peak quarters and bottom 3 trough quarters by revenue. Use when user asks about 'best/worst quarters', 'strongest/weakest quarters', 'peak performance periods'.",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },

      {
        name: "get_monthly_momentum",
        description: "Show month-over-month trends with acceleration/deceleration indicators (Accelerating, Decelerating, Growing, Declining, Stable). Use when user asks about 'monthly momentum', 'are we accelerating?', 'monthly trends'.",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Number of months to show (optional)" },
          },
          required: [],
        },
      },

      {
        name: "get_seasonal_patterns",
        description: "Analyze seasonal patterns by showing average performance for each month across all years. Use when user asks about 'seasonality', 'which months are best', 'seasonal trends', 'Q4 spike'.",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },

      {
        name: "get_revenue_trend_by_category",
        description: "Show revenue trend over time for a specific category with growth rates. Use when user asks about 'category growth over time', 'how is Design trending', 'category performance trend'.",
        parameters: {
          type: "object",
          properties: {
            category: { type: "string", description: "Request Category to analyze" },
          },
          required: ["category"],
        },
      },

      {
        name: "get_revenue_trend_by_state",
        description: "Show revenue trend over time for a specific state with growth rates. Use when user asks about 'state growth over time', 'how is CA trending', 'geographic expansion trend'.",
        parameters: {
          type: "object",
          properties: {
            state_code: { type: "string", description: "State code to analyze (e.g., 'CA', 'TX')" },
          },
          required: ["state_code"],
        },
      },

      {
        name: "get_revenue_trend_by_client",
        description: "Show revenue trend over time for a specific client with growth indicators. Use when user asks about 'client growth over time', 'is this client growing?', 'client relationship trend'.",
        parameters: {
          type: "object",
          properties: {
            client: { type: "string", description: "Client name or CLID" },
          },
          required: ["client"],
        },
      },

      {
        name: "get_pipeline_velocity",
        description: "Calculate average time projects spend in pipeline by status. Use when user asks about 'pipeline velocity', 'deal cycle time', 'how long until close', 'time in pipeline'.",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },

      {
        name: "get_conversion_rate_trend",
        description: "Show win rate trends over time by quarter with changes. Use when user asks about 'conversion rate trends', 'is our win rate improving?', 'win rate over time'.",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Number of quarters to show (optional)" },
          },
          required: [],
        },
      },

      {
        name: "get_deal_cycle_analysis",
        description: "Analyze average deal cycle duration by deal size and category. Use when user asks about 'deal cycle by size', 'how long do large deals take?', 'cycle time analysis'.",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },

      {
        name: "get_pipeline_coverage",
        description: "Calculate total pipeline value, weighted pipeline value, and coverage metrics. Use when user asks about 'pipeline coverage', 'pipeline value', 'what's in the pipeline?'.",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },

      {
        name: "get_pipeline_quality",
        description: "Segment pipeline into High/Medium/Low probability tiers based on win percentage. Use when user asks about 'pipeline quality', 'how strong is our pipeline?', 'probability distribution'.",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },

      // ═══════════════════════════════════════════════════════════════
      // PHASE 3: CLIENT INTELLIGENCE & PHASE 4: RISK/PERFORMANCE
      // ═══════════════════════════════════════════════════════════════

      {
        name: "get_clients_by_value_tier",
        description: "Segment clients into Platinum/Gold/Silver/Bronze tiers by total value. Use when user asks about 'top clients', 'client tiers', 'client segmentation', 'VIP clients'.",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Maximum number of clients to return (optional)" },
          },
          required: [],
        },
      },

      {
        name: "get_client_retention_rate",
        description: "Analyze client retention by categorizing into Long-Term (5+ years), Established (3-4 years), Repeat (2 years), or One-Time clients. Use when user asks about 'client retention', 'how loyal are clients?', 'repeat business'.",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },

      {
        name: "get_dormant_clients",
        description: "Identify clients who haven't had projects in 1+ years but have lifetime value. Use when user asks about 'dormant clients', 'inactive clients', 'clients we lost', 'win-back opportunities'.",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Maximum number of clients to return (optional)" },
          },
          required: [],
        },
      },

      {
        name: "get_at_risk_clients",
        description: "Identify clients showing declining activity (fewer projects this year vs last year, or long inactivity). Use when user asks about 'at-risk clients', 'clients we might lose', 'declining clients'.",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Maximum number of clients to return (optional)" },
          },
          required: [],
        },
      },

      {
        name: "get_client_expansion_opportunities",
        description: "Find clients who only buy 1-2 categories (cross-sell/upsell potential). Use when user asks about 'expansion opportunities', 'cross-sell potential', 'clients who could buy more categories'.",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Maximum number of clients to return (optional)" },
          },
          required: [],
        },
      },

      {
        name: "get_portfolio_diversity",
        description: "Analyze portfolio concentration risk (how much revenue comes from top 10 clients). Use when user asks about 'concentration risk', 'portfolio diversity', 'how dependent are we on top clients?'.",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },

      {
        name: "get_client_concentration",
        description: "Show top 20 clients with revenue concentration and cumulative percentages (Pareto analysis). Use when user asks about 'client concentration', 'top 20 clients', '80/20 analysis', 'revenue distribution'.",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },

      {
        name: "get_declining_win_rates",
        description: "Identify quarters where win rate has declined for 2+ consecutive quarters (early warning signal). Use when user asks about 'declining win rates', 'is our win rate dropping?', 'performance alerts'.",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Number of declining periods to show (optional)" },
          },
          required: [],
        },
      },

      {
        name: "get_underperforming_segments",
        description: "Find categories/states/companies performing below average in value or win rate. Use when user asks about 'underperforming segments', 'which categories/states are struggling?', 'below average performance'.",
        parameters: {
          type: "object",
          properties: {
            dimension: {
              type: "string",
              enum: ["category", "state", "company"],
              description: "What dimension to analyze (category, state, or company)",
            },
            limit: { type: "integer", description: "Maximum number of segments to return (optional)" },
          },
          required: ["dimension"],
        },
      },

      {
        name: "get_stalled_deals",
        description: "Identify open deals that have been in pipeline longer than a threshold (e.g., 180 days). Use when user asks about 'stalled deals', 'deals stuck in pipeline', 'slow-moving opportunities'.",
        parameters: {
          type: "object",
          properties: {
            min_days_stalled: {
              type: "integer",
              description: "Minimum days in pipeline to be considered stalled (e.g., 180)",
            },
            limit: { type: "integer", description: "Maximum number of deals to return (optional)" },
          },
          required: ["min_days_stalled"],
        },
      },

      // Utility
      {
        name: "get_all_projects",
        description: "List all projects with basic fields",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },

      {
        name: "get_project_by_id",
        description: "Find specific project by name or ID",
        parameters: {
          type: "object",
          properties: {
            project_name: { type: "string" },
          },
          required: ["project_name"],
        },
      },
    ];
  }

  /**
   * Smart merge of previous arguments with new arguments
   * Detects whether the user is pivoting (replace) or refining (accumulate)
   */
  private smartMergeArguments(
    previousArgs: Record<string, any>,
    newArgs: Record<string, any>
  ): Record<string, any> {
    console.log(`[SmartMerge] STARTING MERGE`);
    console.log(`[SmartMerge] Previous args:`, JSON.stringify(previousArgs));
    console.log(`[SmartMerge] New args:`, JSON.stringify(newArgs));

    // Normalize tags and categories to always be arrays (AI might return strings)
    if (newArgs.tags && typeof newArgs.tags === 'string') {
      newArgs.tags = [newArgs.tags];
      console.log(`[SmartMerge] Normalized new tags from string to array:`, newArgs.tags);
    }
    if (newArgs.categories && typeof newArgs.categories === 'string') {
      newArgs.categories = [newArgs.categories];
      console.log(`[SmartMerge] Normalized new categories from string to array:`, newArgs.categories);
    }
    if (previousArgs.tags && typeof previousArgs.tags === 'string') {
      previousArgs.tags = [previousArgs.tags];
      console.log(`[SmartMerge] Normalized previous tags from string to array:`, previousArgs.tags);
    }
    if (previousArgs.categories && typeof previousArgs.categories === 'string') {
      previousArgs.categories = [previousArgs.categories];
      console.log(`[SmartMerge] Normalized previous categories from string to array:`, previousArgs.categories);
    }

    // Define parameter categories
    const REPLACEABLE_PARAMS = new Set([
      'company',     // Usually want to pivot to a different company
      'client',      // Usually want to pivot to a different client
      'poc',         // Usually want to pivot to a different person
      'status',      // Usually want to change the status filter
      'size',        // Usually want to change the size filter
      'state_code',  // Usually want to pivot to a different location
      'categories',  // Usually want to REPLACE categories when pivoting
    ]);

    const ADDITIVE_PARAMS = new Set([
      'tags',        // Usually want to ADD new tags to existing ones (e.g., "also add Transit")
    ]);

    const CUMULATIVE_PARAMS = new Set([
      'start_date',  // Keep date filters unless explicitly changed
      'end_date',
      'min_fee',     // Keep fee filters unless explicitly changed
      'max_fee',
      'min_win',     // Keep win% filters unless explicitly changed
      'max_win',
      'limit',       // Usually update the limit
      'year',        // Core query parameters - usually keep
      'quarter',
      'years',
      'category',    // Single category (not array) - usually keep
      'project_name',
      'state_name',
      'time_reference',
    ]);

    const result: Record<string, any> = {};

    // Step 1: Add all previous cumulative parameters (unless new ones override them)
    for (const [key, value] of Object.entries(previousArgs)) {
      if (CUMULATIVE_PARAMS.has(key) && !(key in newArgs)) {
        console.log(`[SmartMerge] Keeping cumulative param: ${key} = ${JSON.stringify(value)}`);
        result[key] = value;
      } else if (!CUMULATIVE_PARAMS.has(key) && !REPLACEABLE_PARAMS.has(key)) {
        // Unknown parameter - keep it for safety
        console.log(`[SmartMerge] Keeping unknown param: ${key} = ${JSON.stringify(value)}`);
        result[key] = value;
      }
    }

    // Step 2: Process new parameters
    for (const [key, value] of Object.entries(newArgs)) {
      if (REPLACEABLE_PARAMS.has(key)) {
        // REPLACE: Don't merge with previous value, just use new value
        console.log(`[SmartMerge] Replacing param: ${key} = ${JSON.stringify(value)}`);
        result[key] = value;
      } else if (ADDITIVE_PARAMS.has(key)) {
        // ADDITIVE: Union new values with existing values (for tags/categories)
        if (previousArgs[key] && Array.isArray(previousArgs[key]) && Array.isArray(value)) {
          // Combine old and new, removing duplicates
          const combined = Array.from(new Set([...previousArgs[key], ...value]));
          console.log(`[SmartMerge] Adding to existing ${key}: ${JSON.stringify(previousArgs[key])} + ${JSON.stringify(value)} = ${JSON.stringify(combined)}`);
          result[key] = combined;
        } else {
          // No previous value or not arrays, just use new value
          console.log(`[SmartMerge] Setting new ${key}: ${JSON.stringify(value)}`);
          result[key] = value;
        }
      } else {
        // CUMULATIVE or OVERRIDE: Use new value
        console.log(`[SmartMerge] Adding/overriding param: ${key} = ${JSON.stringify(value)}`);
        result[key] = value;
      }
    }

    // Step 2.5: Handle fee/win% range changes
    // If user specifies a new min_fee but no max_fee, clear old max_fee
    // (they want "greater than X", not "between X and old_max")
    if (newArgs.min_fee !== undefined && newArgs.max_fee === undefined && previousArgs.max_fee !== undefined) {
      console.log(`[SmartMerge] Fee range change detected: new min_fee without max_fee`);
      console.log(`[SmartMerge]   Clearing old max_fee (${previousArgs.max_fee}) because user wants "greater than ${newArgs.min_fee}"`);
      delete result.max_fee;
    }
    // Similarly, if user specifies a new max_fee but no min_fee, clear old min_fee
    // (they want "less than X", not "between old_min and X")
    if (newArgs.max_fee !== undefined && newArgs.min_fee === undefined && previousArgs.min_fee !== undefined) {
      console.log(`[SmartMerge] Fee range change detected: new max_fee without min_fee`);
      console.log(`[SmartMerge]   Clearing old min_fee (${previousArgs.min_fee}) because user wants "less than ${newArgs.max_fee}"`);
      delete result.min_fee;
    }
    
    // Same logic for win% ranges
    if (newArgs.min_win !== undefined && newArgs.max_win === undefined && previousArgs.max_win !== undefined) {
      console.log(`[SmartMerge] Win% range change detected: clearing old max_win`);
      delete result.max_win;
    }
    if (newArgs.max_win !== undefined && newArgs.min_win === undefined && previousArgs.min_win !== undefined) {
      console.log(`[SmartMerge] Win% range change detected: clearing old min_win`);
      delete result.min_win;
    }

    // Step 3: Handle special pivot cases
    console.log(`[SmartMerge] Checking pivot conditions...`);
    console.log(`[SmartMerge]   newArgs.categories? ${!!newArgs.categories}`);
    console.log(`[SmartMerge]   previousArgs.tags? ${!!previousArgs.tags}`);
    console.log(`[SmartMerge]   !newArgs.tags? ${!newArgs.tags}`);
    
    // IMPORTANT: If user provides new categories but had old tags,
    // this is likely a PIVOT (e.g., tags:Rail/Transit → categories:Healthcare).
    // In this case, we should CLEAR old tags to prevent impossible combinations
    // like "categories=Healthcare AND tags=Rail"
    if (newArgs.categories && previousArgs.tags && !newArgs.tags) {
      console.log(`[SmartMerge] PIVOT condition met: new categories, old tags exist, no new tags`);
      // User pivoted to new categories but didn't mention tags
      // Check if categories actually changed (or if previous had no categories)
      const oldCats = JSON.stringify(previousArgs.categories || []);
      const newCats = JSON.stringify(newArgs.categories);
      
      console.log(`[SmartMerge]   Comparing categories: ${oldCats} vs ${newCats}`);
      
      if (oldCats !== newCats) {
        // Categories changed or were newly added - this is a pivot, clear old tags
        delete result.tags;
        console.log(`[SmartMerge] ✅ PIVOT DETECTED: Categories changed/added, CLEARING old tags`);
        console.log(`[SmartMerge]   Old categories: ${oldCats}, New categories: ${newCats}`);
        console.log(`[SmartMerge]   Old tags (${JSON.stringify(previousArgs.tags)}) were removed`);
      }
    }

    // Similarly, if user provides new tags but had old categories
    // Clear old categories (they're pivoting from one domain to another)
    if (newArgs.tags && previousArgs.categories && !newArgs.categories) {
      console.log(`[SmartMerge] PIVOT condition met: new tags, old categories exist, no new categories`);
      const oldTags = JSON.stringify(previousArgs.tags || []);
      const newTags = JSON.stringify(newArgs.tags);
      
      console.log(`[SmartMerge]   Comparing tags: ${oldTags} vs ${newTags}`);
      
      if (oldTags !== newTags) {
        // Tags changed or were newly added - this is a pivot, clear old categories
        delete result.categories;
        console.log(`[SmartMerge] ✅ PIVOT DETECTED: Tags changed/added, CLEARING old categories`);
        console.log(`[SmartMerge]   Old tags: ${oldTags}, New tags: ${newTags}`);
        console.log(`[SmartMerge]   Old categories (${JSON.stringify(previousArgs.categories)}) were removed`);
      }
    }
    
    // Log replacements for debugging
    if (previousArgs.tags && newArgs.tags) {
      console.log(`[SmartMerge] Tags REPLACED: ${JSON.stringify(previousArgs.tags)} → ${JSON.stringify(newArgs.tags)}`);
    }

    if (previousArgs.categories && newArgs.categories) {
      console.log(`[SmartMerge] Categories REPLACED: ${JSON.stringify(previousArgs.categories)} → ${JSON.stringify(newArgs.categories)}`);
    }

    return result;
  }

  async processQuery(
    userQuestion: string,
    externalDbQuery: (sql: string, params?: any[]) => Promise<any[]>,
    previousContext?: { question: string; function_name: string; arguments: Record<string, any> }
  ): Promise<QueryResponse> {
    try {
      // Step 1: Classify query with LLM (text understanding only)
      // If we have previous context, provide it to help maintain filters
      const enhancedQuestion = previousContext
        ? `CONTEXT: The user previously asked: "${previousContext.question}"
Previous query type: ${previousContext.function_name}
Applied filters: ${JSON.stringify(previousContext.arguments)}

FOLLOW-UP REFINEMENT: ${userQuestion}

CRITICAL INSTRUCTIONS FOR FOLLOW-UP QUERIES:
1. **USE THE SAME QUERY TYPE** (${previousContext.function_name}) unless the user explicitly asks for something completely different
2. **EXTRACT ONLY NEW/CHANGED PARAMETERS** from the follow-up question - DO NOT repeat previous parameters
3. The system will automatically merge your extracted parameters with previous ones

IMPORTANT: Only extract parameters that are EXPLICITLY mentioned or changed in the follow-up question "${userQuestion}".
- If the user explicitly says "tags" or "tagged" → Use TAGS parameter (e.g., "show tags: Rail, Transit" = tags: ["Rail", "Transit"])
- If the follow-up is "also add X" (in context of previous tags) → Treat X as a TAG (e.g., "also add Hospital" = tags: ["Hospital"])
- If the follow-up is a SINGLE category/type WITHOUT "tags" keyword → Use CATEGORY (e.g., "Transportation projects" = category: "Transportation")
- If the follow-up is a COMMA-SEPARATED LIST → Treat as TAGS (e.g., "Rail, Transit, Hospital" = tags: [...])
- If the follow-up mentions a date → Extract ONLY the new date
- If the follow-up explicitly says "size" → Extract as size
- If the follow-up mentions fee/money → Extract as min_fee/max_fee
- DO NOT include previous parameters unless they're explicitly mentioned again

CRITICAL DISTINCTION - Category vs Tags:
"Transportation projects" → category: "Transportation" (use get_projects_by_category)
"Healthcare related projects" → category: "Healthcare" (use get_projects_by_category)
"show tags: Rail, Transit" → tags: ["Rail", "Transit"] (use get_projects_by_combined_filters)
"Rail, Transit, Hospital" → tags: [...] (comma-separated list = tags)
"also add Hospital" (when previous context had tags) → tags: ["Hospital"] (additive)

EXAMPLES:
Previous: get_projects_by_date_range with tags=["Rail","Transit"], start_date="2025-10-31"
Follow-up: "Healthcare, Medical, Hospital, Medium"
→ Extract: tags=["Healthcare","Medical","Hospital","Medium"] (system will clear old tags)

Previous: get_projects_by_year with year=2024
Follow-up: "only mega sized"
→ Extract: size="mega" ONLY (year will be preserved by system)

Previous: get_largest_projects with start_date="2025-01-01"
Follow-up: "last 3 months"
→ Extract: start_date and end_date for last 3 months (replaces previous date)

Extract ONLY the parameters mentioned in: "${userQuestion}"`
        : userQuestion;

      const classification = await this.openaiClient.classifyQuery(
        enhancedQuestion,
        this.functionDefinitions
      );

      console.log(`[QueryEngine] Question: "${userQuestion}"`);
      console.log(`[QueryEngine] Previous context:`, previousContext ? JSON.stringify(previousContext, null, 2) : "None");
      console.log(`[QueryEngine] Classified as: ${classification.function_name}`);
      console.log(`[QueryEngine] AI extracted params:`, JSON.stringify(classification.arguments, null, 2));

      if (!classification.function_name || classification.function_name === "none") {
        return {
          success: false,
          error: "cannot_classify",
          message: `Could not understand the question: '${userQuestion}'. Please try rephrasing.`,
          data: [],
        };
      }

      // Step 1.4: Deterministic category vs tags routing
      // If user did NOT say "tags" or "tagged", and AI classified as combined_filters with single tag
      // Convert to get_projects_by_category instead
      const questionLower = userQuestion.toLowerCase().trim();
      // Use word boundary regex to match standalone "tag", "tags", "tagged", "tag:" but NOT "heritage", "strategic"
      const tagsKeywordPattern = /\btag(s|ged|:)?\b/;
      const hastagsKeyword = tagsKeywordPattern.test(questionLower);
      const isCommaList = userQuestion.includes(',');
      
      if (!hastagsKeyword && !isCommaList && classification.function_name === 'get_projects_by_combined_filters') {
        const args = classification.arguments;
        
        // If there's a single tag (or tags array with one item) and no other meaningful filters
        if (args.tags && !args.categories) {
          const tagsArray = Array.isArray(args.tags) ? args.tags : [args.tags];
          
          // Check if there are any meaningful filters besides tags
          // Ignore: limit, start_date/end_date (date ranges are OK with category)
          const hasMeaningfulFilters = args.size || args.status || args.client || args.company || 
                                      args.poc || args.state_code || args.min_fee || args.max_fee ||
                                      args.min_win || args.max_win;
          
          if (tagsArray.length === 1 && !hasMeaningfulFilters) {
            // Convert to category-based query
            console.log(`[QueryEngine] ⚠️ ROUTING CORRECTION: Converting tags to category`);
            console.log(`[QueryEngine]   Reason: Single value "${tagsArray[0]}" without "tag" keyword or commas`);
            console.log(`[QueryEngine]   Original: get_projects_by_combined_filters with tags=${JSON.stringify(tagsArray)}`);
            
            classification.function_name = 'get_projects_by_category';
            classification.arguments = {
              category: tagsArray[0],
              // Preserve date filters if present
              ...(args.start_date && { start_date: args.start_date }),
              ...(args.end_date && { end_date: args.end_date }),
              ...(args.limit && { limit: args.limit }),
            };
            
            console.log(`[QueryEngine]   Corrected: get_projects_by_category with category="${tagsArray[0]}"`);
          }
        }
      }

      // Step 1.5: Smart merge of previous context with new arguments
      if (previousContext) {
        classification.arguments = this.smartMergeArguments(
          previousContext.arguments,
          classification.arguments
        );
        console.log(`[QueryEngine] After smart merge:`, JSON.stringify(classification.arguments, null, 2));
      }

      // Step 2: Preprocess to handle ALL calculations (dates, numbers, limits)
      const processedClassification = await this.preprocessQuery(
        userQuestion,
        classification,
        externalDbQuery
      );

      const functionName = processedClassification.function_name;
      const args = processedClassification.arguments;

      // Step 3: Execute query
      const results = await this.executeQuery(functionName, args, externalDbQuery);

      if (!results.success) {
        // Convert technical errors to user-friendly messages
        const errorMessage = results.error || "Query execution failed";
        
        // Treat "not found" and "no data" errors as 0 results instead of errors
        if (
          errorMessage.includes("not found") ||
          errorMessage.includes("has no") ||
          errorMessage.includes("No data available")
        ) {
          return {
            success: true,
            question: userQuestion,
            function_name: functionName,
            arguments: args,
            data: [],
            row_count: 0,
            summary: {},
            chart_config: null,
            message: "Found 0 results",
            sql_query: results.sql_query,
            sql_params: results.sql_params,
          };
        }
        
        // For other errors, return friendly message
        return {
          success: false,
          error: errorMessage,
          message: "Unable to process this query. Please try rephrasing your question.",
          data: [],
        };
      }

      // Step 4: Generate chart and summary
      const chartConfig = this.generateChartConfig(results.data, functionName);
      const summary = this.calculateSummaryStats(results.data);

      return {
        success: true,
        question: userQuestion,
        function_name: functionName,
        arguments: args,
        data: results.data,
        row_count: results.data.length,
        summary,
        chart_config: chartConfig,
        message: `Found ${results.data.length} results`,
        sql_query: results.sql_query,
        sql_params: results.sql_params,
      };
    } catch (error) {
      console.error("Error processing query:", error);
      return {
        success: false,
        error: "internal_error",
        message: String(error),
        data: [],
      };
    }
  }

  private async preprocessQuery(
    userQuestion: string,
    classification: { function_name: string; arguments: Record<string, any> },
    externalDbQuery: (sql: string, params?: any[]) => Promise<any[]>
  ): Promise<{ function_name: string; arguments: Record<string, any> }> {
    const args = classification.arguments;

    // Process semantic time references
    if (args.time_reference) {
      const timeRef = args.time_reference;
      const dateRange = this.timeParser.parse(timeRef);

      if (dateRange) {
        args.start_date = dateRange[0];
        args.end_date = dateRange[1];
        delete args.time_reference;
      } else {
        delete args.time_reference;
      }
    }

    // Client normalization - ensure all Client values start with "CLID "
    // BUT: Only for actual client IDs (numbers), NOT person names
    if (args.client) {
      const client = args.client.trim();
      
      // Check if it looks like a person name (has space and letters, not just numbers)
      const looksLikePersonName = /^[A-Za-z]+\s+[A-Za-z]+/.test(client);
      
      if (looksLikePersonName) {
        // This is a person name like "Amy Wincko" - it was misclassified!
        // It should use POC, not Client. Log warning but don't add CLID.
        console.log(`[Normalize] ⚠️ WARNING: "${client}" looks like a person name (POC), not a client ID!`);
        console.log(`[Normalize]   This query should probably use get_projects_by_poc instead.`);
        // Don't add CLID prefix to person names
      } else if (/^\d+$/.test(client)) {
        // Just a number like "4885" -> "CLID 4885"
        args.client = `CLID ${client}`;
        console.log(`[Normalize] Client normalized: "${args.client}"`);
      } else if (!client.toUpperCase().startsWith('CLID')) {
        // Doesn't start with CLID and not a person name -> add prefix
        args.client = `CLID ${client}`;
        console.log(`[Normalize] Client normalized: "${args.client}"`);
      }
    }

    // Handle clients array (for compare_clients, etc.)
    if (args.clients && Array.isArray(args.clients)) {
      args.clients = args.clients.map(client => {
        const trimmed = client.trim();
        
        // Check if it looks like a person name
        const looksLikePersonName = /^[A-Za-z]+\s+[A-Za-z]+/.test(trimmed);
        
        if (looksLikePersonName) {
          console.log(`[Normalize] ⚠️ WARNING: "${trimmed}" looks like a person name (POC), not a client ID!`);
          return trimmed; // Don't add CLID to person names
        } else if (/^\d+$/.test(trimmed)) {
          return `CLID ${trimmed}`;
        } else if (!trimmed.toUpperCase().startsWith('CLID')) {
          return `CLID ${trimmed}`;
        }
        return client;
      });
      console.log(`[Normalize] Clients array normalized: ${JSON.stringify(args.clients)}`);
    }

    // Status normalization
    if (args.status) {
      const status = args.status.toLowerCase();
      if (["won", "win", "winning", "successful", "awarded"].includes(status)) {
        args.status = "won";
      } else if (["lost", "lose", "losing", "unsuccessful", "rejected"].includes(status)) {
        args.status = "lost";
      } else if (["submit", "submitted", "pending", "awaiting"].includes(status)) {
        args.status = "submitted";
      } else if (["lead", "leads", "opportunity", "opportunities"].includes(status)) {
        args.status = "lead";
      } else if (["proposal", "proposal development", "developing"].includes(status)) {
        args.status = "proposal development";
      }
    }

    // Extract limit from question if not provided
    if (!args.limit) {
      const limit = NumberCalculator.parseLimit(userQuestion);
      if (limit) {
        args.limit = limit;
      }
    }

    // Calculate percentiles for size-based queries
    if (args.size || classification.function_name === "get_size_distribution") {
      await this.sizeCalculator.calculatePercentiles(externalDbQuery);
    }

    return classification;
  }

  /**
   * Helper function to substitute parameters into SQL query for logging
   */
  private substituteParams(sql: string, params: any[]): string {
    let result = sql;
    params.forEach((param, index) => {
      const placeholder = `$${index + 1}`;
      let value: string;
      
      if (param === null || param === undefined) {
        value = 'NULL';
      } else if (typeof param === 'string') {
        value = `'${param.replace(/'/g, "''")}'`;
      } else if (Array.isArray(param)) {
        value = `ARRAY[${param.map(v => typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v).join(', ')}]`;
      } else if (typeof param === 'number' || typeof param === 'boolean') {
        value = String(param);
      } else {
        value = `'${String(param).replace(/'/g, "''")}'`;
      }
      
      result = result.replace(new RegExp('\\$' + (index + 1) + '(?=\\D|$)', 'g'), value);
    });
    
    return result;
  }

  /**
   * Security check: Validates that SQL is read-only (SELECT only)
   */
  private isReadOnlySQL(sql: string): boolean {
    const sqlUpper = sql.toUpperCase().trim();
    
    // Block any destructive operations
    const destructiveKeywords = [
      'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 
      'CREATE', 'REPLACE', 'RENAME', 'GRANT', 'REVOKE'
    ];
    
    for (const keyword of destructiveKeywords) {
      // Check for keyword at start or after whitespace/semicolon
      if (sqlUpper.includes(keyword)) {
        return false;
      }
    }
    
    // Only allow SELECT statements (including WITH...SELECT)
    return sqlUpper.startsWith('SELECT') || sqlUpper.startsWith('WITH');
  }

  /**
   * Handle "same attribute as PID X" queries (two-step lookup)
   */
  private async handleSameAttributeQuery(
    args: Record<string, any>,
    externalDbQuery: (sql: string, params?: any[]) => Promise<any[]>
  ): Promise<{ success: boolean; data: any[]; error?: string; sql_query?: string; sql_params?: any[] }> {
    try {
      const { reference_pid, attribute } = args;

      // Step 1: Look up the reference project
      const lookupSql = `SELECT * FROM "Sample" 
                         WHERE "Project Name" ILIKE $1 
                         OR "Internal Id"::text ILIKE $1
                         LIMIT 1`;
      const lookupParams = [`%${reference_pid}%`];
      
      console.log(`[QueryEngine] Step 1: Looking up reference project "${reference_pid}"`);
      const referenceProjects = await externalDbQuery(lookupSql, lookupParams);
      
      if (referenceProjects.length === 0) {
        return {
          success: false,
          data: [],
          error: `Reference project "${reference_pid}" not found`,
        };
      }

      const referenceProject = referenceProjects[0];
      
      // Step 2: Extract the attribute value based on attribute type
      const attributeMap: Record<string, string> = {
        poc: "Point Of Contact",
        category: "Request Category",
        client: "Client",
        status: "Status",
        company: "Company",
      };

      const columnName = attributeMap[attribute];
      if (!columnName) {
        return {
          success: false,
          data: [],
          error: `Invalid attribute type: ${attribute}`,
        };
      }

      const attributeValue = referenceProject[columnName];
      if (!attributeValue) {
        return {
          success: false,
          data: [],
          error: `Reference project has no ${attribute} value`,
        };
      }

      console.log(`[QueryEngine] Step 2: Found ${attribute} = "${attributeValue}"`);

      // Step 3: Build query to find all projects with same attribute
      let sql = `SELECT * FROM "Sample" WHERE "${columnName}" ILIKE $1`;
      const sqlParams: any[] = [`%${attributeValue}%`];
      let paramIndex = 2;

      // Add optional filters
      if (args.min_fee !== undefined) {
        sql += ` AND CAST(NULLIF("Fee", '') AS NUMERIC) >= $${paramIndex}`;
        sqlParams.push(args.min_fee);
        paramIndex++;
      }
      if (args.max_fee !== undefined) {
        sql += ` AND CAST(NULLIF("Fee", '') AS NUMERIC) <= $${paramIndex}`;
        sqlParams.push(args.max_fee);
        paramIndex++;
      }
      if (args.start_date) {
        sql += ` AND TO_DATE("Start Date", 'MM/DD/YYYY') >= $${paramIndex}::date`;
        sqlParams.push(args.start_date);
        paramIndex++;
      }
      if (args.end_date) {
        sql += ` AND TO_DATE("Start Date", 'MM/DD/YYYY') <= $${paramIndex}::date`;
        sqlParams.push(args.end_date);
        paramIndex++;
      }

      sql += ` ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC) DESC NULLS LAST LIMIT 50`;

      console.log(`\n${'='.repeat(80)}`);
      console.log(`[QueryEngine] EXECUTED SQL QUERY (Two-step):`);
      console.log(`${'='.repeat(80)}`);
      console.log(this.substituteParams(sql, sqlParams));
      console.log(`${'='.repeat(80)}\n`);

      const results = await externalDbQuery(sql, sqlParams);
      console.log(`[QueryEngine] Results count: ${results.length}`);

      return {
        success: true,
        data: results,
        sql_query: sql,
        sql_params: sqlParams,
      };
    } catch (error) {
      console.error(`Error in handleSameAttributeQuery:`, error);
      return {
        success: false,
        data: [],
        error: String(error),
      };
    }
  }

  private async executeQuery(
    functionName: string,
    args: Record<string, any>,
    externalDbQuery: (sql: string, params?: any[]) => Promise<any[]>
  ): Promise<{ success: boolean; data: any[]; error?: string; sql_query?: string; sql_params?: any[] }> {
    try {
      const template = this.queryTemplates[functionName];
      if (!template) {
        return {
          success: false,
          data: [],
          error: `Unknown function: ${functionName}`,
        };
      }

      // Special handling for get_projects_with_same_attribute (two-step query)
      if (functionName === "get_projects_with_same_attribute") {
        return await this.handleSameAttributeQuery(args, externalDbQuery);
      }

      let sql = template.sql;
      const sqlParams: any[] = [];
      
      // SECURITY: Validate that SQL is read-only before building/executing
      if (!this.isReadOnlySQL(sql)) {
        console.error(`[SECURITY] ⛔ BLOCKED non-SELECT query: ${sql}`);
        return {
          success: false,
          data: [],
          error: `Security error: Only SELECT queries are allowed. Destructive operations are blocked.`,
        };
      }

      // First, add template's required parameters in order
      for (const paramName of template.params) {
        if (args[paramName] !== undefined) {
          // Add wildcards for text search parameters that use ILIKE
          if (paramName === 'poc' || paramName === 'poc1' || paramName === 'poc2' || paramName === 'keyword' || paramName === 'client') {
            sqlParams.push(`%${args[paramName]}%`);
          } else {
            sqlParams.push(args[paramName]);
          }
        }
      }

      // Mark if parameters are already in required params to avoid duplication in additional_filters
      if (template.params.includes("start_date") && template.params.includes("end_date")) {
        args._date_already_applied = true;
      }
      if (template.params.includes("poc")) {
        args._poc_already_applied = true;
      }
      if (template.params.includes("keyword")) {
        args._keyword_already_applied = true;
      }

      // Then build SQL with dynamic replacements (this will add more params)
      sql = this.buildSql(sql, args, sqlParams, template.params.length);

      // Log the actual executed SQL with parameters substituted
      const executedSql = this.substituteParams(sql, sqlParams);
      console.log(`\n${'='.repeat(80)}`);
      console.log(`[QueryEngine] EXECUTED SQL QUERY:`);
      console.log(`${'='.repeat(80)}`);
      console.log(executedSql);
      console.log(`${'='.repeat(80)}\n`);

      const results = await externalDbQuery(sql, sqlParams);

      console.log(`[QueryEngine] Results count: ${results.length}`);

      return {
        success: true,
        data: results,
        sql_query: sql,
        sql_params: sqlParams,
      };
    } catch (error) {
      console.error(`Error executing ${functionName}:`, error);
      return {
        success: false,
        data: [],
        error: String(error),
      };
    }
  }

  /**
   * Build additional filters for follow-up questions
   * This allows ANY query to accept filter refinements from follow-ups
   * Returns SQL fragment and the next parameter index
   */
  private buildAdditionalFilters(
    args: Record<string, any>,
    params: any[],
    startIndex: number
  ): { sql: string; nextIndex: number } {
    const filters: string[] = [];
    let paramIndex = startIndex;

    // Size filter (uses CASE statement)
    if (args.size) {
      const sizeCase = this.sizeCalculator.getSqlCaseStatement();
      filters.push(`(${sizeCase}) = $${paramIndex}`);
      params.push(args.size);
      paramIndex++;
    }

    // Status filter
    if (args.status) {
      filters.push(`"Status" ILIKE $${paramIndex}`);
      params.push(`%${args.status}%`);
      paramIndex++;
    }

    // State/Location filter
    if (args.state_code) {
      filters.push(`"State Lookup" = $${paramIndex}::text`);
      params.push(args.state_code);
      paramIndex++;
    }

    // Company filter (OPCO)
    if (args.company) {
      filters.push(`"Company" ILIKE $${paramIndex}`);
      params.push(`%${args.company}%`);
      paramIndex++;
    }

    // Client filter (CLID)
    if (args.client) {
      filters.push(`"Client" ILIKE $${paramIndex}`);
      params.push(`%${args.client}%`);
      paramIndex++;
    }

    // Point of Contact filter (POC) - only if not already in main query
    if (args.poc && !args._poc_already_applied) {
      filters.push(`"Point Of Contact" ILIKE $${paramIndex}`);
      params.push(`%${args.poc}%`);
      paramIndex++;
    }

    // Categories filter (array)
    if (args.categories && args.categories.length > 0) {
      filters.push(`"Request Category" ILIKE ANY($${paramIndex})`);
      params.push(args.categories.map((c: string) => `%${c}%`));
      paramIndex++;
    }

    // Tags filter (array) - use OR logic: match if ANY tag matches
    if (args.tags && args.tags.length > 0) {
      const tagConditions = args.tags.map((tag: string) => {
        const condition = `"Tags" ILIKE $${paramIndex}`;
        params.push(`%${tag}%`);
        paramIndex++;
        return condition;
      });
      // Use OR logic: (tag1 OR tag2 OR tag3)
      filters.push(`(${tagConditions.join(' OR ')})`);
    }

    // Fee range filters
    if (args.min_fee) {
      filters.push(`CAST(NULLIF("Fee", '') AS NUMERIC) >= $${paramIndex}`);
      params.push(args.min_fee);
      paramIndex++;
    }

    if (args.max_fee) {
      filters.push(`CAST(NULLIF("Fee", '') AS NUMERIC) <= $${paramIndex}`);
      params.push(args.max_fee);
      paramIndex++;
    }

    // Win percentage filters
    if (args.min_win) {
      filters.push(`CAST(NULLIF("Win %", '') AS NUMERIC) >= $${paramIndex}`);
      params.push(args.min_win);
      paramIndex++;
    }

    if (args.max_win) {
      filters.push(`CAST(NULLIF("Win %", '') AS NUMERIC) <= $${paramIndex}`);
      params.push(args.max_win);
      paramIndex++;
    }

    // Date range filter (only add if not already in main query)
    // Check if the query already has date parameters to avoid duplicates
    if (args.start_date && args.end_date && !args._date_already_applied) {
      filters.push(
        `"Start Date" >= $${paramIndex}::date AND "Start Date" <= $${paramIndex + 1}::date`
      );
      params.push(args.start_date, args.end_date);
      paramIndex += 2;
    }

    // Return SQL fragment
    return {
      sql: filters.length > 0 ? `AND ${filters.join(" AND ")}` : "",
      nextIndex: paramIndex,
    };
  }

  private buildSql(sql: string, args: Record<string, any>, params: any[], startIndex: number = 0): string {
    let result = sql;
    let paramIndex = startIndex + 1;

    // Handle date filter
    if (result.includes("{date_filter}")) {
      if (args.start_date && args.end_date) {
        result = result.replace(
          "{date_filter}",
          `AND "Start Date" >= $${paramIndex}::date AND "Start Date" <= $${paramIndex + 1}::date`
        );
        params.push(args.start_date, args.end_date);
        paramIndex += 2;
        args._date_already_applied = true; // Mark dates as applied to avoid duplication
      } else {
        result = result.replace("{date_filter}", "");
      }
    }

    // Handle limit clause
    if (result.includes("{limit_clause}")) {
      if (args.limit) {
        result = result.replace("{limit_clause}", `LIMIT $${paramIndex}`);
        params.push(args.limit);
        paramIndex++;
      } else {
        result = result.replace("{limit_clause}", "LIMIT 50");
      }
    }

    // Handle size condition
    if (result.includes("{size_condition}")) {
      const sizeCase = this.sizeCalculator.getSqlCaseStatement();
      // Use $1 since 'size' is the first (and only) required param for get_projects_by_size
      result = result.replace("{size_condition}", `(${sizeCase}) = $1`);
    }

    // Handle size case
    if (result.includes("{size_case}")) {
      const sizeCase = this.sizeCalculator.getSqlCaseStatement();
      result = result.replace("{size_case}", sizeCase);
    }

    // Handle combined filters
    if (result.includes("{filters}")) {
      const filters: string[] = [];

      if (args.size) {
        const sizeCase = this.sizeCalculator.getSqlCaseStatement();
        filters.push(`(${sizeCase}) = $${paramIndex}`);
        params.push(args.size);
        paramIndex++;
      }

      if (args.status) {
        filters.push(`"Status" ILIKE $${paramIndex}`);
        params.push(`%${args.status}%`);
        paramIndex++;
      }

      if (args.categories && args.categories.length > 0) {
        filters.push(`"Request Category" ILIKE ANY($${paramIndex})`);
        params.push(args.categories.map((c: string) => `%${c}%`));
        paramIndex++;
      }

      if (args.tags && args.tags.length > 0) {
        const tagConditions = args.tags.map((tag: string) => {
          const condition = `"Tags" ILIKE $${paramIndex}`;
          params.push(`%${tag}%`);
          paramIndex++;
          return condition;
        });
        // Use OR logic: (tag1 OR tag2 OR tag3)
        filters.push(`(${tagConditions.join(' OR ')})`);
      }

      if (args.client) {
        filters.push(`"Client" ILIKE $${paramIndex}`);
        params.push(`%${args.client}%`);
        paramIndex++;
      }

      if (args.poc && !args._poc_already_applied) {
        filters.push(`"Point Of Contact" ILIKE $${paramIndex}`);
        params.push(`%${args.poc}%`);
        paramIndex++;
      }

      if (args.company) {
        filters.push(`"Company" ILIKE $${paramIndex}`);
        params.push(`%${args.company}%`);
        paramIndex++;
      }

      if (args.state_code) {
        filters.push(`"State Lookup" = $${paramIndex}::text`);
        params.push(args.state_code);
        paramIndex++;
      }

      if (args.min_fee) {
        filters.push(`CAST(NULLIF("Fee", '') AS NUMERIC) >= $${paramIndex}`);
        params.push(args.min_fee);
        paramIndex++;
      }

      if (args.max_fee) {
        filters.push(`CAST(NULLIF("Fee", '') AS NUMERIC) <= $${paramIndex}`);
        params.push(args.max_fee);
        paramIndex++;
      }

      if (args.min_win) {
        filters.push(`CAST(NULLIF("Win %", '') AS NUMERIC) >= $${paramIndex}`);
        params.push(args.min_win);
        paramIndex++;
      }

      if (args.max_win) {
        filters.push(`CAST(NULLIF("Win %", '') AS NUMERIC) <= $${paramIndex}`);
        params.push(args.max_win);
        paramIndex++;
      }

      if (args.start_date && args.end_date) {
        filters.push(
          `"Start Date" >= $${paramIndex}::date AND "Start Date" <= $${paramIndex + 1}::date`
        );
        params.push(args.start_date, args.end_date);
        paramIndex += 2;
      }

      result = result.replace("{filters}", filters.length > 0 ? `AND ${filters.join(" AND ")}` : "");
    }

    // Handle tag conditions
    if (result.includes("{tag_conditions}")) {
      const tagFilters: string[] = [];
      
      // Handle tags array (preferred format)
      if (args.tags && Array.isArray(args.tags)) {
        for (const tag of args.tags) {
          tagFilters.push(`"Tags" ILIKE $${paramIndex}`);
          params.push(`%${tag}%`);
          paramIndex++;
        }
      } 
      // Fallback: handle individual tag1, tag2, etc. parameters
      else {
        for (let i = 1; i <= 5; i++) {
          if (args[`tag${i}`]) {
            tagFilters.push(`"Tags" ILIKE $${paramIndex}`);
            params.push(`%${args[`tag${i}`]}%`);
            paramIndex++;
          }
        }
      }
      
      // Use OR logic for tags (match ANY tag, not all)
      result = result.replace(
        "{tag_conditions}",
        tagFilters.length > 0 ? `AND (${tagFilters.join(" OR ")})` : ""
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // UNIVERSAL ADDITIONAL FILTERS
    // This allows ANY query to accept follow-up filter refinements!
    // ═══════════════════════════════════════════════════════════════
    if (result.includes("{additional_filters}")) {
      const additionalFilters = this.buildAdditionalFilters(args, params, paramIndex);
      result = result.replace("{additional_filters}", additionalFilters.sql);
      paramIndex = additionalFilters.nextIndex;
    }

    // Handle other placeholders
    if (result.includes("{max_fee_filter}")) {
      if (args.max_fee) {
        result = result.replace("{max_fee_filter}", `AND CAST(NULLIF("Fee", '') AS NUMERIC) <= $${paramIndex}`);
        params.push(args.max_fee);
        paramIndex++;
      } else {
        result = result.replace("{max_fee_filter}", "");
      }
    }

    if (result.includes("{max_win_filter}")) {
      if (args.max_win) {
        result = result.replace("{max_win_filter}", `AND CAST(NULLIF("Win %", '') AS NUMERIC) <= $${paramIndex}`);
        params.push(args.max_win);
        paramIndex++;
      } else {
        result = result.replace("{max_win_filter}", "");
      }
    }

    if (result.includes("{status_filter}")) {
      if (args.status) {
        result = result.replace("{status_filter}", `AND "Status" ILIKE $${paramIndex}`);
        params.push(`%${args.status}%`);
        paramIndex++;
      } else {
        result = result.replace("{status_filter}", "");
      }
    }

    // Add positional parameters at the END (after dynamic params)
    // This must happen AFTER all dynamic parameter processing above
    // Note: params array already contains dynamic params, so we check for missing template params
    return result;
  }

  private generateChartConfig(data: any[], functionName: string): ChartConfig | null {
    if (!data || data.length === 0) return null;

    const template = this.queryTemplates[functionName];
    if (!template) return null;

    const chartType = template.chart_type;
    const chartField = template.chart_field || "Fee";

    try {
      if (chartType === "bar" || chartType === "line") {
        const limitedData = data.slice(0, 20);
        const labels: string[] = [];
        const values: number[] = [];

        for (const item of limitedData) {
          let label = "Item";
          if (item["Project Name"]) {
            label = String(item["Project Name"]).substring(0, 30);
          } else if (item["Company"]) {
            label = item["Company"];
          } else if (item["tag"]) {
            label = String(item["tag"]).trim();
          } else if (item["Status"]) {
            label = item["Status"];
          } else if (item["size_tier"]) {
            label = item["size_tier"];
          } else if (item["year"]) {
            label = String(item["year"]);
          }

          labels.push(label);

          const value = item[chartField] || item["Fee"] || 0;
          values.push(parseFloat(String(value)) || 0);
        }

        return {
          type: chartType,
          title: `Top ${limitedData.length} Results`,
          labels,
          datasets: [
            {
              label: chartField,
              data: values,
              backgroundColor: "rgba(54, 162, 235, 0.6)",
              borderColor: "rgba(54, 162, 235, 1)",
              borderWidth: 1,
            },
          ],
        };
      } else if (chartType === "pie") {
        const labels: string[] = [];
        const values: number[] = [];

        for (const item of data) {
          if (item["Status"]) {
            labels.push(item["Status"]);
          } else if (item["size_tier"]) {
            labels.push(item["size_tier"]);
          } else {
            labels.push("Category");
          }

          const value = item[chartField] || 1;
          values.push(parseFloat(String(value)) || 1);
        }

        return {
          type: "pie",
          title: "Distribution",
          labels,
          datasets: [
            {
              data: values,
              backgroundColor: [
                "rgba(255, 99, 132, 0.6)",
                "rgba(54, 162, 235, 0.6)",
                "rgba(255, 206, 86, 0.6)",
                "rgba(75, 192, 192, 0.6)",
                "rgba(153, 102, 255, 0.6)",
                "rgba(255, 159, 64, 0.6)",
                "rgba(199, 199, 199, 0.6)",
                "rgba(83, 102, 255, 0.6)",
                "rgba(255, 99, 255, 0.6)",
                "rgba(99, 255, 132, 0.6)",
              ],
            },
          ],
        };
      }

      return null;
    } catch (error) {
      console.error("Error generating chart config:", error);
      return null;
    }
  }

  private calculateSummaryStats(data: any[]): SummaryStats {
    if (!data || data.length === 0) return {};

    const stats: SummaryStats = {
      total_records: data.length,
    };

    // Fee statistics
    const fees: number[] = [];
    for (const item of data) {
      if (item["Fee"]) {
        const fee = parseFloat(String(item["Fee"]));
        if (!isNaN(fee)) fees.push(fee);
      }
    }

    if (fees.length > 0) {
      stats.total_value = fees.reduce((a, b) => a + b, 0);
      stats.avg_fee = stats.total_value / fees.length;
      stats.median_fee = fees.sort((a, b) => a - b)[Math.floor(fees.length / 2)];
      stats.min_fee = Math.min(...fees);
      stats.max_fee = Math.max(...fees);
    }

    // Win rate statistics
    const winRates: number[] = [];
    for (const item of data) {
      const winField = item["Win %"] || item["Win_Percentage"];
      if (winField) {
        const winRate = parseFloat(String(winField));
        if (!isNaN(winRate)) winRates.push(winRate);
      }
    }

    if (winRates.length > 0) {
      stats.avg_win_rate = winRates.reduce((a, b) => a + b, 0) / winRates.length;
    }

    // Status breakdown
    const statusCounts: Record<string, number> = {};
    for (const item of data) {
      if (item["Status"]) {
        const status = item["Status"];
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      }
    }

    if (Object.keys(statusCounts).length > 0) {
      stats.status_breakdown = statusCounts;
    }

    // Company breakdown
    const companyCounts: Record<string, number> = {};
    for (const item of data) {
      if (item["Company"]) {
        const company = item["Company"];
        companyCounts[company] = (companyCounts[company] || 0) + 1;
      }
    }

    if (Object.keys(companyCounts).length > 0) {
      const sorted = Object.entries(companyCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      stats.top_companies = Object.fromEntries(sorted);
    }

    return stats;
  }
}
