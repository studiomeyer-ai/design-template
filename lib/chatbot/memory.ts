import { query } from './db';
import type { DecisionCategory, LearningCategory, PatternType, SessionStats } from './types';

const HALF_LIFE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function temporalDecay(createdAt: Date): number {
  const ageMs = Date.now() - createdAt.getTime();
  return Math.pow(0.5, ageMs / HALF_LIFE_MS);
}

// ─── Sessions ────────────────────────────────────────

export async function startSession(context: string, focus?: string): Promise<number> {
  const result = await query<{ id: number }>(
    `INSERT INTO chatbot_sessions (context, focus) VALUES ($1, $2) RETURNING id`,
    [context, focus || null]
  );
  return result.rows[0].id;
}

export async function endSession(
  sessionId: number,
  summary: string,
  stats: SessionStats
): Promise<void> {
  await query(
    `UPDATE chatbot_sessions
     SET ended_at = NOW(), summary = $2,
         messages_handled = $3, leads_detected = $4,
         tickets_created = $5, learnings_created = $6
     WHERE id = $1`,
    [sessionId, summary, stats.messagesHandled, stats.leadsDetected,
     stats.ticketsCreated, stats.learningsCreated]
  );
}

// ─── Decisions ───────────────────────────────────────

export async function logDecision(input: {
  sessionId?: number;
  category: DecisionCategory;
  question: string;
  options: string[];
  chosen: string;
  reasoning: string;
  context?: string;
  prediction?: string;
  predictionScore?: number;
}): Promise<number> {
  const result = await query<{ id: number }>(
    `INSERT INTO chatbot_decisions
     (session_id, category, question, options, chosen, reasoning, context, prediction, prediction_score)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      input.sessionId || null, input.category, input.question,
      JSON.stringify(input.options), input.chosen, input.reasoning,
      input.context || null, input.prediction || null, input.predictionScore || null,
    ]
  );
  return result.rows[0].id;
}

export async function trackOutcome(
  decisionId: number,
  outcome: string,
  actualScore: number
): Promise<void> {
  // Get prediction score
  const dec = await query<{ prediction_score: number | null }>(
    `SELECT prediction_score FROM chatbot_decisions WHERE id = $1`,
    [decisionId]
  );
  const predicted = dec.rows[0]?.prediction_score || 0;
  const accuracy = predicted > 0
    ? Math.max(0, 100 - (Math.abs(predicted - actualScore) / predicted) * 100)
    : null;

  await query(
    `UPDATE chatbot_decisions
     SET outcome = $2, actual_score = $3, accuracy = $4, outcome_at = NOW()
     WHERE id = $1`,
    [decisionId, outcome, actualScore, accuracy]
  );
}

// ─── Learnings ───────────────────────────────────────

export async function createLearning(
  category: LearningCategory,
  insight: string,
  confidence: number = 0.5,
  evidence?: string[]
): Promise<number> {
  // Deduplicate: check for similar existing learning
  const similar = await query<{ id: number; confidence: number }>(
    `SELECT id, confidence FROM chatbot_learnings
     WHERE is_archived = false AND similarity(insight, $1) > 0.5
     ORDER BY similarity(insight, $1) DESC LIMIT 1`,
    [insight]
  );

  if (similar.rows[0]) {
    // Boost existing learning
    const newConf = Math.min(1.0, similar.rows[0].confidence + 0.1);
    await query(
      `UPDATE chatbot_learnings
       SET confidence = $2, times_confirmed = times_confirmed + 1, updated_at = NOW()
       WHERE id = $1`,
      [similar.rows[0].id, newConf]
    );
    return similar.rows[0].id;
  }

  const result = await query<{ id: number }>(
    `INSERT INTO chatbot_learnings (category, insight, confidence, evidence, source)
     VALUES ($1, $2, $3, $4, 'autonomous')
     RETURNING id`,
    [category, insight, confidence, evidence ? JSON.stringify(evidence) : '[]']
  );
  return result.rows[0].id;
}

// ─── Recall (Memory Search) ─────────────────────────

export async function recall(searchQuery: string, limit: number = 5): Promise<string> {
  // Search learnings with text similarity + FTS
  const learnings = await query<{
    insight: string; category: string; confidence: number; created_at: Date;
  }>(
    `SELECT insight, category, confidence, created_at
     FROM chatbot_learnings
     WHERE is_archived = false
       AND (similarity(insight, $1) > 0.3 OR search_vector @@ plainto_tsquery('english', $1))
     ORDER BY similarity(insight, $1) * confidence DESC
     LIMIT $2`,
    [searchQuery, limit]
  );

  // Search patterns
  const patterns = await query<{
    description: string; pattern_type: string; confidence: number; first_seen: Date;
  }>(
    `SELECT description, pattern_type, confidence, first_seen
     FROM chatbot_patterns
     WHERE is_active = true
       AND similarity(description, $1) > 0.3
     ORDER BY similarity(description, $1) * confidence DESC
     LIMIT 3`,
    [searchQuery]
  );

  const parts: string[] = [];

  if (learnings.rows.length > 0) {
    parts.push('[LEARNINGS]');
    for (const l of learnings.rows) {
      const decay = temporalDecay(l.created_at);
      const relevance = (decay * l.confidence).toFixed(2);
      parts.push(`- [${l.category}] (rel:${relevance}) ${l.insight}`);
    }
  }

  if (patterns.rows.length > 0) {
    parts.push('[PATTERNS]');
    for (const p of patterns.rows) {
      parts.push(`- [${p.pattern_type}] (conf:${p.confidence.toFixed(2)}) ${p.description}`);
    }
  }

  return parts.join('\n');
}

// ─── Pattern Recognition ─────────────────────────────

export async function recognizePatterns(): Promise<number> {
  // Analyze decisions by category to find patterns
  const categories = await query<{
    category: string; avg_score: number; count: number;
  }>(
    `SELECT category, AVG(actual_score) as avg_score, COUNT(*) as count
     FROM chatbot_decisions
     WHERE outcome IS NOT NULL AND actual_score IS NOT NULL
     GROUP BY category
     HAVING COUNT(*) >= 3`,
    []
  );

  if (categories.rows.length === 0) return 0;

  // Get baseline
  const baseline = await query<{ avg: number }>(
    `SELECT AVG(actual_score) as avg FROM chatbot_decisions WHERE actual_score IS NOT NULL`,
    []
  );
  const baselineAvg = baseline.rows[0]?.avg || 0;
  let patternsFound = 0;

  for (const cat of categories.rows) {
    const variance = baselineAvg > 0 ? (cat.avg_score - baselineAvg) / baselineAvg : 0;
    if (Math.abs(variance) < 0.2) continue; // Skip insignificant variance

    const direction = variance > 0 ? 'above' : 'below';
    const description = `${cat.category} decisions perform ${Math.abs(variance * 100).toFixed(0)}% ${direction} average (n=${cat.count})`;

    // Upsert pattern
    const existing = await query<{ id: number; confidence: number }>(
      `SELECT id, confidence FROM chatbot_patterns
       WHERE pattern_type = $1 AND similarity(description, $2) > 0.5
       LIMIT 1`,
      [cat.category as PatternType, description]
    );

    if (existing.rows[0]) {
      await query(
        `UPDATE chatbot_patterns
         SET confidence = LEAST(1.0, confidence + 0.05),
             evidence_count = evidence_count + 1,
             last_confirmed = NOW()
         WHERE id = $1`,
        [existing.rows[0].id]
      );
    } else {
      await query(
        `INSERT INTO chatbot_patterns
         (pattern_type, description, conditions, avg_score, vs_baseline, evidence_count, confidence)
         VALUES ($1, $2, $3, $4, $5, $6, 0.4)`,
        [
          'question' as PatternType, description,
          JSON.stringify({ category: cat.category }),
          cat.avg_score, variance, cat.count,
        ]
      );
    }
    patternsFound++;
  }

  return patternsFound;
}

// ─── Memory Consolidation ────────────────────────────

export async function consolidateMemory(): Promise<number> {
  const learnings = await query<{ id: number; insight: string; confidence: number }>(
    `SELECT id, insight, confidence FROM chatbot_learnings WHERE is_archived = false`,
    []
  );

  let consolidated = 0;

  for (let i = 0; i < learnings.rows.length; i++) {
    for (let j = i + 1; j < learnings.rows.length; j++) {
      const a = learnings.rows[i];
      const b = learnings.rows[j];

      // Check similarity
      const sim = await query<{ sim: number }>(
        `SELECT similarity($1, $2) as sim`,
        [a.insight, b.insight]
      );

      if (sim.rows[0]?.sim > 0.5) {
        // Keep higher confidence, archive lower
        const [keep, archive] = a.confidence >= b.confidence ? [a, b] : [b, a];
        await query(
          `UPDATE chatbot_learnings
           SET confidence = LEAST(1.0, confidence + 0.05),
               times_confirmed = times_confirmed + 1,
               updated_at = NOW()
           WHERE id = $1`,
          [keep.id]
        );
        await query(
          `UPDATE chatbot_learnings SET is_archived = true WHERE id = $1`,
          [archive.id]
        );
        consolidated++;
      }
    }
  }

  return consolidated;
}

// ─── Full Memory Cycle ───────────────────────────────

export async function runMemoryCycle(): Promise<{
  patterns: number;
  consolidated: number;
}> {
  const patterns = await recognizePatterns();
  const consolidated = await consolidateMemory();
  return { patterns, consolidated };
}
