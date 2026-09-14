'use client';

import { Field, Input } from '@/components/ui';

export interface FacilityFormValue {
  name: string;
  address: string;
  phone: string;
  email: string;
}

/** The fields that only a facility has — an address, no linked facility of
 * its own. Everything else is on the shared ReferrerDialog frame. */
export function FacilityForm({
  value,
  onChange,
}: {
  value: FacilityFormValue;
  onChange: (patch: Partial<FacilityFormValue>) => void;
}) {
  return (
    <>
      <Field label="Facility name" required>
        <Input
          value={value.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g. City General Hospital"
        />
      </Field>

      <Field label="Address" optional>
        <Input
          value={value.address}
          onChange={(e) => onChange({ address: e.target.value })}
          placeholder="12 Clinic Road, Kano"
        />
      </Field>

      <Field label="Phone" optional>
        <Input
          type="tel"
          value={value.phone}
          onChange={(e) => onChange({ phone: e.target.value })}
          placeholder="+234 …"
        />
      </Field>

      <Field label="Email" optional>
        <Input
          type="email"
          value={value.email}
          onChange={(e) => onChange({ email: e.target.value })}
          placeholder="info@example.com"
        />
      </Field>
    </>
  );
}
