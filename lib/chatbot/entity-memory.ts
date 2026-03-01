import { query } from './db';
import type { EntityType, RelationType } from './types';

// ─── Entity CRUD ─────────────────────────────────────

export async function upsertEntity(
  name: string,
  entityType: EntityType,
  metadata?: Record<string, unknown>
): Promise<number> {
  const existing = await query<{ id: number }>(
    `SELECT id FROM chatbot_entities
     WHERE LOWER(name) = LOWER($1) AND entity_type = $2
     LIMIT 1`,
    [name, entityType]
  );

  if (existing.rows[0]) {
    await query(
      `UPDATE chatbot_entities
       SET last_seen = NOW(), interaction_count = interaction_count + 1,
           metadata = COALESCE($2, metadata)
       WHERE id = $1`,
      [existing.rows[0].id, metadata ? JSON.stringify(metadata) : null]
    );
    return existing.rows[0].id;
  }

  const result = await query<{ id: number }>(
    `INSERT INTO chatbot_entities (name, entity_type, metadata, importance)
     VALUES ($1, $2, $3, 0.5)
     RETURNING id`,
    [name, entityType, JSON.stringify(metadata || {})]
  );
  return result.rows[0].id;
}

// ─── Observations ────────────────────────────────────

export async function addObservation(
  entityId: number,
  text: string,
  source: string = 'chatbot',
  confidence: number = 0.5
): Promise<number> {
  // Deduplicate
  const similar = await query<{ id: number; confidence: number }>(
    `SELECT id, confidence FROM chatbot_entity_observations
     WHERE entity_id = $1 AND similarity(text, $2) > 0.5 AND is_archived = false
     LIMIT 1`,
    [entityId, text]
  );

  if (similar.rows[0]) {
    const newConf = Math.min(1.0, similar.rows[0].confidence + 0.1);
    await query(
      `UPDATE chatbot_entity_observations
       SET confidence = $2, updated_at = NOW()
       WHERE id = $1`,
      [similar.rows[0].id, newConf]
    );
    return similar.rows[0].id;
  }

  const result = await query<{ id: number }>(
    `INSERT INTO chatbot_entity_observations (entity_id, text, source, confidence)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [entityId, text, source, confidence]
  );

  // Update entity importance based on observation count
  await query(
    `UPDATE chatbot_entities
     SET importance = LEAST(1.0, importance + 0.05)
     WHERE id = $1`,
    [entityId]
  );

  return result.rows[0].id;
}

// ─── Relations ───────────────────────────────────────

export async function addRelation(
  fromEntityId: number,
  toEntityId: number,
  relationType: RelationType,
  strength: number = 0.5
): Promise<void> {
  await query(
    `INSERT INTO chatbot_entity_relations (from_entity, to_entity, relation_type, strength)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (from_entity, to_entity, relation_type)
     DO UPDATE SET strength = LEAST(1.0, chatbot_entity_relations.strength + 0.1),
                   updated_at = NOW()`,
    [fromEntityId, toEntityId, relationType, strength]
  );
}

// ─── Knowledge Graph Search ──────────────────────────

export async function searchKnowledgeGraph(searchQuery: string, limit: number = 5): Promise<string> {
  // Search entities
  const entities = await query<{
    id: number; name: string; entity_type: string; importance: number;
  }>(
    `SELECT id, name, entity_type, importance
     FROM chatbot_entities
     WHERE is_archived = false
       AND (similarity(name, $1) > 0.3
            OR search_vector @@ plainto_tsquery('english', $1))
     ORDER BY similarity(name, $1) * importance DESC
     LIMIT $2`,
    [searchQuery, limit]
  );

  if (entities.rows.length === 0) return '';

  const parts: string[] = ['[KNOWLEDGE GRAPH]'];

  for (const entity of entities.rows) {
    parts.push(`\n${entity.entity_type}: ${entity.name}`);

    // Get observations
    const observations = await query<{ text: string; confidence: number }>(
      `SELECT text, confidence FROM chatbot_entity_observations
       WHERE entity_id = $1 AND is_archived = false
       ORDER BY confidence DESC LIMIT 5`,
      [entity.id]
    );

    for (const obs of observations.rows) {
      parts.push(`  - ${obs.text} (conf: ${obs.confidence.toFixed(2)})`);
    }

    // Get relations
    const relations = await query<{
      relation_type: string; name: string; strength: number;
    }>(
      `SELECT r.relation_type, e.name, r.strength
       FROM chatbot_entity_relations r
       JOIN chatbot_entities e ON e.id = r.to_entity
       WHERE r.from_entity = $1
       ORDER BY r.strength DESC LIMIT 3`,
      [entity.id]
    );

    for (const rel of relations.rows) {
      parts.push(`  → ${rel.relation_type} → ${rel.name} (${rel.strength.toFixed(2)})`);
    }
  }

  return parts.join('\n');
}

// ─── Entity Context for Visitor ──────────────────────

export async function getVisitorEntityContext(visitorHash: string): Promise<string> {
  // Find visitor entity
  const entity = await query<{ id: number }>(
    `SELECT id FROM chatbot_entities
     WHERE entity_type = 'visitor' AND metadata->>'hash' = $1
     LIMIT 1`,
    [visitorHash]
  );

  if (!entity.rows[0]) return '';

  const observations = await query<{ text: string }>(
    `SELECT text FROM chatbot_entity_observations
     WHERE entity_id = $1 AND is_archived = false
     ORDER BY confidence DESC LIMIT 10`,
    [entity.rows[0].id]
  );

  if (observations.rows.length === 0) return '';

  return '[VISITOR KNOWLEDGE]\n' + observations.rows.map(o => `- ${o.text}`).join('\n');
}
