'use client';

import { useState, useRef, useEffect } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
  locale: string;
}

const QUICK_ACTIONS: Record<string, { label: string; message: string }[]> = {
  de: [
    { label: 'Pricing', message: 'Was kostet Aklow?' },
    { label: 'API & Integration', message: 'Wie funktioniert die Developer API?' },
    { label: 'Features', message: 'Was kann der Bot alles?' },
  ],
  en: [
    { label: 'Pricing', message: 'How much does Aklow cost?' },
    { label: 'API & Integration', message: 'How does the Developer API work?' },
    { label: 'Features', message: 'What can the bot do?' },
  ],
  es: [
    { label: 'Precios', message: '¿Cuánto cuesta Aklow?' },
    { label: 'API & Integración', message: '¿Cómo funciona la Developer API?' },
    { label: 'Features', message: '¿Qué puede hacer el bot?' },
  ],
};

export function ChatInput({ onSend, disabled, locale }: ChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showQuickActions, setShowQuickActions] = useState(true);

  const placeholders: Record<string, string> = {
    de: 'Schreib eine Nachricht...',
    en: 'Type a message...',
    es: 'Escribe un mensaje...',
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput('');
    setShowQuickActions(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickActions = QUICK_ACTIONS[locale] || QUICK_ACTIONS.en;

  return (
    <div className="border-t border-white/[0.08] p-3">
      {/* Quick Actions */}
      {showQuickActions && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => {
                onSend(action.message);
                setShowQuickActions(false);
              }}
              disabled={disabled}
              className="px-3 py-1 text-[11px] tracking-wider rounded-full border border-white/[0.1] text-[var(--color-foreground-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-all disabled:opacity-50"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, 2000))}
          onKeyDown={handleKeyDown}
          placeholder={placeholders[locale] || placeholders.en}
          disabled={disabled}
          rows={1}
          className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-foreground-subtle)] focus:outline-none focus:border-[var(--color-accent)]/50 resize-none disabled:opacity-50 transition-colors"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !input.trim()}
          className="w-9 h-9 flex items-center justify-center rounded-lg transition-all disabled:opacity-30"
          style={{
            backgroundColor: input.trim() ? 'var(--color-accent)' : 'transparent',
            color: input.trim() ? 'white' : 'var(--color-foreground-muted)',
          }}
          aria-label="Send"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2L11 13" />
            <path d="M22 2L15 22L11 13L2 9L22 2Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
