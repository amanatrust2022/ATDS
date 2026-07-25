import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { token, password, title, firstName, lastName, surname, publicUrl } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!key) {
      return NextResponse.json({ error: 'Server misconfiguration: Service Role Key missing' }, { status: 500 });
    }

    const supabaseAdmin = createSupabaseClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    // 1. Look up the invitation
    const { data: invite, error: inviteErr } = await supabaseAdmin
      .from('invitations')
      .select('*')
      .eq('token', token)
      .single();

    if (inviteErr || !invite) {
      return NextResponse.json({ error: 'Invitation not found or invalid token' }, { status: 404 });
    }

    if (invite.accepted_at) {
      return NextResponse.json({ error: 'Invitation has already been accepted' }, { status: 400 });
    }

    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 400 });
    }

    const fullName = `${title} ${firstName} ${lastName ? lastName + ' ' : ''}${surname}`.trim();
    
    const userMetaData = {
      full_name: fullName,
      title,
      first_name: firstName,
      surname,
      last_name: lastName,
      signature_url: publicUrl,
      role: invite.role,
      organization_id: invite.organization_id,
    };

    // 2. Check if user already exists in auth.users by email
    const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
    if (listErr) {
      console.error('listUsers error:', listErr);
      return NextResponse.json({ error: `Failed to query users: ${listErr.message || JSON.stringify(listErr)}` }, { status: 500 });
    }

    const existingUser = users.find(u => u.email === invite.email);

    if (existingUser) {
      // 3a. User exists: Update their raw_user_meta_data and profiles table
      const { error: authUpdateErr } = await supabaseAdmin.auth.admin.updateUserById(
        existingUser.id,
        { user_metadata: userMetaData }
      );
      
      if (authUpdateErr) {
        return NextResponse.json({ error: 'Failed to update existing user metadata' }, { status: 500 });
      }

      const { error: profileUpdateErr } = await supabaseAdmin
        .from('profiles')
        .update({
          full_name: fullName,
          title,
          first_name: firstName,
          surname,
          last_name: lastName,
          signature_url: publicUrl,
          role: invite.role,
          organization_id: invite.organization_id,
        })
        .eq('id', existingUser.id);
        
      if (profileUpdateErr) {
        console.error('Failed to update profile for existing user', profileUpdateErr);
      }
    } else {
      // 3b. User does not exist: Create new user with confirmed email
      const { error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: invite.email,
        password: password,
        email_confirm: true,
        user_metadata: userMetaData,
      });

      if (createErr) {
        return NextResponse.json({ error: createErr.message || 'Failed to create user' }, { status: 500 });
      }
    }

    // 4. Update accepted_at for the invitation
    const { error: updateErr } = await supabaseAdmin
      .from('invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('token', token);

    if (updateErr) {
      console.error('Failed to update invitation status:', updateErr);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API /api/invite/accept error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
