'use client';

import * as RadixDialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { Button } from './Button';
import styles from './Dialog.module.css';

/**
 * Every modal in the app was hand-rolled: a position:fixed div over a
 * rgba() scrim. None of the eighteen trapped focus, closed on Escape,
 * locked body scroll, restored focus to the control that opened them, or
 * marked the page behind them inert. A keyboard user could tab straight out
 * of a dialog and into the page underneath while the scrim still covered it.
 *
 * Radix handles all of that. What is added here is the product's chrome and
 * one rule the primitive does not enforce: a dialog always has a title, so
 * `aria-labelledby` can never be dangling.
 */

export type DialogSize = 'sm' | 'md' | 'lg' | 'xl';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Announced when the dialog opens. Required — not decoration. */
  title: string;
  /** One line under the title. Also read out, so keep it useful. */
  description?: string;
  children: ReactNode;
  /** Buttons. Primary action last, matching the platform. */
  footer?: ReactNode;
  /** Small print sitting left of the footer buttons. */
  footerNote?: ReactNode;
  size?: DialogSize;
  /** Fills the viewport height — for previews and long documents. */
  tall?: boolean;
  /** Drops the body padding when the content manages its own scrolling. */
  flush?: boolean;
  /** Anchors to the right edge instead of centring. */
  variant?: 'modal' | 'drawer';
  /**
   * Blocks closing by scrim click and Escape. Use only where losing the
   * content would lose work — never merely to insist on attention.
   */
  dismissible?: boolean;
  /** Hides the title visually while keeping it announced. */
  titleHidden?: boolean;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  footerNote,
  size = 'md',
  tall = false,
  flush = false,
  variant = 'modal',
  dismissible = true,
  titleHidden = false,
}: DialogProps) {
  const block = (event: Event) => {
    if (!dismissible) event.preventDefault();
  };

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={styles['overlay']} />
        <RadixDialog.Content
          className={[
            styles['content'],
            styles[size],
            tall ? styles['tall'] : '',
            variant === 'drawer' ? styles['drawer'] : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onEscapeKeyDown={block}
          onPointerDownOutside={block}
          onInteractOutside={block}
        >
          <div className={styles['header']}>
            <div className={styles['titleGroup']}>
              <RadixDialog.Title className={titleHidden ? 'sr-only' : styles['title']}>
                {title}
              </RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className={styles['description']}>
                  {description}
                </RadixDialog.Description>
              ) : (
                // Radix warns when Content has no Description. Say explicitly
                // that there isn't one rather than shipping an empty element.
                <RadixDialog.Description className="sr-only">
                  {title}
                </RadixDialog.Description>
              )}
            </div>
            {dismissible && (
              <RadixDialog.Close className={styles['close']} aria-label="Close">
                <span aria-hidden="true">&times;</span>
              </RadixDialog.Close>
            )}
          </div>

          <div className={flush ? styles['bodyFlush'] : styles['body']}>{children}</div>

          {(footer || footerNote) && (
            <div className={styles['footer']}>
              {footerNote && <div className={styles['footerNote']}>{footerNote}</div>}
              {footer}
            </div>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

/**
 * A yes/no question, with the destructive option styled as such.
 *
 * The app already replaced its `confirm()` calls with the Notices provider's
 * `ask()`. This is for the cases that need more than one line — showing what
 * will be deleted, or naming the patient a reversal affects.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  destructive = false,
  loading = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  destructive?: boolean;
  loading?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      {...(description ? { description } : {})}
      size="sm"
      footer={
        <>
          <Button intent="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            intent={destructive ? 'danger' : 'primary'}
            onClick={() => void onConfirm()}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}

/** For a trigger that should open the dialog without lifting state up. */
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;
