import React, { useEffect, useState } from 'react';
import { RiAddLine, RiSearchLine } from '@remixicon/react';
import { ReferringDoctor, ReferringFacility } from '@/lib/store';
import { useRegistrationStore } from '@/lib/store/useRegistrationStore';
import { Button, Field, Input } from '@/components/ui';

import styles from './referral.module.css';

/**
 * The two referral pickers at the head of registration: the referring doctor
 * and the referring facility.
 *
 * Both were the same widget the wallet's OwnerPicker used to be — a search
 * whose results were <div onClick>. A mouse could reach them; a keyboard could
 * not, the input had no accessible name, and nothing announced the list. Each
 * is a named combobox over a listbox of buttons now, with arrow keys, Enter and
 * Escape, and the chosen referrer shows below with a button that has a name
 * where the old X had none.
 *
 * The commission figure is still not shown beside a doctor or facility: the
 * commission actually paid comes from the test-price catalogue, not the
 * referrer's record (lib/store/registrationBilling.ts), so a record's own field
 * is always zero — it used to read "No commission" beside every name.
 */

interface ReferralSelectionProps {
  doctors: ReferringDoctor[];
  facilities: ReferringFacility[];
  errors: Record<string, string>;

  selectedDoctorId: string;
  setSelectedDoctorId: (id: string) => void;
  doctorSearch: string;
  setDoctorSearch: (q: string) => void;
  showDoctorDrop: boolean;
  setShowDoctorDrop: (show: boolean) => void;
  doctorRef: React.RefObject<HTMLDivElement | null>;
  onQuickAddDoctor: () => void;

  selectedFacilityId: string;
  setSelectedFacilityId: (id: string) => void;
  facilitySearch: string;
  setFacilitySearch: (q: string) => void;
  showFacilityDrop: boolean;
  setShowFacilityDrop: (show: boolean) => void;
  facilityRef: React.RefObject<HTMLDivElement | null>;
  onQuickAddFacility: () => void;
}

interface Row {
  key: string;
  primary: string;
  secondary?: string;
  free?: boolean;
  special?: boolean;
  onPick: () => void;
}

const cx = (...names: Array<string | false | undefined>) => names.filter(Boolean).join(' ');

