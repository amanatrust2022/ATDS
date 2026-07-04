'use client';
import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase';
import { buildFallbackProfile, clearPersistedAuthState, upsertProfileForUser } from '@/lib/workspace';
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

// Computed once per page load, client-side only. Safe for cloud (Vercel/Cloudflare).
// IMPORTANT: Hostname is the ground truth — we never trust localStorage alone,
// because a stale amana_local_mode=true from a local session can poison cloud deployments.
function getIsLocalMode(): boolean {
  if (typeof window === 'undefined') return false; // SSR — never local
  const h = window.location.hostname;
  const isLocalHostname = (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h.startsWith('192.168.') ||
    h.startsWith('10.') ||
    h.startsWith('172.')
  );
  // On a cloud hostname, always return false regardless of localStorage
  if (!isLocalHostname) return false;
  // On a local hostname, respect the override if set
  const stored = localStorage.getItem('amana_local_mode');
  if (stored !== null) return stored === 'true';
  return true;
}

const AuthContext = createContext<AuthContextType>({
  user: null, profile: null, organization: null,
  session: null, loading: true, authReady: false, profileReady: false,
  signOut: async () => {},
  refreshOrg: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  // Track whether we've already resolved from cache so we don't clobber it
  const resolvedFromCache = useRef(false);

  const supabase = createClient();

  const fetchProfileAndOrg = async (userId: string, sourceUser?: User | null) => {
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

      // Fallback: if no profile row found, try to create one from user_metadata.
      // IMPORTANT: Only do this when a real authenticated session exists.
      // If auth.uid() returns null (anon / session not yet restored), the RLS
      // INSERT policy will silently block the write — we must guard against that.
      if (!prof && sourceUser?.id) {
        try {
          // Verify session exists before writing to profiles (avoids anon upsert being blocked by RLS)
          const { data: { session: liveSession } } = await supabase.auth.getSession();
          if (!liveSession) {
            console.warn('[AuthProvider] No live session — skipping profile upsert to avoid anon write blocked by RLS');
          } else {
            const fallbackProfile = buildFallbackProfile(sourceUser, {
              email: sourceUser.email || '',
              full_name: sourceUser.user_metadata?.full_name || sourceUser.user_metadata?.name || '',
              role: sourceUser.user_metadata?.role || 'reception',
              organization_id: sourceUser.user_metadata?.organization_id || null,
            });

            if (fallbackProfile) {
              const { error: upsertError } = await supabase
                .from('profiles')
                .upsert(fallbackProfile, { onConflict: 'id' });

              if (upsertError) {
                console.error('[AuthProvider] profile upsert failed (RLS or DB error):', upsertError);
              } else {
                prof = fallbackProfile;
                console.log('[AuthProvider] profile upserted from user_metadata fallback');
              }
            }

            if (prof?.organization_id) {
              const { data: orgData, error: orgError } = await supabase
                .from('organizations')
                .select('id, slug, name, plan_tier, address, phone, email, letterhead_line2, letterhead_html')
                .eq('id', prof.organization_id)
                .maybeSingle();
              if (orgError) {
                console.warn('[AuthProvider] org lookup after fallback upsert failed:', orgError);
              } else {
                org = orgData;
              }
            }
          }
        } catch (profileSyncErr) {
          console.warn('[AuthProvider] failed to create or refresh cloud profile:', profileSyncErr);
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
      setProfileReady(true);
      console.log('[AuthProvider] fetchProfileAndOrg completed');
    }
  };

  const refreshOrg = async () => {
    if (user) await fetchProfileAndOrg(user.id);
  };

  useEffect(() => {
    let mounted = true;
    let didResolveAuth = false;

    // Safety net: unblock UI after 15s if Supabase is still slow.
    // 15s gives ample time for Supabase cold starts on Vercel/Cloudflare edge.
    const safetyNet = setTimeout(() => {
      if (mounted && !didResolveAuth) {
        console.warn('[AuthProvider] Safety net fired — Supabase auth is still pending, allowing UI to render');
        didResolveAuth = true;
        setAuthReady(true);
        setProfileReady(true);
        setLoading(false);
      }
    }, 15000);

    const initializeAuth = async () => {
      try {
        // ── STEP 0: Clear stale local-mode flag on cloud hostnames ────────
        // Prevents a leftover amana_local_mode=true (from local dev) from
        // causing the AuthProvider to call /api/profiles (SQLite) on cloud.
        if (typeof window !== 'undefined') {
          const h = window.location.hostname;
          const isLocalHostname = (
            h === 'localhost' || h === '127.0.0.1' ||
            h.startsWith('192.168.') || h.startsWith('10.') || h.startsWith('172.')
          );
          if (!isLocalHostname) {
            const storedMode = localStorage.getItem('amana_local_mode');
            if (storedMode === 'true') {
              console.warn('[AuthProvider] Clearing stale amana_local_mode=true on cloud hostname');
              localStorage.setItem('amana_local_mode', 'false');
            }
          }
        }

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
                setProfileReady(true);
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
          setAuthReady(true);
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
          await fetchProfileAndOrg(session.user.id, session.user);
          // Mark resolved so the finally block and INITIAL_SESSION handler both know
          // this path handled auth. Also mark profile as loaded.
          didResolveAuth = true;
          if (mounted) setProfileReady(true);
        } else {
          // getSession() returned null — two possible reasons:
          //   a) User is genuinely not logged in.
          //   b) PKCE code exchange is still in progress (e.g. email confirmation redirect).
          // We CANNOT tell the difference here. So we clear stale state but leave
          // loading=true and authReady=false. The onAuthStateChange(INITIAL_SESSION)
          // handler below will fire next and act as the single arbiter:
          //   — if the PKCE exchange completed, it arrives with a real session.
          //   — if the user is truly logged out, it arrives with session=null.
          // DO NOT set didResolveAuth = true here.
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
          console.log('[AuthProvider] getSession returned null — deferring to INITIAL_SESSION event');
          // Return without resolving — INITIAL_SESSION will finish this.
          return;
        }

      } catch (e) {
        console.error('[AuthProvider] initializeAuth error:', e);
        if (mounted && !resolvedFromCache.current) {
          setProfile(null); setOrganization(null); setUser(null); setSession(null);
        }
        // On error, resolve so the UI doesn't hang forever
        if (mounted) {
          didResolveAuth = true;
          setProfileReady(true);
          setAuthReady(true);
          setLoading(false);
          clearTimeout(safetyNet);
        }
      } finally {
        // Only resolve auth here when we successfully found AND processed a session.
        // If we hit the early return (no session path), didResolveAuth is still false
        // and INITIAL_SESSION will call setLoading(false) / setAuthReady(true).
        if (mounted && didResolveAuth) {
          setAuthReady(true);
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

        // ── INITIAL_SESSION ───────────────────────────────────────────────────
        // This event fires once when the listener is first registered.
        // It carries the result of the PKCE code exchange if the user came from
        // an email confirmation / magic link redirect (i.e. ?code=... in URL).
        // If initializeAuth already resolved auth via a cached localStorage session,
        // didResolveAuth will be true and we skip this. Otherwise, this is where
        // auth resolution happens for PKCE and "no-session" cases.
        if (event === 'INITIAL_SESSION') {
          if (didResolveAuth) {
            // initializeAuth already handled a session — nothing to do
            return;
          }
          console.log('[AuthProvider] INITIAL_SESSION fired, session=', Boolean(session?.user));
          try {
            if (session?.user) {
              // PKCE exchange completed — we now have a real session
              setSession(session);
              setUser(session.user);
              await fetchProfileAndOrg(session.user.id, session.user);
            } else {
              // Confirmed: no session. User is not logged in.
              if (!resolvedFromCache.current) {
                setProfile(null);
                setOrganization(null);
                setUser(null);
                setSession(null);
              }
            }
          } catch (e) {
            console.warn('[AuthProvider] INITIAL_SESSION handler error:', e);
          } finally {
            if (mounted) {
              didResolveAuth = true;
              clearTimeout(safetyNet);
              setProfileReady(true);
              setAuthReady(true);
              setLoading(false);
            }
          }
          return;
        }

        // ── Subsequent auth events ────────────────────────────────────────────
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
              setAuthReady(true);
              setSession(session);
              setUser(session.user);
              const { data: { user: verifiedUser }, error: userError } = await supabase.auth.getUser();
              console.log('[AuthProvider] auth state change getUser result:', {
                hasUser: Boolean(verifiedUser),
                userId: verifiedUser?.id || null,
                errorMessage: userError?.message || null,
                errorStatus: (userError as any)?.status || null,
              });
              await fetchProfileAndOrg(session.user.id, session.user);
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
    setProfileReady(false);
    supabase.auth.signOut().catch((e: unknown) => console.warn('[AuthProvider] signOut error:', e));
  };

  return (
    <AuthContext.Provider value={{ user, profile, organization, session, loading, authReady, profileReady, signOut, refreshOrg }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
