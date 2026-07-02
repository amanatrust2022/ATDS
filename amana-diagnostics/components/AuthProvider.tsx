'use client';
import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase';
import { clearPersistedAuthState } from '@/lib/workspace';
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

// Computed once per page load, client-side only. Safe for cloud (Vercel).
function getIsLocalMode(): boolean {
  if (typeof window === 'undefined') return false; // SSR — never local
  const stored = localStorage.getItem('amana_local_mode');
  if (stored !== null) return stored === 'true';
  const h = window.location.hostname;
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h.startsWith('192.168.') ||
    h.startsWith('10.') ||
    h.startsWith('172.')
  );
}

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
  // Track whether we've already resolved from cache so we don't clobber it
  const resolvedFromCache = useRef(false);

  const supabase = createClient();

  const fetchProfileAndOrg = async (userId: string) => {
    console.log('[AuthProvider] fetchProfileAndOrg starting for:', userId, 'host=', typeof window !== 'undefined' ? window.location.hostname : 'server');
    const IS_LOCAL_MODE = getIsLocalMode();
    
    // Check localStorage directly to avoid stale React state closure issues
    const cachedSessionStr = typeof window !== 'undefined' ? localStorage.getItem('amana_offline_session') : null;
    let hasCache = false;
    if (cachedSessionStr) {
      try {
        const cached = JSON.parse(cachedSessionStr);
        if (cached && cached.profile && cached.organization) {
          hasCache = true;
        }
      } catch (e) {}
    }

    console.log('[AuthProvider] fetchProfileAndOrg hasCache:', hasCache, 'IS_LOCAL_MODE:', IS_LOCAL_MODE);
    try {
      let prof: any = null;
      let org: any = null;
      let fetchedFromCloud = false;

      if (IS_LOCAL_MODE) {
        // Fetch from local SQLite server endpoints (~5ms)
        try {
          console.log('[AuthProvider] fetchProfileAndOrg fetching from local SQLite...');
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
          console.warn('[AuthProvider] Local database lookup failed, falling back to Supabase:', localErr);
        }
      }

      // In local mode: if org not found locally, check cloud (covers invite/onboarding flows)
      if (IS_LOCAL_MODE && prof && !prof.organization_id) {
        try {
          console.log('[AuthProvider] fetchProfileAndOrg (Local Mode fallback) checking cloud profile...');
          const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, role, organization_id, email')
            .eq('id', userId)
            .maybeSingle();
          if (error) {
            console.warn('[AuthProvider] cloud profile fallback query error:', error);
          } else if (data?.organization_id) {
            prof = data;
            fetchedFromCloud = true;
            if (data.organization_id) {
              const { data: orgData, error: orgError } = await supabase
                .from('organizations')
                .select('id, slug, name, plan_tier, address, phone, email, letterhead_line2, letterhead_html')
                .eq('id', data.organization_id)
                .maybeSingle();
              if (orgError) {
                console.warn('[AuthProvider] organization lookup error:', orgError);
              } else {
                org = orgData;
              }
            }
          }
        } catch (cloudErr) {
          console.log('[AuthProvider] Could not sync profile from cloud during refresh:', cloudErr);
        }
      }

      // Cloud mode (Vercel) — fallback to a simple profile query if the joined query fails
      if (!prof) {
        console.log('[AuthProvider] fetchProfileAndOrg querying cloud Supabase profiles...');
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, role, organization_id, email')
            .eq('id', userId)
            .maybeSingle();

          if (error) {
            console.warn('[AuthProvider] profile query error:', error);
          } else if (data) {
            prof = data;
            if (data.organization_id) {
              const { data: orgData, error: orgError } = await supabase
                .from('organizations')
                .select('id, slug, name, plan_tier, address, phone, email, letterhead_line2, letterhead_html')
                .eq('id', data.organization_id)
                .maybeSingle();
              if (orgError) {
                console.warn('[AuthProvider] organization lookup error:', orgError);
              } else {
                org = orgData;
              }
            }
          }
          fetchedFromCloud = true;
        } catch (cloudQueryErr) {
          console.error('[AuthProvider] cloud profile query threw:', cloudQueryErr);
        }
      }

      console.log('[AuthProvider] fetchProfileAndOrg resolved:', { full_name: prof?.full_name, org_slug: org?.slug, hasProfile: Boolean(prof) });
      setProfile(prof ?? null);
      setOrganization(org ?? null);

      // Always update the SWR cache with fresh data
      if (prof) {
        const cachedUser = user ?? { id: userId, email: prof.email || '' };
        localStorage.setItem('amana_offline_session', JSON.stringify({
          user: { id: userId, email: (prof as any).email || (cachedUser as any).email || '' },
          profile: prof,
          organization: org,
          session: null
        }));

        // Back-sync cloud profile into local SQLite
        if (fetchedFromCloud && IS_LOCAL_MODE) {
          try {
            console.log('[AuthProvider] fetchProfileAndOrg syncing cloud profile/org to local SQLite...');
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
            console.warn('[AuthProvider] Failed to cache profile/org to local SQLite:', syncErr);
          }
        }
      }
    } catch (e) {
      console.error('[AuthProvider] fetchProfileAndOrg error:', e);
      setProfile(null);
      setOrganization(null);
    } finally {
      console.log('[AuthProvider] fetchProfileAndOrg completed');
    }
  };

  const refreshOrg = async () => {
    if (user) await fetchProfileAndOrg(user.id);
  };

  useEffect(() => {
    let mounted = true;
    let didResolveAuth = false;

    // Safety net: unblock UI after 8s if Supabase is still slow
    const safetyNet = setTimeout(() => {
      if (mounted && !didResolveAuth) {
        console.warn('[AuthProvider] Safety net fired — Supabase auth is still pending, allowing UI to render');
        didResolveAuth = true;
        setLoading(false);
      }
    }, 8000);

    const initializeAuth = async () => {
      try {
        // ── STEP 1: Instant paint from SWR cache (~1ms) ───────────────────
        const cachedStr = typeof window !== 'undefined'
          ? localStorage.getItem('amana_offline_session')
          : null;

        if (cachedStr) {
          try {
            const cached = JSON.parse(cachedStr);
            if (cached?.user?.id && cached?.profile) {
              if (mounted) {
                setUser(cached.user as any);
                setProfile(cached.profile);
                setOrganization(cached.organization ?? null);
                setSession(cached.session ?? null);
                resolvedFromCache.current = true;
              }
            }
          } catch {
            localStorage.removeItem('amana_offline_session');
          }
        }

        // ── STEP 2: Validate real Supabase session ─────────────────────────
        const { data: { session }, error } = await supabase.auth.getSession();
        console.log('[AuthProvider] initializeAuth getSession result:', {
          hasSession: Boolean(session?.user),
          userId: session?.user?.id || null,
          errorMessage: error?.message || null,
          errorStatus: (error as any)?.status || null,
        });

        if (!mounted) return;

        if (error) {
          console.warn('[AuthProvider] getSession error:', error.message);
          if (error.message?.includes('Refresh Token') || (error as any).status === 400) {
            clearPersistedAuthState();
            await supabase.auth.signOut().catch(() => {});
            setSession(null); setUser(null); setProfile(null); setOrganization(null);
          }
          didResolveAuth = true;
          setLoading(false);
          return;
        }

        if (session?.user) {
          setSession(session);
          setUser(session.user);
          const { data: { user: verifiedUser }, error: userError } = await supabase.auth.getUser();
          console.log('[AuthProvider] initializeAuth getUser result:', {
            hasUser: Boolean(verifiedUser),
            userId: verifiedUser?.id || null,
            errorMessage: userError?.message || null,
            errorStatus: (userError as any)?.status || null,
          });
          void fetchProfileAndOrg(session.user.id);
        } else {
          const IS_LOCAL_MODE = getIsLocalMode();
          if (!IS_LOCAL_MODE) {
            localStorage.removeItem('amana_offline_session');
            resolvedFromCache.current = false;
            setProfile(null);
            setOrganization(null);
            setUser(null);
            setSession(null);
          } else if (!resolvedFromCache.current) {
            localStorage.removeItem('amana_offline_session');
            setProfile(null);
            setOrganization(null);
            setUser(null);
            setSession(null);
          }
        }

      } catch (e) {
        console.error('[AuthProvider] initializeAuth error:', e);
        if (mounted && !resolvedFromCache.current) {
          setProfile(null); setOrganization(null); setUser(null); setSession(null);
        }
      } finally {
        if (mounted) {
          didResolveAuth = true;
          setLoading(false);
          clearTimeout(safetyNet);
        }
      }
    };

    initializeAuth();

    // ── Auth state change listener ────────────────────────────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: string, session: Session | null) => {
        if (!mounted) return;
        // Skip INITIAL_SESSION — we handle it in initializeAuth
        if (event === 'INITIAL_SESSION') return;

        try {
          const IS_LOCAL_MODE = getIsLocalMode();
          if (event === 'SIGNED_OUT') {
            if (!IS_LOCAL_MODE) {
              clearPersistedAuthState();
              resolvedFromCache.current = false;
              setProfile(null);
              setOrganization(null);
              setSession(null);
              setUser(null);
            }
          } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
            if (session?.user) {
              console.log('[AuthProvider] auth state change:', event, 'userId=', session.user.id);
              setSession(session);
              setUser(session.user);
              const { data: { user: verifiedUser }, error: userError } = await supabase.auth.getUser();
              console.log('[AuthProvider] auth state change getUser result:', {
                hasUser: Boolean(verifiedUser),
                userId: verifiedUser?.id || null,
                errorMessage: userError?.message || null,
                errorStatus: (userError as any)?.status || null,
              });
              void fetchProfileAndOrg(session.user.id);
            }
          }
        } catch (e) {
          console.warn('[AuthProvider] onAuthStateChange error:', e);
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
    clearPersistedAuthState();
    resolvedFromCache.current = false;
    setUser(null);
    setProfile(null);
    setOrganization(null);
    setSession(null);
    supabase.auth.signOut().catch((e: unknown) => console.warn('[AuthProvider] signOut error:', e));
  };

  return (
    <AuthContext.Provider value={{ user, profile, organization, session, loading, signOut, refreshOrg }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
