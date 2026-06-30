'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { createClient } from '@/lib/supabase';
import Header from '@/components/Header';
import { RiUserSettingsLine, RiCheckLine, RiSave3Line, RiUploadCloud2Line } from '@remixicon/react';

export default function UserSettings() {
  const { profile, user, organization } = useAuth();
  const supabase = createClient();

  const [formData, setFormData] = useState({
    title: 'Mr.',
    firstName: '',
    lastName: '',
    surname: ''
  });
  
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    if (profile) {
      setFormData({
        title: profile.title || 'Mr.',
        firstName: profile.first_name || '',
        lastName: profile.last_name || '',
        surname: profile.surname || ''
      });
      if (profile.signature_url) {
        setSignaturePreview(profile.signature_url);
      }
    }
  }, [profile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSignatureFile(file);
      setSignaturePreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !user) return;
    
    setSaving(true);
    setMessage({ text: '', type: '' });

    try {
      let publicUrl = profile.signature_url;

      if (signatureFile) {
        const fileExt = signatureFile.name.split('.').pop();
        const fileName = `${user.id}-${Math.random()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('signatures')
          .upload(fileName, signatureFile);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from('signatures')
          .getPublicUrl(fileName);
        
        publicUrl = data.publicUrl;
      }

      const fullName = `${formData.title} ${formData.firstName} ${formData.lastName ? formData.lastName + ' ' : ''}${formData.surname}`.trim();

      const { error } = await supabase
        .from('profiles')
        .update({
          title: formData.title,
          first_name: formData.firstName,
          last_name: formData.lastName,
          surname: formData.surname,
          full_name: fullName,
          signature_url: publicUrl
        })
        .eq('id', profile.id);

      if (error) throw error;

      // Update auth metadata to sync with profile
      await supabase.auth.updateUser({
        data: {
          full_name: fullName,
          title: formData.title,
          first_name: formData.firstName,
          surname: formData.surname,
          last_name: formData.lastName,
          signature_url: publicUrl,
        }
      });

      setMessage({ text: 'Profile updated successfully. Refresh to see changes across the app.', type: 'success' });
      setSignatureFile(null); // Reset file input
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to update profile.', type: 'error' });
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gray-50)', display: 'flex', flexDirection: 'column' }}>
      <Header
        title="My Profile"
        subtitle={organization?.name}
        icon={<RiUserSettingsLine size={24} color="white" />}
        accentColor="var(--teal-600)"
      />

      <div style={{ padding: '2rem', maxWidth: 800, margin: '0 auto', width: '100%' }}>
        <div style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          
          <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--gray-200)', display: 'flex', alignItems: 'center', gap: '1.25rem', background: 'linear-gradient(135deg, var(--teal-50) 0%, #f0fdf4 100%)' }}>
            {/* Avatar with initials */}
            <div style={{
              width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
              background: 'var(--teal-600)', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.4rem', fontWeight: 800,
            }}>
              {profile?.full_name ? profile.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--gray-900)' }}>
                {profile?.full_name || 'Your Name'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--teal-700)', background: 'var(--teal-100)', padding: '0.15rem 0.5rem', borderRadius: 999 }}>
                  {profile?.role || 'Staff'}
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--gray-500)' }}>{organization?.name}</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: profile?.signature_url ? '#059669' : 'var(--gray-400)', marginTop: '0.2rem' }}>
                {profile?.signature_url ? '✓ Digital signature on file' : '⚠ No signature uploaded yet'}
              </div>
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

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '1rem' }}>
                <div>
                  <label style={lblStyle}>Title *</label>
                  <select style={inpStyle} value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required>
                    <option value="Mr.">Mr.</option>
                    <option value="Ms.">Ms.</option>
                    <option value="Mrs.">Mrs.</option>
                    <option value="Dr.">Dr.</option>
                    <option value="Prof.">Prof.</option>
                    <option value="MLS.">MLS.</option>
                    <option value="Pharm.">Pharm.</option>
                  </select>
                </div>
                <div>
                  <label style={lblStyle}>Surname *</label>
                  <input style={inpStyle} value={formData.surname} onChange={e => setFormData({ ...formData, surname: e.target.value })} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={lblStyle}>First Name *</label>
                  <input style={inpStyle} value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} required />
                </div>
                <div>
                  <label style={lblStyle}>Last Name</label>
                  <input style={inpStyle} value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} />
                </div>
              </div>

              <div>
                <label style={lblStyle}>Digital Signature</label>
                <div style={{ 
                  border: '1px dashed var(--gray-300)', borderRadius: 8, padding: '1rem', 
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.75rem',
                  background: 'var(--gray-50)'
                }}>
                  {signaturePreview ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <img src={signaturePreview} alt="Signature Preview" style={{ maxHeight: 60, objectFit: 'contain', background: 'white', padding: '0.5rem', borderRadius: 4, border: '1px solid var(--gray-200)' }} />
                      <label style={{ color: 'var(--teal-600)', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>
                        Upload New Signature
                        <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                      </label>
                    </div>
                  ) : (
                    <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', gap: '0.5rem', width: '100%', padding: '1rem' }}>
                      <RiUploadCloud2Line size={24} color="var(--gray-400)" />
                      <span style={{ color: 'var(--gray-500)', fontSize: '0.85rem' }}>Upload Signature Image</span>
                      <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                    </label>
                  )}
                  <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)', margin: 0 }}>This signature will be stamped on diagnostic reports you authorize.</p>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button 
                  type="submit" 
                  disabled={saving}
                  style={{ 
                    background: saving ? '#9ca3af' : 'var(--teal-600)', color: 'white', border: 'none', 
                    padding: '0.75rem 1.5rem', borderRadius: '0.5rem', fontWeight: 600, 
                    display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: saving ? 'not-allowed' : 'pointer',
                    transition: 'background 0.2s'
                  }}
                >
                  <RiSave3Line size={18} />
                  {saving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>

            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
