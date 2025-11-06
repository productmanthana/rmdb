import type { Express, Request } from "express";
import { queryExternalDb } from "./external-db";
import { QueryEngine } from "./utils/query-engine";
import { AzureOpenAIClient } from "./utils/azure-openai";
import { QueryRequestSchema } from "@shared/schema";
import { twilioService } from "./services/twilio-conversations";
import { nanoid } from "nanoid";
import { db } from "./db";
import { twilioConversations, twilioMessages } from "@shared/schema";

let queryEngine: QueryEngine | null = null;

function getQueryEngine(): QueryEngine {
  if (!queryEngine) {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_KEY;

    if (!endpoint || !apiKey) {
      throw new Error("Azure OpenAI credentials are required. Please set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_KEY in Replit Secrets.");
    }

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
          const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
          const apiKey = process.env.AZURE_OPENAI_KEY;

          if (!endpoint || !apiKey) {
            throw new Error("Azure OpenAI credentials not configured");
          }

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

      const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
      const apiKey = process.env.AZURE_OPENAI_KEY;

      if (!endpoint || !apiKey) {
        return res.status(500).json({
          success: false,
          error: "configuration_error",
          message: "Azure OpenAI credentials not configured",
        });
      }

      const openaiClient = new AzureOpenAIClient({
        endpoint,
        apiKey,
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
  // DASHBOARD ANALYTICS ENDPOINT
  // ═══════════════════════════════════════════════════════════════

  app.get("/api/dashboard/analytics", async (req, res) => {
    try {
      // Fetch all aggregate data in parallel for dashboard
      const [
        summaryStats,
        sizeDistribution,
        statusDistribution,
        categoryDistribution,
        stateDistribution,
        monthlyTrend,
        topProjects,
        winRateByCategory,
      ] = await Promise.all([
        // Overall summary statistics
        queryExternalDb(`
          SELECT 
            COUNT(*) as total_projects,
            COALESCE(SUM(CAST(NULLIF("Fee", '') AS NUMERIC)), 0) as total_value,
            COALESCE(AVG(CAST(NULLIF("Fee", '') AS NUMERIC)), 0) as avg_fee,
            COALESCE(AVG(CAST(NULLIF("Win %", '') AS NUMERIC)), 0) as avg_win_rate
          FROM "Sample"
        `),
        
        // Distribution by size
        queryExternalDb(`
          SELECT 
            CASE 
              WHEN CAST(NULLIF("Fee", '') AS NUMERIC) < 35000 THEN 'Micro'
              WHEN CAST(NULLIF("Fee", '') AS NUMERIC) >= 35000 AND CAST(NULLIF("Fee", '') AS NUMERIC) < 90000 THEN 'Small'
              WHEN CAST(NULLIF("Fee", '') AS NUMERIC) >= 90000 AND CAST(NULLIF("Fee", '') AS NUMERIC) < 250000 THEN 'Medium'
              WHEN CAST(NULLIF("Fee", '') AS NUMERIC) >= 250000 AND CAST(NULLIF("Fee", '') AS NUMERIC) < 1319919 THEN 'Large'
              ELSE 'Mega'
            END as size,
            COUNT(*) as count,
            COALESCE(SUM(CAST(NULLIF("Fee", '') AS NUMERIC)), 0) as total_value
          FROM "Sample"
          WHERE "Fee" IS NOT NULL AND "Fee" != ''
          GROUP BY size
          ORDER BY MIN(CAST(NULLIF("Fee", '') AS NUMERIC))
        `),
        
        // Distribution by status
        queryExternalDb(`
          SELECT 
            "Status",
            COUNT(*) as count,
            COALESCE(SUM(CAST(NULLIF("Fee", '') AS NUMERIC)), 0) as total_value
          FROM "Sample"
          WHERE "Status" IS NOT NULL AND "Status" != ''
          GROUP BY "Status"
          ORDER BY count DESC
          LIMIT 10
        `),
        
        // Distribution by category
        queryExternalDb(`
          SELECT 
            "Request Category" as category,
            COUNT(*) as count,
            COALESCE(SUM(CAST(NULLIF("Fee", '') AS NUMERIC)), 0) as total_value
          FROM "Sample"
          WHERE "Request Category" IS NOT NULL AND "Request Category" != ''
          GROUP BY "Request Category"
          ORDER BY count DESC
          LIMIT 10
        `),
        
        // Geographic distribution
        queryExternalDb(`
          SELECT 
            "State Lookup" as state,
            COUNT(*) as count,
            COALESCE(SUM(CAST(NULLIF("Fee", '') AS NUMERIC)), 0) as total_value
          FROM "Sample"
          WHERE "State Lookup" IS NOT NULL AND "State Lookup" != ''
          GROUP BY "State Lookup"
          ORDER BY count DESC
          LIMIT 15
        `),
        
        // Monthly trend (last 12 months)
        queryExternalDb(`
          SELECT 
            TO_CHAR("Start Date", 'YYYY-MM') as month,
            COUNT(*) as count,
            COALESCE(SUM(CAST(NULLIF("Fee", '') AS NUMERIC)), 0) as total_value
          FROM "Sample"
          WHERE "Start Date" >= CURRENT_DATE - INTERVAL '12 months'
            AND "Start Date" IS NOT NULL
          GROUP BY TO_CHAR("Start Date", 'YYYY-MM')
          ORDER BY month
        `),
        
        // Top 10 projects by fee
        queryExternalDb(`
          SELECT 
            "Project Name",
            CAST(NULLIF("Fee", '') AS NUMERIC) as fee,
            "Status",
            "Request Category" as category
          FROM "Sample"
          WHERE "Fee" IS NOT NULL AND "Fee" != ''
          ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC) DESC
          LIMIT 10
        `),
        
        // Win rate by category
        queryExternalDb(`
          SELECT 
            "Request Category" as category,
            COUNT(*) as total_projects,
            COALESCE(AVG(CAST(NULLIF("Win %", '') AS NUMERIC)), 0) as avg_win_rate,
            COALESCE(SUM(CAST(NULLIF("Fee", '') AS NUMERIC)), 0) as total_value
          FROM "Sample"
          WHERE "Request Category" IS NOT NULL 
            AND "Request Category" != ''
            AND "Win %" IS NOT NULL 
            AND "Win %" != ''
          GROUP BY "Request Category"
          ORDER BY avg_win_rate DESC
          LIMIT 10
        `)
      ]);

      res.json({
        success: true,
        data: {
          summary: summaryStats[0] || {},
          sizeDistribution: sizeDistribution || [],
          statusDistribution: statusDistribution || [],
          categoryDistribution: categoryDistribution || [],
          stateDistribution: stateDistribution || [],
          monthlyTrend: monthlyTrend || [],
          topProjects: topProjects || [],
          winRateByCategory: winRateByCategory || [],
        }
      });
    } catch (error) {
      console.error("Error fetching dashboard analytics:", error);
      res.status(500).json({
        success: false,
        error: "internal_error",
        message: String(error),
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

  // ═══════════════════════════════════════════════════════════════
  // TWILIO CONVERSATIONS WEBHOOKS
  // ═══════════════════════════════════════════════════════════════

  // Webhook for incoming messages from all channels (SMS, WhatsApp, Email)
  app.post("/webhook/twilio/conversations", async (req, res) => {
    try {
      console.log('📩 Twilio webhook received:', JSON.stringify(req.body, null, 2));

      // Validate Twilio webhook signature for security
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      if (!authToken) {
        console.error('❌ TWILIO_AUTH_TOKEN not configured');
        return res.status(500).send('Server configuration error');
      }

      const twilioSignature = req.headers['x-twilio-signature'] as string;
      if (!twilioSignature) {
        console.error('❌ Missing X-Twilio-Signature header');
        return res.status(401).send('Unauthorized');
      }

      // Verify the request came from Twilio
      const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
      const isValid = require('twilio').validateRequest(
        authToken,
        twilioSignature,
        url,
        req.body
      );

      if (!isValid) {
        console.error('❌ Invalid Twilio signature');
        return res.status(403).send('Forbidden');
      }

      const {
        ConversationSid,
        MessageSid,
        Author,
        Body,
        EventType,
        ParticipantSid,
        Attributes
      } = req.body;

      // Only process message added events
      if (EventType !== 'onMessageAdded') {
        return res.status(200).send('OK');
      }

      // Ignore messages from system/bot
      if (Author === 'system' || !Body) {
        return res.status(200).send('OK');
      }

      // Parse attributes once and reuse
      let parsedAttributes: any = {};
      let channel = 'sms';
      let participantAddress = Author;
      
      if (Attributes) {
        try {
          parsedAttributes = JSON.parse(Attributes);
          channel = parsedAttributes.channel || 'sms';
          participantAddress = parsedAttributes.participantAddress || Author;
        } catch (e) {
          console.error('⚠️  Error parsing attributes, using defaults:', e);
          parsedAttributes = {};
        }
      }

      // Create or update conversation record in database and get the DB primary key
      let conversationDbId: string | null = null;
      
      if (db) {
        const { eq } = await import('drizzle-orm');
        
        // Check if conversation already exists
        const existingConv = await db
          .select()
          .from(twilioConversations)
          .where(eq(twilioConversations.conversation_sid, ConversationSid))
          .limit(1);

        if (existingConv.length === 0) {
          // Create new conversation record
          conversationDbId = nanoid();
          await db.insert(twilioConversations).values({
            id: conversationDbId,
            conversation_sid: ConversationSid,
            friendly_name: `${channel.toUpperCase()} - ${participantAddress}`,
            channel,
            participant_address: participantAddress,
            metadata: parsedAttributes
          });
        } else {
          // Update existing conversation
          conversationDbId = existingConv[0].id;
          await db
            .update(twilioConversations)
            .set({ 
              updated_at: new Date(),
              metadata: parsedAttributes
            })
            .where(eq(twilioConversations.conversation_sid, ConversationSid));
        }

        // Save incoming message to database using the DB primary key
        const incomingMessageId = nanoid();
        await db.insert(twilioMessages).values({
          id: incomingMessageId,
          conversation_id: conversationDbId,
          message_sid: MessageSid,
          author: Author,
          body: Body,
          direction: 'inbound',
          channel
        });
      }

      // Process the query using existing QueryEngine
      const engine = getQueryEngine();
      const queryResponse = await engine.processQuery(Body, queryExternalDb);

      // Generate AI insights if successful
      if (queryResponse.success && queryResponse.data && queryResponse.data.length > 0) {
        try {
          const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
          const apiKey = process.env.AZURE_OPENAI_KEY;

          if (endpoint && apiKey) {
            const openaiClient = new AzureOpenAIClient({
              endpoint,
              apiKey,
              apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview",
              deployment: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o-mini",
            });

            const dataContext = `
Question: ${Body}
Number of Results: ${queryResponse.row_count || queryResponse.data.length}
Summary Statistics: ${JSON.stringify(queryResponse.summary, null, 2)}
Sample Data (first 3 rows): ${JSON.stringify(queryResponse.data.slice(0, 3), null, 2)}
            `.trim();

            const insights = await openaiClient.chat([
              {
                role: "system",
                content: `You are a data analyst providing concise insights about project data.
Provide 2-3 key insights in plain language. Focus on:
- Most important findings
- Notable patterns or trends
- Actionable recommendations

Keep it brief and conversational (2-3 sentences max for ${channel} channel).`,
              },
              {
                role: "user",
                content: `Based on this query result:\n${dataContext}\n\nProvide key insights.`,
              },
            ]);

            queryResponse.ai_insights = insights;
          }
        } catch (aiError) {
          console.error("Error generating AI insights:", aiError);
        }
      }

      // Format response for the specific channel
      const formattedResponse = twilioService.formatResponseForChannel(
        queryResponse,
        channel as 'sms' | 'whatsapp' | 'email'
      );

      // Send response back through Twilio Conversations
      // For email, use HTML content type
      const contentType = channel === 'email' ? 'text/html' : undefined;
      const responseSid = await twilioService.sendMessage(
        ConversationSid,
        formattedResponse,
        'system',
        contentType
      );

      // Save outgoing message to database using the DB primary key
      if (db && conversationDbId) {
        const outgoingMessageId = nanoid();
        await db.insert(twilioMessages).values({
          id: outgoingMessageId,
          conversation_id: conversationDbId,
          message_sid: responseSid,
          author: 'system',
          body: formattedResponse,
          direction: 'outbound',
          channel,
          query_response: queryResponse
        });
      }

      console.log(`✅ Processed ${channel} message and sent response`);
      res.status(200).send('OK');
    } catch (error) {
      console.error('❌ Error processing Twilio webhook:', error);
      res.status(500).send('Internal Server Error');
    }
  });

  // Status callback webhook for message delivery tracking
  app.post("/webhook/twilio/status", async (req, res) => {
    console.log('📊 Message status update:', req.body);
    res.status(200).send('OK');
  });

  // Test endpoint to verify Twilio configuration
  app.get("/api/twilio/status", async (req, res) => {
    try {
      const configured = twilioService.isConfigured();
      
      res.json({
        configured,
        accountSid: process.env.TWILIO_ACCOUNT_SID ? '✓ Set' : '✗ Missing',
        authToken: process.env.TWILIO_AUTH_TOKEN ? '✓ Set' : '✗ Missing',
        sendgridApiKey: process.env.SENDGRID_API_KEY ? '✓ Set' : '✗ Missing',
        message: configured 
          ? 'Twilio Conversations API is configured and ready!'
          : 'Twilio credentials not configured. Please add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and SENDGRID_API_KEY to Replit Secrets.'
      });
    } catch (error) {
      res.status(500).json({
        configured: false,
        error: String(error)
      });
    }
  });

  return app;
}
