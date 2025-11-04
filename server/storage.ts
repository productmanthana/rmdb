import { type Chat, type InsertChat, type Message, type InsertMessage, chats, messages } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getAllChats(sessionId: string): Promise<Chat[]>;
  getChat(chatId: string): Promise<Chat | undefined>;
  createChat(chat: InsertChat): Promise<Chat>;
  updateChatTitle(chatId: string, title: string): Promise<void>;
  deleteChat(chatId: string): Promise<void>;
  getChatMessages(chatId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
}

export class DbStorage implements IStorage {
  async getAllChats(sessionId: string): Promise<Chat[]> {
    if (!db) throw new Error("Database not initialized");
    
    const result = await db
      .select()
      .from(chats)
      .where(eq(chats.session_id, sessionId))
      .orderBy(desc(chats.updated_at));
    
    return result;
  }

  async getChat(chatId: string): Promise<Chat | undefined> {
    if (!db) throw new Error("Database not initialized");
    
    const result = await db
      .select()
      .from(chats)
      .where(eq(chats.id, chatId))
      .limit(1);
    
    return result[0];
  }

  async createChat(insertChat: InsertChat): Promise<Chat> {
    if (!db) throw new Error("Database not initialized");
    
    const chatId = insertChat.id || `chat-${randomUUID()}`;
    
    const result = await db
      .insert(chats)
      .values({
        ...insertChat,
        id: chatId,
      })
      .returning();
    
    return result[0];
  }

  async updateChatTitle(chatId: string, title: string): Promise<void> {
    if (!db) throw new Error("Database not initialized");
    
    await db
      .update(chats)
      .set({ 
        title, 
        updated_at: new Date() 
      })
      .where(eq(chats.id, chatId));
  }

  async deleteChat(chatId: string): Promise<void> {
    if (!db) throw new Error("Database not initialized");
    
    await db.delete(messages).where(eq(messages.chat_id, chatId));
    await db.delete(chats).where(eq(chats.id, chatId));
  }

  async getChatMessages(chatId: string): Promise<Message[]> {
    if (!db) throw new Error("Database not initialized");
    
    const result = await db
      .select()
      .from(messages)
      .where(eq(messages.chat_id, chatId))
      .orderBy(messages.timestamp);
    
    return result;
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    if (!db) throw new Error("Database not initialized");
    
    const messageId = insertMessage.id || `msg-${randomUUID()}`;
    
    const result = await db
      .insert(messages)
      .values({
        ...insertMessage,
        id: messageId,
      })
      .returning();
    
    return result[0];
  }
}

export const storage = new DbStorage();