/** One search-and-pick control, shared by the doctor and the facility. */
function ReferralCombobox({
  idBase, label, error, onQuickAdd, containerRef,
  open, setOpen, search, onType, placeholder,
  selectionLabel, onRemove, rows, emptyMessage,
}: {
  idBase: string;
  label: string;
  error?: string;
  onQuickAdd: () => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  open: boolean;
  setOpen: (show: boolean) => void;
  search: string;
  onType: (value: string) => void;
  placeholder: string;
  selectionLabel: string | null;
  onRemove: () => void;
  rows: Row[];
  emptyMessage: string | null;
}) {
  const [active, setActive] = useState(0);
  const listId = `${idBase}-results`;

  // The highlight belongs to the list as it stands, not to a stale index.
  useEffect(() => {
    setActive(0);
  }, [search, open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!open || rows.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % rows.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i - 1 + rows.length) % rows.length);
    } else if (e.key === 'Enter') {
      // Enter inside the registration form would otherwise submit it.
      e.preventDefault();
      rows[active]?.onPick();
    }
  };

  return (
    <Field
      label={label}
      required
      error={error}
      action={
        <Button intent="link" size="sm" icon={<RiAddLine size={12} />} onClick={onQuickAdd}>
          Quick Register
        </Button>
      }
    >
      <div ref={containerRef} className={styles['picker']}>
        <Input
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          required={false}
          prefix={<RiSearchLine size={14} />}
          placeholder={placeholder}
          value={selectionLabel ?? search}
          onChange={(e) => onType(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />

        {selectionLabel && (
          <p className={styles['chosen']}>
            <span>{selectionLabel}</span>
            <Button size="sm" intent="dangerQuiet" onClick={onRemove}>
              Remove
            </Button>
          </p>
        )}

        {open && (
          <div className={styles['results']}>
            <ul id={listId} role="listbox" aria-label={label} className={styles['resultList']}>
              {rows.map((r, i) => (
                <li key={r.key} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    className={cx(styles['option'], r.special && styles['special'], i === active && styles['optionActive'])}
                    onClick={r.onPick}
                  >
                    {r.free ? (
                      <span className={styles['optionFree']}>{r.primary}</span>
                    ) : (
                      <>
                        <span className={styles['optionName']}>{r.primary}</span>
                        {r.secondary && <span className={styles['optionMeta']}>{r.secondary}</span>}
                      </>
                    )}
                  </button>
                </li>
              ))}
              {emptyMessage && <li className={styles['empty']}>{emptyMessage}</li>}
            </ul>
          </div>
        )}
      </div>
    </Field>
  );
}

export default function ReferralSelection({
  doctors, facilities, errors,
  selectedDoctorId, setSelectedDoctorId, doctorSearch, setDoctorSearch,
  showDoctorDrop, setShowDoctorDrop, doctorRef, onQuickAddDoctor,
  selectedFacilityId, setSelectedFacilityId, facilitySearch, setFacilitySearch,
  showFacilityDrop, setShowFacilityDrop, facilityRef, onQuickAddFacility,
}: ReferralSelectionProps) {
  const setForm = useRegistrationStore((state) => state.setForm);

  const matchingDoctors = doctors.filter(
    (d) => !doctorSearch || d.name.toLowerCase().includes(doctorSearch.toLowerCase()),
  );
  const matchingFacilities = facilities.filter(
    (f) => !facilitySearch || f.name.toLowerCase().includes(facilitySearch.toLowerCase()),
  );

  // ── Doctor rows ──
  const doctorRows: Row[] = [];
  if (doctorSearch && !selectedDoctorId) {
    doctorRows.push({
      key: '__free',
      primary: `Use "${doctorSearch}" as typed`,
      free: true,
      onPick: () => { setForm({ referredBy: doctorSearch }); setShowDoctorDrop(false); },
    });
  }
  matchingDoctors.forEach((d) => {
    doctorRows.push({
      key: d.id,
      primary: `Dr. ${d.name}`,
      secondary: d.facility_name || 'Independent',
      onPick: () => {
        setSelectedDoctorId(d.id);
        setDoctorSearch('');
        setShowDoctorDrop(false);
        setForm({ referredBy: `Dr. ${d.name}` });
      },
    });
  });
  doctorRows.push({
    key: '__none',
    primary: 'Not referred by anyone',
    secondary: 'Direct walk-in / self-referral',
    special: true,
    onPick: () => {
      setSelectedDoctorId('none');
      setDoctorSearch('');
      setShowDoctorDrop(false);
      setForm({ referredBy: 'Not referred by anyone', referringFacility: 'None / Walk-in' });
      setSelectedFacilityId('none');
      setFacilitySearch('');
    },
  });

  const doctorSelectionLabel = selectedDoctorId
    ? (selectedDoctorId === 'none'
        ? 'Not referred by anyone'
        : `Dr. ${doctors.find((d) => d.id === selectedDoctorId)?.name || ''}`)
    : null;

  // ── Facility rows ──
  const facilityRows: Row[] = [];
  if (facilitySearch && !selectedFacilityId) {
    facilityRows.push({
      key: '__free',
      primary: `Use "${facilitySearch}" as typed`,
      free: true,
      onPick: () => { setForm({ referringFacility: facilitySearch }); setShowFacilityDrop(false); },
    });
  }
  matchingFacilities.forEach((f) => {
    facilityRows.push({
      key: f.id,
      primary: f.name,
      secondary: f.address || undefined,
      onPick: () => {
        setSelectedFacilityId(f.id);
        setFacilitySearch('');
        setShowFacilityDrop(false);
        setForm({ referringFacility: f.name });
      },
    });
  });
  facilityRows.push({
    key: '__none',
    primary: 'None / Walk-in',
    secondary: 'Direct walk-in patient',
    special: true,
    onPick: () => {
      setSelectedFacilityId('none');
      setFacilitySearch('');
      setShowFacilityDrop(false);
      setForm({ referringFacility: 'None / Walk-in' });
    },
  });

  const facilitySelectionLabel = selectedFacilityId
    ? (selectedFacilityId === 'none'
        ? 'None / Walk-in'
        : facilities.find((f) => f.id === selectedFacilityId)?.name || '')
    : null;

  return (
    <div className={styles['grid']}>
      <ReferralCombobox
        idBase="doctor"
        label="Referred by (doctor)"
        error={errors.referredBy}
        onQuickAdd={onQuickAddDoctor}
        containerRef={doctorRef}
        open={showDoctorDrop}
        setOpen={setShowDoctorDrop}
        search={doctorSearch}
        onType={(v) => { setDoctorSearch(v); setSelectedDoctorId(''); setShowDoctorDrop(true); }}
        placeholder="Search or type doctor name…"
        selectionLabel={doctorSelectionLabel}
        onRemove={() => { setSelectedDoctorId(''); setDoctorSearch(''); setForm({ referredBy: '' }); }}
        rows={doctorRows}
        emptyMessage={matchingDoctors.length === 0 && !doctorSearch ? 'No doctors in database. Type to use a custom name.' : null}
      />

      <ReferralCombobox
        idBase="facility"
        label="Referring facility"
        error={errors.referringFacility}
        onQuickAdd={onQuickAddFacility}
        containerRef={facilityRef}
        open={showFacilityDrop}
        setOpen={setShowFacilityDrop}
        search={facilitySearch}
        onType={(v) => { setFacilitySearch(v); setSelectedFacilityId(''); setShowFacilityDrop(true); }}
        placeholder="Search or type facility name…"
        selectionLabel={facilitySelectionLabel}
        onRemove={() => { setSelectedFacilityId(''); setFacilitySearch(''); setForm({ referringFacility: '' }); }}
        rows={facilityRows}
        emptyMessage={matchingFacilities.length === 0 && !facilitySearch ? 'No facilities in database. Type to use a custom name.' : null}
      />
    </div>
  );
}
