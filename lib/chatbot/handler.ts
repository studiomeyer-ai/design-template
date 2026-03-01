import Anthropic from '@anthropic-ai/sdk';
import { getOrCreateVisitor, updateVisitorInfo, updateInterests, getVisitorContext } from './visitor';
import { getOrCreateConversation, getConversationHistory, saveMessage } from './conversation';
import { checkCannedResponse } from './canned';
import { searchKnowledge } from './knowledge';
import { recall, createLearning } from './memory';
import { searchKnowledgeGraph, getVisitorEntityContext, upsertEntity, addObservation, addRelation } from './entity-memory';
import { detectEscalation, createTicket, detectLeadInfo } from './support';
import { incrementDailyStat } from './stats';
import { buildSystemPrompt } from './prompts';
import type { ChatRequest, StreamChunk } from './types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Interest detection keywords
const INTEREST_KEYWORDS: Record<string, string[]> = {
  pricing: ['preis', 'kosten', 'price', 'cost', 'precio', 'plan', 'free', 'pro', 'business'],
  encryption: ['byok', 'encryption', 'verschlüsselung', 'aes', 'cifrado', 'key'],
  memory: ['memory', 'gedächtnis', 'remember', 'remember', 'erinnern', 'memoria', 'knowledge graph'],
  providers: ['multi-provider', 'openai', 'anthropic', 'ollama', 'openrouter', 'provider', 'anbieter'],
  api: ['api', 'rest', 'mcp', 'tool', 'integration', 'webhook'],
  support: ['support', 'help', 'hilfe', 'ayuda', 'problem', 'bug'],
};

function detectInterests(message: string): string[] {
  const lower = message.toLowerCase();
  const interests: string[] = [];
  for (const [interest, keywords] of Object.entries(INTEREST_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) {
      interests.push(interest);
    }
  }
  return interests;
}

export async function* handleChat(
  request: ChatRequest
): AsyncGenerator<StreamChunk> {
  const { message, visitorHash, locale, conversationId: reqConversationId } = request;

  try {
    // ─── Step 1: Visitor ─────────────────────────────
    const visitor = await getOrCreateVisitor(visitorHash, locale);

    // ─── Step 2: Conversation ────────────────────────
    const conversation = await getOrCreateConversation(visitor.id, locale, reqConversationId);

    // Send conversation ID immediately
    yield { type: 'meta', conversationId: conversation.id };

    // Use message directly (shield removed — Claude handles safety natively)
    const sanitizedMessage = message;

    // ─── Step 3: Canned Response Check ───────────────
    const canned = await checkCannedResponse(sanitizedMessage, locale);
    if (canned) {
      const msgId = await saveMessage(conversation.id, 'user', message);
      const assistantId = await saveMessage(conversation.id, 'assistant', canned);
      yield { type: 'text', content: canned };
      yield { type: 'done', messageId: assistantId };

      // Background: stats
      incrementDailyStat('messages', 2).catch(() => {});
      incrementDailyStat('canned_hits').catch(() => {});
      return;
    }

    // ─── Step 4: Memory Context ──────────────────────
    const [visitorCtx, entityCtx, memoryCtx, kgCtx] = await Promise.all([
      getVisitorContext(visitor.id),
      getVisitorEntityContext(visitorHash),
      recall(sanitizedMessage, 5),
      searchKnowledgeGraph(sanitizedMessage, 3),
    ]);

    // ─── Step 5: RAG Knowledge ───────────────────────
    const knowledgeCtx = await searchKnowledge(sanitizedMessage, 3);

    // ─── Step 6: System Prompt ───────────────────────
    const combinedVisitorCtx = [visitorCtx, entityCtx].filter(Boolean).join('\n\n');
    const combinedMemoryCtx = [memoryCtx, kgCtx].filter(Boolean).join('\n\n');
    const systemPrompt = buildSystemPrompt(locale, combinedVisitorCtx, knowledgeCtx, combinedMemoryCtx);

    // ─── Step 7: Conversation History ────────────────
    const history = await getConversationHistory(conversation.id, 20);
    const messages: Anthropic.MessageParam[] = history.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
    messages.push({ role: 'user', content: sanitizedMessage });

    // ─── Step 8: Save User Message ───────────────────
    await saveMessage(conversation.id, 'user', sanitizedMessage);

    // ─── Step 9: Claude Streaming ────────────────────
    let fullResponse = '';
    let inputTokens = 0;
    let outputTokens = 0;

    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        fullResponse += event.delta.text;
        yield { type: 'text', content: event.delta.text };
      }
    }

    const finalMessage = await stream.finalMessage();
    inputTokens = finalMessage.usage.input_tokens;
    outputTokens = finalMessage.usage.output_tokens;

    // ─── Step 10: Save Assistant Message ─────────────
    const assistantMsgId = await saveMessage(conversation.id, 'assistant', fullResponse, {
      input: inputTokens,
      output: outputTokens,
    });

    yield { type: 'done', messageId: assistantMsgId };

    // ─── Steps 11-12: Background Processing ─────────
    // Run these async, don't block the response
    // Pass original message for lead detection, sanitized for memory/learning
    backgroundProcessing(visitor, visitorHash, conversation.id, message, fullResponse, locale).catch(() => {});

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    yield { type: 'error', error: errorMsg };
  }
}

