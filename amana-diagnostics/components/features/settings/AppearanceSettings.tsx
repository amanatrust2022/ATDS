'use client';

import { RiComputerLine, RiMoonLine, RiSunLine } from '@remixicon/react';
import {
  Card,
  CardBody,
  CardHeader,
  FieldSet,
  Radio,
  useAppearance,
  type Density,
  type ThemeChoice,
} from '@/components/ui';

/**
 * Theme and density, where the user can find them.
 *
 * Both are stored on the device rather than the account: the same
 * technologist wants compact rows on the bench workstation and comfortable
 * ones on the tablet they carry between rooms, and a clinic's shared login
 * would otherwise make one person's choice everybody's.
 *
 * Radio groups rather than a toggle, because there are three theme states and
 * "match my system" is one of them — a two-state switch cannot express it, and
 * that is the state most people are actually in.
 */

const THEMES: { value: ThemeChoice; label: string; hint: string; icon: React.ReactNode }[] = [
  {
    value: 'system',
    label: 'Match my device',
    hint: 'Follows whatever this computer or tablet is set to.',
    icon: <RiComputerLine size={16} />,
  },
  {
    value: 'light',
    label: 'Light',
    hint: 'Best in a bright room and closest to the printed report.',
    icon: <RiSunLine size={16} />,
  },
  {
    value: 'dark',
    label: 'Dark',
    hint: 'Easier on the eyes on a night shift.',
    icon: <RiMoonLine size={16} />,
  },
];

const DENSITIES: { value: Density; label: string; hint: string }[] = [
  {
    value: 'compact',
    label: 'Compact',
    hint: 'More rows on screen at once. For a bench working through a long queue.',
  },
  {
    value: 'standard',
    label: 'Standard',
    hint: 'The default.',
  },
  {
    value: 'comfortable',
    label: 'Comfortable',
    hint: 'Bigger targets and more room. For touchscreens and shared workstations.',
  },
];

export function AppearanceSettings() {
  const { theme, density, setTheme, setDensity } = useAppearance();

  return (
    <Card>
      <CardHeader
        title="Appearance"
        subtitle="Saved on this device, so each screen you work from can differ."
      />
      <CardBody>
        <div style={{ display: 'grid', gap: 'var(--space-6)' }}>
          <FieldSet legend="Theme">
            {THEMES.map((option) => (
              <Radio
                key={option.value}
                name="theme"
                value={option.value}
                checked={theme === option.value}
                onChange={() => setTheme(option.value)}
                label={
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                    }}
                  >
                    <span aria-hidden="true" style={{ display: 'inline-flex' }}>
                      {option.icon}
                    </span>
                    {option.label}
                  </span>
                }
                hint={option.hint}
              />
            ))}
          </FieldSet>

          <FieldSet legend="Row height">
            {DENSITIES.map((option) => (
              <Radio
                key={option.value}
                name="density"
                value={option.value}
                checked={density === option.value}
                onChange={() => setDensity(option.value)}
                label={option.label}
                hint={option.hint}
              />
            ))}
          </FieldSet>
        </div>
      </CardBody>
    </Card>
  );
}
