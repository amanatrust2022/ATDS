export const STANDARD_STAFF_TITLES = [
  'Mr.',
  'Ms.',
  'Mrs.',
  'Dr.',
  'Prof.',
  'MLS.',
  'Pharm.',
] as const;

export const isStandardStaffTitle = (title: string) =>
  STANDARD_STAFF_TITLES.includes(title as (typeof STANDARD_STAFF_TITLES)[number]);
