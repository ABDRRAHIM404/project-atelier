'use client';

import { useEffect, useRef, type FormEventHandler } from 'react';

import { formatDate } from './client-api';

export type ChatMessage = Readonly<{
  body: string;
  id: string;
  senderKind: 'CUSTOMER' | 'MANAGER';
  sentAt: string;
}>;

type ConversationChatProps = Readonly<{
  busy: boolean;
  currentActor: 'CUSTOMER' | 'MANAGER';
  emptyText: string;
  messages: readonly ChatMessage[];
  onSubmit: FormEventHandler<HTMLFormElement>;
  subtitle?: string | undefined;
  title: string;
}>;

export function ConversationChat({
  busy,
  currentActor,
  emptyText,
  messages,
  onSubmit,
  subtitle,
  title,
}: ConversationChatProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  return (
    <section className="chat-window" aria-label={`محادثة ${title}`}>
      <header className="chat-window__header">
        <span className="chat-avatar" aria-hidden="true">
          {title.trim().charAt(0) || 'ع'}
        </span>
        <div>
          <strong>{title}</strong>
          {subtitle ? <small>{subtitle}</small> : null}
        </div>
      </header>

      <div className="chat-window__messages" aria-live="polite">
        {messages.length === 0 ? (
          <div className="chat-empty-state">
            <span aria-hidden="true">💬</span>
            <p>{emptyText}</p>
          </div>
        ) : (
          messages.map((message) => {
            const own = message.senderKind === currentActor;
            return (
              <article
                className={`chat-bubble${own ? ' chat-bubble--own' : ''}`}
                key={message.id}
              >
                <p>{message.body}</p>
                <small>{formatDate(message.sentAt)}</small>
              </article>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <form className="chat-composer" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor={`chat-message-${currentActor.toLowerCase()}`}>
          اكتب رسالتك
        </label>
        <textarea
          id={`chat-message-${currentActor.toLowerCase()}`}
          name="body"
          placeholder="اكتب رسالة..."
          required
          rows={1}
        />
        <button className="chat-composer__send" disabled={busy} type="submit">
          <span aria-hidden="true">➤</span>
          <span className="sr-only">إرسال</span>
        </button>
      </form>
    </section>
  );
}
