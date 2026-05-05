'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { User, Session } from '@supabase/supabase-js';

export type Profile = {
  id: string;
  full_name: string;
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
    const { data: prof } = await supabase
      .from('profiles').select('*').eq('id', userId).single();
    setProfile(prof);
    if (prof?.organization_id) {
      const { data: org } = await supabase
        .from('organizations').select('*').eq('id', prof.organization_id).single();
      setOrganization(org);
    } else {
      setOrganization(null);
    }
  };

  const refreshOrg = async () => {
    if (user) await fetchProfileAndOrg(user.id);
  };

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) await fetchProfileAndOrg(session.user.id);
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfileAndOrg(session.user.id);
      } else {
        setProfile(null);
        setOrganization(null);
      }
      setLoading(false);
    });

    init();
    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => { await supabase.auth.signOut(); };

  return (
    <AuthContext.Provider value={{ user, profile, organization, session, loading, signOut, refreshOrg }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
