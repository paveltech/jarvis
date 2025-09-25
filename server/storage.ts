import { type Conversation, type InsertConversation } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getConversations(sessionId: string): Promise<Conversation[]>;
  addConversation(conversation: InsertConversation): Promise<Conversation>;
}

export class MemStorage implements IStorage {
  private conversations: Map<string, Conversation>;

  constructor() {
    this.conversations = new Map();
  }

  async getConversations(sessionId: string): Promise<Conversation[]> {
    return Array.from(this.conversations.values())
      .filter(conv => conv.sessionId === sessionId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  async addConversation(insertConversation: InsertConversation): Promise<Conversation> {
    const id = randomUUID();
    const conversation: Conversation = {
      ...insertConversation,
      id,
      timestamp: new Date(),
      metadata: insertConversation.metadata || null,
      audioUrl: insertConversation.audioUrl || null,
    };
    this.conversations.set(id, conversation);
    return conversation;
  }
}

export const storage = new MemStorage();
