// ─── Visitor ─────────────────────────────────────────
export interface Visitor {
  id: number;
  hash: string;
  display_name: string | null;
  email: string | null;
  locale: string;
  visits: number;
  interests: string[];
  first_seen: Date;
  last_seen: Date;
}

// ─── Conversation ────────────────────────────────────
export interface Conversation {
  id: number;
  visitor_id: number;
  locale: string;
  message_count: number;
  started_at: Date;
  last_message_at: Date;
}

// ─── Message ─────────────────────────────────────────
export interface Message {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant';
  content: string;
  input_tokens: number;
  output_tokens: number;
  feedback: 'positive' | 'negative' | null;
  created_at: Date;
}

// ─── Ticket ──────────────────────────────────────────
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high';

export interface Ticket {
  id: number;
  visitor_id: number;
  conversation_id: number;
  topic: string;
  summary: string;
  status: TicketStatus;
  priority: TicketPriority;
  created_at: Date;
}

// ─── Canned Response ─────────────────────────────────
export interface CannedResponse {
  id: number;
  trigger_patterns: string[];
  response_de: string;
  response_en: string;
  response_es: string;
  is_active: boolean;
}

// ─── Knowledge ───────────────────────────────────────
export interface KnowledgeChunk {
  id: number;
  source_url: string;
  title: string;
  content: string;
  chunk_index: number;
}

// ─── Memory Types (CEO-Pattern) ──────────────────────
export type DecisionCategory =
  | 'escalation'    // When to escalate to human
  | 'response'      // Response strategy choices
  | 'lead'          // Lead qualification decisions
  | 'support'       // Support topic handling
  | 'routing';      // Conversation routing

export type LearningCategory =
  | 'faq'           // Frequently asked questions
  | 'objection'     // Common objections & responses
  | 'conversion'    // What converts visitors to leads
  | 'support'       // Support pain points
  | 'product'       // Product feedback from users
  | 'ux'            // UX/website issues reported
  | 'meta';         // Learnings about the bot itself

export type PatternType =
  | 'question'      // Recurring question patterns
  | 'conversion'    // Conversion funnel patterns
  | 'escalation'    // Escalation trigger patterns
  | 'sentiment'     // Sentiment patterns
  | 'locale';       // Language-specific patterns

// ─── Knowledge Graph ─────────────────────────────────
export type EntityType = 'visitor' | 'topic' | 'issue' | 'feature' | 'competitor';
export type RelationType = 'asked_about' | 'interested_in' | 'had_issue' | 'compared_to' | 'related_to';

// ─── Chat API ────────────────────────────────────────
export interface ChatRequest {
  message: string;
  visitorHash: string;
  locale: string;
  conversationId?: number;
}

export interface StreamChunk {
  type: 'text' | 'done' | 'error' | 'meta';
  content?: string;
  conversationId?: number;
  messageId?: number;
  error?: string;
}

// ─── Session (Memory) ────────────────────────────────
export interface SessionStats {
  messagesHandled: number;
  leadsDetected: number;
  ticketsCreated: number;
  learningsCreated: number;
}
