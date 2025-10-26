import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { QueryResponse, QueryHistoryItem, SummaryStats } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChartVisualization } from "@/components/ChartVisualization";
import { Send, Copy, Check, AlertCircle, Lightbulb, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  type: "user" | "bot";
  content: string;
  timestamp: Date;
  response?: QueryResponse;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const queryMutation = useMutation({
    mutationFn: async (question: string) => {
      return apiRequest<QueryResponse>("/api/query", {
        method: "POST",
        body: JSON.stringify({ question }),
        headers: { "Content-Type": "application/json" },
      });
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
    setInput(query);
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
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="border-b h-16 flex items-center px-6">
        <div className="flex items-center gap-3">
          <Database className="h-8 w-8 text-primary" data-testid="logo-icon" />
          <div>
            <h1 className="text-xl font-semibold" data-testid="text-app-title">
              Natural Language Database Query
            </h1>
            <p className="text-sm text-muted-foreground">Ask questions about your data in plain English</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Examples */}
        <aside className="w-80 border-r p-4 overflow-y-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Lightbulb className="h-5 w-5" />
                Example Queries
              </CardTitle>
              <CardDescription>Click to try</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2">Date Queries</h4>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left h-auto py-2 px-3"
                    onClick={() =>
                      handleExampleClick(
                        "Show me all mega sized projects starting in the next ten months which are transportation related"
                      )
                    }
                    data-testid="button-example-1"
                  >
                    <span className="text-sm">Mega transportation projects next 10 months</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left h-auto py-2 px-3"
                    onClick={() => handleExampleClick("Top 10 projects in last 6 months")}
                    data-testid="button-example-2"
                  >
                    <span className="text-sm">Top 10 projects in last 6 months</span>
                  </Button>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-medium mb-2">Rankings</h4>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left h-auto py-2 px-3"
                    onClick={() => handleExampleClick("Top 5 largest projects")}
                    data-testid="button-example-3"
                  >
                    <span className="text-sm">Top 5 largest projects</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left h-auto py-2 px-3"
                    onClick={() => handleExampleClick("Biggest projects in California")}
                    data-testid="button-example-4"
                  >
                    <span className="text-sm">Biggest projects in California</span>
                  </Button>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-medium mb-2">Analysis</h4>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left h-auto py-2 px-3"
                    onClick={() => handleExampleClick("Projects with Rail and Transit tags")}
                    data-testid="button-example-5"
                  >
                    <span className="text-sm">Projects with Rail and Transit tags</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left h-auto py-2 px-3"
                    onClick={() => handleExampleClick("Compare revenue between OPCOs")}
                    data-testid="button-example-6"
                  >
                    <span className="text-sm">Compare revenue between OPCOs</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>

        {/* Chat Area */}
        <main className="flex-1 flex flex-col">
          {/* Messages */}
          <ScrollArea className="flex-1 p-6">
            <div className="max-w-4xl mx-auto space-y-6">
              {messages.length === 0 && (
                <div className="text-center py-12">
                  <Database className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h2 className="text-2xl font-semibold mb-2">Welcome to NL Database Query</h2>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Ask questions about your data in plain English. Try an example query from the sidebar or type
                    your own below.
                  </p>
                </div>
              )}

              {messages.map((message) => (
                <div key={message.id} className={message.type === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div className={message.type === "user" ? "max-w-2xl" : "max-w-full w-full"}>
                    {message.type === "user" ? (
                      <div className="bg-primary text-primary-foreground rounded-2xl px-4 py-3">
                        <p className="text-base" data-testid={`text-user-message-${message.id}`}>
                          {message.content}
                        </p>
                        <p className="text-xs mt-1 opacity-70">{message.timestamp.toLocaleTimeString()}</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="bg-muted rounded-xl px-4 py-3">
                          <p className="text-base" data-testid={`text-bot-message-${message.id}`}>
                            {message.content}
                          </p>
                          <p className="text-xs mt-1 text-muted-foreground">{message.timestamp.toLocaleTimeString()}</p>
                        </div>

                        {message.response && (
                          <div className="space-y-4">
                            {/* Summary Stats */}
                            {message.response.summary && message.response.success && (
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {message.response.summary.total_records !== undefined && (
                                  <Card>
                                    <CardContent className="pt-4">
                                      <p className="text-xs text-muted-foreground">Total Records</p>
                                      <p className="text-2xl font-bold" data-testid="text-total-records">
                                        {message.response.summary.total_records}
                                      </p>
                                    </CardContent>
                                  </Card>
                                )}
                                {message.response.summary.total_value !== undefined && (
                                  <Card>
                                    <CardContent className="pt-4">
                                      <p className="text-xs text-muted-foreground">Total Value</p>
                                      <p className="text-2xl font-bold" data-testid="text-total-value">
                                        ${(message.response.summary.total_value / 1e6).toFixed(1)}M
                                      </p>
                                    </CardContent>
                                  </Card>
                                )}
                                {message.response.summary.avg_fee !== undefined && (
                                  <Card>
                                    <CardContent className="pt-4">
                                      <p className="text-xs text-muted-foreground">Avg Fee</p>
                                      <p className="text-2xl font-bold" data-testid="text-avg-fee">
                                        ${(message.response.summary.avg_fee / 1e6).toFixed(1)}M
                                      </p>
                                    </CardContent>
                                  </Card>
                                )}
                                {message.response.summary.avg_win_rate !== undefined && (
                                  <Card>
                                    <CardContent className="pt-4">
                                      <p className="text-xs text-muted-foreground">Avg Win Rate</p>
                                      <p className="text-2xl font-bold" data-testid="text-avg-win-rate">
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
                                <AlertDescription>{message.response.message || "An error occurred"}</AlertDescription>
                              </Alert>
                            )}

                            {/* Dual View: Chart + Raw Data */}
                            {message.response.success && (
                              <Tabs defaultValue="chart" className="w-full">
                                <TabsList className="grid w-full max-w-md grid-cols-2">
                                  <TabsTrigger value="chart" data-testid="tab-chart">
                                    Chart View
                                  </TabsTrigger>
                                  <TabsTrigger value="data" data-testid="tab-data">
                                    Raw Data
                                  </TabsTrigger>
                                </TabsList>

                                <TabsContent value="chart" className="space-y-4">
                                  {message.response.chart_config ? (
                                    <ChartVisualization config={message.response.chart_config} />
                                  ) : (
                                    <Card>
                                      <CardContent className="pt-6 text-center text-muted-foreground">
                                        No chart available for this query
                                      </CardContent>
                                    </Card>
                                  )}
                                </TabsContent>

                                <TabsContent value="data" className="space-y-4">
                                  <Card>
                                    <CardHeader>
                                      <div className="flex items-center justify-between">
                                        <CardTitle className="text-lg">Raw Data</CardTitle>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() =>
                                            copyToClipboard(JSON.stringify(message.response?.data, null, 2))
                                          }
                                          data-testid="button-copy-data"
                                        >
                                          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                          <span className="ml-2">{copied ? "Copied" : "Copy"}</span>
                                        </Button>
                                      </div>
                                    </CardHeader>
                                    <CardContent>
                                      <ScrollArea className="h-96">
                                        <pre className="text-xs font-mono p-4 rounded-lg bg-muted overflow-x-auto">
                                          {JSON.stringify(message.response.data, null, 2)}
                                        </pre>
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
                  <div className="max-w-full w-full space-y-4">
                    <div className="bg-muted rounded-xl px-4 py-3">
                      <p className="text-base text-muted-foreground">Processing your query...</p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[1, 2, 3, 4].map((i) => (
                        <Card key={i}>
                          <CardContent className="pt-4">
                            <Skeleton className="h-4 w-20 mb-2" />
                            <Skeleton className="h-8 w-24" />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="border-t p-4">
            <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
              <div className="flex gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about your data in natural language..."
                  className="min-h-12 max-h-32 resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                  disabled={queryMutation.isPending}
                  data-testid="input-query"
                />
                <Button
                  type="submit"
                  size="icon"
                  className="h-12 w-12 rounded-full"
                  disabled={!input.trim() || queryMutation.isPending}
                  data-testid="button-send"
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Press Enter to send • Shift+Enter for new line
              </p>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
