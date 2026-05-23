'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { createClient } from '@/lib/supabase';
import { RiSettings3Line, RiCheckLine, RiSave3Line, RiHospitalLine } from '@remixicon/react';

export default function OrganizationSettings() {
  const { organization, refreshOrg } = useAuth();
  const supabase = createClient();

  const [formData, setFormData] = useState({
    name: '',
    letterheadLine2: '',
    email: '',
    phone: '',
    address: ''
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Pre-fill from live org data
  useEffect(() => {
    if (organization) {
      setFormData({
        name: organization.name || '',
        letterheadLine2: organization.letterhead_line2 || '',
        email: organization.email || '',
        phone: organization.phone || '',
        address: organization.address || ''
      });
    }
  }, [organization]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization) return;
    
    setSaving(true);
    setMessage({ text: '', type: '' });

    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          name: formData.name,
          letterhead_line2: formData.letterheadLine2 || null,
          email: formData.email,
          phone: formData.phone,
          address: formData.address
        })
        .eq('id', organization.id);

      if (error) throw error;

      await refreshOrg();
      setMessage({ text: 'Settings updated successfully. Printed reports will now use the new letterhead.', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to update settings.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const inpStyle: React.CSSProperties = {
    width: '100%', padding: '0.75rem 1rem', border: '1px solid var(--gray-300)',
    borderRadius: '0.5rem', fontSize: '0.9rem', outline: 'none', transition: 'border-color 0.2s',
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

      <div style={{ padding: '0 2rem', maxWidth: 800, margin: '0 auto' }}>
        <div style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          
          <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--gray-200)', display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(249,250,251,0.5)' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(68,114,196,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4472c4' }}>
              <RiHospitalLine size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Facility Profile & Letterhead</h2>
              <p style={{ color: 'var(--gray-500)', fontSize: '0.85rem', margin: 0 }}>This information is printed on all patient slips and diagnostic reports.</p>
            </div>
          </div>

          <div style={{ padding: '2rem' }}>
            {message.text && (
              <div style={{ 
                padding: '1rem', marginBottom: '1.5rem', borderRadius: '0.5rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
                background: message.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(248,113,113,0.1)',
                color: message.type === 'success' ? '#059669' : '#dc2626'
              }}>
                {message.type === 'success' && <RiCheckLine size={18} />}
                {message.text}
              </div>
            )}

            {/* Letterhead Preview */}
            <div style={{ border: '2px solid #4472c4', borderRadius: 6, padding: '1rem', marginBottom: '1.5rem', background: '#f8faff', textAlign: 'center' }}>
              <p style={{ fontSize: '0.65rem', fontWeight: 700, color: '#4472c4', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.08em' }}>Letterhead Preview</p>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0563c1', lineHeight: 1.1 }}>{formData.name.toUpperCase() || 'FACILITY NAME'}</div>
              {formData.letterheadLine2 && <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0563c1', lineHeight: 1.2 }}>{formData.letterheadLine2.toUpperCase()}</div>}
              {formData.address && <div style={{ fontSize: '0.7rem', color: '#333', marginTop: '0.25rem' }}>{formData.address}</div>}
              {(formData.phone || formData.email) && (
                <div style={{ fontSize: '0.7rem', marginTop: '0.15rem' }}>
                  {formData.phone && <span style={{ color: '#c00000', marginRight: '0.5rem' }}>📞 {formData.phone}</span>}
                  {formData.email && <span style={{ color: '#0563c1' }}>✉ {formData.email}</span>}
                </div>
              )}
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              <div>
                <label style={lblStyle}>Facility Name (Letterhead Line 1) *</label>
                <input 
                  style={inpStyle} 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                  placeholder="e.g. Amana Trust Diagnostics"
                  required
                />
                <p style={hintStyle}>This is the main title on all printed reports.</p>
              </div>

              <div>
                <label style={lblStyle}>Letterhead Second Line (Optional)</label>
                <input 
                  style={inpStyle} 
                  value={formData.letterheadLine2} 
                  onChange={e => setFormData({...formData, letterheadLine2: e.target.value})} 
                  placeholder="e.g. AND CLINICAL SERVICES LIMITED"
                />
                <p style={hintStyle}>Appears below the facility name in a smaller font on all reports.</p>
              </div>

              <div>
                <label style={lblStyle}>Physical Address</label>
                <textarea 
                  style={{ ...inpStyle, minHeight: '80px', resize: 'vertical' }} 
                  value={formData.address} 
                  onChange={e => setFormData({...formData, address: e.target.value})} 
                  placeholder="Full physical address for reports..."
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div>
                  <label style={lblStyle}>Phone Number(s)</label>
                  <input 
                    style={inpStyle} 
                    value={formData.phone} 
                    onChange={e => setFormData({...formData, phone: e.target.value})} 
                    placeholder="+234 803 339 0574"
                  />
                  <p style={hintStyle}>Shown in red on reports. Use commas for multiple numbers.</p>
                </div>
                <div>
                  <label style={lblStyle}>Contact Email</label>
                  <input 
                    type="email"
                    style={inpStyle} 
                    value={formData.email} 
                    onChange={e => setFormData({...formData, email: e.target.value})} 
                    placeholder="info@facility.com"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button 
                  type="submit" 
                  disabled={saving}
                  style={{ 
                    background: saving ? '#9ca3af' : '#4472c4', color: 'white', border: 'none', 
                    padding: '0.75rem 1.5rem', borderRadius: '0.5rem', fontWeight: 600, 
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

        <div style={{ marginTop: '2rem', padding: '1.5rem', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 'var(--radius-lg)', background: 'rgba(254,226,226,0.3)' }}>
          <h3 style={{ color: '#b91c1c', fontSize: '1rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>Workspace ID</h3>
          <p style={{ color: '#991b1b', fontSize: '0.85rem', margin: '0 0 1rem 0' }}>
            Your unique workspace identifier is <strong>{organization?.slug}</strong>. This cannot be changed as it is used for all internal routing.
          </p>
        </div>
      </div>
    </div>
  );
}
