import { query } from './db';
import type { TicketPriority } from './types';

const ESCALATION_KEYWORDS = {
  de: ['bug', 'fehler', 'kaputt', 'funktioniert nicht', 'problem', 'hilfe', 'support', 'dringend', 'urgent'],
  en: ['bug', 'error', 'broken', 'not working', 'problem', 'help', 'support', 'urgent', 'critical'],
  es: ['bug', 'error', 'roto', 'no funciona', 'problema', 'ayuda', 'soporte', 'urgente', 'crítico'],
};

export function detectEscalation(message: string, locale: string): { shouldEscalate: boolean; topic: string } {
  const keywords = ESCALATION_KEYWORDS[locale as keyof typeof ESCALATION_KEYWORDS] || ESCALATION_KEYWORDS.en;
  const lower = message.toLowerCase();

  for (const keyword of keywords) {
    if (lower.includes(keyword)) {
      return { shouldEscalate: true, topic: keyword };
    }
  }
  return { shouldEscalate: false, topic: '' };
}

export async function createTicket(
  visitorId: number,
  conversationId: number,
  topic: string,
  summary: string,
  priority: TicketPriority = 'medium'
): Promise<number> {
  const result = await query<{ id: number }>(
    `INSERT INTO chatbot_tickets (visitor_id, conversation_id, topic, summary, priority)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [visitorId, conversationId, topic, summary, priority]
  );

  // Send Telegram alert
  await sendTelegramAlert(result.rows[0].id, topic, summary, priority);

  return result.rows[0].id;
}

async function sendTelegramAlert(
  ticketId: number,
  topic: string,
  summary: string,
  priority: TicketPriority
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) return;

  const priorityEmoji = priority === 'high' ? '🔴' : priority === 'medium' ? '🟡' : '🟢';
  const text = `${priorityEmoji} *Support Ticket #${ticketId}*\n\n*Topic:* ${topic}\n*Priority:* ${priority}\n*Summary:* ${summary}\n\nhttps://example.com`;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
      }),
    });
  } catch {
    // Silently fail — don't break chat for Telegram issues
  }
}

// Detect lead info from message
export function detectLeadInfo(message: string): { name?: string; email?: string } {
  const result: { name?: string; email?: string } = {};

  // Email detection
  const emailMatch = message.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  if (emailMatch) result.email = emailMatch[0];

  // Name detection (simple heuristic: "Ich bin X" / "My name is X" / "Me llamo X")
  const namePatterns = [
    /(?:ich bin|mein name ist|ich hei[ßs]e)\s+([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?)/i,
    /(?:my name is|i'm|i am)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /(?:me llamo|soy)\s+([A-ZÁÉÍÓÚ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚ][a-záéíóúñ]+)?)/i,
  ];

  for (const pattern of namePatterns) {
    const nameMatch = message.match(pattern);
    if (nameMatch) {
      result.name = nameMatch[1];
      break;
    }
  }

  return result;
}
