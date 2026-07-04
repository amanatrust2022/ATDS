'use client';
import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase';
import { buildFallbackProfile, clearPersistedAuthState } from '@/lib/workspace';
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
  authReady: boolean;
  profileReady: boolean;
  signOut: () => Promise<void>;
  refreshOrg: () => Promise<void>;
};

function getIsLocalMode(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  const isLocal = (
    h === 'localhost' || h === '127.0.0.1' ||
    h.startsWith('192.168.') || h.startsWith('10.') || h.startsWith('172.')
  );
  if (!isLocal) return false;
  const stored = localStorage.getItem('amana_local_mode');
  return stored !== null ? stored === 'true' : true;
}

const AuthContext = createContext<AuthContextType>({
  user: null, profile: null, organization: null,
  session: null, loading: true, authReady: false, profileReady: false,
  signOut: async () => {},
  refreshOrg: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]               = useState<User | null>(null);
  const [profile, setProfile]         = useState<Profile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [session, setSession]         = useState<Session | null>(null);
  const [loading, setLoading]         = useState(true);
  const [authReady, setAuthReady]     = useState(false);
  const [profileReady, setProfileReady] = useState(false);

  // ── Guards ────────────────────────────────────────────────────────────────
  // isFetching prevents concurrent fetchProfileAndOrg calls (the core bug fix)
  const isFetching      = useRef(false);
  // lastFetchedUserId prevents re-fetching for the same user when SIGNED_IN
  // fires multiple times (Supabase fires it on every token refresh too)
  const lastFetchedUserId = useRef<string | null>(null);

  const supabase = createClient();

  // ── fetchProfileAndOrg ────────────────────────────────────────────────────
  // Single, deduplicated function. Guards against:
  //   1. Concurrent calls (isFetching ref)
  //   2. Redundant calls for the same user (lastFetchedUserId ref)
  //   3. setSession() side-effects — REMOVED entirely (was causing double SIGNED_IN)
  const fetchProfileAndOrg = async (
    userId: string,
    sourceUser?: User | null,
    force = false
  ) => {
    // Skip if already fetching, or if we already loaded this user's profile
    if (isFetching.current) {
      console.log('[AuthProvider] fetchProfileAndOrg skipped — already in progress');
      return;
    }
    if (!force && lastFetchedUserId.current === userId) {
      console.log('[AuthProvider] fetchProfileAndOrg skipped — already loaded for', userId);
      return;
    }

    isFetching.current = true;
    console.log('[AuthProvider] fetchProfileAndOrg starting for:', userId);

    try {
      let prof: any = null;
      let org: any  = null;
      const IS_LOCAL_MODE = getIsLocalMode();

      // ── Local mode: SQLite first ────────────────────────────────────────
      if (IS_LOCAL_MODE) {
        try {
          const profRes = await fetch(`/api/profiles?userId=${userId}`);
          if (profRes.ok) {
            prof = await profRes.json();
            if (prof?.organization_id) {
              const orgRes = await fetch(`/api/organizations?id=${prof.organization_id}`);
              if (orgRes.ok) org = await orgRes.json();
            }
          }
        } catch (e) {
          console.warn('[AuthProvider] local SQLite lookup failed:', e);
        }
      }

      // ── Cloud: direct Supabase query ────────────────────────────────────
      // NOTE: do NOT call supabase.auth.setSession() here — it triggers a new
      // SIGNED_IN event which would cause this function to be called again.
      if (!prof) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, role, organization_id, email')
            .eq('id', userId)
            .maybeSingle();

          if (error) {
            console.warn('[AuthProvider] profile query error:', error.message);
          } else if (data) {
            prof = data;
          } else {
            console.warn('[AuthProvider] client-side profile query returned null — trying /api/profile fallback');
          }
        } catch (e) {
          console.error('[AuthProvider] profile query threw:', e);
        }
      }

      // Fetch org if we got a profile with org id
      if (prof?.organization_id && !org) {
        try {
          const { data: orgData, error: orgError } = await supabase
            .from('organizations')
            .select('id, slug, name, plan_tier, address, phone, email, letterhead_line2, letterhead_html')
            .eq('id', prof.organization_id)
            .maybeSingle();
          if (!orgError) org = orgData;
        } catch (e) {
          console.warn('[AuthProvider] org query threw:', e);
        }
      }

      // ── Server-side fallback via /api/profile ───────────────────────────
      // Only used when the client-side query returns null (RLS timing edge case)
      if (!prof) {
        try {
          const { data: { session: s } } = await supabase.auth.getSession();
          const token = s?.access_token;
          if (token) {
            const res = await fetch('/api/profile', {
              headers: { 'Authorization': `Bearer ${token}` },
            });
            if (res.ok) {
              const payload = await res.json();
              if (payload.profile) {
                prof = payload.profile;
                org  = payload.organization ?? null;
                console.log('[AuthProvider] /api/profile fallback succeeded, role:', prof.role);
              } else {
                console.warn('[AuthProvider] /api/profile returned ok but no profile:', payload);
              }
            } else {
              console.error('[AuthProvider] /api/profile returned', res.status, await res.text());
            }
          }
        } catch (e) {
          console.warn('[AuthProvider] /api/profile fallback threw:', e);
        }
      }

      // ── Last resort: upsert profile from user_metadata ──────────────────
      if (!prof && sourceUser?.id) {
        try {
          const { data: { session: liveSession } } = await supabase.auth.getSession();
          if (liveSession) {
            const fallback = buildFallbackProfile(sourceUser, {
              email: sourceUser.email || '',
              full_name: sourceUser.user_metadata?.full_name || sourceUser.user_metadata?.name || '',
              role: sourceUser.user_metadata?.role || 'reception',
              organization_id: sourceUser.user_metadata?.organization_id || null,
            });
            if (fallback) {
              const { error: upsertErr } = await supabase
                .from('profiles')
                .upsert(fallback, { onConflict: 'id' });
              if (!upsertErr) {
                prof = fallback;
                console.log('[AuthProvider] profile upserted from user_metadata');
              } else {
                console.error('[AuthProvider] profile upsert failed:', upsertErr.message);
              }
            }
          }
        } catch (e) {
          console.warn('[AuthProvider] metadata upsert threw:', e);
        }
      }

      // ── Commit state ────────────────────────────────────────────────────
      console.log('[AuthProvider] fetchProfileAndOrg resolved — profile:', Boolean(prof), 'org:', Boolean(org));
      setProfile(prof ?? null);
      setOrganization(org ?? null);
      lastFetchedUserId.current = userId;

      // Cache for offline / fast paint
      if (prof) {
        localStorage.setItem('amana_offline_session', JSON.stringify({
          user:         { id: userId, email: (prof as any).email || '' },
          profile:      prof,
          organization: org,
          session:      null,
        }));

        // Back-sync to local SQLite when running in local mode
        if (IS_LOCAL_MODE) {
          try {
            await fetch('/api/profiles', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(prof),
            });
            if (org) {
              await fetch('/api/organizations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(org),
              });
            }
          } catch (e) {
            console.warn('[AuthProvider] local back-sync failed:', e);
          }
        }
      }
    } catch (e) {
      console.error('[AuthProvider] fetchProfileAndOrg error:', e);
      setProfile(null);
      setOrganization(null);
    } finally {
      isFetching.current = false;
      setProfileReady(true);
      console.log('[AuthProvider] fetchProfileAndOrg completed');
    }
  };

  const refreshOrg = async () => {
    if (user) {
      lastFetchedUserId.current = null; // force refresh
      await fetchProfileAndOrg(user.id, user, true);
    }
  };

  // ── Main auth effect ───────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    // On cloud hostnames, clear any stale local mode flag immediately
    if (typeof window !== 'undefined') {
      const h = window.location.hostname;
      const isLocal = (
        h === 'localhost' || h === '127.0.0.1' ||
        h.startsWith('192.168.') || h.startsWith('10.') || h.startsWith('172.')
      );
      if (!isLocal && localStorage.getItem('amana_local_mode') === 'true') {
        localStorage.setItem('amana_local_mode', 'false');
      }
    }

    // Paint from cache instantly for returning users
    const cachedStr = typeof window !== 'undefined'
      ? localStorage.getItem('amana_offline_session') : null;
    if (cachedStr) {
      try {
        const cached = JSON.parse(cachedStr);
        if (cached?.user?.id && cached?.profile && mounted) {
          setUser(cached.user as any);
          setProfile(cached.profile);
          setOrganization(cached.organization ?? null);
          setSession(cached.session ?? null);
          setProfileReady(true);
          lastFetchedUserId.current = cached.user.id;
        }
      } catch {
        localStorage.removeItem('amana_offline_session');
      }
    }

    // ── Single auth state listener ─────────────────────────────────────────
    // This is the ONLY place auth state is read. We no longer call getSession()
    // manually and then also listen — that was the source of double-resolution.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: any, session: any) => {
        if (!mounted) return;
        console.log('[AuthProvider] auth event:', event, 'user:', session?.user?.id ?? 'none');

        if (event === 'SIGNED_OUT') {
          clearPersistedAuthState();
          lastFetchedUserId.current = null;
          isFetching.current = false;
          setUser(null);
          setProfile(null);
          setOrganization(null);
          setSession(null);
          setAuthReady(true);
          setProfileReady(true);
          setLoading(false);
          return;
        }

        if (session?.user) {
          setSession(session);
          setUser(session.user);
          setAuthReady(true);

          // SIGNED_IN fires on every token refresh — only fetch profile once per user
          // unless it's a fresh login (no cached profile for this user)
          await fetchProfileAndOrg(session.user.id, session.user);

          if (mounted) {
            setLoading(false);
          }
        } else {
          // INITIAL_SESSION with no session = user is logged out
          if (event === 'INITIAL_SESSION') {
            setAuthReady(true);
            setLoading(false);
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    clearPersistedAuthState();
    lastFetchedUserId.current = null;
    isFetching.current = false;
    setUser(null);
    setProfile(null);
    setOrganization(null);
    setSession(null);
    setProfileReady(false);
    supabase.auth.signOut().catch((e: unknown) =>
      console.warn('[AuthProvider] signOut error:', e)
    );
  };

  return (
    <AuthContext.Provider value={{
      user, profile, organization, session,
      loading, authReady, profileReady,
      signOut, refreshOrg,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
