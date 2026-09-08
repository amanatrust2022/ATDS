'use client';
import RequireRole from '@/components/RequireRole';
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { createClient } from '@/lib/supabase';
import { RiSettings3Line, RiCheckLine, RiSave3Line, RiHospitalLine } from '@remixicon/react';
import dynamic from 'next/dynamic';
import LetterheadA4Preview from '@/components/LetterheadA4Preview';
import { splitLetterhead, combineLetterhead } from '@/lib/letterheadStyles';
const LetterheadDesigner = dynamic(() => import('@/components/LetterheadDesigner'), { ssr: false });

const IS_LOCAL_MODE = typeof window !== 'undefined'
  ? (localStorage.getItem('amana_local_mode') === null
      ? (window.location.hostname === 'localhost' || 
         window.location.hostname === '127.0.0.1' || 
         window.location.hostname.startsWith('192.168.') || 
         window.location.hostname.startsWith('10.') || 
         window.location.hostname.startsWith('172.'))
      : localStorage.getItem('amana_local_mode') === 'true')
  : (process.env.NEXT_PUBLIC_LOCAL_SERVER_MODE === 'true');


function OrganizationSettings() {
  const { organization, refreshOrg } = useAuth();
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
    letterheadBgBottom: 90
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isInitialized, setIsInitialized] = useState(false);
  const [lhTab, setLhTab] = useState<'header' | 'footer' | 'fullpage'>('header');

  // Pre-fill from live org data
  useEffect(() => {
    if (organization && !isInitialized) {
      // Pre-assemble a default HTML letterhead if organization.letterhead_html is empty
      const defaultHtml = `
        <div style="text-align: center;">
          <h1 style="color: #0563c1; font-size: 24pt; margin: 0; font-family: Times New Roman, serif; font-weight: 800;">${(organization.name || '').toUpperCase()}</h1>
          ${organization.letterhead_line2 ? `<h2 style="color: #0563c1; font-size: 16pt; margin: 2px 0 0 0; font-family: Times New Roman, serif; font-weight: 700;">${organization.letterhead_line2.toUpperCase()}</h2>` : ''}
          ${organization.address ? `<p style="font-size: 11pt; color: #222a35; margin: 6px 0 0 0; font-family: Times New Roman, serif;">${organization.address}</p>` : ''}
          <p style="font-size: 11pt; margin: 4px 0 0 0; font-family: Times New Roman, serif; color: #333;">
            ${organization.phone ? `<span style="color: #c00000; margin-right: 15px;">📞 <b>${organization.phone}</b></span>` : ''}
            ${organization.email ? `<span style="color: #0563c1;">✉ <b>${organization.email}</b></span>` : ''}
          </p>
        </div>
      `;

      const { header, footer, bg, bgTop, bgBottom } = splitLetterhead(organization.letterhead_html);
      setFormData({
        name: organization.name || '',
        letterheadLine2: organization.letterhead_line2 || '',
        email: organization.email || '',
        phone: organization.phone || '',
        address: organization.address || '',
        letterheadHtml: header || defaultHtml.trim(),
        letterheadFooterHtml: footer,
        letterheadBgHtml: bg,
        letterheadBgTop: bgTop,
        letterheadBgBottom: bgBottom
      });
      setIsInitialized(true);
    }
  }, [organization, isInitialized]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization) return;
    
    setSaving(true);
    setMessage({ text: '', type: '' });

    // Header + optional footer + optional full-page background ride inside the
    // one letterhead_html field.
    const combinedLetterhead = combineLetterhead(formData.letterheadHtml, formData.letterheadFooterHtml, formData.letterheadBgHtml, formData.letterheadBgTop, formData.letterheadBgBottom);

    try {
      const orgUpdates = {
        id: organization.id,
        name: formData.name,
        slug: organization.slug,
        plan_tier: organization.plan_tier || 'standard',
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        letterhead_line2: formData.letterheadLine2 || null,
        letterhead_html: combinedLetterhead || null
      };

      if (IS_LOCAL_MODE) {
        // 1. Update local DB
        const res = await fetch('/api/organizations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orgUpdates)
        });
        if (!res.ok) {
          throw new Error('Failed to save settings to the local database.');
        }

        // 2. Try to update Supabase in the background, but don't fail if offline
        try {
          const { error } = await supabase
            .from('organizations')
            .update({
              name: formData.name,
              letterhead_line2: formData.letterheadLine2 || null,
              email: formData.email,
              phone: formData.phone,
              address: formData.address,
              letterhead_html: combinedLetterhead || null
            })
            .eq('id', organization.id);
          if (error) {
            console.warn('Background Supabase settings update failed:', error);
          }
        } catch (supabaseErr) {
          console.warn('Background Supabase settings update threw error:', supabaseErr);
        }
      } else {
        // Cloud mode: update Supabase directly
        const { error } = await supabase
          .from('organizations')
          .update({
            name: formData.name,
            letterhead_line2: formData.letterheadLine2 || null,
            email: formData.email,
            phone: formData.phone,
            address: formData.address,
            letterhead_html: combinedLetterhead || null
          })
          .eq('id', organization.id);

        if (error) throw error;
      }

      await refreshOrg();
      setMessage({ 
        text: IS_LOCAL_MODE 
          ? 'Settings updated successfully. Printed reports will now use the new letterhead (saved locally).' 
          : 'Settings updated successfully. Printed reports will now use the new letterhead.', 
        type: 'success' 
      });
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to update settings.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const inpStyle: React.CSSProperties = {
    width: '100%', padding: '0.75rem 1rem', border: '1px solid var(--gray-300)',
    borderRadius: 0, fontSize: '0.9rem', outline: 'none', transition: 'border-color 0.2s',
    background: 'white'
  };

  const lblStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--gray-700)', marginBottom: '0.4rem'
  };

  const hintStyle: React.CSSProperties = {
    fontSize: '0.72rem', color: 'var(--gray-400)', marginTop: '0.25rem'
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gray-50)' }}>
      <div style={{ background: 'white', borderBottom: '1px solid var(--gray-200)', padding: '1.5rem 2rem', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--gray-900)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <RiSettings3Line size={24} color="var(--teal-600)" /> Organization Settings
        </h1>
        <p style={{ color: 'var(--gray-500)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
          Update your facility details, contact information, and letterhead.
        </p>
      </div>

      <div style={{ padding: '0 2rem', maxWidth: 1180, margin: '0 auto', paddingBottom: '3rem' }}>
        <div style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: 0, overflow: 'hidden' }}>
          
          <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--gray-200)', display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(249,250,251,0.5)' }}>
            <div style={{ width: 48, height: 48, borderRadius: 0, background: 'rgba(68,114,196,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4472c4' }}>
              <RiHospitalLine size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Facility Profile & Letterhead</h2>
              <p style={{ color: 'var(--gray-500)', fontSize: '0.85rem', margin: 0 }}>Design a custom HTML letterhead with images, logos, tables, and colors.</p>
            </div>
          </div>

          <div style={{ padding: '2rem' }}>
            {message.text && (
              <div style={{ 
                padding: '1rem', marginBottom: '1.5rem', borderRadius: 0, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
                background: message.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(248,113,113,0.1)',
                color: message.type === 'success' ? '#059669' : '#dc2626'
              }}>
                {message.type === 'success' && <RiCheckLine size={18} />}
                {message.text}
              </div>
            )}

            {/* Letterhead Preview — real A4 page geometry */}
            <div style={{ border: '2px solid #4472c4', borderRadius: 0, marginBottom: '2rem', background: 'white', textAlign: 'left', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
              <p style={{ fontSize: '0.65rem', fontWeight: 700, color: '#4472c4', textTransform: 'uppercase', margin: 0, letterSpacing: '0.08em', borderBottom: '1px solid var(--gray-200)', padding: '0.75rem 1.5rem' }}>
                Live A4 Print Preview <span style={{ color: 'var(--gray-400)', fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>— header on page 1, footer on every page, exactly as printed</span>
              </p>
              <LetterheadA4Preview html={formData.letterheadHtml} footerHtml={formData.letterheadFooterHtml} bgHtml={formData.letterheadBgHtml} bgTop={formData.letterheadBgTop} bgBottom={formData.letterheadBgBottom} />
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              
              <div>
                <label style={lblStyle}>Facility Name (Official Title) *</label>
                <input 
                  style={inpStyle} 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                  placeholder="e.g. Amana Trust Diagnostics"
                  required
                />
                <p style={hintStyle}>This is the main title of your organization used in dashboard headers and invoice generation.</p>
              </div>

              <div>
                <label style={lblStyle}>Custom Designed Letterhead (Free Design Canvas) *</label>
                <p style={{ ...hintStyle, marginBottom: '0.75rem' }}>
                  Design the <strong>Header</strong> (top of the first page) and, optionally, a <strong>Footer</strong> that repeats at the bottom of every printed page — together they make a complete letterhead sheet. Already have one? Click <strong>Import letterhead</strong> to drop in a picture of it (a high-resolution PNG/JPG export or scan). Otherwise add text, your logo, lines and shapes, drag to move, use the handles to resize/rotate, and double-click a text box to type.
                </p>

                {/* Header / Footer / Full-page tabs */}
                <div style={{ display: 'flex', gap: 4, marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                  {([['header', 'Header'], ['footer', 'Footer'], ['fullpage', 'Full page']] as const).map(([t, label]) => {
                    const empty = (t === 'footer' && !formData.letterheadFooterHtml.trim()) || (t === 'fullpage' && !formData.letterheadBgHtml.trim());
                    return (
                      <button key={t} type="button" onClick={() => setLhTab(t)}
                        style={{
                          padding: '0.5rem 1.1rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
                          border: '1px solid ' + (lhTab === t ? '#2563eb' : 'var(--gray-300)'),
                          borderBottom: lhTab === t ? '2px solid #2563eb' : '1px solid var(--gray-300)',
                          background: lhTab === t ? '#eff6ff' : 'white', color: lhTab === t ? '#1d4ed8' : 'var(--gray-600)',
                        }}>
                        {label}{empty ? ' (none yet)' : ''}
                      </button>
                    );
                  })}
                  <div style={{ flex: 1 }} />
                  {lhTab === 'footer' && formData.letterheadFooterHtml.trim() && (
                    <button type="button" onClick={() => setFormData({ ...formData, letterheadFooterHtml: '' })}
                      style={{ padding: '0.5rem 0.9rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626' }}>
                      Remove footer
                    </button>
                  )}
                  {lhTab === 'fullpage' && formData.letterheadBgHtml.trim() && (
                    <button type="button" onClick={() => setFormData({ ...formData, letterheadBgHtml: '' })}
                      style={{ padding: '0.5rem 0.9rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626' }}>
                      Remove background
                    </button>
                  )}
                </div>

                {/* All stay mounted so each keeps its own undo history; inactive ones are hidden. */}
                <div hidden={lhTab !== 'header'}>
                  <LetterheadDesigner
                    value={formData.letterheadHtml}
                    onChange={val => setFormData(fd => ({ ...fd, letterheadHtml: val }))}
                  />
                </div>
                <div hidden={lhTab !== 'footer'}>
                  <p style={{ ...hintStyle, marginBottom: '0.5rem' }}>
                    The footer prints at the bottom of every page. Keep it short — a thin strip (address, tagline, a line or logo). Leave it empty for no footer.
                  </p>
                  <LetterheadDesigner
                    value={formData.letterheadFooterHtml}
                    defaultHeight={90}
                    onChange={val => setFormData(fd => ({ ...fd, letterheadFooterHtml: val }))}
                  />
                </div>
                <div hidden={lhTab !== 'fullpage'}>
                  <p style={{ ...hintStyle, marginBottom: '0.5rem' }}>
                    A full-page background — a frame, border or watermark that sits <em>behind</em> the report on every page. Easiest is <strong>Import letterhead</strong> with a full-page design (PNG/JPG/PDF). Then set the clear area below so the report prints in the empty middle, not on top of the letterhead's own header/footer (shown as the dashed box in the preview). Leave empty for none.
                  </p>
                  {formData.letterheadBgHtml.trim() && (
                    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', margin: '0 0 0.75rem', padding: '0.6rem 0.9rem', background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Report clear area</span>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--gray-700)' }}>
                        Space at top
                        <input type="number" value={formData.letterheadBgTop}
                          onChange={e => setFormData(fd => ({ ...fd, letterheadBgTop: Math.max(0, parseInt(e.target.value) || 0) }))}
                          style={{ width: 70, padding: '4px 6px', border: '1px solid var(--gray-300)', fontSize: '0.8rem' }} /> px
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--gray-700)' }}>
                        Space at bottom
                        <input type="number" value={formData.letterheadBgBottom}
                          onChange={e => setFormData(fd => ({ ...fd, letterheadBgBottom: Math.max(0, parseInt(e.target.value) || 0) }))}
                          style={{ width: 70, padding: '4px 6px', border: '1px solid var(--gray-300)', fontSize: '0.8rem' }} /> px
                      </label>
                    </div>
                  )}
                  <LetterheadDesigner
                    value={formData.letterheadBgHtml}
                    defaultHeight={1040}
                    onChange={val => setFormData(fd => ({ ...fd, letterheadBgHtml: val }))}
                  />
                </div>
              </div>

              {/* Collapsible Accordion for standard fallback fields */}
              <details style={{ border: '1px solid var(--gray-200)', padding: '1.25rem', background: 'var(--gray-50)' }}>
                <summary style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--gray-600)', cursor: 'pointer', outline: 'none', userSelect: 'none' }}>
                  Standard Database Fields & Contact Fallbacks
                </summary>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1.25rem' }}>
                  <p style={{ fontSize: '0.72rem', color: 'var(--gray-500)', margin: 0 }}>
                    These fields are stored for backwards compatibility and are used by basic printouts (like reception slips) or internal API hooks if no custom HTML letterhead is designed.
                  </p>
                  <div>
                    <label style={lblStyle}>Letterhead Line 2 (Fallback)</label>
                    <input 
                      style={inpStyle} 
                      value={formData.letterheadLine2} 
                      onChange={e => setFormData({...formData, letterheadLine2: e.target.value})} 
                      placeholder="e.g. AND CLINICAL SERVICES LIMITED"
                    />
                  </div>
                  <div>
                    <label style={lblStyle}>Physical Address (Fallback)</label>
                    <textarea 
                      style={{ ...inpStyle, minHeight: '60px', resize: 'vertical' }} 
                      value={formData.address} 
                      onChange={e => setFormData({...formData, address: e.target.value})} 
                      placeholder="Full physical address for reports..."
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                    <div>
                      <label style={lblStyle}>Phone Number(s) (Fallback)</label>
                      <input 
                        style={inpStyle} 
                        value={formData.phone} 
                        onChange={e => setFormData({...formData, phone: e.target.value})} 
                        placeholder="+234 803 339 0574"
                      />
                    </div>
                    <div>
                      <label style={lblStyle}>Contact Email (Fallback)</label>
                      <input 
                        type="email"
                        style={inpStyle} 
                        value={formData.email} 
                        onChange={e => setFormData({...formData, email: e.target.value})} 
                        placeholder="info@facility.com"
                      />
                    </div>
                  </div>
                </div>
              </details>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button 
                  type="submit" 
                  disabled={saving}
                  style={{ 
                    background: saving ? '#9ca3af' : '#4472c4', color: 'white', border: 'none', 
                    padding: '0.75rem 1.5rem', borderRadius: 0, fontWeight: 600, 
                    display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: saving ? 'not-allowed' : 'pointer',
                    transition: 'background 0.2s'
                  }}
                >
                  <RiSave3Line size={18} />
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>

            </form>
          </div>
        </div>

        <div style={{ marginTop: '2rem', padding: '1.5rem', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 0, background: 'rgba(254,226,226,0.3)' }}>
          <h3 style={{ color: '#b91c1c', fontSize: '1rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>Workspace ID</h3>
          <p style={{ color: '#991b1b', fontSize: '0.85rem', margin: '0 0 1rem 0' }}>
            Your unique workspace identifier is <strong>{organization?.slug}</strong>. This cannot be changed as it is used for all internal routing.
          </p>
        </div>
      </div>
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
