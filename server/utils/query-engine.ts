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
        sql: `SELECT TRIM(UNNEST(string_to_array("Tags", ','))) as tag,
              COUNT(*) as project_count,
              SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_value
              FROM "Sample"
              WHERE "Tags" IS NOT NULL AND "Tags" != ''
              GROUP BY tag
              HAVING TRIM(UNNEST(string_to_array("Tags", ','))) != ''
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
              ORDER BY CAST("Win %" AS NUMERIC) DESC,
                       CAST(NULLIF("Fee", '') AS NUMERIC) DESC NULLS LAST
              LIMIT $1`,
        params: ["limit"],
        param_types: ["int"],
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
    };
  }

  private initializeFunctionDefinitions(): FunctionDefinition[] {
    return [
      // Combined filters - most flexible
      {
        name: "get_projects_by_combined_filters",
        description:
          "Get projects matching MULTIPLE filters simultaneously. Use for complex queries with size, categories, tags, status, dates, etc. For CLID (Client ID), use 'client' field, NOT 'company'.",
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
              description: "List of request categories",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "List of tags",
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
        description: "Get projects by request category",
        parameters: {
          type: "object",
          properties: {
            category: { type: "string" },
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
          "Get projects that have ALL specified tags. Use when user mentions multiple tags with 'and', '&', or commas.",
        parameters: {
          type: "object",
          properties: {
            tags: {
              type: "array",
              items: { type: "string" },
              description: "List of tags (up to 5). Project must have ALL tags.",
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
        description: "Get top tags across all projects",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "integer" },
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
        description: "Get all projects for specific CLIENT or CLID (Client ID). Use 'client' parameter for CLID values like 'CLID 1573'. Do NOT use 'company' for CLID.",
        parameters: {
          type: "object",
          properties: {
            client: { type: "string", description: "Client name or CLID (e.g., 'CLID 1573', 'CLID 3507')" },
          },
          required: ["client"],
        },
      },

      {
        name: "get_projects_by_client_and_fee_range",
        description: "Get projects for client within fee range",
        parameters: {
          type: "object",
          properties: {
            client: { type: "string" },
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
        description: "Get all projects managed by specific Point of Contact/POC/project manager. Use when user asks for a specific person's projects.",
        parameters: {
          type: "object",
          properties: {
            poc: { type: "string", description: "Name of the Point of Contact/project manager" },
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
2. **REPLACE parameters of the same type** - If the previous query had a POC and the user provides a name, REPLACE the POC name
3. **Keep other filters unchanged** - Status, dates, companies, etc. should be preserved unless explicitly changed

COMMON FOLLOW-UP PATTERNS:
- User provides just a NAME → Replace the POC/client/person parameter with the new name, keep the same function (${previousContext.function_name})
- "best", "top one", "#1" → Keep everything, just set limit=1
- "next X months/years" → Update date range only, keep other filters
- "in California" → ADD state filter, keep everything else
- "mega sized" → ADD/UPDATE size filter, keep everything else

EXAMPLES:
Previous: get_projects_by_poc with poc="Amy Wincko"
Follow-up: "Michael Luciani" 
→ Use get_projects_by_poc with poc="Michael Luciani" (SAME FUNCTION, REPLACE POC)

Previous: get_projects_by_year with year=2024
Follow-up: "only mega sized"
→ Use get_projects_by_year with year=2024, size="mega" (ADD SIZE FILTER)

Extract the COMPLETE set of filters, maintaining the query type and replacing parameters appropriately.`
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
        return {
          success: false,
          error: results.error || "Query execution failed",
          message: "An error occurred while executing the query",
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

      let sql = template.sql;
      const sqlParams: any[] = [];

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

    // Tags filter (array)
    if (args.tags && args.tags.length > 0) {
      for (const tag of args.tags) {
        filters.push(`"Tags" ILIKE $${paramIndex}`);
        params.push(`%${tag}%`);
        paramIndex++;
      }
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
        for (const tag of args.tags) {
          filters.push(`"Tags" ILIKE $${paramIndex}`);
          params.push(`%${tag}%`);
          paramIndex++;
        }
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
      for (let i = 1; i <= 5; i++) {
        if (args[`tag${i}`]) {
          tagFilters.push(`"Tags" ILIKE $${paramIndex}`);
          params.push(`%${args[`tag${i}`]}%`);
          paramIndex++;
        }
      }
      result = result.replace(
        "{tag_conditions}",
        tagFilters.length > 0 ? `AND ${tagFilters.join(" AND ")}` : ""
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
