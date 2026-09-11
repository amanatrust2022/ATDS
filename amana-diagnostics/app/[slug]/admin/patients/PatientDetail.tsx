'use client';

import { RiRadarLine, RiTestTubeLine } from '@remixicon/react';

import { Badge, Button, Card, CardBody, CardHeader, DescriptionList } from '@/components/ui';
import type { Patient } from '@/lib/store';
import { patientDisplayName } from '@/lib/store/patientName';

import styles from './patients.module.css';

const STATUS_TONE: Record<string, 'success' | 'warning' | 'neutral'> = {
  completed: 'success',
  in_progress: 'warning',
  pending: 'neutral',
};

const STATUS_LABEL: Record<string, string> = {
  completed: 'Done',
  in_progress: 'In progress',
  pending: 'Not started',
};

/** One patient's record, beside the list. */
export function PatientDetail({
  patient,
  onClose,
  onEdit,
}: {
  patient: Patient;
  onClose: () => void;
  onEdit: () => void;
}) {
  return (
    <Card as="div" className={styles['detail']}>
      <CardHeader
        title={patientDisplayName(patient)}
        subtitle={<span className={styles['mono']}>{patient.slipNumber}</span>}
        actions={
          <Button size="sm" onClick={onClose} aria-label="Close this patient">
            Close
          </Button>
        }
      />
      <CardBody>
        <DescriptionList
          items={[
            { label: 'Age and sex', value: `${patient.age} / ${patient.sex}` },
            { label: 'Phone', value: patient.phone || '—' },
            { label: 'Email', value: patient.email || '—' },
            { label: 'Address', value: patient.address || '—' },
            { label: 'Referred by', value: patient.referredBy || '—' },
            { label: 'Facility', value: patient.referringFacility || '—' },
            {
              label: 'Registered',
              value: new Date(patient.registeredAt).toLocaleString('en-NG'),
            },
          ]}
        />

        <h3 className={styles['detailHeading']}>Tests ({patient.tests.length})</h3>
        <ul className={styles['testList']}>
          {patient.tests.map((t) => (
            <li key={t.testId} className={styles['testRow']}>
              <span className={styles['testName']}>
                {t.department === 'lab' ? (
                  <RiTestTubeLine size={14} aria-hidden="true" />
                ) : (
                  <RiRadarLine size={14} aria-hidden="true" />
                )}
                {t.testName}
              </span>
              <Badge tone={STATUS_TONE[t.status] ?? 'neutral'}>
                {STATUS_LABEL[t.status] ?? t.status}
              </Badge>
            </li>
          ))}
        </ul>

        <Button fullWidth onClick={onEdit}>
          Edit these details
        </Button>
      </CardBody>
    </Card>
  );
}
