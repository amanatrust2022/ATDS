'use client';
import RequireRole from '@/components/RequireRole';
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useNotices } from '@/components/Notices';
import { createClient } from '@/lib/supabase';
import { getRuntimeMode } from '@/lib/runtimeMode';
import { RiSave3Line, RiHospitalLine } from '@remixicon/react';
import dynamic from 'next/dynamic';
import LetterheadA4Preview from '@/components/LetterheadA4Preview';
import { splitLetterhead, combineLetterhead } from '@/lib/letterheadStyles';
import {
  Alert, Button, Card, CardBody, CardHeader, Field, Input, SegmentedControl, Textarea,
} from '@/components/ui';

import { useShellSlot } from '@/components/shell/ShellSlot';
import styles from './organisation.module.css';

const LetterheadDesigner = dynamic(() => import('@/components/LetterheadDesigner'), { ssr: false });

/** Facility details are typed by a person; the letterhead is HTML. */
const esc = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * What a facility gets before it has designed anything: its own name and
 * contact details, set in the style of a printed letterhead. Assembled by
 * string, so everything a person typed is escaped — "Smith & Sons" used to
 * go in raw.
 */
function defaultLetterhead(org: {
  name?: string | null; letterhead_line2?: string | null; address?: string | null;
  phone?: string | null; email?: string | null;
}) {
  const name = esc((org.name || '').toUpperCase());
  const line2 = org.letterhead_line2 ? esc(org.letterhead_line2.toUpperCase()) : '';
  const address = org.address ? esc(org.address) : '';
  const phone = org.phone ? esc(org.phone) : '';
  const email = org.email ? esc(org.email) : '';

  return `
    <div style="text-align: center;">
      <h1 style="color: #0563c1; font-size: 24pt; margin: 0; font-family: Times New Roman, serif; font-weight: 800;">${name}</h1>
      ${line2 ? `<h2 style="color: #0563c1; font-size: 16pt; margin: 2px 0 0 0; font-family: Times New Roman, serif; font-weight: 700;">${line2}</h2>` : ''}
      ${address ? `<p style="font-size: 11pt; color: #222a35; margin: 6px 0 0 0; font-family: Times New Roman, serif;">${address}</p>` : ''}
      <p style="font-size: 11pt; margin: 4px 0 0 0; font-family: Times New Roman, serif; color: #333;">
        ${phone ? `<span style="color: #c00000; margin-right: 15px;">📞 <b>${phone}</b></span>` : ''}
        ${email ? `<span style="color: #0563c1;">✉ <b>${email}</b></span>` : ''}
      </p>
    </div>
  `.trim();
}

type Section = 'header' | 'footer' | 'fullpage';

/**
 * How big a letterhead may get.
 *
 * It is one HTML string in one column, and every picture in it is base64 inside
 * that string. It is read back on every screen that renders a letterhead,
 * embedded in every report printed and emailed, pushed through the offline
 * sync, and shown in the patient portal. There was no limit and no indication
 * of size at all: a clinic could import a phone photograph of its letterhead,
 * save a five-megabyte row, and then find that saving failed, sync stalled, or
 * result emails bounced — with nothing connecting any of that to what they did.
 *
 * The designer now bounds each picture (MAX_IMAGE_PX), so these are a backstop
 * and, more usefully, a number on screen.
 */
const LETTERHEAD_WARN_BYTES = 1_500_000;
const LETTERHEAD_MAX_BYTES = 4_000_000;

const byteLength = (value: string) =>
  typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(value).length : value.length;

