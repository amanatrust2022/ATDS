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
      await supabase
        .from('profiles')
        .update({ organization_id: organization.id })
        .eq('id', options.userId);
    } catch (profileError) {
      console.warn('[workspace] failed to link profile to organization', profileError);
    }
  }

  return { organization, created: true };
}
