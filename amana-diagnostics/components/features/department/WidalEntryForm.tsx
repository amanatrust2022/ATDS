'use client';

import { WidalFormState } from '@/lib/store/labResults';
import { Card, CardBody, CardHeader, Select, Table } from '@/components/ui';
import type { TableColumn } from '@/components/ui';

import styles from './entryForm.module.css';

interface Props {
  value: WidalFormState;
  onChange: (next: WidalFormState) => void;
}

type Limb = 'O' | 'H';

const antigens = [
  { name: 'S. Typhi', keys: { O: 'typhiO', H: 'typhiH' } },
  { name: 'S. Paratyphi A', keys: { O: 'paratyphiAO', H: 'paratyphiAH' } },
  { name: 'S. Paratyphi B', keys: { O: 'paratyphiBO', H: 'paratyphiBH' } },
  { name: 'S. Paratyphi C', keys: { O: 'paratyphiCO', H: 'paratyphiCH' } },
] as const;

const titerOptions = ['Negative', '1:20', '1:40', '1:80', '1:160', '1:320'];

/** 1:80 and above is the titre this lab reports as significant. */
const isSignificant = (titer: string) =>
  titer !== 'Negative' && titer !== '1:20' && titer !== '1:40';

/**
 * One agglutination titre.
 *
 * The cell used to be an unnamed dropdown whose only identity was its position
 * in the grid — eight of "combo box" in a row by keyboard or screen reader,
 * where putting 1:160 in the wrong one reports typhoid against the wrong
 * antigen. It is named by antigen and limb, which have to stay distinct: O
 * rises in acute infection, H persists long after it and after vaccination.
 */
function TiterCell({
  antigen,
  limb,
  titer,
  onSelect,
}: {
  antigen: string;
  limb: Limb;
  titer: string;
  onSelect: (val: string) => void;
}) {
  const significant = isSignificant(titer);

  return (
    <div className={styles['titreCell']}>
      <Select
        aria-label={`${antigen} ${limb} titre`}
        value={titer}
        onChange={(e) => onSelect(e.target.value)}
      >
        {titerOptions.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </Select>

      {/* The old cell went red and bold and said nothing. Red is not a
        * reading: it does not survive a monochrome print, it does not read
        * aloud, and roughly one man in twelve cannot rely on it. */}
      {significant && <span className={styles['significant']}>Significant</span>}
    </div>
  );
}

export default function WidalEntryForm({ value, onChange }: Props) {
  const setTiter = (key: keyof WidalFormState, val: string) =>
    onChange({ ...value, [key]: val });

  /* The antigen names the row, so a reader hears which organism a titre is
   * against before it hears the titre. */
  const columns: TableColumn<(typeof antigens)[number]>[] = [
    {
      key: 'antigen',
      header: 'Antigen',
      rowHeader: true,
      cellClassName: styles['antigen'],
      render: (a) => a.name,
    },
    {
      key: 'O',
      header: 'O titre',
      render: (a) => (
        <TiterCell
          antigen={a.name}
          limb="O"
          titer={value[a.keys.O]}
          onSelect={(val) => setTiter(a.keys.O, val)}
        />
      ),
    },
    {
      key: 'H',
      header: 'H titre',
      render: (a) => (
        <TiterCell
          antigen={a.name}
          limb="H"
          titer={value[a.keys.H]}
          onSelect={(val) => setTiter(a.keys.H, val)}
        />
      ),
    },
  ];

  return (
    <Card>
      <CardHeader
        title="Widal reaction"
        subtitle="Salmonella agglutination titres. 1:80 and above is reported as significant."
      />
      <CardBody>
        <Table
          caption="Widal agglutination titres. One row per salmonella antigen, with its O and H titres."
          className={styles['widalTable']}
          columns={columns}
          rows={[...antigens]}
          rowKey={(a) => a.name}
        />
      </CardBody>
    </Card>
  );
}
