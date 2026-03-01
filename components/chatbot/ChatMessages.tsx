'use client';

import { useEffect, useRef } from 'react';

interface ChatMessage {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
}

interface ChatMessagesProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingContent: string;
  onFeedback?: (messageId: number, feedback: 'positive' | 'negative') => void;
}

export function ChatMessages({ messages, isStreaming, streamingContent, onFeedback }: ChatMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-5 py-4 space-y-4"
      style={{ scrollBehavior: 'smooth' }}
    >
      {messages.map((msg, i) => (
        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div
            className={`max-w-[85%] rounded-2xl text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-[var(--color-accent)] text-white rounded-br-md px-4 py-2.5'
                : 'bg-white/[0.06] text-[var(--color-foreground)] rounded-bl-md px-4 py-3 border border-white/[0.08]'
            }`}
          >
            <MessageContent content={msg.content} isUser={msg.role === 'user'} />
            {msg.role === 'assistant' && msg.id && onFeedback && (
              <div className="flex gap-2 mt-2.5 pt-2 border-t border-white/[0.06]">
                <button
                  onClick={() => onFeedback(msg.id!, 'positive')}
                  className="text-[10px] text-[var(--color-foreground-subtle)] hover:text-green-400 transition-colors"
                  aria-label="Good response"
                >
                  &#128077;
                </button>
                <button
                  onClick={() => onFeedback(msg.id!, 'negative')}
                  className="text-[10px] text-[var(--color-foreground-subtle)] hover:text-red-400 transition-colors"
                  aria-label="Bad response"
                >
                  &#128078;
                </button>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Streaming message */}
      {isStreaming && (
        <div className="flex justify-start">
          <div className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-3 text-sm leading-relaxed bg-white/[0.06] text-[var(--color-foreground)] border border-white/[0.08]">
            {streamingContent ? (
              <MessageContent content={streamingContent} isUser={false} />
            ) : (
              <div className="flex gap-1 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-foreground-muted)] animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-foreground-muted)] animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-foreground-muted)] animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Inline markdown: bold, italic, code, links */
function inlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-[var(--color-foreground)]">$1</strong>')
    .replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="px-1.5 py-0.5 bg-white/[0.08] rounded text-[12px] font-mono text-[var(--color-accent)]">$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener" class="underline text-[var(--color-accent)] hover:opacity-80 transition-opacity">$1</a>')
    .replace(/\n/g, '<br/>');
}

function processMarkdown(content: string): string {
  // Step 1: Extract fenced code blocks to protect them from further processing
  const codeBlocks: { lang: string; code: string }[] = [];
  let processed = content.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, lang, code) => {
    codeBlocks.push({ lang: lang || '', code: code.replace(/\n$/, '') });
    return `\x00CB${codeBlocks.length - 1}\x00`;
  });

  // Step 2: Split into blocks by double newlines
  const blocks = processed.split(/\n\n+/);

  const htmlParts = blocks.map((block) => {
    block = block.trim();
    if (!block) return '';

    // Code block placeholder
    const cbMatch = block.match(/^\x00CB(\d+)\x00$/);
    if (cbMatch) {
      const { code } = codeBlocks[parseInt(cbMatch[1])];
      return `<pre class="my-2 p-3 rounded-lg bg-white/[0.04] border border-white/[0.06] overflow-x-auto"><code class="text-[12px] leading-relaxed font-mono text-[var(--color-foreground-muted)]">${escapeHtml(code)}</code></pre>`;
    }

    // Headers
    if (block.startsWith('### '))
      return `<h4 class="text-[13px] font-semibold text-[var(--color-foreground)] mt-3 mb-1">${inlineMarkdown(block.slice(4))}</h4>`;
    if (block.startsWith('## '))
      return `<h3 class="text-sm font-semibold text-[var(--color-foreground)] mt-3 mb-1">${inlineMarkdown(block.slice(3))}</h3>`;
    if (block.startsWith('# '))
      return `<h3 class="text-sm font-semibold text-[var(--color-foreground)] mt-3 mb-1">${inlineMarkdown(block.slice(2))}</h3>`;

    // Blockquote
    if (/^> /m.test(block)) {
      const text = block.replace(/^> ?/gm, '');
      return `<blockquote class="my-2 pl-3 border-l-2 border-[var(--color-accent)]/40 text-[var(--color-foreground-muted)] italic">${inlineMarkdown(text)}</blockquote>`;
    }

    // Horizontal rule
    if (/^-{3,}$/.test(block) || /^\*{3,}$/.test(block))
      return '<hr class="my-3 border-white/[0.08]" />';

    // Unordered list
    const ulLines = block.split('\n');
    if (ulLines.every((l) => /^[-*] /.test(l) || !l.trim())) {
      const items = ulLines
        .filter((l) => /^[-*] /.test(l))
        .map((l) => `<li class="relative pl-4 before:content-['•'] before:absolute before:left-0 before:text-[var(--color-accent)] before:text-xs">${inlineMarkdown(l.replace(/^[-*] /, ''))}</li>`);
      return `<ul class="my-1.5 space-y-1 text-[13px]">${items.join('')}</ul>`;
    }

    // Numbered list
    if (ulLines.every((l) => /^\d+\. /.test(l) || !l.trim())) {
      const items = ulLines
        .filter((l) => /^\d+\. /.test(l))
        .map((l, idx) => `<li class="relative pl-5"><span class="absolute left-0 text-[var(--color-accent)] text-xs font-medium">${idx + 1}.</span>${inlineMarkdown(l.replace(/^\d+\. /, ''))}</li>`);
      return `<ol class="my-1.5 space-y-1 text-[13px]">${items.join('')}</ol>`;
    }

    // Mixed block with inline list items (single newline separated)
    if (ulLines.some((l) => /^[-*] /.test(l)) || ulLines.some((l) => /^\d+\. /.test(l))) {
      // Process line by line
      const parts: string[] = [];
      let currentList: string[] = [];
      let listType: 'ul' | 'ol' | null = null;

      const flushList = () => {
        if (currentList.length > 0 && listType) {
          if (listType === 'ul') {
            parts.push(`<ul class="my-1.5 space-y-1 text-[13px]">${currentList.map((l) => `<li class="relative pl-4 before:content-['•'] before:absolute before:left-0 before:text-[var(--color-accent)] before:text-xs">${inlineMarkdown(l)}</li>`).join('')}</ul>`);
          } else {
            parts.push(`<ol class="my-1.5 space-y-1 text-[13px]">${currentList.map((l, idx) => `<li class="relative pl-5"><span class="absolute left-0 text-[var(--color-accent)] text-xs font-medium">${idx + 1}.</span>${inlineMarkdown(l)}</li>`).join('')}</ol>`);
          }
          currentList = [];
          listType = null;
        }
      };

      for (const line of ulLines) {
        const ulMatch = line.match(/^[-*] (.+)/);
        const olMatch = line.match(/^\d+\. (.+)/);
        if (ulMatch) {
          if (listType !== 'ul') flushList();
          listType = 'ul';
          currentList.push(ulMatch[1]);
        } else if (olMatch) {
          if (listType !== 'ol') flushList();
          listType = 'ol';
          currentList.push(olMatch[1]);
        } else if (line.trim()) {
          flushList();
          parts.push(`<p class="my-1">${inlineMarkdown(line)}</p>`);
        }
      }
      flushList();
      return parts.join('');
    }

    // Regular paragraph — handle single newlines within
    return `<p class="my-1">${inlineMarkdown(block)}</p>`;
  });

  return htmlParts.filter(Boolean).join('');
}

function MessageContent({ content, isUser }: { content: string; isUser: boolean }) {
  if (isUser) {
    // User messages: minimal formatting, just escape and preserve newlines
    const html = escapeHtml(content).replace(/\n/g, '<br/>');
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  }

  const html = processMarkdown(content);
  return (
    <div
      className="chat-md [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
