import { useState, useEffect, useRef } from "react";
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

// Component to handle table with external scrollbar
function TableWithExternalScrollbar({ data, messageId, height = "400px" }: { data: any[]; messageId: string; height?: string }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const scrollbarRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollbarContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const scrollbar = scrollbarRef.current;
    const content = contentRef.current;
    const scrollbarContent = scrollbarContentRef.current;

    if (!wrapper || !scrollbar || !content || !scrollbarContent) return;

    // Set scrollbar content width to match table width
    const updateScrollbarWidth = () => {
      scrollbarContent.style.width = `${content.scrollWidth}px`;
    };
    
    updateScrollbarWidth();
    // Update on window resize
    window.addEventListener('resize', updateScrollbarWidth);

    let syncing = false;

    // Sync scrollbar to table
    const handleScrollbarScroll = () => {
      if (!syncing) {
        syncing = true;
        wrapper.scrollLeft = scrollbar.scrollLeft;
        requestAnimationFrame(() => {
          syncing = false;
        });
      }
    };

    // Sync table to scrollbar
    const handleWrapperScroll = () => {
      if (!syncing) {
        syncing = true;
        scrollbar.scrollLeft = wrapper.scrollLeft;
        requestAnimationFrame(() => {
          syncing = false;
        });
      }
    };

    scrollbar.addEventListener('scroll', handleScrollbarScroll);
    wrapper.addEventListener('scroll', handleWrapperScroll);

    return () => {
      scrollbar.removeEventListener('scroll', handleScrollbarScroll);
      wrapper.removeEventListener('scroll', handleWrapperScroll);
      window.removeEventListener('resize', updateScrollbarWidth);
    };
  }, [data]);

  return (
    <div>
      <div
        ref={wrapperRef}
        className="overflow-y-auto overflow-x-hidden rounded-lg border border-white/10"
        style={{ height }}
      >
        <div ref={contentRef} className="inline-block min-w-full">
          <Table>
            <TableHeader className="bg-white/5 sticky top-0 z-10">
              <TableRow className="hover:bg-transparent border-white/20">
                {Object.keys(data[0]).map((key) => (
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
              {data.map((row: any, idx: number) => (
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
        </div>
      </div>

      {/* External horizontal scrollbar */}
      <div
        ref={scrollbarRef}
        className="mt-2 overflow-x-auto overflow-y-hidden h-4 rounded bg-white/5"
        style={{ scrollbarWidth: 'thin' }}
      >
        <div ref={scrollbarContentRef} style={{ height: '1px' }} />
      </div>
    </div>
  );
}

// Component for maximized table with external scrollbars (both horizontal and vertical)
function MaximizedTableWithScrollbars({ data }: { data: any[] }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const hScrollbarRef = useRef<HTMLDivElement>(null);
  const vScrollbarRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const hScrollbarContentRef = useRef<HTMLDivElement>(null);
  const vScrollbarContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const hScrollbar = hScrollbarRef.current;
    const vScrollbar = vScrollbarRef.current;
    const content = contentRef.current;
    const hScrollbarContent = hScrollbarContentRef.current;
    const vScrollbarContent = vScrollbarContentRef.current;

    if (!wrapper || !hScrollbar || !vScrollbar || !content || !hScrollbarContent || !vScrollbarContent) return;

    // Set scrollbar content sizes
    const updateScrollbarSizes = () => {
      hScrollbarContent.style.width = `${content.scrollWidth}px`;
      vScrollbarContent.style.height = `${content.scrollHeight}px`;
    };
    
    updateScrollbarSizes();
    window.addEventListener('resize', updateScrollbarSizes);

    let syncing = false;

    // Horizontal scrollbar sync
    const handleHScrollbarScroll = () => {
      if (!syncing) {
        syncing = true;
        wrapper.scrollLeft = hScrollbar.scrollLeft;
        requestAnimationFrame(() => { syncing = false; });
      }
    };

    // Vertical scrollbar sync
    const handleVScrollbarScroll = () => {
      if (!syncing) {
        syncing = true;
        wrapper.scrollTop = vScrollbar.scrollTop;
        requestAnimationFrame(() => { syncing = false; });
      }
    };

    // Wrapper scroll sync (both directions)
    const handleWrapperScroll = () => {
      if (!syncing) {
        syncing = true;
        hScrollbar.scrollLeft = wrapper.scrollLeft;
        vScrollbar.scrollTop = wrapper.scrollTop;
        requestAnimationFrame(() => { syncing = false; });
      }
    };

    hScrollbar.addEventListener('scroll', handleHScrollbarScroll);
    vScrollbar.addEventListener('scroll', handleVScrollbarScroll);
    wrapper.addEventListener('scroll', handleWrapperScroll);

    return () => {
      hScrollbar.removeEventListener('scroll', handleHScrollbarScroll);
      vScrollbar.removeEventListener('scroll', handleVScrollbarScroll);
      wrapper.removeEventListener('scroll', handleWrapperScroll);
      window.removeEventListener('resize', updateScrollbarSizes);
    };
  }, [data]);

  return (
    <div className="flex gap-2 h-full">
      <div className="flex-1 flex flex-col min-w-0">
        <div
          ref={wrapperRef}
          className="flex-1 overflow-auto scrollbar-hide rounded-lg border border-white/10"
        >
          <div ref={contentRef} className="inline-block min-w-full">
            <Table>
              <TableHeader className="bg-white/5 sticky top-0 z-10">
                <TableRow className="hover:bg-transparent border-white/20">
                  {Object.keys(data[0]).map((key) => (
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
                {data.map((row: any, idx: number) => (
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

        {/* External horizontal scrollbar */}
        <div
          ref={hScrollbarRef}
          className="mt-2 overflow-x-auto overflow-y-hidden h-4 rounded bg-white/5 flex-shrink-0"
          style={{ scrollbarWidth: 'thin' }}
        >
          <div ref={hScrollbarContentRef} style={{ height: '1px' }} />
        </div>
      </div>

      {/* External vertical scrollbar */}
      <div
        ref={vScrollbarRef}
        className="overflow-y-auto overflow-x-hidden w-4 rounded bg-white/5 flex-shrink-0"
        style={{ scrollbarWidth: 'thin' }}
      >
        <div ref={vScrollbarContentRef} style={{ width: '1px' }} />
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChats, setSelectedChats] = useState<Set<string>>(new Set());
  const [aiAnalysisInputs, setAiAnalysisInputs] = useState<Record<string, string>>({});
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState<Record<string, boolean>>({});
  const [maximizedTable, setMaximizedTable] = useState<{ messageId: string; data: any[] } | null>(null);
  const [activeTabPerMessage, setActiveTabPerMessage] = useState<Record<string, string>>({});
  const [followUpVisible, setFollowUpVisible] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  // Keep ref in sync with messages state
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

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
      // Get the last bot message to use as previous context for follow-up queries
      // Use messagesRef.current to get the latest messages (not stale closure)
      const lastBotMessage = messagesRef.current.filter(m => m.type === "bot").pop();
      const previousContext = lastBotMessage?.response?.function_name && lastBotMessage?.response?.arguments ? {
        question: lastBotMessage.response.question || "",
        function_name: lastBotMessage.response.function_name,
        arguments: lastBotMessage.response.arguments,
      } : undefined;

      console.log('[ChatPage] Sending query:', question);
      console.log('[ChatPage] Previous context:', previousContext);

      const res = await apiRequest("POST", "/api/query", { 
        question,
        previousContext 
      });
      const data = await res.json() as Promise<QueryResponse>;
      console.log('[ChatPage] Response:', data);
      return data;
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

    // Check if we've reached the 3 follow-up question limit
    const userFollowUpCount = (message.aiAnalysisMessages || []).filter(m => m.type === "user").length;
    if (userFollowUpCount >= 3) {
      toast({
        variant: "destructive",
        title: "Follow-up Limit Reached",
        description: "Maximum 3 follow-up questions allowed. Please start a new query.",
      });
      return;
    }

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
      // Execute a new SQL query with follow-up question and previous context
      const res = await apiRequest("POST", "/api/query", {
        question: question.trim(),
        previousContext: message.response.function_name && message.response.arguments ? {
          question: message.content.trim(),
          function_name: message.response.function_name,
          arguments: message.response.arguments,
        } : undefined,
      });

      const data = await res.json() as QueryResponse;

      // Add assistant response with full query results
      const assistantMsg: AIAnalysisMessage = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content: "",
        response: data,
      };

      setMessages(prev => prev.map(m => {
        if (m.id === messageId) {
          // Update the original message's context if this follow-up refined it
          // This ensures future follow-ups build on the cumulative refined context
          // We update context whenever the follow-up was successful and returned arguments
          // even if the function name changed (Azure may classify refinements differently)
          const shouldUpdateContext = 
            data.success && 
            data.function_name &&
            data.arguments;

          const updatedMessages = [...(m.aiAnalysisMessages || []), assistantMsg];
          const newUserCount = updatedMessages.filter(msg => msg.type === "user").length;

          // If we've reached 3 follow-ups, automatically close the follow-up section
          if (newUserCount >= 3) {
            setTimeout(() => {
              setFollowUpVisible(prev => ({ ...prev, [messageId]: false }));
            }, 1500); // Small delay to let user see the response before closing
          }

          return {
            ...m,
            aiAnalysisMessages: updatedMessages,
            // Update the parent response with refined function and arguments
            response: shouldUpdateContext ? {
              ...m.response!,
              function_name: data.function_name,
              arguments: data.arguments,
            } : m.response,
          };
        }
        return m;
      }));

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
                      className="mt-1 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                      data-testid={`checkbox-chat-${chat.id}`}
                    />
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <p className="text-sm text-white font-medium line-clamp-2 break-words">
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
                                  <Tabs 
                                    value={activeTabPerMessage[message.id] || "data"}
                                    className="w-full"
                                    onValueChange={(value) => {
                                      setActiveTabPerMessage(prev => ({
                                        ...prev,
                                        [message.id]: value
                                      }));
                                    }}
                                  >
                                    <TabsList className="glass border-0">
                                      <TabsTrigger value="data" className="text-white data-[state=active]:glass-input" data-testid="tab-data">
                                        Response
                                      </TabsTrigger>
                                      <TabsTrigger value="chart" className="text-white data-[state=active]:glass-input" data-testid="tab-chart">
                                        Chart
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
                                        {message.response.data && message.response.data.length > 0 ? (
                                          <TableWithExternalScrollbar 
                                            data={message.response.data}
                                            messageId={message.id}
                                          />
                                        ) : (
                                          <div className="rounded-lg border border-white/10 p-8 text-center text-white/50">
                                            No data available
                                          </div>
                                        )}
                                      </div>

                                      {/* AI Analysis Section with Integrated Follow-up */}
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
                                        ) : (!message.response.data || message.response.data.length === 0) ? (
                                          <div className="glass-dark rounded-lg p-4 text-center">
                                            <div className="flex items-center justify-center gap-2 text-white/60">
                                              <AlertCircle className="h-5 w-5" />
                                              <span>No data available for AI analysis</span>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="glass-dark rounded-lg p-4 text-center">
                                            <div className="flex items-center justify-center gap-2 text-white/60">
                                              <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                              <span>Generating AI analysis...</span>
                                            </div>
                                          </div>
                                        )}

                                        {/* Follow-up Questions Integration */}
                                        {(message.response.data && message.response.data.length > 0) && (
                                          <div className="mt-4 pt-4 border-t border-white/10">
                                            <div className="flex items-center justify-between mb-4">
                                              <div className="flex items-center gap-2">
                                                <MessageSquare className="h-5 w-5 text-white/70" />
                                                <span className="text-sm text-white/70">Follow up questions</span>
                                                <span className="text-xs text-white/50 ml-2">
                                                  ({((message.aiAnalysisMessages || []).filter(m => m.type === "user").length)}/3)
                                                </span>
                                              </div>
                                              <Button
                                              size="sm"
                                              variant="ghost"
                                              className="glass text-white hover:glass-hover"
                                              onClick={() => {
                                                setFollowUpVisible(prev => ({
                                                  ...prev,
                                                  [message.id]: !prev[message.id]
                                                }));
                                              }}
                                              data-testid={`button-toggle-followup-${message.id}`}
                                            >
                                              {followUpVisible[message.id] ? (
                                                <>
                                                  <X className="h-4 w-4 mr-1" />
                                                  Hide
                                                </>
                                              ) : (
                                                <>
                                                  <Plus className="h-4 w-4 mr-1" />
                                                  Ask Question
                                                </>
                                              )}
                                            </Button>
                                          </div>

                                          {/* Follow-up Content - Only show when visible */}
                                          {followUpVisible[message.id] && (
                                            <div className="space-y-4">
                                              {/* Follow-up Chat History */}
                                              {message.aiAnalysisMessages && message.aiAnalysisMessages.length > 0 && (
                                                <div className="space-y-6 mb-4">
                                                  {message.aiAnalysisMessages.map((msg) => (
                                                    <div key={msg.id} className="space-y-3">
                                                      {/* User Question */}
                                                      <div className="flex justify-end">
                                                        <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-lg p-3 max-w-[80%]">
                                                          <p className="text-sm text-white font-medium">{msg.content}</p>
                                                        </div>
                                                      </div>

                                                      {/* Query Response with Tabs */}
                                                      {msg.response && msg.response.success && (
                                                        <Tabs defaultValue="data" className="w-full">
                                                          <TabsList className="glass border-0">
                                                            <TabsTrigger value="data" className="text-white data-[state=active]:glass-input">
                                                              Response
                                                            </TabsTrigger>
                                                            <TabsTrigger value="chart" className="text-white data-[state=active]:glass-input">
                                                              Chart
                                                            </TabsTrigger>
                                                            <TabsTrigger value="logs" className="text-white data-[state=active]:glass-input">
                                                              Logs
                                                            </TabsTrigger>
                                                          </TabsList>

                                                          <TabsContent value="data" className="space-y-4 mt-4">
                                                            {msg.response.data && msg.response.data.length > 0 ? (
                                                              <TableWithExternalScrollbar 
                                                                data={msg.response.data}
                                                                messageId={`followup-${msg.id}`}
                                                                height="300px"
                                                              />
                                                            ) : (
                                                              <div className="glass rounded-lg p-8 text-center text-white/50">
                                                                No data available
                                                              </div>
                                                            )}
                                                          </TabsContent>

                                                          <TabsContent value="chart" className="space-y-4 mt-4">
                                                            {msg.response.chart_config ? (
                                                              <div className="glass-dark rounded-lg p-4">
                                                                <ChartVisualization config={msg.response.chart_config} />
                                                              </div>
                                                            ) : (
                                                              <div className="glass rounded-lg p-6 text-center text-white/50">
                                                                No chart available
                                                              </div>
                                                            )}
                                                          </TabsContent>

                                                          <TabsContent value="logs" className="space-y-4 mt-4">
                                                            <div className="glass-dark rounded-lg p-4">
                                                              {/* SQL Query */}
                                                              <div className="mb-3">
                                                                <p className="text-xs text-white/70 mb-2 font-mono">SQL QUERY:</p>
                                                                <div className="glass rounded-lg p-3 overflow-x-auto">
                                                                  <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">
                                                                    {msg.response.sql_query || "No SQL query available"}
                                                                  </pre>
                                                                </div>
                                                              </div>

                                                              {/* SQL Parameters */}
                                                              <div className="mb-3">
                                                                <p className="text-xs text-white/70 mb-2 font-mono">PARAMETERS:</p>
                                                                <div className="glass rounded-lg p-3 overflow-x-auto">
                                                                  <pre className="text-xs text-blue-400 font-mono">
                                                                    {JSON.stringify(msg.response.sql_params || [], null, 2)}
                                                                  </pre>
                                                                </div>
                                                              </div>

                                                              {/* Raw JSON Response */}
                                                              <div>
                                                                <div className="flex items-center justify-between mb-2">
                                                                  <p className="text-xs text-white/70 font-mono">RAW JSON RESPONSE:</p>
                                                                  <Button
                                                                    size="sm"
                                                                    className="glass text-white hover:glass-hover h-6"
                                                                    onClick={() => {
                                                                      copyToClipboard(JSON.stringify(msg.response, null, 2));
                                                                    }}
                                                                  >
                                                                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                                                    <span className="ml-1 text-xs">Copy</span>
                                                                  </Button>
                                                                </div>
                                                                <div className="glass rounded-lg p-3 overflow-x-auto">
                                                                  <ScrollArea className="h-[200px]">
                                                                    <pre className="text-xs text-purple-400 font-mono">
                                                                      {JSON.stringify(msg.response, null, 2)}
                                                                    </pre>
                                                                  </ScrollArea>
                                                                </div>
                                                              </div>
                                                            </div>
                                                          </TabsContent>
                                                        </Tabs>
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
                                              )}

                                              {/* Typing Indicator */}
                                              {aiAnalysisLoading[message.id] && (
                                                <div className="flex items-start gap-3">
                                                  <div className="glass-dark rounded-xl p-4">
                                                    <TypingIndicator />
                                                  </div>
                                                </div>
                                              )}

                                              {/* Follow-up Input */}
                                              {(() => {
                                                const userFollowUpCount = (message.aiAnalysisMessages || []).filter(m => m.type === "user").length;
                                                const limitReached = userFollowUpCount >= 3;

                                                return limitReached ? (
                                                  <div className="glass-dark rounded-xl p-4 border border-white/10">
                                                    <div className="flex items-center gap-3">
                                                      <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                                                        <AlertCircle className="h-5 w-5 text-white/70" />
                                                      </div>
                                                      <div>
                                                        <p className="text-sm font-medium text-white">Follow-up Limit Reached</p>
                                                        <p className="text-xs text-white/60 mt-1">
                                                          You've asked 3 follow-up questions. Please start a new query to continue exploring the data.
                                                        </p>
                                                      </div>
                                                    </div>
                                                  </div>
                                                ) : (
                                                  <div className="space-y-2">
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
                                                          onKeyDown={(e) => {
                                                            if (e.key === "Enter" && !e.shiftKey) {
                                                              e.preventDefault();
                                                              if (aiAnalysisInputs[message.id]?.trim() && !aiAnalysisLoading[message.id]) {
                                                                handleAIAnalysis(message.id, aiAnalysisInputs[message.id] || "");
                                                              }
                                                            }
                                                          }}
                                                          placeholder="Ask a follow-up question... (Press Enter to send, Shift+Enter for new line)"
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
                                                    <p className="text-xs text-white/50 px-2">
                                                      {userFollowUpCount}/3 follow-up questions used
                                                    </p>
                                                  </div>
                                                );
                                              })()}
                                            </div>
                                          )}
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

          {/* Glassmorphic Input Area - Hide when follow-up section is open */}
          {(() => {
            // Check if any follow-up section is currently visible
            const anyFollowUpVisible = Object.values(followUpVisible).some(visible => visible === true);
            
            // Hide main input if a follow-up section is open
            if (anyFollowUpVisible) {
              return (
                <div className="glass-dark border-t border-white/10 shrink-0">
                  <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-center gap-3">
                      <p className="text-sm text-white/60">
                        Close the follow-up section above to ask a new question
                      </p>
                    </div>
                  </div>
                </div>
              );
            }

            // Show main input
            return (
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
            );
          })()}
        </div>
      </div>

      {/* Maximized Table Dialog */}
      <Dialog open={!!maximizedTable} onOpenChange={() => setMaximizedTable(null)}>
        <DialogContent className="max-w-[95vw] h-[95vh] glass-dark border-white/20 flex flex-col p-6">
          <DialogHeader className="flex-shrink-0">
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
          
          <div className="flex-1 min-h-0 mt-4">
            {maximizedTable?.data && maximizedTable.data.length > 0 && (
              <MaximizedTableWithScrollbars data={maximizedTable.data} />
            )}
          </div>
          
          <div className="mt-4 text-sm text-white/60 text-center flex-shrink-0">
            Total Rows: {maximizedTable?.data?.length || 0}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
