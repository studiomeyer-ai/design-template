import { query } from './db';

export async function incrementDailyStat(
  field: 'conversations' | 'messages' | 'leads' | 'tickets' | 'canned_hits' | 'blocked_messages',
  increment: number = 1
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  await query(
    `INSERT INTO chatbot_daily_stats (date, ${field})
     VALUES ($1, $2)
     ON CONFLICT (date)
     DO UPDATE SET ${field} = chatbot_daily_stats.${field} + $2`,
    [today, increment]
  );
}
