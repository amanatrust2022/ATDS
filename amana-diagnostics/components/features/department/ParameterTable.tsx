'use client';

import { useMemo } from 'react';
import { Field, Input, ResultFlag, ResultDelta, Select, Table } from '@/components/ui';
import type { TableColumn } from '@/components/ui';
import {
  deriveFlag,
  isCritical,
  isSignificantDelta,
  type Flag,
  type Sex,
} from '@/lib/clinical/referenceRange';
import styles from './ParameterTable.module.css';

export interface EditableResult {
  parameter: string;
  result: string;
  unit: string;
  range: string;
  flag: string;
  /** The patient's last value for this parameter, when there is one. */
  previous?: number | null;
}

interface Props {
  results: EditableResult[];
  onUpdate: (index: number, field: 'result' | 'flag', value: string) => void;
  /** Lets a sexed reference range resolve. Unknown means no flag is derived. */
  sex?: Sex;
}

/**
 * The parameter/result grid — the whole form for an ordinary test, and the
 * "Additional parameters" block under a Widal or MPs matrix.
 *
 * Three things changed here, and they are the clinical point of the overhaul.
 *
 * 1. THE FLAG IS DERIVED. The reference range has always sat in the next
 *    column and nothing ever read it; the technologist set H or L by hand from
 *    a dropdown. An unset flag looked exactly like a normal result. The flag is
 *    now computed as the value is typed, and the dropdown becomes an override
 *    rather than the only source.
 *
 * 2. CRITICAL IS ITS OWN TIER. A panic value is not a louder abnormal. It gets
 *    its own mark and its own row treatment, and DepartmentPage will not
 *    release the test until it has been acknowledged.
 *
 * 3. NOTHING IS COLOUR ALONE. Every flag carries its letter, its word and its
 *    fill. The previous version tinted the input red or blue, which is invisible
 *    to a colour-blind technologist and gone entirely on the monochrome
 *    printouts clinics hand to patients.
 */
export default function ParameterTable({ results, onUpdate, sex = 'unknown' }: Props) {
  /* What the range says each row is, alongside what the technologist has
   * actually recorded. The two are separate on purpose: an override that
   * disagrees with the range is a legitimate clinical act, and the row says so
   * rather than silently replacing one with the other. */
  const derived = useMemo(
    () =>
      results.map((r) =>
        deriveFlag(r.result, r.range, { parameter: r.parameter, sex }),
      ),
    [results, sex],
  );

  /* One column per thing the technologist reads across a row. The parameter is
   * the row's header, so a reader moving along hears what the row is about
   * before it hears the value in it. */
  const columns: TableColumn<EditableResult>[] = [
    {
      key: 'parameter',
      header: 'Parameter',
      rowHeader: true,
      cellClassName: styles['parameter'],
      render: (row) => row.parameter,
    },
    {
      key: 'result',
      header: 'Result',
      cellClassName: styles['resultCell'],
      render: (row, i) => {
        const previous = row.previous;
        const current = Number(row.result);
        const showDelta =
          previous !== null &&
          previous !== undefined &&
          Number.isFinite(current) &&
          row.result.trim() !== '';

        return (
          <>
            <Field label={`${row.parameter} result`} labelHidden>
              <Input
                value={row.result}
                onChange={(e) => onUpdate(i, 'result', e.target.value)}
                placeholder="Enter result"
                inputMode="decimal"
                className={styles['resultInput']}
              />
            </Field>
            {showDelta && (
              <ResultDelta
                previous={previous}
                current={current}
                unit={row.unit}
                significant={isSignificantDelta(previous, current)}
              />
            )}
          </>
        );
      },
    },
    {
      key: 'unit',
      header: 'Unit',
      cellClassName: styles['unit'],
      render: (row) => row.unit || '—',
    },
    {
      key: 'range',
      header: 'Reference range',
      cellClassName: styles['range'],
      render: (row) => row.range || '—',
    },
    {
      key: 'flag',
      header: 'Flag',
      cellClassName: styles['flagCell'],
      render: (row, i) => {
        const suggested = derived[i] ?? null;
        const effective = (row.flag || suggested || '') as Flag;
        const overridden = row.flag !== '' && suggested !== null && row.flag !== suggested;

        return (
          <>
            <ResultFlag value={effective} />
            {overridden && (
              <span className={styles['overrideNote']}>
                set by hand
                <span className="sr-only">
                  , overriding the {suggested === '' ? 'in-range' : suggested} result
                  derived from the reference range
                </span>
              </span>
            )}
          </>
        );
      },
    },
    {
      key: 'override',
      header: 'Override',
      cellClassName: styles['overrideCell'],
      render: (row, i) => {
        const suggested = derived[i] ?? null;
        return (
          <Field label={`Override the flag for ${row.parameter}`} labelHidden>
            <Select
              value={row.flag}
              onChange={(e) => onUpdate(i, 'flag', e.target.value)}
              className={styles['overrideSelect']}
            >
              <option value="">{suggested === null ? 'No range' : 'From range'}</option>
              <option value="H">H — high</option>
              <option value="L">L — low</option>
              <option value="HH">HH — critical high</option>
              <option value="LL">LL — critical low</option>
            </Select>
          </Field>
        );
      },
    },
  ];

  return (
    <Table
      caption="Test parameters, with each result flagged against its reference range"
      className={styles['table']}
      columns={columns}
      rows={results}
      rowKey={(row, i) => `${row.parameter}-${i}`}
      isRowCritical={(row) => {
        const i = results.indexOf(row);
        return isCritical((row.flag || derived[i] || '') as Flag);
      }}
    />
  );
}

/**
 * The rows a technologist has to acknowledge before the test can be released.
 *
 * Exported so DepartmentPage can gate the save on it without re-deriving the
 * flags and risking the two disagreeing.
 */
export function criticalRows(results: EditableResult[], sex: Sex = 'unknown') {
  return results
    .map((row) => {
      const flag = (row.flag ||
        deriveFlag(row.result, row.range, { parameter: row.parameter, sex }) ||
        '') as Flag;
      return { row, flag };
    })
    .filter(({ flag }) => isCritical(flag));
}
