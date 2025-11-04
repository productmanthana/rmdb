/**
 * localStorage-based chat persistence
 * Chats persist until browser data is cleared
 */

export interface StoredChat {
  id: string;
  title: string;
  created_at: string;
  messages: StoredMessage[];
}

export interface StoredMessage {
  id: string;
  type: "user" | "bot";
  content: string;
  response?: any;
  ai_analysis_messages?: Array<{
    id: string;
    type: "user" | "assistant";
    content: string;
    response?: any;
  }>;
}

const STORAGE_KEY = "rmone_chats";

class ChatStorage {
  private getChats(): StoredChat[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("Failed to load chats from localStorage:", error);
      return [];
    }
  }

  private saveChats(chats: StoredChat[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
    } catch (error) {
      console.error("Failed to save chats to localStorage:", error);
    }
  }

  getAllChats(): StoredChat[] {
    return this.getChats();
  }

  getChat(chatId: string): StoredChat | null {
    const chats = this.getChats();
    return chats.find(chat => chat.id === chatId) || null;
  }

  createChat(title: string): StoredChat {
    const chats = this.getChats();
    const newChat: StoredChat = {
      id: Date.now().toString(),
      title: title.slice(0, 100),
      created_at: new Date().toISOString(),
      messages: []
    };
    chats.unshift(newChat); // Add to beginning
    this.saveChats(chats);
    return newChat;
  }

  addMessage(chatId: string, message: StoredMessage): void {
    const chats = this.getChats();
    const chat = chats.find(c => c.id === chatId);
    if (chat) {
      // Limit data size for large datasets to avoid localStorage quota errors
      const messageToStore = this.limitMessageSize(message);
      chat.messages.push(messageToStore);
      this.saveChats(chats);
    }
  }
  
  private limitMessageSize(message: StoredMessage): StoredMessage {
    // If response has large data array (>500 rows), store only metadata
    // Browser localStorage has ~5-10MB limit, so we need to be conservative
    if (message.response?.data && Array.isArray(message.response.data) && message.response.data.length > 500) {
      return {
        ...message,
        response: {
          ...message.response,
          data: [], // Don't store large data arrays
          _data_truncated: true,
          _original_count: message.response.data.length,
        }
      };
    }
    return message;
  }

  updateMessage(chatId: string, messageId: string, updates: Partial<StoredMessage>): void {
    const chats = this.getChats();
    const chat = chats.find(c => c.id === chatId);
    if (chat) {
      const messageIndex = chat.messages.findIndex(m => m.id === messageId);
      if (messageIndex !== -1) {
        const updatedMessage = {
          ...chat.messages[messageIndex],
          ...updates
        };
        // Limit size before saving
        chat.messages[messageIndex] = this.limitMessageSize(updatedMessage);
        this.saveChats(chats);
      }
    }
  }

  deleteChat(chatId: string): void {
    const chats = this.getChats();
    const filtered = chats.filter(c => c.id !== chatId);
    this.saveChats(filtered);
  }

  deleteChats(chatIds: string[]): void {
    const chats = this.getChats();
    const filtered = chats.filter(c => !chatIds.includes(c.id));
    this.saveChats(filtered);
  }

  clearAll(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export const chatStorage = new ChatStorage();
