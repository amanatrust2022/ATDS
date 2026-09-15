type PatientNameParts = {
  name?: unknown;
  firstName?: unknown;
  middleName?: unknown;
  surname?: unknown;
  first_name?: unknown;
  middle_name?: unknown;
};

const cleanPart = (value: unknown) => {
  if (typeof value !== 'string') return '';
  const part = value.trim();
  return /^(undefined|null)$/i.test(part) ? '' : part;
};

/**
 * The name to show for a patient. The only place this is worked out.
 *
 * `patients` has no `name` column — only the parts — so this is derived at read
 * time and never stored. Writing one is rejected outright and stops
 * registration for everyone; see BUGFIXES.md, 2 September.
 *
 * The `name` in the signature is tolerated rather than expected: some callers
 * still carry an object that has one, and honouring it costs nothing. Nothing
 * should be relying on it.
 *
 * There were three copies of this derivation — here, in the queue card, and in
 * the offline hub's own API mapper. They agreed, but nothing held them
 * together, so the next change to any of them would have parted them.
 */
export const patientDisplayName = (p: PatientNameParts | null | undefined) => {
  if (!p) return '';
  const stored = cleanPart(p.name);
  if (stored) return stored;
  return [p.firstName ?? p.first_name, p.middleName ?? p.middle_name, p.surname]
    .map(cleanPart)
    .filter(Boolean)
    .join(' ');
};
