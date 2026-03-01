import { query } from './db';
import type { Conversation, Message } from './types';

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export async function getOrCreateConversation(
  visitorId: number,
  locale: string,
  existingConversationId?: number
): Promise<Conversation> {
  // If a conversation ID is provided, try to resume it
  if (existingConversationId) {
    const existing = await query<Conversation>(
      `SELECT * FROM chatbot_conversations WHERE id = $1 AND visitor_id = $2 LIMIT 1`,
      [existingConversationId, visitorId]
    );
    if (existing.rows[0]) {
      const lastMsg = existing.rows[0].last_message_at;
      const elapsed = Date.now() - new Date(lastMsg).getTime();
      if (elapsed < SESSION_TIMEOUT_MS) {
        return existing.rows[0];
      }
    }
  }

  // Look for a recent active conversation
  const recent = await query<Conversation>(
    `SELECT * FROM chatbot_conversations
     WHERE visitor_id = $1 AND last_message_at > NOW() - INTERVAL '30 minutes'
     ORDER BY last_message_at DESC LIMIT 1`,
    [visitorId]
  );

  if (recent.rows[0]) return recent.rows[0];

  // Create new conversation
  const result = await query<Conversation>(
    `INSERT INTO chatbot_conversations (visitor_id, locale, message_count)
     VALUES ($1, $2, 0)
     RETURNING *`,
    [visitorId, locale]
  );
  return result.rows[0];
}

export async function getConversationHistory(
  conversationId: number,
  limit: number = 20
): Promise<Message[]> {
  const result = await query<Message>(
    `SELECT * FROM chatbot_messages
     WHERE conversation_id = $1
     ORDER BY created_at DESC LIMIT $2`,
    [conversationId, limit]
  );
  return result.rows.reverse();
}

export async function saveMessage(
  conversationId: number,
  role: 'user' | 'assistant',
  content: string,
  tokens: { input?: number; output?: number } = {}
): Promise<number> {
  const result = await query<{ id: number }>(
    `INSERT INTO chatbot_messages (conversation_id, role, content, input_tokens, output_tokens)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [conversationId, role, content, tokens.input || 0, tokens.output || 0]
  );

  // Update conversation stats
  await query(
    `UPDATE chatbot_conversations
     SET message_count = message_count + 1, last_message_at = NOW()
     WHERE id = $1`,
    [conversationId]
  );

  return result.rows[0].id;
}
