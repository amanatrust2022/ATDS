'use client';

import type { ReactNode } from 'react';

import { Alert, Button, Checkbox, Dialog, Field } from '@/components/ui';

import styles from './referrers.module.css';

/**
 * The add/edit form shared by both referrer directories.
 *
 * Doctors and facilities each had their own copy: the same teal header band,
 * the same `<div>` overlay with no dialog role, no focus trap and no Escape,
 * and the same local `Field` whose `<label>` had no `htmlFor`, so not one
 * control in either form had a name. The fields differ between the two — a
 * doctor has a facility, a facility has an address — so those stay with their
 * screens and are passed in as children.
 */
export function ReferrerDialog({
  open,
  onOpenChange,
  title,
  children,
  saving,
  error,
  onSave,
  saveLabel,
  isActive,
  onActiveChange,
  activeHint,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  saving: boolean;
  error: string;
  onSave: () => void;
  saveLabel: string;
  isActive: boolean;
  onActiveChange: (next: boolean) => void;
  activeHint: string;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title={title}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button intent="primary" loading={saving} onClick={onSave}>
            {saveLabel}
          </Button>
        </>
      }
    >
      <div className={styles['form']}>
        {error && (
          <Alert tone="critical" live>
            {error}
          </Alert>
        )}

        {children}

        <Field label="Visibility" labelHidden>
          <Checkbox
            checked={isActive}
            label="Active"
            hint={activeHint}
            onChange={(e) => onActiveChange(e.target.checked)}
          />
        </Field>
      </div>
    </Dialog>
  );
}
