'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { User, Session } from '@supabase/supabase-js';

export type Profile = {
  id: string;
  full_name: string;
  title?: string;
  first_name?: string;
  surname?: string;
  last_name?: string;
  signature_url?: string;
  role: 'reception' | 'lab' | 'radiology' | 'admin';
  organization_id: string | null;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  plan_tier: string;
  address?: string;
  phone?: string;
  email?: string;
  letterhead_line2?: string;
  letterhead_html?: string | null;
};

type AuthContextType = {
  user: User | null;
  profile: Profile | null;
  organization: Organization | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshOrg: () => Promise<void>;
};

const IS_LOCAL_MODE = typeof window !== 'undefined'
  ? (localStorage.getItem('amana_local_mode') === 'true' || 
     window.location.hostname === 'localhost' || 
     window.location.hostname === '127.0.0.1' || 
     window.location.hostname.startsWith('192.168.') || 
     window.location.hostname.startsWith('10.') || 
     window.location.hostname.startsWith('172.'))
  : (process.env.NEXT_PUBLIC_LOCAL_SERVER_MODE === 'true');

const AuthContext = createContext<AuthContextType>({
  user: null, profile: null, organization: null,
  session: null, loading: true,
  signOut: async () => {},
  refreshOrg: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const fetchProfileAndOrg = async (userId: string) => {
    try {
      let prof = null;
      let org = null;
      let fetchedFromCloud = false;

      if (IS_LOCAL_MODE) {
        // Fetch from local SQLite server endpoints
        try {
          const profRes = await fetch(`/api/profiles?userId=${userId}`);
          if (profRes.ok) {
            prof = await profRes.json();
            if (prof?.organization_id) {
              const orgRes = await fetch(`/api/organizations?id=${prof.organization_id}`);
              if (orgRes.ok) {
                org = await orgRes.json();
              }
            }
          }
        } catch (localErr) {
          console.warn('Local database lookup failed, falling back to Supabase:', localErr);
        }
      }

      if (!prof) {
        // Fallback/cloud behavior
        const { data } = await supabase
          .from('profiles').select('*').eq('id', userId).single();
        prof = data;
        if (prof?.organization_id) {
          const { data: orgData } = await supabase
            .from('organizations').select('*').eq('id', prof.organization_id).single();
          org = orgData;
        }
        fetchedFromCloud = true;
      }

      setProfile(prof ?? null);
      setOrganization(org ?? null);

      if (prof) {
        localStorage.setItem('amana_offline_session', JSON.stringify({
          user: { id: userId, email: (prof as any).email || '' },
          profile: prof,
          organization: org,
          session: null
        }));

        // Cache cloud profile and organization locally in SQLite
        if (fetchedFromCloud && IS_LOCAL_MODE) {
          try {
            await fetch('/api/profiles', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(prof)
            });
            if (org) {
              await fetch('/api/organizations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(org)
              });
            }
          } catch (syncErr) {
            console.warn('Failed to cache profile/org to local SQLite:', syncErr);
          }
        }
      }
    } catch (e) {
      console.error('fetchProfileAndOrg error:', e);
      setProfile(null);
      setOrganization(null);
    }
  };

  const refreshOrg = async () => {
    if (user) await fetchProfileAndOrg(user.id);
  };

  useEffect(() => {
    let mounted = true;

    // A completely silent safety net. If Supabase hangs (e.g. due to corrupted local storage), 
    // we unblock the UI after 2.5 seconds without throwing scary errors.
    const safetyNet = setTimeout(() => {
      if (mounted && loading) {
        setLoading(false);
      }
    }, 2500);

    const initializeAuth = async () => {
      try {
        // In local mode, try to load offline mock session first to render immediately
        if (IS_LOCAL_MODE) {
          const cachedSessionStr = localStorage.getItem('amana_offline_session');
          if (cachedSessionStr) {
            try {
              const cached = JSON.parse(cachedSessionStr);
              if (cached && cached.user && cached.profile) {
                if (mounted) {
                  setUser(cached.user);
                  setProfile(cached.profile);
                  setOrganization(cached.organization || null);
                  setSession(cached.session || null);
                  setLoading(false);
                  clearTimeout(safetyNet);
                  // Trigger background validation of profile/org in case they were updated
                  fetchProfileAndOrg(cached.user.id);
                  return;
                }
              }
            } catch (jsonErr) {
              console.error('Failed to parse cached offline session:', jsonErr);
            }
          }
        }

        // Race the session fetch against a silent timeout
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<{ data: { session: null }, error: null }>((resolve) => {
          setTimeout(() => resolve({ data: { session: null }, error: null }), 2000);
        });

        const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise]);
        
        if (error) {
          if (mounted) setLoading(false);
          return;
        }
        
        if (!mounted) return;
        
        if (session?.user) {
          // If we have a user, fetch profile
          await fetchProfileAndOrg(session.user.id);
        } else {
          setProfile(null);
          setOrganization(null);
        }
        
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);
      } catch (e) {
        // Ignore errors silently to behave like a normal app
        if (mounted) {
          setProfile(null);
          setOrganization(null);
          setUser(null);
          setSession(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
          clearTimeout(safetyNet);
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: string, session: any) => {
        if (!mounted) return;
        if (event === 'INITIAL_SESSION') return;

        try {
          if (event === 'SIGNED_OUT') {
            setProfile(null);
            setOrganization(null);
          } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
            if (session?.user) {
              await fetchProfileAndOrg(session.user.id);
            }
          }
          
          if (!mounted) return;
          setSession(session);
          setUser(session?.user ?? null);
        } catch (e) {
          // Silent catch
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(safetyNet);
    };
  }, []);

  const signOut = async () => {
    try {
      localStorage.removeItem('amana_offline_session');
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Sign out from Supabase failed or offline:', e);
    } finally {
      setUser(null);
      setProfile(null);
      setOrganization(null);
      setSession(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, organization, session, loading, signOut, refreshOrg }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