async function backgroundProcessing(
  visitor: { id: number; display_name: string | null; email: string | null },
  visitorHash: string,
  conversationId: number,
  userMessage: string,
  botResponse: string,
  locale: string
): Promise<void> {
  // ─── Lead Detection ────────────────────────────────
  const leadInfo = detectLeadInfo(userMessage);
  if (leadInfo.email || leadInfo.name) {
    await updateVisitorInfo(visitor.id, {
      displayName: leadInfo.name,
      email: leadInfo.email,
    });
    incrementDailyStat('leads').catch(() => {});

    // Create/update visitor entity
    const entityId = await upsertEntity(
      leadInfo.name || `Visitor-${visitorHash.slice(0, 8)}`,
      'visitor',
      { hash: visitorHash, email: leadInfo.email }
    );
    if (leadInfo.email) {
      await addObservation(entityId, `Email: ${leadInfo.email}`, 'chatbot', 0.9);
    }
  }

  // ─── Interest Tracking ─────────────────────────────
  const interests = detectInterests(userMessage);
  if (interests.length > 0) {
    await updateInterests(visitor.id, interests);

    // Link visitor to topic entities
    const visitorEntityId = await upsertEntity(
      visitor.display_name || `Visitor-${visitorHash.slice(0, 8)}`,
      'visitor',
      { hash: visitorHash }
    );
    for (const interest of interests) {
      const topicId = await upsertEntity(interest, 'topic');
      await addRelation(visitorEntityId, topicId, 'interested_in', 0.6);
    }
  }

  // ─── Escalation Check ─────────────────────────────
  const escalation = detectEscalation(userMessage, locale);
  if (escalation.shouldEscalate) {
    await createTicket(
      visitor.id,
      conversationId,
      escalation.topic,
      `User: ${userMessage.slice(0, 200)}\nBot: ${botResponse.slice(0, 200)}`,
      'medium'
    );
    incrementDailyStat('tickets').catch(() => {});
  }

  // ─── Daily Stats ───────────────────────────────────
  await incrementDailyStat('messages', 2);
  await incrementDailyStat('conversations');

  // ─── Learning (every 10th conversation) ────────────
  const msgCount = await getConversationHistory(conversationId, 100);
  if (msgCount.length >= 6 && msgCount.length % 6 === 0) {
    // Extract a learning from the conversation pattern
    const topInterest = interests[0] || 'general';
    await createLearning(
      'faq',
      `Visitor asked about ${topInterest}: "${userMessage.slice(0, 100)}"`,
      0.4,
      [userMessage.slice(0, 200)]
    );
  }
}
