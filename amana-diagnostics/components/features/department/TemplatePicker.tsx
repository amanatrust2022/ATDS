'use client';
import { useState } from 'react';
import { RiSettings3Line } from '@remixicon/react';
import { labelStyle, plainInputStyle } from './entryFormStyles';

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
 */
export default function TemplatePicker({ templates, onSelect, onManageTemplates }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const query = searchQuery.toLowerCase();
  const filtered = templates.filter(t =>
    t.name.toLowerCase().includes(query) || t.key.toLowerCase().includes(query)
  );

  const choose = (template: PickableTemplate) => {
    onSelect(template);
    setSearchQuery('');
    setShowDropdown(false);
  };

  const dropdownStyle: React.CSSProperties = {
    position: 'absolute', top: '100%', left: 0, right: 0,
    background: 'white', border: '1px solid #d1d5db',
    borderRadius: 'var(--radius)', marginTop: '0.25rem',
    zIndex: 50,
  };

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
        <label style={labelStyle}>Search &amp; Select Report Template</label>
        <button
          onClick={onManageTemplates}
          style={{
            background: 'none', border: 'none', color: '#7c3aed',
            fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '0.2rem',
            textTransform: 'uppercase', padding: 0
          }}
        >
          <RiSettings3Line size={13} /> Manage Templates
        </button>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          value={searchQuery}
          onChange={e => {
            setSearchQuery(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          placeholder="Type to search e.g. Appendicitis, Pelvic, Normal..."
          style={plainInputStyle}
        />
        {searchQuery && (
          <button
            onClick={() => {
              setSearchQuery('');
              setShowDropdown(false);
            }}
            style={{
              background: '#f3f4f6', border: '1px solid #d1d5db',
              padding: '0.45rem 0.75rem', borderRadius: 'var(--radius)',
              cursor: 'pointer', fontSize: '0.8rem'
            }}
          >
            Clear
          </button>
        )}
      </div>

      {showDropdown && filtered.length > 0 && (
        <div style={{
          ...dropdownStyle,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          maxHeight: '250px', overflowY: 'auto'
        }}>
          {filtered.map(t => (
            <div
              key={t.key}
              onClick={() => choose(t)}
              style={{
                padding: '0.6rem 0.75rem', cursor: 'pointer',
                fontSize: '0.8rem', borderBottom: '1px solid #f3f4f6',
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', transition: 'background 0.1s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                {t.name}
                {!t.isSystem && (
                  <span style={{ fontSize: '0.65rem', padding: '1px 5px', background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', borderRadius: '4px', fontWeight: 700 }}>Custom</span>
                )}
              </span>
              <span style={{ fontSize: '0.65rem', color: '#9ca3af' }}>{t.key.replace(/_/g, ' ')}</span>
            </div>
          ))}
        </div>
      )}
      {showDropdown && filtered.length === 0 && (
        <div style={{
          ...dropdownStyle,
          padding: '0.75rem', fontSize: '0.8rem', color: '#9ca3af', textAlign: 'center'
        }}>
          No matching templates found
        </div>
      )}
    </div>
  );
}
