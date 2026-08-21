import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

const SOCIAL_PLATFORMS = new Set(['facebook', 'instagram', 'tiktok', 'whatsapp', 'youtube', 'other']);

function splitName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  return {
    firstName: parts.shift() || '',
    lastName: parts.join(' ') || '-',
  };
}

function createPasswordVerifier() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function POST(request) {
  const admin = createSupabaseAdmin();
  let createdUserId = null;

  try {
    const body = await request.json();
    const fullName = String(body.name || '').trim();
    const phone = String(body.phone || '').replace(/[^\d+]/g, '').trim();
    const requestedEmail = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const confirmPassword = String(body.confirmPassword || '');
    const primarySocialPlatform = String(body.primarySocialPlatform || '').trim().toLowerCase();
    const socialProfile = String(body.socialProfile || '').trim();

    if (fullName.length < 3 || phone.length < 9 || !requestedEmail.includes('@')
        || !SOCIAL_PLATFORMS.has(primarySocialPlatform) || socialProfile.length < 2) {
      return NextResponse.json({ error: 'Preencha correctamente todos os campos.' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'A palavra-passe deve ter pelo menos 8 caracteres.' }, { status: 400 });
    }
    if (password !== confirmPassword) {
      return NextResponse.json({ error: 'As palavras-passe nao coincidem.' }, { status: 400 });
    }

    const { firstName, lastName } = splitName(fullName);
    const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
      email: requestedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        role: 'passenger',
        first_name: firstName,
        last_name: lastName,
        full_name: fullName,
        phone_number: phone,
      },
    });

    let user = createdUser?.user || null;
    if (createUserError) {
      const alreadyExists = /already|registered|exists/i.test(createUserError.message || '');
      if (!alreadyExists) {
        return NextResponse.json({ error: 'Nao foi possivel criar a conta.' }, { status: 400 });
      }

      // Real emails may already belong to an existing passenger account.
      // Verify the password with an isolated anon client, then attach the
      // affiliate application to that same Auth user. The admin client remains
      // untouched so profile/application writes still use the service role.
      const verifier = createPasswordVerifier();
      const { data: signInData, error: signInError } = await verifier.auth.signInWithPassword({
        email: requestedEmail,
        password,
      });
      if (signInError || !signInData.user) {
        return NextResponse.json({
          error: 'Este email ja esta registado, mas a palavra-passe esta incorrecta. Use a palavra-passe dessa conta ou recupere-a primeiro.',
        }, { status: 401 });
      }
      user = signInData.user;
    } else if (user) {
      createdUserId = user.id;
    }

    if (!user) {
      return NextResponse.json({ error: 'Nao foi possivel criar ou validar a conta.' }, { status: 400 });
    }

    const email = requestedEmail;
    const { data: existingApplication, error: existingError } = await admin
      .from('affiliate_accounts')
      .select('status')
      .eq('user_id', user.id)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existingApplication && existingApplication.status !== 'rejected') {
      return NextResponse.json({
        error: existingApplication.status === 'pending'
          ? 'A sua candidatura ja esta em analise.'
          : 'Esta conta ja participa no programa de afiliados.',
      }, { status: 409 });
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError) throw profileError;

    const profileWrite = profile
      ? admin.from('profiles').update({
          first_name: firstName,
          last_name: lastName,
          phone_number: phone,
          updated_at: new Date().toISOString(),
        }).eq('id', user.id)
      : admin.from('profiles').insert({
          id: user.id,
          role: 'passenger',
          first_name: firstName,
          last_name: lastName,
          phone_number: phone,
        });
    const { error: profileWriteError } = await profileWrite;
    if (profileWriteError) throw profileWriteError;

    const { error: applicationError } = await admin
      .from('affiliate_accounts')
      .upsert({
        user_id: user.id,
        email,
        primary_social_platform: primarySocialPlatform,
        social_profile: socialProfile,
        status: 'pending',
        rejected_at: null,
        rejection_reason: null,
        applied_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    if (applicationError) throw applicationError;

    return NextResponse.json({ success: true, status: 'pending' }, { status: 201 });
  } catch (error) {
    console.error('Affiliate application failed:', error);
    if (createdUserId) {
      await admin.auth.admin.deleteUser(createdUserId).catch(() => null);
    }
    return NextResponse.json({ error: 'Nao foi possivel enviar a candidatura.' }, { status: 500 });
  }
}
