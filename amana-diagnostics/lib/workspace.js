function normalizeOrganizationData(data) {
  const slug = String(data?.slug || '').trim().toLowerCase();
  return {
    name: String(data?.name || '').trim(),
    slug,
    address: data?.address || null,
    phone: data?.phone || null,
    email: data?.email || null,
    letterhead_line2: data?.letterheadLine2 || null,
    plan_tier: 'standard',
  };
}

export function buildFallbackProfile(user, profileData = {}) {
  if (!user?.id) return null;

  return {
    id: user.id,
    email: profileData.email || user.email || null,
    full_name: profileData.full_name || user.user_metadata?.full_name || user.user_metadata?.name || null,
    role: profileData.role || user.user_metadata?.role || 'reception',
    organization_id: profileData.organization_id ?? user.user_metadata?.organization_id ?? null,
  };
}

export function clearPersistedAuthState() {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem('amana_offline_session');
  } catch (error) {
    console.warn('[workspace] failed to clear cached session', error);
  }

  try {
    const authKeys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('sb-') || key.startsWith('supabase.'))) {
        authKeys.push(key);
      }
    }
    authKeys.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.warn('[workspace] failed to clear Supabase auth storage', error);
  }

  try {
    const sessionKeys = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key && (key.startsWith('sb-') || key.startsWith('supabase.'))) {
        sessionKeys.push(key);
      }
    }
    sessionKeys.forEach((key) => sessionStorage.removeItem(key));
  } catch (error) {
    console.warn('[workspace] failed to clear Supabase session storage', error);
  }
}

export async function upsertProfileForUser(supabase, userId, profileData = {}) {
  if (!userId) return null;

  const payload = {
    id: userId,
    email: profileData.email || null,
    full_name: profileData.full_name || profileData.fullName || null,
    role: profileData.role || 'reception',
    organization_id: profileData.organization_id ?? null,
  };

  try {
    const profilesTable = supabase.from('profiles');

    if (typeof profilesTable.upsert === 'function') {
      const { data, error } = await profilesTable
        .upsert(payload, { onConflict: 'id' })
        .select('id')
        .maybeSingle();

      if (!error) {
        return data;
      }
      console.warn('[workspace] Supabase profile upsert failed, falling back to server endpoint:', error);
    } else {
      const { data, error } = await profilesTable
        .update(payload)
        .eq('id', userId)
        .select('id')
        .maybeSingle();

      if (!error) {
        return data;
      }
      console.warn('[workspace] Supabase profile update failed, falling back to server endpoint:', error);
    }
  } catch (error) {
    console.warn('[workspace] Supabase profile write threw, falling back to server endpoint:', error);
  }

  if (typeof window !== 'undefined') {
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, profile: payload }),
      });

      if (response.ok) {
        const result = await response.json();
        return result?.data || { id: userId };
      }
    } catch (fallbackError) {
      console.warn('[workspace] server-side profile fallback failed:', fallbackError);
    }
  }

  return { id: userId };
}

export async function createOrganizationWithFallback(supabase, data, options = {}) {
  const payload = normalizeOrganizationData(data);
  if (!payload.slug) {
    throw new Error('Workspace ID is required.');
  }

  try {
    const rpcResponse = await supabase.rpc('create_organization_for_signup', {
      p_name: payload.name,
      p_slug: payload.slug,
      p_address: payload.address || null,
      p_phone: payload.phone || null,
      p_email: payload.email || null,
      p_letterhead_line2: payload.letterhead_line2 || null,
    });

    if (!rpcResponse?.error && rpcResponse?.data?.id) {
      return { organization: rpcResponse.data, created: true };
    }
  } catch (rpcError) {
    console.warn('[workspace] RPC create_organization_for_signup failed, using fallback.', rpcError);
  }

  const existingOrgQuery = await supabase
    .from('organizations')
    .select('id, slug, name')
    .eq('slug', payload.slug)
    .maybeSingle();

  if (existingOrgQuery?.error && existingOrgQuery.error.code !== 'PGRST116' && existingOrgQuery.error.status !== 406) {
    throw existingOrgQuery.error;
  }

  if (existingOrgQuery?.data) {
    return { organization: existingOrgQuery.data, created: false };
  }

  const insertResponse = await supabase
    .from('organizations')
    .insert([payload])
    .select('id, slug, name')
    .single();

  if (insertResponse?.error) {
    throw insertResponse.error;
  }

  const organization = insertResponse?.data;

  if (options?.userId) {
    try {
      await upsertProfileForUser(supabase, options.userId, {
        organization_id: organization.id,
        email: options.email || null,
        full_name: options.fullName || null,
        role: options.role || 'admin',
      });
    } catch (profileError) {
      console.warn('[workspace] failed to link profile to organization', profileError);
    }
  }

  return { organization, created: true };
}
