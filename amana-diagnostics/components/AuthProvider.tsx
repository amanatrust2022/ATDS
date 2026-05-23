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
      const { data: prof } = await supabase
        .from('profiles').select('*').eq('id', userId).single();
      setProfile(prof ?? null);
      if (prof?.organization_id) {
        const { data: org } = await supabase
          .from('organizations').select('*').eq('id', prof.organization_id).single();
        setOrganization(org ?? null);
      } else {
        setOrganization(null);
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
          // If we have a user, fetch profile with its own safety race
          const profilePromise = fetchProfileAndOrg(session.user.id);
          const profTimeout = new Promise((resolve) => setTimeout(resolve, 2000));
          await Promise.race([profilePromise, profTimeout]);
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
      async (event, session) => {
        if (!mounted) return;
        if (event === 'INITIAL_SESSION') return;

        try {
          if (event === 'SIGNED_OUT') {
            setProfile(null);
            setOrganization(null);
          } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
            if (session?.user) {
              const profilePromise = fetchProfileAndOrg(session.user.id);
              const profTimeout = new Promise((resolve) => setTimeout(resolve, 2000));
              await Promise.race([profilePromise, profTimeout]);
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
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, profile, organization, session, loading, signOut, refreshOrg }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
