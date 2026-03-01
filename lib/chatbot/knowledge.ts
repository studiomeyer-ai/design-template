import { query } from './db';

export async function searchKnowledge(
  searchQuery: string,
  limit: number = 3
): Promise<string> {
  const results = await query<{ title: string; content: string; source_url: string }>(
    `SELECT title, content, source_url
     FROM chatbot_knowledge
     WHERE search_vector @@ plainto_tsquery('english', $1)
        OR similarity(content, $1) > 0.2
     ORDER BY ts_rank(search_vector, plainto_tsquery('english', $1))
            + similarity(content, $1) DESC
     LIMIT $2`,
    [searchQuery, limit]
  );

  if (results.rows.length === 0) return '';

  const parts = ['[KNOWLEDGE BASE]'];
  for (const r of results.rows) {
    parts.push(`\n### ${r.title}`);
    parts.push(r.content);
  }

  return parts.join('\n');
}

export async function addKnowledge(
  sourceUrl: string,
  title: string,
  content: string,
  chunkIndex: number = 0
): Promise<number> {
  const result = await query<{ id: number }>(
    `INSERT INTO chatbot_knowledge (source_url, title, content, chunk_index)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (source_url, chunk_index)
     DO UPDATE SET title = $2, content = $3, updated_at = NOW()
     RETURNING id`,
    [sourceUrl, title, content, chunkIndex]
  );
  return result.rows[0].id;
}
