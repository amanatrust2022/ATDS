/**
 * The application shell: persistent navigation, header, patient context and
 * the command palette. One import for anything that lays out a screen.
 */
export { AppShell } from './AppShell';
export type { AppShellProps, PatientContext } from './AppShell';
export { CommandPalette, useCommandPaletteHotkey } from './CommandPalette';
export type { Command } from './CommandPalette';
export { NAV, navFor, homePathFor, activeEntry, crumbsFor } from './navigation';
export type { NavEntry, Role } from './navigation';
export { SyncStatus } from './SyncStatus';
