import type { Express } from "express";
import { queryExternalDb } from "./external-db";
import { QueryEngine } from "./utils/query-engine";
import { AzureOpenAIClient } from "./utils/azure-openai";
import { QueryRequestSchema } from "@shared/schema";

let queryEngine: QueryEngine | null = null;

function getQueryEngine(): QueryEngine {
  if (!queryEngine) {
    const openaiClient = new AzureOpenAIClient({
      endpoint:
        process.env.AZURE_OPENAI_ENDPOINT ||
        "https://aiage-mh4lk8m5-eastus2.cognitiveservices.azure.com/",
      apiKey:
        process.env.AZURE_OPENAI_KEY ||
        "1jSEw3gXJYnZWcSsb5WKEg2kdNPJaOchCp64BgVzEUkgbsPJ5Y5KJQQJ99BJACHYHv6XJ3w3AAAAACOGx3MU",
      apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview",
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
    });

    queryEngine = new QueryEngine(openaiClient);
  }

  return queryEngine;
}

export function registerRoutes(app: Express): Express {
  // ═══════════════════════════════════════════════════════════════
  // MAIN QUERY ENDPOINT
  // ═══════════════════════════════════════════════════════════════

  app.post("/api/query", async (req, res) => {
    try {
      const validation = QueryRequestSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: "invalid_request",
          message: "Please provide a valid question",
          data: [],
        });
      }

      const { question } = validation.data;
      const engine = getQueryEngine();

      const response = await engine.processQuery(question, queryExternalDb);

      res.json(response);
    } catch (error) {
      console.error("Error processing query:", error);
      res.status(500).json({
        success: false,
        error: "internal_error",
        message: String(error),
        data: [],
      });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // DATABASE CONNECTION TEST
  // ═══════════════════════════════════════════════════════════════

  app.get("/api/health", async (req, res) => {
    try {
      const result = await queryExternalDb("SELECT 1 as connected");
      res.json({
        status: "ok",
        database: result.length > 0 ? "connected" : "error",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        status: "error",
        database: "disconnected",
        error: String(error),
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // EXAMPLE QUERIES
  // ═══════════════════════════════════════════════════════════════

  app.get("/api/examples", (req, res) => {
    res.json({
      examples: [
        {
          category: "Date Queries",
          queries: [
            "Show me all mega sized projects starting in the next ten months which are transportation related",
            "Top 10 projects in last 6 months",
            "Projects in Q1 2026",
            "What projects are coming soon?",
          ],
        },
        {
          category: "Rankings",
          queries: [
            "Top 5 largest projects",
            "Biggest projects in California",
            "Smallest projects this year",
          ],
        },
        {
          category: "Filters & Analysis",
          queries: [
            "Projects with Rail and Transit tags",
            "Healthcare category projects with Win% > 70%",
            "Compare revenue between OPCOs",
            "Status breakdown of all projects",
          ],
        },
        {
          category: "Predictions",
          queries: [
            "What if projections for revenue",
            "Top predicted wins",
            "Overoptimistic losses",
          ],
        },
      ],
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // EMBEDDING SNIPPET GENERATION
  // ═══════════════════════════════════════════════════════════════

  app.get("/api/embed/snippet", (req, res) => {
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const embedUrl = `${baseUrl}/embed`;

    const iframeSnippet = `<!-- Natural Language Database Query Chatbot -->
<iframe 
  src="${embedUrl}"
  width="800"
  height="900"
  frameborder="0"
  style="border: 1px solid #e5e7eb; border-radius: 8px;"
  allow="clipboard-write"
></iframe>`;

    const jsSnippet = `<!-- Natural Language Database Query Chatbot -->
<div id="nlq-chatbot"></div>
<script>
  (function() {
    var iframe = document.createElement('iframe');
    iframe.src = '${embedUrl}';
    iframe.width = '800';
    iframe.height = '900';
    iframe.frameBorder = '0';
    iframe.style.border = '1px solid #e5e7eb';
    iframe.style.borderRadius = '8px';
    iframe.allow = 'clipboard-write';
    
    document.getElementById('nlq-chatbot').appendChild(iframe);
  })();
</script>`;

    res.json({
      embedUrl,
      iframeSnippet,
      jsSnippet,
      options: {
        width: "Customize width (e.g., 800, 100%)",
        height: "Customize height (e.g., 900, 100vh)",
        theme: "Auto-detects light/dark mode",
      },
    });
  });

  return app;
}
