import { query } from './db';
import type { Visitor } from './types';

export async function getOrCreateVisitor(hash: string, locale: string): Promise<Visitor> {
  // Try to find existing visitor
  const existing = await query<Visitor>(
    `SELECT * FROM chatbot_visitors WHERE hash = $1 LIMIT 1`,
    [hash]
  );

  if (existing.rows[0]) {
    // Update last_seen + visits
    await query(
      `UPDATE chatbot_visitors SET last_seen = NOW(), visits = visits + 1, locale = $2 WHERE id = $1`,
      [existing.rows[0].id, locale]
    );
    return { ...existing.rows[0], visits: existing.rows[0].visits + 1 };
  }

  // Create new visitor
  const result = await query<Visitor>(
    `INSERT INTO chatbot_visitors (hash, locale, visits, interests)
     VALUES ($1, $2, 1, '{}')
     RETURNING *`,
    [hash, locale]
  );
  return result.rows[0];
}

export async function updateVisitorInfo(
  visitorId: number,
  updates: { displayName?: string; email?: string }
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (updates.displayName) {
    sets.push(`display_name = $${idx++}`);
    params.push(updates.displayName);
  }
  if (updates.email) {
    sets.push(`email = $${idx++}`);
    params.push(updates.email);
  }

  if (sets.length === 0) return;

  params.push(visitorId);
  await query(
    `UPDATE chatbot_visitors SET ${sets.join(', ')} WHERE id = $${idx}`,
    params
  );
}

export async function updateInterests(visitorId: number, newInterests: string[]): Promise<void> {
  await query(
    `UPDATE chatbot_visitors
     SET interests = (
       SELECT array_agg(DISTINCT elem)
       FROM unnest(interests || $2::text[]) AS elem
     )
     WHERE id = $1`,
    [visitorId, newInterests]
  );
}

export async function getVisitorContext(visitorId: number): Promise<string> {
  const v = await query<Visitor>(
    `SELECT * FROM chatbot_visitors WHERE id = $1`,
    [visitorId]
  );

  if (!v.rows[0]) return '';

  const visitor = v.rows[0];
  const parts: string[] = [];

  if (visitor.display_name) parts.push(`Name: ${visitor.display_name}`);
  if (visitor.email) parts.push(`Email: ${visitor.email}`);
  if (visitor.visits > 1) parts.push(`Returning visitor (${visitor.visits} visits)`);
  if (visitor.interests.length > 0) parts.push(`Interests: ${visitor.interests.join(', ')}`);

  return parts.length > 0 ? `[VISITOR CONTEXT]\n${parts.join('\n')}` : '';
}
