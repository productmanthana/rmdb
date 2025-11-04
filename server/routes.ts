import type { Express } from "express";
import { queryExternalDb } from "./external-db";
import { QueryEngine } from "./utils/query-engine";
import { AzureOpenAIClient } from "./utils/azure-openai";
import { QueryRequestSchema } from "@shared/schema";

let queryEngine: QueryEngine | null = null;

function getQueryEngine(): QueryEngine {
  if (!queryEngine) {
    // In production, require environment variables
    // In development, allow fallback to default credentials
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT || 
      (process.env.NODE_ENV === 'production' 
        ? (() => { throw new Error("AZURE_OPENAI_ENDPOINT required in production") })()
        : "https://rmone.openai.azure.com/");
    
    const apiKey = process.env.AZURE_OPENAI_KEY || 
      (process.env.NODE_ENV === 'production'
        ? (() => { throw new Error("AZURE_OPENAI_KEY required in production") })()
        : "6wPl6eJkfHt16UgF87ytZlo6xMjpKzH5P2zagHfe3l6TuUbErOYtJQQJ99BJACYeBjFXJ3w3AAABACOGCsJD");

    const openaiClient = new AzureOpenAIClient({
      endpoint,
      apiKey,
      apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview",
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o-mini",
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

      const { question, previousContext } = validation.data;
      const engine = getQueryEngine();

      const response = await engine.processQuery(question, queryExternalDb, previousContext);

      // Generate AI insights automatically if query was successful
      if (response.success && response.data && response.data.length > 0) {
        try {
          const endpoint = process.env.AZURE_OPENAI_ENDPOINT || 
            (process.env.NODE_ENV === 'production'
              ? (() => { throw new Error("AZURE_OPENAI_ENDPOINT required in production") })()
              : "https://rmone.openai.azure.com/");
          
          const apiKey = process.env.AZURE_OPENAI_KEY || 
            (process.env.NODE_ENV === 'production'
              ? (() => { throw new Error("AZURE_OPENAI_KEY required in production") })()
              : "6wPl6eJkfHt16UgF87ytZlo6xMjpKzH5P2zagHfe3l6TuUbErOYtJQQJ99BJACYeBjFXJ3w3AAABACOGCsJD");

          const openaiClient = new AzureOpenAIClient({
            endpoint,
            apiKey,
            apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview",
            deployment: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o-mini",
          });

          const dataContext = `
Question: ${question}
Number of Results: ${response.row_count || response.data.length}
Summary Statistics: ${JSON.stringify(response.summary, null, 2)}
Sample Data (first 3 rows): ${JSON.stringify(response.data.slice(0, 3), null, 2)}
          `.trim();

          const insights = await openaiClient.chat([
            {
              role: "system",
              content: `You are a data analyst providing concise insights about project data.
Provide 2-3 key insights in plain language. Focus on:
- Most important findings
- Notable patterns or trends
- Actionable recommendations

Keep it brief and conversational (3-4 sentences max).`,
            },
            {
              role: "user",
              content: `Based on this query result:
${dataContext}

Provide key insights.`,
            },
          ]);

          response.ai_insights = insights;
        } catch (aiError) {
          console.error("Error generating AI insights:", aiError);
          // Don't fail the whole query if insights generation fails
        }
      }

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
  // AI ANALYSIS ENDPOINT
  // ═══════════════════════════════════════════════════════════════

  app.post("/api/ai-analysis", async (req, res) => {
    try {
      const { question, originalQuestion, followUpQuestion, queryData } = req.body;

      if (!question || !queryData) {
        return res.status(400).json({
          success: false,
          error: "invalid_request",
          message: "Please provide a question and query data",
        });
      }

      const openaiClient = new AzureOpenAIClient({
        endpoint:
          process.env.AZURE_OPENAI_ENDPOINT ||
          "https://rmone.openai.azure.com/",
        apiKey:
          process.env.AZURE_OPENAI_KEY ||
          "6wPl6eJkfHt16UgF87ytZlo6xMjpKzH5P2zagHfe3l6TuUbErOYtJQQJ99BJACYeBjFXJ3w3AAABACOGCsJD",
        apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview",
        deployment: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o-mini",
      });

      // Create context from query data
      const dataContext = `
Original Question: ${originalQuestion}
Follow-up Question: ${followUpQuestion}
Combined Query Context: ${question}

Number of Results: ${queryData.rowCount}
Summary Statistics: ${JSON.stringify(queryData.summary, null, 2)}
Sample Data (first 5 rows): ${JSON.stringify(queryData.data.slice(0, 5), null, 2)}
      `.trim();

      const response = await openaiClient.chat([
        {
          role: "system",
          content: `You are a data analyst helping users understand their project data. 
The user originally asked: "${originalQuestion}"
Now they have a follow-up question: "${followUpQuestion}"

Provide clear, actionable insights in plain language that addresses their follow-up question in the context of their original query. Focus on:
- Answering the follow-up question directly
- Providing context from the original query results
- Key patterns and trends relevant to the question
- Actionable recommendations

Keep responses concise (2-3 paragraphs max) and conversational.`,
        },
        {
          role: "user",
          content: `Based on this query result data:
${dataContext}

Please provide a helpful analysis for the follow-up question.`,
        },
      ]);

      res.json({
        success: true,
        analysis: response,
      });
    } catch (error) {
      console.error("Error generating AI analysis:", error);
      res.status(500).json({
        success: false,
        error: "internal_error",
        message: "Failed to generate analysis",
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
  // CHAT HISTORY MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  // In-memory storage for chat history (replace with database later)
  const chatHistory = new Map<string, any>();
  let chatIdCounter = 1;

  // Get all chats
  app.get("/api/chats", (req, res) => {
    const chats = Array.from(chatHistory.values()).sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
    res.json(chats);
  });

  // Create new chat
  app.post("/api/chats", (req, res) => {
    const { title } = req.body;
    const chatId = `chat-${chatIdCounter++}`;
    const chat = {
      id: chatId,
      title: title || "New Chat",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    chatHistory.set(chatId, chat);
    res.json(chat);
  });

  // Delete single chat
  app.delete("/api/chats/:id", (req, res) => {
    const { id } = req.params;
    if (chatHistory.has(id)) {
      chatHistory.delete(id);
      res.json({ success: true, message: "Chat deleted" });
    } else {
      res.status(404).json({ success: false, message: "Chat not found" });
    }
  });

  // Bulk delete chats
  app.post("/api/chats/bulk-delete", (req, res) => {
    const { chat_ids } = req.body;
    if (!Array.isArray(chat_ids)) {
      return res.status(400).json({ success: false, message: "Invalid request" });
    }

    let deletedCount = 0;
    chat_ids.forEach((id: string) => {
      if (chatHistory.has(id)) {
        chatHistory.delete(id);
        deletedCount++;
      }
    });

    res.json({
      success: true,
      message: `Deleted ${deletedCount} chats`,
      deleted_count: deletedCount,
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
