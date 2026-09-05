'use client';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

/**
 * Messages, questions and prompts, without the browser's own dialogs.
 *
 * There were around seventy `alert()` calls carrying failure messages, plus
 * `confirm()` and `prompt()`. Each one freezes the tab until it is clicked, and
 * none of them can be styled, logged, dismissed together, or captured for
 * support — so "what did it say?" was never answerable after the fact.
 *
 * Three things, matching what the browser gave us so call sites read the same:
 *
 *   notify(message, tone)  — a message that needs no answer. Was `alert`.
 *   ask(message)           — yes or no. Was `confirm`. Returns a promise.
 *   askFor(message)        — a line of text, or null. Was `prompt`.
 *
 * `ask` and `askFor` return promises rather than blocking, so every call site
 * that used them has to `await`. That is the point: the browser's versions stop
 * the whole page, including any work already in flight.
 */

export type Tone = 'success' | 'error' | 'info';

interface Notice {
  id: number;
  message: string;
  tone: Tone;
}

interface Question {
  message: string;
  /** Present when text is being asked for rather than a yes/no. */
  input?: { value: string };
  resolve: (value: any) => void;
}

interface NoticeApi {
  notify: (message: string, tone?: Tone) => void;
  ask: (message: string) => Promise<boolean>;
  askFor: (message: string, initial?: string) => Promise<string | null>;
}

const NoticeContext = createContext<NoticeApi>({
  // Before the provider mounts, fall back to not losing the message entirely.
  notify: (m) => console.warn('[notice]', m),
  ask: async () => false,
  askFor: async () => null,
});

export const useNotices = () => useContext(NoticeContext);

export function NoticeProvider({ children }: { children: React.ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [question, setQuestion] = useState<Question | null>(null);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setNotices(list => list.filter(n => n.id !== id));
  }, []);

  const notify = useCallback((message: string, tone: Tone = 'info') => {
    const id = nextId.current++;
    setNotices(list => [...list, { id, message, tone }]);
    // Errors stay until dismissed; the rest clear themselves.
    if (tone !== 'error') setTimeout(() => dismiss(id), 4500);
  }, [dismiss]);

  const ask = useCallback((message: string) => new Promise<boolean>(resolve => {
    setQuestion({ message, resolve });
  }), []);

  const askFor = useCallback((message: string, initial = '') => new Promise<string | null>(resolve => {
    setQuestion({ message, input: { value: initial }, resolve });
  }), []);

  const api = useMemo(() => ({ notify, ask, askFor }), [notify, ask, askFor]);

  return (
    <NoticeContext.Provider value={api}>
      {children}
      <NoticeStack notices={notices} onDismiss={dismiss} />
      {question && <QuestionDialog question={question} onDone={() => setQuestion(null)} />}
    </NoticeContext.Provider>
  );
}

const TONE_STYLE: Record<Tone, { bg: string; border: string; fg: string }> = {
  success: { bg: '#ecfdf5', border: '#a7f3d0', fg: '#065f46' },
  error: { bg: '#fef2f2', border: '#fecaca', fg: '#991b1b' },
  info: { bg: '#f8fafc', border: '#e2e8f0', fg: '#334155' },
};

function NoticeStack({ notices, onDismiss }: { notices: Notice[]; onDismiss: (id: number) => void }) {
  if (!notices.length) return null;

  return (
    <div
      // Announced to a screen reader without stealing focus, which is the one
      // thing the native dialog did well.
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed', top: 16, right: 16, zIndex: 10000,
        display: 'flex', flexDirection: 'column', gap: 8,
        maxWidth: 380, pointerEvents: 'none',
      }}
    >
      {notices.map(n => {
        const t = TONE_STYLE[n.tone];
        return (
          <div
            key={n.id}
            onClick={() => onDismiss(n.id)}
            style={{
              pointerEvents: 'auto', cursor: 'pointer',
              background: t.bg, border: `1px solid ${t.border}`, color: t.fg,
              padding: '0.7rem 0.9rem', borderRadius: 6, fontSize: '0.8rem',
              lineHeight: 1.45, whiteSpace: 'pre-wrap',
              boxShadow: '0 10px 30px -12px rgba(15,23,42,0.35)',
            }}
          >
            {n.message}
          </div>
        );
      })}
    </div>
  );
}

function QuestionDialog({ question, onDone }: { question: Question; onDone: () => void }) {
  const [text, setText] = useState(question.input?.value ?? '');
  const asksForText = !!question.input;

  const finish = (value: any) => { question.resolve(value); onDone(); };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 10001,
        background: 'rgba(15,23,42,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
      }}
      onClick={() => finish(asksForText ? null : false)}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: 8, maxWidth: 460, width: '100%',
          padding: '1.25rem', boxShadow: '0 30px 60px -20px rgba(15,23,42,0.5)',
        }}
      >
        <div style={{ fontSize: '0.85rem', color: 'var(--gray-800)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
          {question.message}
        </div>

        {asksForText && (
          <input
            autoFocus
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') finish(text); }}
            style={{
              width: '100%', marginTop: '0.9rem', padding: '0.55rem 0.75rem',
              border: '1px solid var(--gray-300)', borderRadius: 4, fontSize: '0.82rem',
            }}
          />
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.1rem' }}>
          <button
            onClick={() => finish(asksForText ? null : false)}
            style={{
              background: 'none', border: '1px solid var(--gray-300)', color: 'var(--gray-700)',
              padding: '0.45rem 0.9rem', borderRadius: 4, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            autoFocus={!asksForText}
            onClick={() => finish(asksForText ? text : true)}
            style={{
              background: 'var(--teal-700, #0f766e)', border: 'none', color: 'white',
              padding: '0.45rem 0.9rem', borderRadius: 4, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
            }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
