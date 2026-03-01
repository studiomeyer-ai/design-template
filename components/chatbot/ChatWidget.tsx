'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';

interface ChatMessage {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
}

function getVisitorHash(): string {
  const key = 'aklow_visitor';
  let hash = document.cookie.match(new RegExp(`(?:^|; )${key}=([^;]*)`))?.[1];

  if (!hash) {
    // Generate a random hash
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    hash = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');

    // Set cookie for 1 year
    const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `${key}=${hash}; expires=${expires}; path=/; SameSite=Lax`;
  }

  return hash;
}

function getLocale(): string {
  const path = window.location.pathname.split('/')[1];
  return ['de', 'en', 'es'].includes(path) ? path : 'de';
}

const GREETING: Record<string, string> = {
  de: 'Hi! Ich bin der Aklow Assistent. Frag mich zu Features, Preisen, API oder was immer du wissen willst.',
  en: 'Hi! I\'m the Aklow Assistant. Ask me about features, pricing, API, or anything you want to know.',
  es: 'Hola! Soy el Asistente de Aklow. Preguntame sobre features, precios, API o lo que quieras saber.',
};

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [locale, setLocale] = useState('de');

  useEffect(() => {
    setLocale(getLocale());
  }, []);

  // Show greeting on first open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const greeting = GREETING[locale] || GREETING.en;
      setMessages([{ role: 'assistant', content: greeting }]);
    }
    if (isOpen) setUnreadCount(0);
  }, [isOpen, locale, messages.length]);

  const sendMessage = useCallback(async (message: string) => {
    if (isStreaming) return;

    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: message }]);
    setIsStreaming(true);
    setStreamingContent('');

    try {
      const visitorHash = getVisitorHash();

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          visitorHash,
          locale,
          conversationId,
        }),
      });

      if (!response.ok) throw new Error('Chat request failed');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No stream reader');

      const decoder = new TextDecoder();
      let fullContent = '';
      let messageId: number | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          try {
            const chunk = JSON.parse(line.slice(6));

            if (chunk.type === 'meta' && chunk.conversationId) {
              setConversationId(chunk.conversationId);
            } else if (chunk.type === 'text') {
              fullContent += chunk.content;
              setStreamingContent(fullContent);
            } else if (chunk.type === 'done') {
              messageId = chunk.messageId;
            } else if (chunk.type === 'error') {
              fullContent = chunk.error || 'An error occurred.';
            }
          } catch {
            // Skip unparseable lines
          }
        }
      }

      // Add completed message
      setMessages(prev => [...prev, {
        id: messageId,
        role: 'assistant',
        content: fullContent,
      }]);

      if (!isOpen) setUnreadCount(prev => prev + 1);

    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: locale === 'de'
          ? 'Entschuldigung, ein Fehler ist aufgetreten. Bitte versuche es erneut.'
          : locale === 'es'
          ? 'Lo siento, ocurri\u00f3 un error. Por favor int\u00e9ntalo de nuevo.'
          : 'Sorry, an error occurred. Please try again.',
      }]);
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
    }
  }, [isStreaming, locale, conversationId, isOpen]);

  const handleFeedback = async (messageId: number, feedback: 'positive' | 'negative') => {
    try {
      await fetch('/api/chat/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, feedback }),
      });
    } catch {
      // Silently fail
    }
  };

  return (
    <>
      {/* Chat Window */}
      {isOpen && (
        <div
          className="fixed bottom-20 right-4 md:right-6 z-50 w-[calc(100vw-2rem)] max-w-[420px] h-[min(600px,80vh)] flex flex-col rounded-2xl border border-white/[0.1] shadow-2xl overflow-hidden"
          style={{
            backgroundColor: 'rgba(10, 10, 10, 0.95)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-light" style={{ backgroundColor: 'var(--color-accent)', color: 'white' }}>
                A
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--color-foreground)]">Aklow Assistant</p>
                <p className="text-[10px] text-[var(--color-foreground-subtle)]">
                  {locale === 'de' ? 'KI mit Ged\u00e4chtnis' : locale === 'es' ? 'IA con memoria' : 'AI with memory'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)] hover:bg-white/[0.06] transition-all"
              aria-label="Close chat"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <ChatMessages
            messages={messages}
            isStreaming={isStreaming}
            streamingContent={streamingContent}
            onFeedback={handleFeedback}
          />

          {/* Input */}
          <ChatInput
            onSend={sendMessage}
            disabled={isStreaming}
            locale={locale}
          />
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 md:right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-105 active:scale-95"
        style={{
          backgroundColor: isOpen ? 'var(--color-foreground)' : 'var(--color-accent)',
          color: isOpen ? 'var(--color-background)' : 'white',
        }}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        {isOpen ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
        {/* Unread badge */}
        {unreadCount > 0 && !isOpen && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-medium">
            {unreadCount}
          </span>
        )}
      </button>
    </>
  );
}
