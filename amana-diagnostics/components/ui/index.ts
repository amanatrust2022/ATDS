/**
 * The DiagnosticOS component library.
 *
 * Everything a screen needs, so no screen has to type a colour, a size or an
 * ARIA attribute by hand. Import from here, not from the files directly:
 *
 *   import { Button, Field, Input, Table } from '@/components/ui';
 *
 * Two rules keep this working:
 *
 *   1. Components read from the semantic layer of styles/tokens.css and
 *      nowhere else. A component that reaches a primitive (--n-500, --a-600)
 *      will be right in light mode and wrong in dark.
 *   2. If a screen needs something this library does not have, it goes in
 *      here — not inline "just this once". scripts/check-tokens.mjs enforces
 *      that by failing the build when the inline-style count rises.
 *
 * The overlays, tabs and menus are built on Radix primitives, so focus
 * trapping, Escape handling, roving tabindex and the ARIA wiring come from a
 * library that has already solved them rather than from this codebase.
 */

export { Button, ButtonGroup } from './Button';
export type { ButtonProps, ButtonIntent, ButtonSize } from './Button';

export {
  Field,
  FieldRow,
  FieldSet,
  Input,
  Textarea,
  Select,
  Checkbox,
  Radio,
} from './Field';
export type { FieldProps } from './Field';

export { Dialog, ConfirmDialog, DialogTrigger, DialogClose } from './Dialog';
export type { DialogProps, DialogSize } from './Dialog';

export { Tabs, TabPanel, SegmentedControl } from './Tabs';
export type { TabItem } from './Tabs';

export { Badge, StatusPill, ResultFlag, ResultDelta } from './Status';
export type { Tone, StatusShape, ResultFlagValue } from './Status';

export {
  Alert,
  Skeleton,
  SkeletonText,
  SkeletonRows,
  EmptyState,
  Spinner,
  LoadingPanel,
  ErrorBoundary,
} from './Feedback';
export type { AlertTone } from './Feedback';

export {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  DescriptionList,
  Table,
  TableToolbar,
} from './Surface';
export type {
  DescriptionItem,
  TableColumn,
  TableProps,
  SortDirection,
} from './Surface';

export { AppearanceProvider, useAppearance, appearanceBootScript } from './ThemeProvider';
export type { ThemeChoice, Density } from './ThemeProvider';
