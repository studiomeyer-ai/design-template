import { query } from './db';

export async function checkCannedResponse(
  message: string,
  locale: string
): Promise<string | null> {
  const localeColumn = locale === 'en' ? 'response_en'
    : locale === 'es' ? 'response_es'
    : 'response_de';

  // Check against trigger patterns with trigram similarity
  const result = await query<{ response: string }>(
    `SELECT ${localeColumn} as response
     FROM chatbot_canned_responses
     WHERE is_active = true
       AND EXISTS (
         SELECT 1 FROM unnest(trigger_patterns) AS pattern
         WHERE similarity(LOWER($1), LOWER(pattern)) > 0.4
            OR LOWER($1) LIKE '%' || LOWER(pattern) || '%'
       )
     LIMIT 1`,
    [message]
  );

  return result.rows[0]?.response || null;
}
