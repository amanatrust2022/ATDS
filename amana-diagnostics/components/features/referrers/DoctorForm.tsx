'use client';

import { Field, Input, Select } from '@/components/ui';
import type { ReferringFacility } from '@/lib/store';

export interface DoctorFormValue {
  name: string;
  facilityId: string;
  phone: string;
  email: string;
}

/** The fields that only a doctor has — a facility to link to. Everything else
 * is on the shared ReferrerDialog frame. */
export function DoctorForm({
  value,
  onChange,
  facilities,
}: {
  value: DoctorFormValue;
  onChange: (patch: Partial<DoctorFormValue>) => void;
  facilities: ReferringFacility[];
}) {
  return (
    <>
      <Field label="Doctor name" required>
        <Input
          value={value.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g. Amina Bello"
        />
      </Field>

      <Field label="Linked facility" optional hint="Leave blank for an independent doctor.">
        <Select value={value.facilityId} onChange={(e) => onChange({ facilityId: e.target.value })}>
          <option value="">Independent — no facility</option>
          {facilities
            .filter((f) => f.is_active || f.id === value.facilityId)
            .map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
        </Select>
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
          placeholder="doctor@example.com"
        />
      </Field>
    </>
  );
}
