'use client';

import { Field, FieldRow, Input, Select } from '@/components/ui';

/** The shape the wallet store keeps for a person it is about to register. */
export interface PersonDetails {
  firstName: string;
  surname: string;
  middleName: string;
  age: string;
  sex: 'Male' | 'Female';
  phone: string;
  address: string;
}

/**
 * The details needed to register somebody.
 *
 * One component rather than two near-identical blocks. The owner grid and the
 * dependant grid had drifted apart — the dependant rows were placeholder-only
 * inputs with no labels at all, and put Middle Name after Phone while the owner
 * grid put it second. Same seven fields, so same component.
 */
export function PersonFields({
  value,
  onChange,
  showAddress = true,
  requirePhone = true,
}: {
  value: PersonDetails;
  onChange: (field: keyof PersonDetails, next: string) => void;
  /** Dependants inherit the account's address, so their form omits it. */
  showAddress?: boolean;
  /** A dependant — a child, usually — may not have a phone of their own. */
  requirePhone?: boolean;
}) {
  return (
    <>
      <FieldRow>
        <Field label="First name" required>
          <Input value={value.firstName} onChange={(e) => onChange('firstName', e.target.value)} />
        </Field>
        <Field label="Surname" required>
          <Input value={value.surname} onChange={(e) => onChange('surname', e.target.value)} />
        </Field>
        <Field label="Middle name" optional>
          <Input value={value.middleName} onChange={(e) => onChange('middleName', e.target.value)} />
        </Field>
      </FieldRow>

      <FieldRow>
        <Field label="Age" required>
          <Input value={value.age} onChange={(e) => onChange('age', e.target.value)} />
        </Field>
        <Field label="Sex">
          <Select value={value.sex} onChange={(e) => onChange('sex', e.target.value)}>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </Select>
        </Field>
        <Field label="Phone" optional={!requirePhone} required={requirePhone}>
          <Input type="tel" value={value.phone} onChange={(e) => onChange('phone', e.target.value)} />
        </Field>
      </FieldRow>

      {showAddress && (
        <Field label="Address" optional>
          <Input value={value.address} onChange={(e) => onChange('address', e.target.value)} />
        </Field>
      )}
    </>
  );
}
