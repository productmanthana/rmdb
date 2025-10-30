import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { QueryResponse, ChatHistory } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChartVisualization } from "@/components/ChartVisualization";
import { FloatingParticles } from "@/components/FloatingParticles";
import { TypingIndicator } from "@/components/TypingIndicator";
import {
  Send,
  Copy,
  Check,
  AlertCircle,
  Sparkles,
  TrendingUp,
  Calendar,
  Tag,
  Building,
  Trash2,
  Search,
  Plus,
  MessageSquare,
  X,
  Menu,
  PanelLeftClose,
  FileText,
  Brain,
  Maximize2,
  Download,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AIAnalysisMessage {
  id: string;
  type: "user" | "assistant";
  content: string;
  response?: QueryResponse;
}

interface Message {
  id: string;
  type: "user" | "bot";
  content: string;
  timestamp: Date;
  response?: QueryResponse;
  aiAnalysisMessages?: AIAnalysisMessage[];
}

const exampleQueries = [
  {
    icon: Calendar,
    category: "Time-Based",
    queries: [
      "Show me all mega sized projects starting in the next ten months",
      "Top 10 projects in last 6 months",
      "Projects completed in 2024",
    ],
  },
  {
    icon: TrendingUp,
    category: "Rankings",
    queries: [
      "Top 5 largest projects",
      "Smallest 3 active projects",
      "Biggest projects in California",
    ],
  },
  {
    icon: Tag,
    category: "Categories",
    queries: [
      "Projects with sustainability and innovation tags",
      "Transportation related projects",
      "Show all energy sector projects",
    ],
  },
  {
    icon: Building,
    category: "Analysis",
    queries: [
      "Compare revenue between OPCOs",
      "Projects with Rail and Transit tags",
      "Win rate by company",
    ],
  },
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChats, setSelectedChats] = useState<Set<string>>(new Set());
  const [aiAnalysisInputs, setAiAnalysisInputs] = useState<Record<string, string>>({});
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState<Record<string, boolean>>({});
  const [maximizedTable, setMaximizedTable] = useState<{ messageId: string; data: any[] } | null>(null);
  const { toast } = useToast();

  // Fetch chat history
  const { data: chatHistory = [] } = useQuery<ChatHistory[]>({
    queryKey: ["/api/chats"],
  });

  // Filter chats based on search
  const filteredChats = chatHistory.filter((chat) =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Query mutation
  const queryMutation = useMutation({
    mutationFn: async (question: string) => {
      const res = await apiRequest("POST", "/api/query", { question });
      return res.json() as Promise<QueryResponse>;
    },
    onSuccess: async (data, question) => {
      const botMessage: Message = {
        id: Date.now().toString(),
        type: "bot",
        content: data.message || "Query executed successfully",
        timestamp: new Date(),
        response: data,
      };

      setMessages((prev) => [...prev, botMessage]);

      // Save chat if it doesn't exist
      if (!currentChatId) {
        try {
          const chatRes = await apiRequest("POST", "/api/chats", {
            title: question.slice(0, 50) + (question.length > 50 ? "..." : ""),
          });
          const chatData = await chatRes.json();
          setCurrentChatId(chatData.id);
          queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
        } catch (error) {
          console.error("Failed to save chat:", error);
        }
      }

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

  // Delete chat mutation
  const deleteChatMutation = useMutation({
    mutationFn: async (chatId: string) => {
      const res = await apiRequest("DELETE", `/api/chats/${chatId}`, null);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      toast({
        title: "Chat deleted",
        description: "Successfully deleted the chat",
      });
      if (currentChatId && selectedChats.has(currentChatId)) {
        handleNewChat();
      }
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (chatIds: string[]) => {
      const res = await apiRequest("POST", "/api/chats/bulk-delete", {
        chat_ids: chatIds,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      setSelectedChats(new Set());
      toast({
        title: "Chats deleted",
        description: `Successfully deleted ${selectedChats.size} chats`,
      });
      handleNewChat();
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

  const handleNewChat = () => {
    setMessages([]);
    setCurrentChatId(null);
  };

  const handleSelectChat = (chatId: string) => {
    const newSelected = new Set(selectedChats);
    if (newSelected.has(chatId)) {
      newSelected.delete(chatId);
    } else {
      newSelected.add(chatId);
    }
    setSelectedChats(newSelected);
  };

  const handleBulkDelete = () => {
    if (selectedChats.size === 0) return;
    bulkDeleteMutation.mutate(Array.from(selectedChats));
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

  const handleAIAnalysis = async (messageId: string, question: string) => {
    if (!question.trim()) return;

    const message = messages.find(m => m.id === messageId);
    if (!message || !message.response) return;

    // Add user question to AI analysis messages
    const userMsg: AIAnalysisMessage = {
      id: Date.now().toString(),
      type: "user",
      content: question,
    };

    setMessages(prev => prev.map(m => 
      m.id === messageId 
        ? { ...m, aiAnalysisMessages: [...(m.aiAnalysisMessages || []), userMsg] }
        : m
    ));

    // Clear input for this message
    setAiAnalysisInputs(prev => ({ ...prev, [messageId]: "" }));
    setAiAnalysisLoading(prev => ({ ...prev, [messageId]: true }));

    try {
      // Combine original question with follow-up question to create a new query
      const combinedQuestion = `${message.content.trim()} ${question.trim()}`;

      // Execute a new SQL query with the combined question
      const res = await apiRequest("POST", "/api/query", {
        question: combinedQuestion,
      });

      const data = await res.json() as QueryResponse;

      // Add assistant response with full query results
      const assistantMsg: AIAnalysisMessage = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content: question,
        response: data,
      };

      setMessages(prev => prev.map(m => 
        m.id === messageId 
          ? { ...m, aiAnalysisMessages: [...(m.aiAnalysisMessages || []), assistantMsg] }
          : m
      ));

      if (!data.success) {
        toast({
          variant: "destructive",
          title: "Query Failed",
          description: data.message || "An error occurred",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Query Failed",
        description: "Unable to execute follow-up query",
      });
    } finally {
      setAiAnalysisLoading(prev => ({ ...prev, [messageId]: false }));
    }
  };

  return (
    <div className="flex h-screen flex-col gradient-mesh overflow-hidden relative">
      {/* Floating Particles Background */}
      <FloatingParticles />

      {/* Glassmorphic Header */}
      <header className="glass-dark px-4 py-3 flex items-center justify-between shrink-0 relative z-10">
        <div className="flex items-center gap-3">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="text-white hover:bg-white/10 transition-all"
            data-testid="button-toggle-sidebar"
          >
            {isSidebarOpen ? (
              <PanelLeftClose className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
          <div className="h-10 w-10 rounded-xl gradient-glow flex items-center justify-center animate-float">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white" data-testid="text-app-title">
              AI Database Assistant
            </h1>
            <p className="text-xs text-white/70">Natural language queries</p>
          </div>
        </div>
        <Button
          onClick={handleNewChat}
          size="sm"
          className="glass text-white hover:glass-hover"
          data-testid="button-new-chat"
        >
          <Plus className="h-4 w-4 mr-1" />
          New Chat
        </Button>
      </header>

      <div className="flex flex-1 overflow-hidden relative z-10">
        {/* Glassmorphic Sidebar */}
        {isSidebarOpen && (
          <aside className="w-80 glass-dark border-r border-white/10 flex flex-col shrink-0 animate-fade-in-up">
          {/* Search */}
          <div className="p-3 border-b border-white/10">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chats..."
                className="pl-9 glass-input text-white placeholder:text-white/50 border-0"
                data-testid="input-search-chats"
              />
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedChats.size > 0 && (
            <div className="p-3 glass border-white/10 border-y flex items-center justify-between">
              <span className="text-sm text-white">{selectedChats.size} selected</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white hover:bg-white/10"
                  onClick={() => setSelectedChats(new Set())}
                  data-testid="button-clear-selection"
                >
                  Clear
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="glass-dark text-white"
                  onClick={handleBulkDelete}
                  disabled={bulkDeleteMutation.isPending}
                  data-testid="button-bulk-delete"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          )}

          {/* Chat List */}
          <ScrollArea className="flex-1 p-3">
            <div className="space-y-2">
              {filteredChats.length === 0 && (
                <div className="text-center py-8 text-white/50 text-sm">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  {searchQuery ? "No chats found" : "No saved chats yet"}
                </div>
              )}

              {filteredChats.map((chat) => (
                <div
                  key={chat.id}
                  className={`group relative glass rounded-lg p-3 transition-all cursor-pointer ${
                    selectedChats.has(chat.id) ? "ring-2 ring-white/30" : ""
                  } glass-hover`}
                  onClick={() => handleSelectChat(chat.id)}
                  data-testid={`chat-item-${chat.id}`}
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={selectedChats.has(chat.id)}
                      onChange={() => handleSelectChat(chat.id)}
                      className="mt-1"
                      onClick={(e) => e.stopPropagation()}
                      data-testid={`checkbox-chat-${chat.id}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate font-medium">
                        {chat.title}
                      </p>
                      <p className="text-xs text-white/50 mt-1">
                        {new Date(chat.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-white/70 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteChatMutation.mutate(chat.id);
                      }}
                      data-testid={`button-delete-${chat.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </aside>
        )}

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1 px-4">
            <div className="max-w-4xl mx-auto py-8">
              {messages.length === 0 ? (
                /* Welcome Screen */
                <div className="space-y-8">
                  <div className="text-center space-y-3 py-8">
                    <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl glass">
                      <Sparkles className="h-8 w-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">
                      Welcome to AI Database Assistant
                    </h2>
                    <p className="text-white/70 max-w-md mx-auto">
                      Ask questions about your data in plain English. I'll analyze and visualize the
                      results for you.
                    </p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    {exampleQueries.map((group, idx) => (
                      <div key={idx} className="glass rounded-xl p-5 space-y-3 transition-all">
                        <div className="flex items-center gap-2 text-white">
                          <group.icon className="h-4 w-4" />
                          <h3 className="font-semibold text-sm">{group.category}</h3>
                        </div>
                        <div className="space-y-2">
                          {group.queries.map((query, qIdx) => (
                            <button
                              key={qIdx}
                              onClick={() => handleExampleClick(query)}
                              className="w-full text-left px-3 py-2 rounded-lg text-sm text-white/90 glass-input transition-all hover:glass-hover"
                              data-testid={`button-example-${idx}-${qIdx}`}
                            >
                              {query}
                            </button>
                          ))}
                        </div>
                      </div>
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
                          <div className="glass-input rounded-2xl px-5 py-3 inline-block">
                            <p className="text-sm text-white" data-testid={`text-user-message-${message.id}`}>
                              {message.content}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="glass rounded-2xl px-5 py-3 inline-block max-w-2xl">
                              <p className="text-sm text-white" data-testid={`text-bot-message-${message.id}`}>
                                {message.content}
                              </p>
                            </div>

                            {message.response && (
                              <div className="space-y-4">
                                {/* Summary Stats */}
                                {message.response.summary && message.response.success && (
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {message.response.summary.total_records !== undefined && (
                                      <div className="glass rounded-xl p-4">
                                        <p className="text-xs text-white/70 mb-1">Records</p>
                                        <p className="text-xl font-bold text-white" data-testid="text-total-records">
                                          {message.response.summary.total_records}
                                        </p>
                                      </div>
                                    )}
                                    {message.response.summary.total_value !== undefined && (
                                      <div className="glass rounded-xl p-4">
                                        <p className="text-xs text-white/70 mb-1">Total Value</p>
                                        <p className="text-xl font-bold text-white" data-testid="text-total-value">
                                          ${(message.response.summary.total_value / 1e6).toFixed(1)}M
                                        </p>
                                      </div>
                                    )}
                                    {message.response.summary.avg_fee !== undefined && (
                                      <div className="glass rounded-xl p-4">
                                        <p className="text-xs text-white/70 mb-1">Avg Fee</p>
                                        <p className="text-xl font-bold text-white" data-testid="text-avg-fee">
                                          ${(message.response.summary.avg_fee / 1e6).toFixed(1)}M
                                        </p>
                                      </div>
                                    )}
                                    {message.response.summary.avg_win_rate !== undefined && (
                                      <div className="glass rounded-xl p-4">
                                        <p className="text-xs text-white/70 mb-1">Avg Win Rate</p>
                                        <p className="text-xl font-bold text-white" data-testid="text-avg-win-rate">
                                          {message.response.summary.avg_win_rate.toFixed(1)}%
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Error Display */}
                                {!message.response.success && (
                                  <Alert variant="destructive" className="glass-dark border-red-500/50" data-testid="alert-error">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription className="text-white">
                                      {message.response.message || "An error occurred"}
                                    </AlertDescription>
                                  </Alert>
                                )}

                                {/* Data Display */}
                                {message.response.success && (
                                  <Tabs defaultValue="data" className="w-full">
                                    <TabsList className="glass border-0">
                                      <TabsTrigger value="data" className="text-white data-[state=active]:glass-input" data-testid="tab-data">
                                        Response
                                      </TabsTrigger>
                                      <TabsTrigger value="chart" className="text-white data-[state=active]:glass-input" data-testid="tab-chart">
                                        Chart
                                      </TabsTrigger>
                                      <TabsTrigger value="analysis" className="text-white data-[state=active]:glass-input" data-testid="tab-analysis">
                                        <Brain className="h-4 w-4 mr-1" />
                                        Follow up questions
                                      </TabsTrigger>
                                      <TabsTrigger value="logs" className="text-white data-[state=active]:glass-input" data-testid="tab-logs">
                                        <FileText className="h-4 w-4 mr-1" />
                                        Logs
                                      </TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="chart" className="space-y-4 mt-4">
                                      {message.response.chart_config ? (
                                        <div className="glass rounded-xl p-6">
                                          <ChartVisualization config={message.response.chart_config} />
                                        </div>
                                      ) : (
                                        <div className="glass rounded-xl p-6 text-center text-white/70">
                                          No chart available
                                        </div>
                                      )}
                                    </TabsContent>

                                    <TabsContent value="data" className="space-y-4 mt-4">
                                      <div className="glass rounded-xl p-6">
                                        <div className="flex items-center justify-between mb-4">
                                          <h3 className="font-semibold text-white">Data Table</h3>
                                          <div className="flex items-center gap-2">
                                            <Button
                                              size="sm"
                                              className="glass text-white hover:glass-hover"
                                              onClick={() => {
                                                const data = message.response?.data || [];
                                                if (data.length > 0) {
                                                  const headers = Object.keys(data[0]);
                                                  const csv = [
                                                    headers.join(","),
                                                    ...data.map((row: any) =>
                                                      headers.map((h) => JSON.stringify(row[h] ?? "")).join(",")
                                                    ),
                                                  ].join("\n");
                                                  copyToClipboard(csv);
                                                }
                                              }}
                                              data-testid="button-copy-data"
                                            >
                                              {copied ? (
                                                <Check className="h-4 w-4" />
                                              ) : (
                                                <Copy className="h-4 w-4" />
                                              )}
                                              <span className="ml-2">Copy CSV</span>
                                            </Button>
                                            <Button
                                              size="sm"
                                              className="glass text-white hover:glass-hover"
                                              onClick={() => {
                                                if (message.response?.data) {
                                                  setMaximizedTable({
                                                    messageId: message.id,
                                                    data: message.response.data,
                                                  });
                                                }
                                              }}
                                              data-testid="button-maximize-table"
                                            >
                                              <Maximize2 className="h-4 w-4" />
                                              <span className="ml-2">Maximize</span>
                                            </Button>
                                          </div>
                                        </div>
                                        <div className="rounded-lg border border-white/10 h-[400px] flex flex-col">
                                          <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0">
                                            {message.response.data && message.response.data.length > 0 ? (
                                              <Table>
                                                <TableHeader className="bg-white/5 sticky top-0 z-10">
                                                  <TableRow className="hover:bg-transparent border-white/20">
                                                    {Object.keys(message.response.data[0]).map((key) => (
                                                      <TableHead
                                                        key={key}
                                                        className="text-white font-semibold h-10 whitespace-nowrap px-4"
                                                      >
                                                        {key}
                                                      </TableHead>
                                                    ))}
                                                  </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                  {message.response.data.map((row: any, idx: number) => (
                                                    <TableRow
                                                      key={idx}
                                                      className="border-white/10 hover:bg-white/5 transition-colors"
                                                      data-testid={`table-row-${idx}`}
                                                    >
                                                      {Object.values(row).map((value: any, colIdx: number) => (
                                                        <TableCell
                                                          key={colIdx}
                                                          className="text-white/90 py-2 whitespace-nowrap px-4"
                                                        >
                                                          {typeof value === "number"
                                                            ? value.toLocaleString()
                                                            : String(value ?? "")}
                                                        </TableCell>
                                                      ))}
                                                    </TableRow>
                                                  ))}
                                                </TableBody>
                                              </Table>
                                            ) : (
                                              <div className="text-center py-8 text-white/50">No data available</div>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      {/* AI Analysis Section */}
                                      <div className="glass rounded-xl p-6">
                                        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                                          <Brain className="h-5 w-5" />
                                          AI Analysis
                                        </h3>
                                        {message.response.ai_insights ? (
                                          <div className="glass-dark rounded-lg p-4">
                                            <p className="text-white/90 whitespace-pre-wrap leading-relaxed">
                                              {message.response.ai_insights}
                                            </p>
                                          </div>
                                        ) : (
                                          <div className="glass-dark rounded-lg p-4 text-center">
                                            <div className="flex items-center justify-center gap-2 text-white/60">
                                              <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                              <span>Generating AI analysis...</span>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </TabsContent>

                                    <TabsContent value="logs" className="space-y-4 mt-4">
                                      <div className="glass rounded-xl p-6">
                                        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                                          <FileText className="h-5 w-5" />
                                          SQL Query & Execution Details
                                        </h3>
                                        
                                        {/* SQL Query */}
                                        <div className="mb-4">
                                          <p className="text-xs text-white/70 mb-2 font-mono">SQL QUERY:</p>
                                          <div className="glass-dark rounded-lg p-4 overflow-x-auto">
                                            <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">
                                              {message.response.sql_query || "No SQL query available"}
                                            </pre>
                                          </div>
                                        </div>

                                        {/* SQL Parameters */}
                                        <div className="mb-4">
                                          <p className="text-xs text-white/70 mb-2 font-mono">PARAMETERS:</p>
                                          <div className="glass-dark rounded-lg p-4 overflow-x-auto">
                                            <pre className="text-sm text-blue-400 font-mono">
                                              {JSON.stringify(message.response.sql_params || [], null, 2)}
                                            </pre>
                                          </div>
                                        </div>

                                        {/* Raw JSON Response */}
                                        <div>
                                          <div className="flex items-center justify-between mb-2">
                                            <p className="text-xs text-white/70 font-mono">RAW JSON RESPONSE:</p>
                                            <Button
                                              size="sm"
                                              className="glass text-white hover:glass-hover h-7"
                                              onClick={() => {
                                                copyToClipboard(JSON.stringify(message.response, null, 2));
                                              }}
                                              data-testid="button-copy-json"
                                            >
                                              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                              <span className="ml-1 text-xs">Copy</span>
                                            </Button>
                                          </div>
                                          <div className="glass-dark rounded-lg p-4 overflow-x-auto">
                                            <ScrollArea className="h-[300px]">
                                              <pre className="text-sm text-purple-400 font-mono">
                                                {JSON.stringify(message.response, null, 2)}
                                              </pre>
                                            </ScrollArea>
                                          </div>
                                        </div>
                                      </div>
                                    </TabsContent>

                                    <TabsContent value="analysis" className="space-y-4 mt-4">
                                      <div className="glass rounded-xl p-6">
                                        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                                          <Brain className="h-5 w-5" />
                                          Follow up questions
                                        </h3>

                                        {/* Follow-up Query Results */}
                                        <div className="mb-4 space-y-6">
                                          {message.aiAnalysisMessages && message.aiAnalysisMessages.length > 0 ? (
                                            <div className="space-y-6">
                                              {message.aiAnalysisMessages.map((msg) => (
                                                <div key={msg.id} className="space-y-3">
                                                  {/* User Question */}
                                                  <div className="flex justify-end">
                                                    <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-lg p-3 max-w-[80%]">
                                                      <p className="text-sm text-white font-medium">{msg.content}</p>
                                                    </div>
                                                  </div>

                                                  {/* Query Response */}
                                                  {msg.response && msg.response.success && (
                                                    <div className="glass-dark rounded-xl p-4 space-y-4">
                                                      {/* Summary Stats */}
                                                      {msg.response.summary && (
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                                          {msg.response.summary.total_records !== undefined && (
                                                            <div className="glass rounded-lg p-2">
                                                              <p className="text-xs text-white/60">Records</p>
                                                              <p className="text-lg font-bold text-white">{msg.response.summary.total_records}</p>
                                                            </div>
                                                          )}
                                                          {msg.response.summary.total_value !== undefined && (
                                                            <div className="glass rounded-lg p-2">
                                                              <p className="text-xs text-white/60">Total Value</p>
                                                              <p className="text-lg font-bold text-white">${(msg.response.summary.total_value / 1e6).toFixed(1)}M</p>
                                                            </div>
                                                          )}
                                                          {msg.response.summary.avg_fee !== undefined && (
                                                            <div className="glass rounded-lg p-2">
                                                              <p className="text-xs text-white/60">Avg Fee</p>
                                                              <p className="text-lg font-bold text-white">${(msg.response.summary.avg_fee / 1e6).toFixed(1)}M</p>
                                                            </div>
                                                          )}
                                                          {msg.response.summary.avg_win_rate !== undefined && (
                                                            <div className="glass rounded-lg p-2">
                                                              <p className="text-xs text-white/60">Win Rate</p>
                                                              <p className="text-lg font-bold text-white">{msg.response.summary.avg_win_rate.toFixed(1)}%</p>
                                                            </div>
                                                          )}
                                                        </div>
                                                      )}

                                                      {/* Data Table */}
                                                      {msg.response.data && msg.response.data.length > 0 && (
                                                        <div className="rounded-lg border border-white/10 h-[300px] flex flex-col">
                                                          <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0">
                                                            <Table>
                                                              <TableHeader className="bg-white/5 sticky top-0 z-10">
                                                                <TableRow className="hover:bg-transparent border-white/20">
                                                                  {Object.keys(msg.response.data[0]).map((key) => (
                                                                    <TableHead
                                                                      key={key}
                                                                      className="text-white font-semibold h-10 whitespace-nowrap px-4"
                                                                    >
                                                                      {key}
                                                                    </TableHead>
                                                                  ))}
                                                                </TableRow>
                                                              </TableHeader>
                                                              <TableBody>
                                                                {msg.response.data.slice(0, 10).map((row: any, idx: number) => (
                                                                  <TableRow
                                                                    key={idx}
                                                                    className="border-white/10 hover:bg-white/5 transition-colors"
                                                                  >
                                                                    {Object.values(row).map((value: any, colIdx: number) => (
                                                                      <TableCell
                                                                        key={colIdx}
                                                                        className="text-white/90 py-2 whitespace-nowrap px-4"
                                                                      >
                                                                        {typeof value === "number"
                                                                          ? value.toLocaleString()
                                                                          : String(value ?? "")}
                                                                      </TableCell>
                                                                    ))}
                                                                  </TableRow>
                                                                ))}
                                                              </TableBody>
                                                            </Table>
                                                          </div>
                                                        </div>
                                                      )}

                                                      {/* AI Insights */}
                                                      {msg.response.ai_insights && (
                                                        <div className="glass rounded-lg p-3">
                                                          <p className="text-xs text-white/60 mb-2">AI Insights</p>
                                                          <p className="text-sm text-white/90 whitespace-pre-wrap">{msg.response.ai_insights}</p>
                                                        </div>
                                                      )}
                                                    </div>
                                                  )}

                                                  {/* Error Display */}
                                                  {msg.response && !msg.response.success && (
                                                    <Alert variant="destructive" className="glass-dark border-red-500/50">
                                                      <AlertCircle className="h-4 w-4" />
                                                      <AlertDescription className="text-white">
                                                        {msg.response.message || "Query failed"}
                                                      </AlertDescription>
                                                    </Alert>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            <div className="glass-dark rounded-lg p-4 text-center">
                                              <p className="text-white/70 text-sm">
                                                Ask follow-up questions to refine your query. For example:
                                              </p>
                                              <div className="mt-3 space-y-2 text-xs text-white/60">
                                                <p>• "which ones are in California?"</p>
                                                <p>• "show only active status"</p>
                                                <p>• "with fees over $500K"</p>
                                              </div>
                                            </div>
                                          )}
                                        </div>

                                        {/* AI Analysis Input */}
                                        <div className="glass-input rounded-xl p-1">
                                          <form
                                            onSubmit={(e) => {
                                              e.preventDefault();
                                              handleAIAnalysis(message.id, aiAnalysisInputs[message.id] || "");
                                            }}
                                            className="flex items-end gap-2"
                                          >
                                            <Textarea
                                              value={aiAnalysisInputs[message.id] || ""}
                                              onChange={(e) =>
                                                setAiAnalysisInputs((prev) => ({
                                                  ...prev,
                                                  [message.id]: e.target.value,
                                                }))
                                              }
                                              placeholder="Ask a question about the data..."
                                              className="flex-1 min-h-[60px] bg-transparent border-0 text-white placeholder:text-white/50 resize-none focus-visible:ring-0 px-3 py-2"
                                              disabled={aiAnalysisLoading[message.id]}
                                              data-testid={`input-ai-analysis-${message.id}`}
                                            />
                                            <Button
                                              type="submit"
                                              size="icon"
                                              className="gradient-accent rounded-xl h-10 w-10 shrink-0 mr-1 mb-1"
                                              disabled={!aiAnalysisInputs[message.id]?.trim() || aiAnalysisLoading[message.id]}
                                              data-testid={`button-submit-ai-analysis-${message.id}`}
                                            >
                                              {aiAnalysisLoading[message.id] ? (
                                                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                              ) : (
                                                <Send className="h-4 w-4 text-white" />
                                              )}
                                            </Button>
                                          </form>
                                        </div>
                                      </div>
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
                    <div className="flex justify-start animate-fade-in-up">
                      <TypingIndicator />
                    </div>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Glassmorphic Input Area */}
          <div className="glass-dark border-t border-white/10 shrink-0">
            <div className="max-w-4xl mx-auto px-4 py-4">
              <form onSubmit={handleSubmit} className="relative">
                <div className="glass-input rounded-3xl p-1 flex items-end gap-2">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask anything about your data..."
                    className="flex-1 min-h-[60px] bg-transparent border-0 text-white placeholder:text-white/50 resize-none focus-visible:ring-0 px-4 py-3"
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
                    className="gradient-accent rounded-2xl h-12 w-12 shrink-0 mr-1 mb-1 hover:opacity-90 transition-opacity shadow-lg"
                    disabled={!input.trim() || queryMutation.isPending}
                    data-testid="button-submit"
                  >
                    <Send className="h-5 w-5 text-white" />
                  </Button>
                </div>
                <p className="text-xs text-center text-white/50 mt-2">
                  Press Enter to send, Shift + Enter for new line
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Maximized Table Dialog */}
      <Dialog open={!!maximizedTable} onOpenChange={() => setMaximizedTable(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] glass-dark border-white/20">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-white text-xl">Data Table (Full View)</DialogTitle>
              <Button
                size="sm"
                className="glass text-white hover:glass-hover"
                onClick={() => {
                  if (maximizedTable?.data && maximizedTable.data.length > 0) {
                    const headers = Object.keys(maximizedTable.data[0]);
                    const csv = [
                      headers.join(","),
                      ...maximizedTable.data.map((row: any) =>
                        headers.map((h) => JSON.stringify(row[h] ?? "")).join(",")
                      ),
                    ].join("\n");
                    
                    // Create download link
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `data-export-${Date.now()}.csv`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                    
                    toast({
                      title: "CSV Downloaded",
                      description: "Data exported successfully",
                    });
                  }
                }}
                data-testid="button-export-csv"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </DialogHeader>
          
          <div className="rounded-lg border border-white/10 mt-4 h-[calc(95vh-150px)] flex flex-col">
            <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0">
              {maximizedTable?.data && maximizedTable.data.length > 0 && (
                <Table>
                  <TableHeader className="bg-white/5 sticky top-0 z-10">
                    <TableRow className="hover:bg-transparent border-white/20">
                      {Object.keys(maximizedTable.data[0]).map((key) => (
                        <TableHead
                          key={key}
                          className="text-white font-semibold h-10 whitespace-nowrap px-4"
                        >
                          {key}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {maximizedTable.data.map((row: any, idx: number) => (
                      <TableRow
                        key={idx}
                        className="border-white/10 hover:bg-white/5 transition-colors"
                      >
                        {Object.values(row).map((value: any, colIdx: number) => (
                          <TableCell
                            key={colIdx}
                            className="text-white/90 py-2 whitespace-nowrap px-4"
                          >
                            {typeof value === "number"
                              ? value.toLocaleString()
                              : String(value ?? "")}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
          
          <div className="mt-4 text-sm text-white/60 text-center">
            Total Rows: {maximizedTable?.data?.length || 0}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
