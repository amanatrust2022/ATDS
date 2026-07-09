'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { RiMicroscopeLine, RiCheckLine, RiShieldCheckLine, RiUploadCloud2Line, RiEyeLine, RiEyeOffLine } from '@remixicon/react';

async function withTimeout(promise: any, ms: number, onWarning: () => void): Promise<any> {
  const timer = setTimeout(onWarning, ms);
  try {
    return await promise;
  } finally {
    clearTimeout(timer);
  }
}

export default function InviteAcceptPage() {
  const params = useParams();
  const token = params?.token as string;
  const router = useRouter();
  const supabase = createClient();

  const [invite, setInvite] = useState<any>(null);
  const [org, setOrg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  
  const [form, setForm] = useState({
    title: 'Mr.',
    firstName: '',
    lastName: '',
    surname: '',
    password: '',
    confirm: ''
  });
  
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const fetchInvite = async () => {
      try {
        const fetchPromise = supabase
          .from('invitations')
          .select('*, organizations(*)')
          .eq('token', token)
          .is('accepted_at', null)
          .gt('expires_at', new Date().toISOString())
          .single();

        const { data, error } = await withTimeout(
          fetchPromise,
          10000,
          () => setError('Slow network connection detected. Still retrieving invitation details... please wait.')
        );

        if (error || !data) {
          setInvalid(true);
        } else {
          setInvite(data);
          setOrg(data.organizations);
        }
      } catch (err: any) {
        console.error('Invite fetch error:', err);
        setInvalid(true);
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchInvite();
  }, [token]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSignatureFile(file);
      setSignaturePreview(URL.createObjectURL(file));
    }
  };

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (!signatureFile) { setError('Please upload your signature.'); return; }
    
    setSubmitting(true); setError('');

    try {
      // 1. Upload Signature
      const fileExt = signatureFile.name.split('.').pop();
      const fileName = `${invite.id}-${Math.random()}.${fileExt}`;
      
      const uploadPromise = supabase.storage
        .from('signatures')
        .upload(fileName, signatureFile);

      const { data: uploadData, error: uploadError } = await withTimeout(
        uploadPromise,
        15000,
        () => setError('Slow network connection detected. Still uploading your signature image... please wait.')
      );

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('signatures')
        .getPublicUrl(fileName);

      // 2. Format Full Name
      const fullName = `${form.title} ${form.firstName} ${form.lastName ? form.lastName + ' ' : ''}${form.surname}`.trim();

      // 3. Create auth user
      const signUpPromise = supabase.auth.signUp({
        email: invite.email,
        password: form.password,
        options: {
          data: {
            full_name: fullName,
            title: form.title,
            first_name: form.firstName,
            surname: form.surname,
            last_name: form.lastName,
            signature_url: publicUrl,
            role: invite.role,
            organization_id: invite.organization_id,
          }
        }
      });

      const { data: authData, error: signUpErr } = await withTimeout(
        signUpPromise,
        15000,
        () => setError('Slow network connection detected. Still creating your account credentials... please wait.')
      );

      if (signUpErr) throw signUpErr;

      // 4. Mark invite as accepted
      const markInvitePromise = supabase
        .from('invitations')
        .update({ accepted_at: new Date().toISOString() })
        .eq('token', token);

      await withTimeout(
        markInvitePromise,
        10000,
        () => setError('Slow network connection detected. Still finalizing invitation status... please wait.')
      );

      // 5. Redirect directly to workspace
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'An unexpected connection error occurred.');
      setSubmitting(false);
    }
  };

  const inp: React.CSSProperties = {
    width: '100%', padding: '0.7rem 0.9rem',
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8, color: 'white', fontSize: '0.9rem', outline: 'none', transition: 'border-color 0.2s'
  };
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: '0.75rem', fontWeight: 600,
    color: 'rgba(255,255,255,0.5)', marginBottom: '0.4rem',
    textTransform: 'uppercase', letterSpacing: '0.05em'
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0f1e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-body)' }}>
      Verifying invite link...
    </div>
  );

  if (invalid) return (
    <div style={{ minHeight: '100vh', background: '#0a0f1e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-body)', padding: '2rem' }}>
      <div style={{ textAlign: 'center', color: 'white', maxWidth: 400 }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔗</div>
        <h2 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Invalid or expired link</h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          This invite link has already been used, expired, or verification timed out due to slow network. Please contact your administrator.
        </p>
        <a href="/login" style={{ color: '#7fa3e0', textDecoration: 'none', fontWeight: 600 }}>← Back to sign in</a>
      </div>
    </div>
  );

  const roleLabels: Record<string, string> = {
    reception: 'Receptionist', lab: 'Lab Scientist', radiology: 'Radiologist', admin: 'Administrator'
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0f1e', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', fontFamily: 'var(--font-body)' }}>
      <style>{`
        input::placeholder { color: rgba(255,255,255,0.2); } 
        input:focus, select:focus { border-color: #4472c4 !important; }
        select option { color: #000; }
      `}</style>
      <div style={{ width: '100%', maxWidth: 500 }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ background: '#4472c4', borderRadius: 10, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
            <RiMicroscopeLine size={24} color="white" />
          </div>
          <h1 style={{ color: 'white', fontSize: '1.4rem', fontWeight: 700 }}>You've been invited!</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
            Join <strong style={{ color: '#7fa3e0' }}>{org?.name}</strong> as {roleLabels[invite.role] || invite.role}
          </p>
        </div>

        <div style={{ background: 'rgba(68,114,196,0.08)', border: '1px solid rgba(68,114,196,0.2)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#7fa3e0' }}>
          <RiShieldCheckLine size={16} />
          Signing in as: <strong>{invite.email}</strong>
        </div>

        <form onSubmit={handleAccept} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '1rem' }}>
            <div>
              <label style={lbl}>Title *</label>
              <select style={inp} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required>
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
              <label style={lbl}>Surname *</label>
              <input style={inp} value={form.surname} onChange={e => setForm({ ...form, surname: e.target.value })} placeholder="e.g. Doe" required />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={lbl}>First Name *</label>
              <input style={inp} value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} placeholder="e.g. John" required />
            </div>
            <div>
              <label style={lbl}>Last Name</label>
              <input style={inp} value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} placeholder="Optional" />
            </div>
          </div>

          <div>
            <label style={lbl}>Digital Signature *</label>
            <div style={{ 
              border: '1px dashed rgba(255,255,255,0.2)', borderRadius: 8, padding: '1rem', 
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem',
              background: 'rgba(255,255,255,0.02)'
            }}>
              {signaturePreview ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  <img src={signaturePreview} alt="Signature Preview" style={{ maxHeight: 60, objectFit: 'contain', background: 'white', padding: '0.5rem', borderRadius: 4 }} />
                  <label style={{ color: '#7fa3e0', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}>
                    Change Signature
                    <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                  </label>
                </div>
              ) : (
                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', gap: '0.5rem' }}>
                  <RiUploadCloud2Line size={24} color="rgba(255,255,255,0.4)" />
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>Upload Signature Image</span>
                  <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} required />
                </label>
              )}
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={lbl}>Create Password *</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showPassword ? "text" : "password"} 
                  style={{...inp, background: 'rgba(0,0,0,0.2)', paddingRight: '2.8rem'}} 
                  value={form.password} 
                  onChange={e => setForm({ ...form, password: e.target.value })} 
                  placeholder="At least 8 characters" 
                  required 
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '0.9rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'rgba(255,255,255,0.25)',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  {showPassword ? <RiEyeOffLine size={16} /> : <RiEyeLine size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label style={lbl}>Confirm Password *</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showConfirm ? "text" : "password"} 
                  style={{...inp, background: 'rgba(0,0,0,0.2)', paddingRight: '2.8rem'}} 
                  value={form.confirm} 
                  onChange={e => setForm({ ...form, confirm: e.target.value })} 
                  placeholder="Repeat password" 
                  required 
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  style={{
                    position: 'absolute',
                    right: '0.9rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'rgba(255,255,255,0.25)',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  {showConfirm ? <RiEyeOffLine size={16} /> : <RiEyeLine size={16} />}
                </button>
              </div>
            </div>
          </div>

          {error && <p style={{ color: '#f87171', fontSize: '0.82rem', background: 'rgba(248,113,113,0.1)', padding: '0.6rem 0.9rem', borderRadius: 6, margin: 0 }}>{error}</p>}
          
          <button type="submit" disabled={submitting} style={{ background: submitting ? '#2a4a8a' : '#4472c4', border: 'none', color: 'white', padding: '0.85rem', borderRadius: 8, fontWeight: 700, fontSize: '0.95rem', cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            {submitting ? 'Creating account...' : <><RiCheckLine size={18} /> Accept Invite & Join Workspace</>}
          </button>
        </form>
      </div>
    </div>
  );
}
