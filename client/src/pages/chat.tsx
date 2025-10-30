import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { QueryResponse } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChartVisualization } from "@/components/ChartVisualization";
import { Send, Copy, Check, AlertCircle, Sparkles, TrendingUp, Calendar, Tag, Building } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  type: "user" | "bot";
  content: string;
  timestamp: Date;
  response?: QueryResponse;
}

const exampleQueries = [
  {
    icon: Calendar,
    category: "Time-Based",
    queries: [
      "Show me all mega sized projects starting in the next ten months",
      "Top 10 projects in last 6 months",
      "Projects completed in 2024"
    ]
  },
  {
    icon: TrendingUp,
    category: "Rankings",
    queries: [
      "Top 5 largest projects",
      "Smallest 3 active projects",
      "Biggest projects in California"
    ]
  },
  {
    icon: Tag,
    category: "Categories",
    queries: [
      "Projects with sustainability and innovation tags",
      "Transportation related projects",
      "Show all energy sector projects"
    ]
  },
  {
    icon: Building,
    category: "Analysis",
    queries: [
      "Compare revenue between OPCOs",
      "Projects with Rail and Transit tags",
      "Win rate by company"
    ]
  }
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const queryMutation = useMutation({
    mutationFn: async (question: string) => {
      const res = await apiRequest("POST", "/api/query", { question });
      return res.json() as Promise<QueryResponse>;
    },
    onSuccess: (data, question) => {
      const botMessage: Message = {
        id: Date.now().toString(),
        type: "bot",
        content: data.message || "Query executed successfully",
        timestamp: new Date(),
        response: data,
      };

      setMessages((prev) => [...prev, botMessage]);

      if (!data.success) {
        toast({
          variant: "destructive",
          title: "Query Failed",
          description: data.message || "An error occurred",
        });
      }
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: String(error),
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || queryMutation.isPending) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    queryMutation.mutate(input);
    setInput("");
  };

  const handleExampleClick = (query: string) => {
    if (queryMutation.isPending) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: query,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    queryMutation.mutate(query);
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast({
      title: "Copied!",
      description: "Data copied to clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold" data-testid="text-app-title">
              Database Query Assistant
            </h1>
            <p className="text-xs text-muted-foreground">Ask anything about your data</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <ScrollArea className="flex-1 px-4">
          <div className="max-w-4xl mx-auto py-8">
            {messages.length === 0 ? (
              /* Welcome Screen with Examples */
              <div className="space-y-8">
                <div className="text-center space-y-3 py-8">
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                    <Sparkles className="h-8 w-8 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold">Welcome to Database Query Assistant</h2>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Ask questions about your data in plain English. I'll analyze and visualize the results for you.
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {exampleQueries.map((group, idx) => (
                    <Card key={idx} className="hover-elevate transition-all">
                      <CardContent className="p-5 space-y-3">
                        <div className="flex items-center gap-2 text-primary">
                          <group.icon className="h-4 w-4" />
                          <h3 className="font-semibold text-sm">{group.category}</h3>
                        </div>
                        <div className="space-y-2">
                          {group.queries.map((query, qIdx) => (
                            <button
                              key={qIdx}
                              onClick={() => handleExampleClick(query)}
                              className="w-full text-left px-3 py-2 rounded-lg text-sm hover-elevate active-elevate-2 border border-border/50 transition-all"
                              data-testid={`button-example-${idx}-${qIdx}`}
                            >
                              {query}
                            </button>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              /* Chat Messages */
              <div className="space-y-6 pb-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={message.type === "user" ? "flex justify-end" : "flex justify-start"}
                  >
                    <div className={message.type === "user" ? "max-w-2xl" : "max-w-full w-full"}>
                      {message.type === "user" ? (
                        <div className="inline-block bg-primary text-primary-foreground rounded-2xl px-5 py-3">
                          <p className="text-sm" data-testid={`text-user-message-${message.id}`}>
                            {message.content}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="inline-block bg-muted rounded-2xl px-5 py-3 max-w-2xl">
                            <p className="text-sm" data-testid={`text-bot-message-${message.id}`}>
                              {message.content}
                            </p>
                          </div>

                          {message.response && (
                            <div className="space-y-4">
                              {/* Summary Stats */}
                              {message.response.summary && message.response.success && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                  {message.response.summary.total_records !== undefined && (
                                    <Card>
                                      <CardContent className="p-4">
                                        <p className="text-xs text-muted-foreground mb-1">Records</p>
                                        <p className="text-xl font-bold" data-testid="text-total-records">
                                          {message.response.summary.total_records}
                                        </p>
                                      </CardContent>
                                    </Card>
                                  )}
                                  {message.response.summary.total_value !== undefined && (
                                    <Card>
                                      <CardContent className="p-4">
                                        <p className="text-xs text-muted-foreground mb-1">Total Value</p>
                                        <p className="text-xl font-bold" data-testid="text-total-value">
                                          ${(message.response.summary.total_value / 1e6).toFixed(1)}M
                                        </p>
                                      </CardContent>
                                    </Card>
                                  )}
                                  {message.response.summary.avg_fee !== undefined && (
                                    <Card>
                                      <CardContent className="p-4">
                                        <p className="text-xs text-muted-foreground mb-1">Avg Fee</p>
                                        <p className="text-xl font-bold" data-testid="text-avg-fee">
                                          ${(message.response.summary.avg_fee / 1e6).toFixed(1)}M
                                        </p>
                                      </CardContent>
                                    </Card>
                                  )}
                                  {message.response.summary.avg_win_rate !== undefined && (
                                    <Card>
                                      <CardContent className="p-4">
                                        <p className="text-xs text-muted-foreground mb-1">Avg Win Rate</p>
                                        <p className="text-xl font-bold" data-testid="text-avg-win-rate">
                                          {message.response.summary.avg_win_rate.toFixed(1)}%
                                        </p>
                                      </CardContent>
                                    </Card>
                                  )}
                                </div>
                              )}

                              {/* Error Display */}
                              {!message.response.success && (
                                <Alert variant="destructive" data-testid="alert-error">
                                  <AlertCircle className="h-4 w-4" />
                                  <AlertDescription>
                                    {message.response.message || "An error occurred"}
                                  </AlertDescription>
                                </Alert>
                              )}

                              {/* Data Display */}
                              {message.response.success && (
                                <Tabs defaultValue="chart" className="w-full">
                                  <TabsList className="grid w-full max-w-md grid-cols-2">
                                    <TabsTrigger value="chart" data-testid="tab-chart">
                                      Chart
                                    </TabsTrigger>
                                    <TabsTrigger value="data" data-testid="tab-data">
                                      Table
                                    </TabsTrigger>
                                  </TabsList>

                                  <TabsContent value="chart" className="space-y-4">
                                    {message.response.chart_config ? (
                                      <ChartVisualization config={message.response.chart_config} />
                                    ) : (
                                      <Card>
                                        <CardContent className="pt-6 text-center text-muted-foreground">
                                          No chart available
                                        </CardContent>
                                      </Card>
                                    )}
                                  </TabsContent>

                                  <TabsContent value="data" className="space-y-4">
                                    <Card>
                                      <CardContent className="p-6">
                                        <div className="flex items-center justify-between mb-4">
                                          <h3 className="font-semibold">Data Table</h3>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                              const data = message.response?.data || [];
                                              if (data.length > 0) {
                                                const headers = Object.keys(data[0]);
                                                const csv = [
                                                  headers.join(','),
                                                  ...data.map((row: any) =>
                                                    headers.map(h => JSON.stringify(row[h] ?? '')).join(',')
                                                  )
                                                ].join('\n');
                                                copyToClipboard(csv);
                                              }
                                            }}
                                            data-testid="button-copy-data"
                                          >
                                            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                            <span className="ml-2">Copy CSV</span>
                                          </Button>
                                        </div>
                                        <ScrollArea className="h-96">
                                          <div className="relative w-full overflow-auto">
                                            <table className="w-full caption-bottom text-sm">
                                              <thead className="[&_tr]:border-b">
                                                <tr className="border-b transition-colors hover:bg-muted/50">
                                                  {message.response.data && message.response.data.length > 0 &&
                                                    Object.keys(message.response.data[0]).map((key) => (
                                                      <th
                                                        key={key}
                                                        className="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
                                                      >
                                                        {key}
                                                      </th>
                                                    ))
                                                  }
                                                </tr>
                                              </thead>
                                              <tbody className="[&_tr:last-child]:border-0">
                                                {message.response.data && message.response.data.map((row: any, idx: number) => (
                                                  <tr
                                                    key={idx}
                                                    className="border-b transition-colors hover:bg-muted/50"
                                                    data-testid={`table-row-${idx}`}
                                                  >
                                                    {Object.values(row).map((value: any, colIdx: number) => (
                                                      <td
                                                        key={colIdx}
                                                        className="p-4 align-middle"
                                                      >
                                                        {typeof value === 'number'
                                                          ? value.toLocaleString()
                                                          : String(value ?? '')
                                                        }
                                                      </td>
                                                    ))}
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                            {(!message.response.data || message.response.data.length === 0) && (
                                              <div className="text-center py-8 text-muted-foreground">
                                                No data available
                                              </div>
                                            )}
                                          </div>
                                        </ScrollArea>
                                      </CardContent>
                                    </Card>
                                  </TabsContent>
                                </Tabs>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {queryMutation.isPending && (
                  <div className="flex justify-start">
                    <div className="space-y-2">
                      <Skeleton className="h-12 w-48 rounded-2xl" />
                      <Skeleton className="h-32 w-96 rounded-lg" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="border-t bg-background">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <form onSubmit={handleSubmit} className="relative">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your data... (e.g., Show me all projects from 2024)"
                className="min-h-[60px] pr-12 resize-none rounded-2xl"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                data-testid="input-query"
                disabled={queryMutation.isPending}
              />
              <Button
                type="submit"
                size="icon"
                className="absolute right-2 bottom-2 rounded-xl"
                disabled={!input.trim() || queryMutation.isPending}
                data-testid="button-submit"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
            <p className="text-xs text-center text-muted-foreground mt-2">
              Press Enter to send, Shift + Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
