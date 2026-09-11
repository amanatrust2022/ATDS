'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { RiSettings3Line } from '@remixicon/react';

import { Badge, Button, Field, Input } from '@/components/ui';

import styles from './entryForm.module.css';

export interface PickableTemplate {
  key: string;
  name: string;
  findings: string;
  impression: string;
  isSystem: boolean;
}

interface Props {
  templates: PickableTemplate[];
  onSelect: (template: PickableTemplate) => void;
  onManageTemplates: () => void;
}

/**
 * Type-ahead over the report templates, system and organisation-specific.
 *
 * The query and the open/closed flag are ephemeral UI state and belong here
 * (AGENTS.md §5) — nothing outside this widget reads them.
 *
 * This is the most-used control on the reporting screen and it could not be
 * operated from a keyboard. The results were `<div onClick>` with no tabindex
 * and no key handler, so focus reached the search box and stopped: no arrow
 * keys, no Enter, nothing to tab to. A radiologist who typed "appendicitis"
 * still had to go and find the mouse. It is a combobox over a listbox now,
 * which is what it always was pretending to be.
 */
export default function TemplatePicker({ templates, onSelect, onManageTemplates }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const listId = useId();
  const optionId = (idx: number) => `${listId}-opt-${idx}`;
  const rootRef = useRef<HTMLDivElement>(null);

  const query = searchQuery.toLowerCase();
  const filtered = templates.filter(
    (t) => t.name.toLowerCase().includes(query) || t.key.toLowerCase().includes(query),
  );

  // Clicking away closes the list. It used to stay open over the report.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const choose = (template: PickableTemplate | undefined) => {
    if (!template) return;
    onSelect(template);
    setSearchQuery('');
    setOpen(false);
    setActive(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const step = e.key === 'ArrowDown' ? 1 : -1;
      // Wraps, so holding one arrow key gets you round the list either way.
      setActive((i) => (filtered.length === 0 ? 0 : (i + step + filtered.length) % filtered.length));
      return;
    }
    if (e.key === 'Enter' && open) {
      e.preventDefault();
      choose(filtered[active]);
    }
  };

  return (
    <div className={styles['picker']} ref={rootRef}>
      <div className={styles['pickerHead']}>
        <Field label="Report template" hint="Type to search, then use the arrow keys.">
          <Input
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && filtered.length > 0 ? optionId(active) : undefined}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setActive(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. Appendicitis, Pelvic, Normal…"
          />
        </Field>

        <Button
          intent="link"
          icon={<RiSettings3Line size={14} />}
          onClick={onManageTemplates}
        >
          Manage templates
        </Button>
      </div>

      {open && filtered.length > 0 && (
        <ul className={styles['pickerList']} id={listId} role="listbox" aria-label="Report templates">
          {filtered.map((t, idx) => (
            <li
              key={t.key}
              id={optionId(idx)}
              role="option"
              aria-selected={idx === active}
              className={[styles['pickerOption'], idx === active ? styles['pickerActive'] : '']
                .filter(Boolean)
                .join(' ')}
              // The input keeps focus throughout, so the pointer must not take
              // it away before the click lands.
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(idx)}
              onClick={() => choose(t)}
            >
              <span className={styles['pickerName']}>
                {t.name}
                {!t.isSystem && <Badge tone="accent">Custom</Badge>}
              </span>
              <span className={styles['pickerKey']}>{t.key.replace(/_/g, ' ')}</span>
            </li>
          ))}
        </ul>
      )}

      {open && filtered.length === 0 && (
        <div className={styles['pickerEmpty']} id={listId}>
          No matching templates found
        </div>
      )}
    </div>
  );
}
