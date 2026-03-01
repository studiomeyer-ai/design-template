import pg from 'pg';
import { config } from 'dotenv';

config();

const { Pool } = pg;

async function setup() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 2,
  });

  console.log('Setting up Aklow Chatbot database...\n');

  // ─── Core Chat Tables ──────────────────────────────

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chatbot_visitors (
      id SERIAL PRIMARY KEY,
      hash VARCHAR(64) UNIQUE NOT NULL,
      display_name VARCHAR(255),
      email VARCHAR(255),
      locale VARCHAR(5) DEFAULT 'de',
      visits INTEGER DEFAULT 1,
      interests TEXT[] DEFAULT '{}',
      first_seen TIMESTAMPTZ DEFAULT NOW(),
      last_seen TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_visitors_hash ON chatbot_visitors (hash);
    CREATE INDEX IF NOT EXISTS idx_visitors_email ON chatbot_visitors (email) WHERE email IS NOT NULL;
  `);
  console.log('  ✓ chatbot_visitors');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chatbot_conversations (
      id SERIAL PRIMARY KEY,
      visitor_id INTEGER NOT NULL REFERENCES chatbot_visitors(id),
      locale VARCHAR(5) DEFAULT 'de',
      message_count INTEGER DEFAULT 0,
      started_at TIMESTAMPTZ DEFAULT NOW(),
      last_message_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_conversations_visitor ON chatbot_conversations (visitor_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_last_msg ON chatbot_conversations (last_message_at);
  `);
  console.log('  ✓ chatbot_conversations');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chatbot_messages (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER NOT NULL REFERENCES chatbot_conversations(id),
      role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      feedback VARCHAR(10) CHECK (feedback IN ('positive', 'negative')),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON chatbot_messages (conversation_id);
    CREATE INDEX IF NOT EXISTS idx_messages_created ON chatbot_messages (created_at);
  `);
  console.log('  ✓ chatbot_messages');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chatbot_knowledge (
      id SERIAL PRIMARY KEY,
      source_url VARCHAR(500) NOT NULL,
      title VARCHAR(500) NOT NULL,
      content TEXT NOT NULL,
      chunk_index INTEGER DEFAULT 0,
      search_vector TSVECTOR GENERATED ALWAYS AS (
        setweight(to_tsvector('english', title), 'A') ||
        setweight(to_tsvector('english', content), 'B')
      ) STORED,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(source_url, chunk_index)
    );
    CREATE INDEX IF NOT EXISTS idx_knowledge_search ON chatbot_knowledge USING GIN (search_vector);
    CREATE INDEX IF NOT EXISTS idx_knowledge_content_trgm ON chatbot_knowledge USING GIN (content gin_trgm_ops);
  `);
  console.log('  ✓ chatbot_knowledge');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chatbot_canned_responses (
      id SERIAL PRIMARY KEY,
      trigger_patterns TEXT[] NOT NULL,
      response_de TEXT NOT NULL,
      response_en TEXT NOT NULL,
      response_es TEXT NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('  ✓ chatbot_canned_responses');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chatbot_tickets (
      id SERIAL PRIMARY KEY,
      visitor_id INTEGER NOT NULL REFERENCES chatbot_visitors(id),
      conversation_id INTEGER NOT NULL REFERENCES chatbot_conversations(id),
      topic VARCHAR(255) NOT NULL,
      summary TEXT NOT NULL,
      status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
      priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      resolved_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_tickets_status ON chatbot_tickets (status);
  `);
  console.log('  ✓ chatbot_tickets');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chatbot_daily_stats (
      id SERIAL PRIMARY KEY,
      date DATE UNIQUE NOT NULL DEFAULT CURRENT_DATE,
      conversations INTEGER DEFAULT 0,
      messages INTEGER DEFAULT 0,
      leads INTEGER DEFAULT 0,
      tickets INTEGER DEFAULT 0,
      canned_hits INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON chatbot_daily_stats (date);
  `);
  console.log('  ✓ chatbot_daily_stats');

  // ─── Memory Tables (CEO Pattern) ───────────────────

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chatbot_sessions (
      id SERIAL PRIMARY KEY,
      context VARCHAR(500) NOT NULL,
      focus VARCHAR(100),
      summary TEXT,
      messages_handled INTEGER DEFAULT 0,
      leads_detected INTEGER DEFAULT 0,
      tickets_created INTEGER DEFAULT 0,
      learnings_created INTEGER DEFAULT 0,
      started_at TIMESTAMPTZ DEFAULT NOW(),
      ended_at TIMESTAMPTZ
    );
  `);
  console.log('  ✓ chatbot_sessions');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chatbot_decisions (
      id SERIAL PRIMARY KEY,
      session_id INTEGER REFERENCES chatbot_sessions(id),
      category VARCHAR(50) NOT NULL,
      question TEXT NOT NULL,
      options JSONB DEFAULT '[]',
      chosen TEXT NOT NULL,
      reasoning TEXT NOT NULL,
      context TEXT,
      prediction TEXT,
      prediction_score NUMERIC,
      outcome TEXT,
      actual_score NUMERIC,
      accuracy NUMERIC,
      outcome_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_decisions_category ON chatbot_decisions (category);
    CREATE INDEX IF NOT EXISTS idx_decisions_created ON chatbot_decisions (created_at);
  `);
  console.log('  ✓ chatbot_decisions');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chatbot_learnings (
      id SERIAL PRIMARY KEY,
      category VARCHAR(50) NOT NULL,
      insight TEXT NOT NULL,
      confidence NUMERIC DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
      evidence JSONB DEFAULT '[]',
      source VARCHAR(50) DEFAULT 'autonomous',
      times_confirmed INTEGER DEFAULT 0,
      times_contradicted INTEGER DEFAULT 0,
      is_archived BOOLEAN DEFAULT false,
      search_vector TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', insight)) STORED,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_learnings_category ON chatbot_learnings (category) WHERE is_archived = false;
    CREATE INDEX IF NOT EXISTS idx_learnings_confidence ON chatbot_learnings (confidence DESC) WHERE is_archived = false;
    CREATE INDEX IF NOT EXISTS idx_learnings_search ON chatbot_learnings USING GIN (search_vector);
    CREATE INDEX IF NOT EXISTS idx_learnings_insight_trgm ON chatbot_learnings USING GIN (insight gin_trgm_ops);
  `);
  console.log('  ✓ chatbot_learnings');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chatbot_patterns (
      id SERIAL PRIMARY KEY,
      pattern_type VARCHAR(50) NOT NULL,
      description TEXT NOT NULL,
      conditions JSONB DEFAULT '{}',
      avg_score NUMERIC,
      vs_baseline NUMERIC,
      evidence_count INTEGER DEFAULT 0,
      confidence NUMERIC DEFAULT 0.4 CHECK (confidence >= 0 AND confidence <= 1),
      is_active BOOLEAN DEFAULT true,
      first_seen TIMESTAMPTZ DEFAULT NOW(),
      last_confirmed TIMESTAMPTZ DEFAULT NOW(),
      search_vector TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', description)) STORED
    );
    CREATE INDEX IF NOT EXISTS idx_patterns_type ON chatbot_patterns (pattern_type) WHERE is_active = true;
    CREATE INDEX IF NOT EXISTS idx_patterns_desc_trgm ON chatbot_patterns USING GIN (description gin_trgm_ops);
  `);
  console.log('  ✓ chatbot_patterns');

  // ─── Knowledge Graph ───────────────────────────────

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chatbot_entities (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      entity_type VARCHAR(50) NOT NULL,
      metadata JSONB DEFAULT '{}',
      summary TEXT,
      importance NUMERIC DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
      interaction_count INTEGER DEFAULT 1,
      is_archived BOOLEAN DEFAULT false,
      first_seen TIMESTAMPTZ DEFAULT NOW(),
      last_seen TIMESTAMPTZ DEFAULT NOW(),
      search_vector TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', name || ' ' || COALESCE(summary, ''))) STORED
    );
    CREATE INDEX IF NOT EXISTS idx_entities_name ON chatbot_entities (LOWER(name));
    CREATE INDEX IF NOT EXISTS idx_entities_type ON chatbot_entities (entity_type) WHERE is_archived = false;
    CREATE INDEX IF NOT EXISTS idx_entities_search ON chatbot_entities USING GIN (search_vector);
    CREATE INDEX IF NOT EXISTS idx_entities_name_trgm ON chatbot_entities USING GIN (name gin_trgm_ops);
  `);
  console.log('  ✓ chatbot_entities');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chatbot_entity_observations (
      id SERIAL PRIMARY KEY,
      entity_id INTEGER NOT NULL REFERENCES chatbot_entities(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      source VARCHAR(50) DEFAULT 'chatbot',
      confidence NUMERIC DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
      is_archived BOOLEAN DEFAULT false,
      search_vector TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', text)) STORED,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_observations_entity ON chatbot_entity_observations (entity_id) WHERE is_archived = false;
    CREATE INDEX IF NOT EXISTS idx_observations_text_trgm ON chatbot_entity_observations USING GIN (text gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS idx_observations_search ON chatbot_entity_observations USING GIN (search_vector);
  `);
  console.log('  ✓ chatbot_entity_observations');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chatbot_entity_relations (
      id SERIAL PRIMARY KEY,
      from_entity INTEGER NOT NULL REFERENCES chatbot_entities(id) ON DELETE CASCADE,
      to_entity INTEGER NOT NULL REFERENCES chatbot_entities(id) ON DELETE CASCADE,
      relation_type VARCHAR(50) NOT NULL,
      strength NUMERIC DEFAULT 0.5 CHECK (strength >= 0 AND strength <= 1),
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(from_entity, to_entity, relation_type)
    );
    CREATE INDEX IF NOT EXISTS idx_relations_from ON chatbot_entity_relations (from_entity);
    CREATE INDEX IF NOT EXISTS idx_relations_to ON chatbot_entity_relations (to_entity);
  `);
  console.log('  ✓ chatbot_entity_relations');

  console.log('\n  All 14 tables created.\n');

  // ─── Seed: Canned Responses ────────────────────────

  console.log('Seeding canned responses...');

  const cannedResponses = [
    {
      patterns: ['was kostet', 'preise', 'pricing', 'how much', 'price', 'cuánto cuesta', 'precio'],
      de: '**Vier Pläne:**\n\n- **Free** (EUR 0) — Volles Memory, Haiku 4.5, 100 Nachrichten/Mo\n- **Plus** (EUR 19/Mo) — Sonnet 4.6, 500 Nachrichten, 10 Bilder/Mo, Research Agent Basic (10/Mo)\n- **Pro** (EUR 49/Mo) — 1.500 Nachrichten, Research Agent Pro (20/Mo), 30 Bilder/Mo\n- **Business** (EUR 149/Mo) — 4.000 Nachrichten, Research Agent Pro (60/Mo), 100 Bilder/Mo, volle API\n\nAlle Details auf [/pricing](/pricing).',
      en: '**Four plans:**\n\n- **Free** (EUR 0) — Full memory, Haiku 4.5, 100 messages/mo\n- **Plus** (EUR 19/mo) — Sonnet 4.6, 500 messages, 10 images/mo, Research Agent Basic (10/mo)\n- **Pro** (EUR 49/mo) — 1,500 messages, Research Agent Pro (20/mo), 30 images/mo\n- **Business** (EUR 149/mo) — 4,000 messages, Research Agent Pro (60/mo), 100 images/mo, full API\n\nAll details at [/pricing](/pricing).',
      es: '**Cuatro planes:**\n\n- **Free** (EUR 0) — Memoria completa, Haiku 4.5, 100 mensajes/mes\n- **Plus** (EUR 19/mes) — Sonnet 4.6, 500 mensajes, 10 imágenes/mes, Research Agent Basic (10/mes)\n- **Pro** (EUR 49/mes) — 1.500 mensajes, Research Agent Pro (20/mes), 30 imágenes/mes\n- **Business** (EUR 149/mes) — 4.000 mensajes, Research Agent Pro (60/mes), 100 imágenes/mes, API completa\n\nTodos los detalles en [/pricing](/pricing).',
    },
    {
      patterns: ['api', 'developer', 'integration', 'schnittstelle', 'integración', 'entwickler'],
      de: '**Developer API mit 29 Endpoints:**\n\nChat, Memory, Knowledge Graph, Bot-Management — alles per REST API steuerbar.\n\n- Free: kein API-Zugang\n- Plus: 30 req/min\n- Pro: 60 req/min\n- Business: 120 req/min, 10 API Keys\n\nDoku auf [/api](/api).',
      en: '**Developer API with 29 endpoints:**\n\nChat, memory, knowledge graph, bot management — all controllable via REST API.\n\n- Free: no API access\n- Plus: 30 req/min\n- Pro: 60 req/min\n- Business: 120 req/min, 10 API keys\n\nDocs at [/api](/api).',
      es: '**Developer API con 29 endpoints:**\n\nChat, memoria, knowledge graph, gestión de bots — todo controlable vía REST API.\n\n- Free: sin acceso API\n- Plus: 30 req/min\n- Pro: 60 req/min\n- Business: 120 req/min, 10 API keys\n\nDocs en [/api](/api).',
    },
    {
      patterns: ['lizenz', 'license', 'github', 'código', 'licencia', 'code'],
      de: 'Aklow Claude Amplifier ist **proprietäre Software** — eine AI Agent Platform mit BYOK-Verschlüsselung (AES-256-GCM). Deine Daten sind per-User verschlüsselt auf Servern in Deutschland gespeichert.\n\n→ [GitHub: AklowLabs](https://github.com/AklowLabs) für Dokumentation und Community.',
      en: 'Aklow Claude Amplifier is **proprietary software** — an AI Agent Platform with BYOK encryption (AES-256-GCM). Your data is per-user encrypted and stored on servers in Germany.\n\n→ [GitHub: AklowLabs](https://github.com/AklowLabs) for documentation and community.',
      es: 'Aklow Claude Amplifier es **software propietario** — una AI Agent Platform con cifrado BYOK (AES-256-GCM). Tus datos están cifrados por usuario y almacenados en servidores en Alemania.\n\n→ [GitHub: AklowLabs](https://github.com/AklowLabs) para documentación y comunidad.',
    },
    {
      patterns: ['was kann', 'features', 'funktionen', 'what can', 'capabilities', 'qué puede'],
      de: '**Core Features:**\n\n- **16 Memory-Features** — Knowledge Graph, Temporal Decay, Contradiction Detection, Community Detection\n- **17 KI-Tools** — Web-Suche, Dokumente, Rechner, Email, Bilder, Research Agent u.v.m.\n- **Multi-Provider** — OpenAI, Anthropic, Ollama, OpenRouter\n- **BYOK** — Eigene API Keys, AES-256-GCM per-User verschlüsselt\n- **Developer API** — 29 REST Endpoints, Chat, Memory, Knowledge Graph\n\nMehr auf [/features](/features).',
      en: '**Core Features:**\n\n- **16 Memory Features** — Knowledge graph, temporal decay, contradiction detection, community detection\n- **17 AI Tools** — Web search, documents, calculator, email, images, research agent & more\n- **Multi-Provider** — OpenAI, Anthropic, Ollama, OpenRouter\n- **BYOK** — Your own API keys, AES-256-GCM per-user encrypted\n- **Developer API** — 29 REST endpoints, chat, memory, knowledge graph\n\nMore at [/features](/features).',
      es: '**Core Features:**\n\n- **16 Funciones de Memoria** — Knowledge graph, temporal decay, detección de contradicciones, detección de comunidades\n- **17 Herramientas IA** — Búsqueda web, documentos, calculadora, email, imágenes, agente de investigación y más\n- **Multi-Proveedor** — OpenAI, Anthropic, Ollama, OpenRouter\n- **BYOK** — Tus propias API keys, cifrado AES-256-GCM por usuario\n- **Developer API** — 29 REST endpoints, chat, memoria, knowledge graph\n\nMás en [/features](/features).',
    },
    {
      patterns: ['byok', 'api key', 'eigene keys', 'own keys', 'schlüssel', 'claves'],
      de: '**BYOK = Bring Your Own Key.** Du nutzt deine eigenen API-Schlüssel (OpenAI, Anthropic, etc.).\n\n- AES-256-GCM verschlüsselt auf deinem Server\n- Kein Aufpreis, kein Mittelsmann, keine Limits\n- Multi-Provider Support',
      en: '**BYOK = Bring Your Own Key.** Use your own API keys (OpenAI, Anthropic, etc.).\n\n- AES-256-GCM encrypted on your server\n- No extra cost, no middleman, no limits\n- Multi-provider support',
      es: '**BYOK = Bring Your Own Key.** Usa tus propias API keys (OpenAI, Anthropic, etc.).\n\n- Cifrado AES-256-GCM en tu servidor\n- Sin costo extra, sin intermediarios, sin límites\n- Soporte multi-proveedor',
    },
  ];

  for (const cr of cannedResponses) {
    await pool.query(
      `INSERT INTO chatbot_canned_responses (trigger_patterns, response_de, response_en, response_es)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [cr.patterns, cr.de, cr.en, cr.es]
    );
  }
  console.log(`  ✓ ${cannedResponses.length} canned responses seeded`);

  // ─── Seed: Knowledge Base ──────────────────────────

  console.log('Seeding knowledge base...');

  const knowledgeChunks = [
    {
      url: 'https://aklow-labs.com/features',
      title: 'Aklow Features — Persistent Memory',
      content: 'Aklow builds AI with persistent memory. Your bot remembers every conversation through a Knowledge Graph with entities, observations, and relations. Temporal decay ensures old memories fade while frequently accessed ones stay strong. Confidence scoring (0-1) with auto-archival. Context across sessions — not as a feature, as a foundation.',
    },
    {
      url: 'https://aklow-labs.com/features',
      title: 'Aklow Features — Agent Tools',
      content: 'More than just chat. 5 built-in AI tools: web search, document search (RAG), calculator, date/time, email sending. Extensible via MCP protocol. REST API and custom actions for your workflow. Your bot can act, automate and integrate.',
    },
    {
      url: 'https://aklow-labs.com/features',
      title: 'Aklow Features — Privacy & BYOK Encryption',
      content: 'BYOK (Bring Your Own Key) — use your own API keys from OpenAI, Anthropic, Ollama, or OpenRouter. AES-256-GCM per-user encrypted key storage. All data stored on servers in Germany. GDPR compliant. Your data belongs to you.',
    },
    {
      url: 'https://aklow-labs.com/pricing',
      title: 'Aklow Pricing',
      content: 'Four plans in EUR: Free (EUR 0/forever) — full memory & knowledge graph, Haiku 4.5, 100 messages/month, 5 lifetime images, BYOK. Plus (EUR 19/mo) — Sonnet 4.6, 500 messages, 10 images/month, Research Agent Basic (10/mo). Pro (EUR 49/mo) — 1,500 messages, Research Agent Pro (20/mo), 30 images, Developer API (60 req/min). Business (EUR 149/mo) — 4,000 messages, Research Agent Pro (60/mo), 100 images, Developer API (120 req/min, 10 keys), unlimited documents.',
    },
    {
      url: 'https://aklow-labs.com/about',
      title: 'About Aklow Labs',
      content: 'Aklow Labs is an AI-managed company. Our CEO is an AI. Our product is AI — that knows you, evolves and learns with you. Aklow Labs has been run by an AI since February 2026. Every decision — product, marketing, strategy — is made autonomously, measured and learned from. Claude Amplifier is the result. Based in Germany.',
    },
    {
      url: 'https://aklow-labs.com/product',
      title: 'Aklow Product — Claude Amplifier',
      content: 'Claude Amplifier — AI Agent Platform with long-term memory. Memory-first, privacy-first. The platform builds a real model of you — entities, relations, observations. Not a key-value store, but a knowledge graph. Like Google Knowledge Graph, but for you. Your data belongs to you. AES-256-GCM per-user encryption, BYOK support, servers in Germany. No hidden data collection, no tracking.',
    },
  ];

  for (let i = 0; i < knowledgeChunks.length; i++) {
    const chunk = knowledgeChunks[i];
    await pool.query(
      `INSERT INTO chatbot_knowledge (source_url, title, content, chunk_index)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (source_url, chunk_index) DO UPDATE SET title = $2, content = $3, updated_at = NOW()`,
      [chunk.url, chunk.title, chunk.content, i]
    );
  }
  console.log(`  ✓ ${knowledgeChunks.length} knowledge chunks seeded`);

  // ─── Seed: Initial Entities ────────────────────────

  console.log('Seeding initial entities...');

  const entities = [
    { name: 'Pricing', type: 'topic' },
    { name: 'Developer API', type: 'topic' },
    { name: 'Memory System', type: 'feature' },
    { name: 'Knowledge Graph', type: 'feature' },
    { name: 'BYOK', type: 'feature' },
    { name: 'Agent Tools', type: 'feature' },
    { name: 'Privacy & Security', type: 'topic' },
  ];

  for (const entity of entities) {
    await pool.query(
      `INSERT INTO chatbot_entities (name, entity_type, importance)
       VALUES ($1, $2, 0.7)
       ON CONFLICT DO NOTHING`,
      [entity.name, entity.type]
    );
  }
  console.log(`  ✓ ${entities.length} entities seeded`);

  console.log('\n✅ Aklow Chatbot database setup complete!\n');

  await pool.end();
}

setup().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
