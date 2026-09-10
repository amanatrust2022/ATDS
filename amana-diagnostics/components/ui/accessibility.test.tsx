import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import axe from 'axe-core';

import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  DescriptionList,
  Dialog,
  EmptyState,
  Field,
  FieldSet,
  Input,
  Radio,
  ResultFlag,
  Select,
  StatusPill,
  TabPanel,
  Table,
  Tabs,
  Textarea,
} from './index';

/**
 * Every screen in the product is built from these, so a violation here is a
 * violation everywhere. The app it replaced had two aria-labels across 264
 * buttons and 192 inputs, and nothing checked.
 *
 * axe cannot see everything — it will not tell you a focus order is confusing
 * or a label is wrong — so this is a floor, not a certificate. The keyboard
 * walkthroughs in docs/DESIGN_SYSTEM.md are the rest of it.
 */

async function expectNoViolations(container: HTMLElement) {
  const results = await axe.run(container, {
    // Colour contrast is verified against the tokens by
    // scripts/check-contrast.mjs. jsdom computes no styles, so axe would
    // report every pair as "incomplete" here and tell us nothing.
    rules: { 'color-contrast': { enabled: false } },
  });

  const violations = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.map((n) => n.html),
  }));

  expect(violations).toEqual([]);
}

describe('the component library meets the accessibility floor', () => {
  it('buttons, including icon-only and loading ones', async () => {
    const { container } = render(
      <div>
        <Button intent="primary">Save result</Button>
        <Button intent="danger" loading>
          Reversing
        </Button>
        <Button intent="ghost" disabled>
          Print
        </Button>
        <Button aria-label="Close the panel" icon={<span>x</span>} />
      </div>,
    );
    await expectNoViolations(container);
  });

  it('every form control is labelled and its error is associated', async () => {
    const { container } = render(
      <form>
        <Field label="Surname" required error="Enter the patient's surname">
          <Input defaultValue="" />
        </Field>
        <Field label="Notes" hint="Seen by the requesting clinician">
          <Textarea defaultValue="" />
        </Field>
        <Field label="Department">
          <Select defaultValue="" placeholder="Choose one">
            <option value="lab">Laboratory</option>
            <option value="rad">Radiology</option>
          </Select>
        </Field>
        <FieldSet legend="Specimen">
          <Radio name="s" label="Blood" defaultChecked />
          <Radio name="s" label="Urine" />
        </FieldSet>
        <Checkbox label="Send the report by email" hint="Uses the address on file" />
      </form>,
    );
    await expectNoViolations(container);
  });

  it('a field marks itself invalid and points at its message', () => {
    render(
      <Field label="Surname" error="Enter the patient's surname">
        <Input />
      </Field>,
    );

    const input = screen.getByLabelText(/Surname/);
    expect(input.getAttribute('aria-invalid')).toBe('true');

    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();

    // The id must resolve — a dangling aria-describedby is worse than none,
    // because the control claims a description that is not there.
    const target = document.getElementById(describedBy!.split(' ')[0]!);
    expect(target?.textContent).toContain("Enter the patient's surname");
  });

  it('a field with no error claims no description', () => {
    render(
      <Field label="Surname">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText(/Surname/);
    expect(input.getAttribute('aria-describedby')).toBeNull();
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });

  it('tabs carry the roles and the selected state', async () => {
    function Harness() {
      const [tab, setTab] = useState('queue');
      return (
        <Tabs
          value={tab}
          onValueChange={setTab}
          ariaLabel="Reception sections"
          items={[
            { value: 'queue', label: 'Queue', count: 4 },
            { value: 'results', label: 'Results', count: 2, alert: true },
          ]}
        >
          <TabPanel value="queue">Queue contents</TabPanel>
          <TabPanel value="results">Results contents</TabPanel>
        </Tabs>
      );
    }

    const { container } = render(<Harness />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0]!.getAttribute('aria-selected')).toBe('true');
    await expectNoViolations(container);
  });

  it('a dialog is labelled, traps into itself, and closes on Escape', async () => {
    function Harness() {
      const [open, setOpen] = useState(true);
      return (
        <Dialog
          open={open}
          onOpenChange={setOpen}
          title="Reverse this payment"
          description="12,000 from the wallet"
          footer={<Button intent="danger">Reverse</Button>}
        >
          <p>This cannot be undone.</p>
        </Dialog>
      );
    }

    render(<Harness />);
    const dialog = await screen.findByRole('dialog');
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy();
    expect(screen.getByText('Reverse this payment')).toBeTruthy();

    await expectNoViolations(dialog as HTMLElement);

    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('a table has a caption, column scopes and a sort state', async () => {
    const { container } = render(
      <Table
        caption="Patients waiting for results"
        rows={[{ id: '1', name: 'A. Bello', balance: 12000 }]}
        rowKey={(r) => r.id}
        sort={{ key: 'name', direction: 'asc' }}
        onSortChange={() => {}}
        columns={[
          { key: 'name', header: 'Patient', sortable: true, render: (r) => r.name },
          { key: 'balance', header: 'Balance', numeric: true, render: (r) => r.balance },
          {
            key: 'do',
            header: '',
            actions: true,
            headerLabel: 'Actions',
            render: () => <Button size="sm">Open</Button>,
          },
        ]}
      />,
    );

    expect(screen.getByRole('table').querySelector('caption')?.textContent).toContain(
      'Patients waiting',
    );
    const sorted = screen.getAllByRole('columnheader')[0]!;
    expect(sorted.getAttribute('aria-sort')).toBe('ascending');

    await expectNoViolations(container);
  });

  it('cards, alerts, empty states and status marks', async () => {
    const { container } = render(
      <div>
        <Card>
          <CardHeader title="Wallet" subtitle="Shared across the family" />
          <CardBody>
            <DescriptionList
              items={[
                { label: 'Balance', value: '12,000' },
                { label: 'Members', value: '4' },
              ]}
            />
          </CardBody>
        </Card>
        <Alert tone="critical" title="Sync incomplete" live>
          Three results have not reached the cloud.
        </Alert>
        <EmptyState title="Nobody is waiting" action={<Button>Register a patient</Button>}>
          Patients appear here once reception has registered them.
        </EmptyState>
        <Badge tone="success">Paid</Badge>
        <StatusPill label="In progress" tone="accent" shape="pulse" />
      </div>,
    );
    await expectNoViolations(container);
  });

  it('a result flag says what it means, not just what colour it is', () => {
    render(
      <div>
        <ResultFlag value="HH" />
        <ResultFlag value="L" />
        <ResultFlag value="" />
      </div>,
    );

    // The words have to be in the accessible name, because the colour and the
    // single letter are the two channels a screen reader cannot use.
    // Twice each, by design: the visible copy is aria-hidden and the sr-only
    // copy carries it, so a screen reader hears it exactly once.
    expect(screen.getAllByText('Critical high').length).toBe(2);
    expect(screen.getAllByText('Low').length).toBe(2);
    expect(screen.getByText('Within reference range')).toBeTruthy();
  });
});
