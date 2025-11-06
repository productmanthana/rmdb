/**
 * Azure OpenAI Client
 * Used for text understanding ONLY - all calculations done in TypeScript
 */

import { AzureOpenAIConfig } from "@shared/schema";

export interface FunctionDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

export interface Classification {
  function_name: string;
  arguments: Record<string, any>;
  error?: string;
  retryAfter?: number;
}

export class AzureOpenAIClient {
  private endpoint: string;
  private apiKey: string;
  private apiVersion: string;
  private deployment: string;

  constructor(config: AzureOpenAIConfig) {
    this.endpoint = config.endpoint;
    this.apiKey = config.apiKey;
    this.apiVersion = config.apiVersion;
    this.deployment = config.deployment;
  }

  async classifyQuery(
    userQuestion: string,
    functions: FunctionDefinition[]
  ): Promise<Classification> {
    const systemPrompt = `You are a function classifier for a database query system.

Your job is to select the BEST function and extract parameters from user questions.

CRITICAL INSTRUCTIONS:
1. For time references, extract the EXACT phrase the user said - do NOT calculate dates
2. Extract ONLY what the user explicitly asks for
3. Use semantic "time_reference" parameter for date-related queries
4. Always extract "limit" if user mentions "top N", "first N", etc.

Examples:
User: "Show me mega sized projects starting in the next ten months"
→ {"function_name": "get_projects_by_combined_filters", "arguments": {"size": "Mega", "time_reference": "next ten months"}}

User: "Top 5 largest projects in last 6 months"
→ {"function_name": "get_largest_projects", "arguments": {"limit": 5, "time_reference": "last 6 months"}}

User: "Projects with Rail and Transit tags"
→ {"function_name": "get_projects_by_multiple_tags", "arguments": {"tags": ["Rail", "Transit"]}}

Return ONLY valid JSON with "function_name" and "arguments" fields.`;

    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const url = `${this.endpoint}/openai/deployments/${this.deployment}/chat/completions?api-version=${this.apiVersion}`;

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": this.apiKey,
          },
          body: JSON.stringify({
            messages: [
              { role: "system", content: systemPrompt },
              {
                role: "user",
                content: `Question: "${userQuestion}"\n\nAvailable functions: ${JSON.stringify(functions, null, 2)}\n\nSelect the best function and extract parameters.`,
              },
            ],
            temperature: 0.1,
            max_tokens: 500,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Azure OpenAI API Error:", errorText);
          
          // Check if it's a rate limit error
          try {
            const errorData = JSON.parse(errorText);
            if (errorData.error?.code === "RateLimitReached") {
              // Extract retry-after time from the message if available
              const message = errorData.error?.message || "";
              const retryMatch = message.match(/retry after (\d+) second/i);
              const retrySeconds = retryMatch ? parseInt(retryMatch[1]) : 10;
              
              return {
                function_name: "none",
                arguments: {},
                error: "rate_limit",
                retryAfter: retrySeconds,
              };
            }
          } catch (e) {
            // If parsing fails, continue with generic error
          }
          
          throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        let responseText = data.choices?.[0]?.message?.content || "";

        // Clean up response (remove markdown code blocks)
        if (responseText.includes("```json")) {
          const jsonStart = responseText.indexOf("```json") + 7;
          const jsonEnd = responseText.indexOf("```", jsonStart);
          responseText = responseText.substring(jsonStart, jsonEnd).trim();
        } else if (responseText.includes("```")) {
          const jsonStart = responseText.indexOf("```") + 3;
          const jsonEnd = responseText.indexOf("```", jsonStart);
          responseText = responseText.substring(jsonStart, jsonEnd).trim();
        }

        // Extract JSON object
        if (responseText.includes("{") && responseText.includes("}")) {
          const jsonStart = responseText.indexOf("{");
          const jsonEnd = responseText.lastIndexOf("}") + 1;
          responseText = responseText.substring(jsonStart, jsonEnd);
        }

        const result = JSON.parse(responseText);

        return {
          function_name: result.function_name || "none",
          arguments: result.arguments || {},
        };
      } catch (error: any) {
        lastError = error;
        
        // Check if it's a transient error worth retrying
        const isTransientError = 
          error.name === 'AggregateError' ||
          error.name === 'TypeError' && error.message?.includes('fetch') ||
          error.message?.includes('timeout') ||
          error.message?.includes('ECONNRESET') ||
          error.message?.includes('ETIMEDOUT') ||
          error.message?.includes('network');
        
        // If it's the last attempt or not a transient error, bail out
        if (attempt === maxRetries - 1 || !isTransientError) {
          console.error(`Azure OpenAI classification failed after ${attempt + 1} attempt(s):`, error);
          return {
            function_name: "none",
            arguments: {},
            error: String(error),
          };
        }
        
        // Log retry and wait before next attempt
        console.warn(`Azure OpenAI attempt ${attempt + 1} failed, retrying...`, error.message);
        await new Promise(resolve => setTimeout(resolve, Math.min(1000 * (attempt + 1), 3000)));
      }
    }

    // Fallback (should never reach here)
    return {
      function_name: "none",
      arguments: {},
      error: String(lastError),
    };
  }

  async chat(messages: Array<{ role: string; content: string }>): Promise<string> {
    try {
      const url = `${this.endpoint}/openai/deployments/${this.deployment}/chat/completions?api-version=${this.apiVersion}`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": this.apiKey,
        },
        body: JSON.stringify({
          messages,
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("Azure OpenAI API Error:", error);
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      const responseText = data.choices?.[0]?.message?.content || "";

      return responseText;
    } catch (error) {
      console.error("Error in chat completion:", error);
      throw error;
    }
  }
}
