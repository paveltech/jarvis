import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: text("session_id").notNull(),
  message: text("message").notNull(),
  sender: text("sender").notNull(), // 'user' or 'jarvis'
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  audioUrl: text("audio_url"), // for storing audio file URLs
  metadata: json("metadata"), // for storing additional data
});

export const insertConversationSchema = createInsertSchema(conversations).pick({
  sessionId: true,
  message: true,
  sender: true,
  audioUrl: true,
  metadata: true,
});

export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

// API request/response schemas
export const transcribeRequestSchema = z.object({
  audioBlob: z.string(), // base64 encoded audio
});

export const jarvisRequestSchema = z.object({
  message: z.string(),
  sessionId: z.string(),
});

export const jarvisResponseSchema = z.object({
  response: z.string(),
  audioUrl: z.string().optional(),
});

export type TranscribeRequest = z.infer<typeof transcribeRequestSchema>;
export type JarvisRequest = z.infer<typeof jarvisRequestSchema>;
export type JarvisResponse = z.infer<typeof jarvisResponseSchema>;