const readableSize = (bytes: number) =>
  bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`;

function OrganizationSettings() {
  const { organization, refreshOrg } = useAuth();
  const { ask } = useNotices();
  const supabase = createClient();

  const [formData, setFormData] = useState({
    name: '',
    letterheadLine2: '',
    email: '',
    phone: '',
    address: '',
    letterheadHtml: '',
    letterheadFooterHtml: '',
    letterheadBgHtml: '',
    letterheadBgTop: 170,
    letterheadBgBottom: 90,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [section, setSection] = useState<Section>('header');

  // The heading is the shell's (decision #30); this is the sentence under it.
  useShellSlot({ subtitle: 'Facility details, contact information and the printed letterhead.' });

  // Pre-fill from live org data, once.
  useEffect(() => {
    if (organization && !isInitialized) {
      const { header, footer, bg, bgTop, bgBottom } = splitLetterhead(organization.letterhead_html);
      setFormData({
        name: organization.name || '',
        letterheadLine2: organization.letterhead_line2 || '',
        email: organization.email || '',
        phone: organization.phone || '',
        address: organization.address || '',
        letterheadHtml: header || defaultLetterhead(organization),
        letterheadFooterHtml: footer,
        letterheadBgHtml: bg,
        letterheadBgTop: bgTop,
        letterheadBgBottom: bgBottom,
      });
      setIsInitialized(true);
    }
  }, [organization, isInitialized]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization) return;

    setSaving(true);
    setMessage(null);

    // Header + optional footer + optional full-page background ride inside the
    // one letterhead_html field.
    const combinedLetterhead = combineLetterhead(
      formData.letterheadHtml, formData.letterheadFooterHtml, formData.letterheadBgHtml,
      formData.letterheadBgTop, formData.letterheadBgBottom,
    );

    const size = byteLength(combinedLetterhead);
    if (size > LETTERHEAD_MAX_BYTES) {
      setSaving(false);
      setMessage({
        text:
          `This letterhead is ${readableSize(size)}, which is too large to store and would be ` +
          'attached to every report the clinic prints and emails. Re-import the design as a ' +
          'smaller picture, or remove the full-page background.',
        type: 'error',
      });
      return;
    }

    const cloudUpdates = {
      name: formData.name,
      letterhead_line2: formData.letterheadLine2 || null,
      email: formData.email,
      phone: formData.phone,
      address: formData.address,
      letterhead_html: combinedLetterhead || null,
    };

    try {
      if (getRuntimeMode() === 'local') {
        // On a hub the hub's copy is the one every report prints from, and
        // the hub queues the change for the cloud itself (the sync outbox,
        // pushed by the engine). This used to also fire a Supabase update
        // from here and swallow its failure — so a letterhead saved while
        // the internet was down never reached the cloud at all.
        const res = await fetch('/api/organizations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: organization.id,
            slug: organization.slug,
            plan_tier: organization.plan_tier || 'standard',
            ...cloudUpdates,
          }),
        });
        if (!res.ok) {
          throw new Error('Failed to save settings to the local database.');
        }
      } else {
        const { error } = await supabase
          .from('organizations')
          .update(cloudUpdates)
          .eq('id', organization.id);
        if (error) throw error;
      }

      await refreshOrg();
      setMessage({
        text: 'Settings updated. Printed reports will now use the new letterhead.',
        type: 'success',
      });
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to update settings.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const footerEmpty = !formData.letterheadFooterHtml.trim();
  const bgEmpty = !formData.letterheadBgHtml.trim();

  const letterheadSize = byteLength(
    combineLetterhead(
      formData.letterheadHtml, formData.letterheadFooterHtml, formData.letterheadBgHtml,
      formData.letterheadBgTop, formData.letterheadBgBottom,
    ),
  );

  const sections: { value: Section; label: string }[] = [
    { value: 'header', label: 'Header' },
    { value: 'footer', label: footerEmpty ? 'Footer (none yet)' : 'Footer' },
    { value: 'fullpage', label: bgEmpty ? 'Full page (none yet)' : 'Full page' },
  ];

  return (
    <div className={styles['page']}>
      <Card>
        <CardHeader
          title={
            <span className={styles['cardTitle']}>
              <RiHospitalLine size={18} aria-hidden="true" /> Facility profile &amp; letterhead
            </span>
          }
          subtitle="Design a custom letterhead with images, logos, tables, and colours."
        />
        <CardBody>
          {message && (
            <Alert tone={message.type === 'success' ? 'success' : 'critical'} live>
              {message.text}
            </Alert>
          )}

          {/* Letterhead preview — real A4 page geometry */}
          <div className={styles['preview']}>
            <p className={styles['previewLabel']}>
              Live A4 print preview
              <span className={styles['previewNote']}>
                — header on page 1, footer on every page, exactly as printed
              </span>
            </p>
            <LetterheadA4Preview
              html={formData.letterheadHtml}
              footerHtml={formData.letterheadFooterHtml}
              bgHtml={formData.letterheadBgHtml}
              bgTop={formData.letterheadBgTop}
              bgBottom={formData.letterheadBgBottom}
            />
            {letterheadSize > LETTERHEAD_WARN_BYTES && (
              <Alert tone="warning" title={`This letterhead is ${readableSize(letterheadSize)}`}>
                It rides inside every report this clinic prints and emails, and through the
                offline sync. Above {readableSize(LETTERHEAD_MAX_BYTES)} it will not save at all.
                A smaller picture — or a designed letterhead rather than a scan — costs nothing
                in print quality.
              </Alert>
            )}
          </div>

          <form onSubmit={handleSave} className={styles['form']}>
            <Field
              label="Facility name (official title)"
              hint="The main title of your organisation, used in dashboard headers and on invoices."
              required
            >
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Northgate Diagnostic Centre"
                required
              />
            </Field>

            <div>
              <p className={styles['hint']}>
                Design the <strong>Header</strong> (top of the first page) and, optionally, a{' '}
                <strong>Footer</strong> that repeats at the bottom of every printed page — together
                they make a complete letterhead sheet. Already have one? Click{' '}
                <strong>Import letterhead</strong> to drop in a picture of it (a high-resolution
                PNG/JPG export or scan). Otherwise add text, your logo, lines and shapes, drag to
                move, use the handles to resize/rotate, and double-click a text box to type.
              </p>

              <div className={styles['sectionBar']}>
                <SegmentedControl
                  value={section}
                  onValueChange={setSection}
                  options={sections}
                  ariaLabel="Letterhead section"
                />
                {/* Both of these throw a design away. They used to do it on a
                  * single click, with no warning and nothing on the page to say
                  * what had just gone. */}
                {section === 'footer' && !footerEmpty && (
                  <Button
                    intent="danger"
                    size="sm"
                    onClick={async () => {
                      if (!(await ask('Delete the footer design? This cannot be undone once the settings are saved.'))) return;
                      setFormData((fd) => ({ ...fd, letterheadFooterHtml: '' }));
                    }}
                  >
                    Remove footer
                  </Button>
                )}
                {section === 'fullpage' && !bgEmpty && (
                  <Button
                    intent="danger"
                    size="sm"
                    onClick={async () => {
                      if (!(await ask('Delete the full-page background? This cannot be undone once the settings are saved.'))) return;
                      setFormData((fd) => ({ ...fd, letterheadBgHtml: '' }));
                    }}
                  >
                    Remove background
                  </Button>
                )}
              </div>

              {/* All stay mounted so each keeps its own undo history; inactive ones are hidden. */}
              <div hidden={section !== 'header'}>
                <LetterheadDesigner
                  value={formData.letterheadHtml}
                  onChange={(val) => setFormData((fd) => ({ ...fd, letterheadHtml: val }))}
                />
              </div>
              <div hidden={section !== 'footer'}>
                <p className={styles['hint']}>
                  The footer prints at the bottom of every page. Keep it short — a thin strip
                  (address, tagline, a line or logo). Leave it empty for no footer.
                </p>
                <LetterheadDesigner
                  value={formData.letterheadFooterHtml}
                  defaultHeight={90}
                  minHeight={20}
                  onChange={(val) => setFormData((fd) => ({ ...fd, letterheadFooterHtml: val }))}
                />
              </div>
              <div hidden={section !== 'fullpage'}>
                <p className={styles['hint']}>
                  A full-page background — a frame, border or watermark that sits <em>behind</em>{' '}
                  the report on every page. Easiest is <strong>Import letterhead</strong> with a
                  full-page design (PNG/JPG/PDF). Then set the clear area below so the report
                  prints in the empty middle, not on top of the letterhead&apos;s own header and
                  footer (shown as the dashed box in the preview). Leave empty for none.
                </p>
                {!bgEmpty && (
                  <div className={styles['clearArea']}>
                    <span className={styles['clearAreaTitle']}>Report clear area</span>
                    <label className={styles['clearAreaField']}>
                      Space at top
                      <Input
                        type="number"
                        min={0}
                        value={formData.letterheadBgTop}
                        onChange={(e) =>
                          setFormData((fd) => ({
                            ...fd, letterheadBgTop: Math.max(0, parseInt(e.target.value) || 0),
                          }))
                        }
                      />
                      px
                    </label>
                    <label className={styles['clearAreaField']}>
                      Space at bottom
                      <Input
                        type="number"
                        min={0}
                        value={formData.letterheadBgBottom}
                        onChange={(e) =>
                          setFormData((fd) => ({
                            ...fd, letterheadBgBottom: Math.max(0, parseInt(e.target.value) || 0),
                          }))
                        }
                      />
                      px
                    </label>
                  </div>
                )}
                <LetterheadDesigner
                  value={formData.letterheadBgHtml}
                  defaultHeight={1040}
                  onChange={(val) => setFormData((fd) => ({ ...fd, letterheadBgHtml: val }))}
                />
              </div>
            </div>

            <details className={styles['fallbacks']}>
              <summary>Standard fields &amp; contact fallbacks</summary>
              <div className={styles['fallbackFields']}>
                <p className={styles['fallbackNote']}>
                  Used by basic printouts (such as reception slips) and wherever no custom
                  letterhead has been designed.
                </p>
                <Field label="Letterhead line 2">
                  <Input
                    value={formData.letterheadLine2}
                    onChange={(e) => setFormData({ ...formData, letterheadLine2: e.target.value })}
                    placeholder="e.g. AND CLINICAL SERVICES LIMITED"
                  />
                </Field>
                <Field label="Physical address">
                  <Textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Full physical address for reports…"
                    rows={3}
                  />
                </Field>
                <div className={styles['pair']}>
                  <Field label="Phone number(s)">
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+234 803 339 0574"
                    />
                  </Field>
                  <Field label="Contact email">
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="info@facility.com"
                    />
                  </Field>
                </div>
              </div>
            </details>

            <div className={styles['actions']}>
              <Button
                type="submit"
                intent="primary"
                loading={saving}
                icon={<RiSave3Line size={16} />}
              >
                {saving ? 'Saving…' : 'Save settings'}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {/* Was a red "danger" panel. It is not a danger; it is a fact. */}
      <Alert tone="info" title="Workspace ID">
        Your workspace identifier is{' '}
        <span className={styles['workspaceId']}>{organization?.slug}</span>. It is used in every
        link into this workspace, so it cannot be changed.
      </Alert>
    </div>
  );
}

/** Only these roles may open this screen — see components/RequireRole.tsx. */
export default function GuardedOrganizationSettings(props: any) {
  return (
    <RequireRole allow={['admin']}>
      <OrganizationSettings {...props} />
    </RequireRole>
  );
}
