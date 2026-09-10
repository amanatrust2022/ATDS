'use client';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Button, Dialog, Field, Input } from '@/components/ui';
import styles from './Notices.module.css';

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

/**
 * Two live regions, not one.
 *
 * Everything used to be announced politely, which meant a failure waited
 * behind whatever the screen reader was already saying. An error interrupts;
 * a confirmation waits its turn.
 */
function NoticeStack({ notices, onDismiss }: { notices: Notice[]; onDismiss: (id: number) => void }) {
  const errors = notices.filter(n => n.tone === 'error');
  const rest = notices.filter(n => n.tone !== 'error');

  return (
    <div className={styles.stack}>
      <div role="alert" aria-live="assertive" className={styles.region}>
        {errors.map(n => <NoticeCard key={n.id} notice={n} onDismiss={onDismiss} />)}
      </div>
      <div role="status" aria-live="polite" className={styles.region}>
        {rest.map(n => <NoticeCard key={n.id} notice={n} onDismiss={onDismiss} />)}
      </div>
    </div>
  );
}

/** What the tone means, for anyone who cannot see the colour. */
const TONE_WORD: Record<Tone, string> = {
  success: 'Done',
  error: 'Problem',
  info: 'Note',
};

function NoticeCard({ notice, onDismiss }: { notice: Notice; onDismiss: (id: number) => void }) {
  return (
    // A dismiss button, not a clickable div: the old card could only be
    // dismissed with a mouse, so an error a keyboard user could not clear
    // stayed on screen for the rest of the session.
    <div className={[styles.card, styles[notice.tone]].join(' ')}>
      <span className={styles.tone}>{TONE_WORD[notice.tone]}</span>
      <span className={styles.message}>{notice.message}</span>
      <button
        type="button"
        className={styles.dismiss}
        onClick={() => onDismiss(notice.id)}
        aria-label={`Dismiss: ${notice.message}`}
      >
        <span aria-hidden="true">&times;</span>
      </button>
    </div>
  );
}

/**
 * The question  and  put on screen.
 *
 * It was a hand-rolled overlay: no focus trap, no Escape, and focus never
 * returned to whatever had asked. Built on the shared Dialog now, so all four
 * come from the primitive.
 */
function QuestionDialog({ question, onDone }: { question: Question; onDone: () => void }) {
  const [text, setText] = useState(question.input?.value ?? '');
  const asksForText = !!question.input;

  const finish = (value: any) => { question.resolve(value); onDone(); };
  const cancelValue = asksForText ? null : false;

  return (
    <Dialog
      open
      onOpenChange={(next) => { if (!next) finish(cancelValue); }}
      title={asksForText ? 'One more thing' : 'Please confirm'}
      titleHidden
      size="sm"
      footer={
        <>
          <Button intent="ghost" onClick={() => finish(cancelValue)}>Cancel</Button>
          <Button intent="primary" onClick={() => finish(asksForText ? text : true)}>OK</Button>
        </>
      }
    >
      <p className={styles.question}>{question.message}</p>
      {asksForText && (
        <div style={{ marginTop: 'var(--space-4)' }}>
          <Field label={question.message} labelHidden>
            <Input
              autoFocus
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') finish(text); }}
            />
          </Field>
        </div>
      )}
    </Dialog>
  );
}