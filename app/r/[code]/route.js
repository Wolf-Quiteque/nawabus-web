import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

const SOURCES = new Set(['facebook', 'instagram', 'tiktok', 'whatsapp', 'direct', 'other']);

export async function GET(request, context) {
  const { code: rawCode } = await context.params;
  const code = String(rawCode || '').trim().toUpperCase();
  const url = new URL(request.url);
  const requestedSource = String(url.searchParams.get('source') || url.searchParams.get('src') || 'direct')
    .trim()
    .toLowerCase();
  const source = SOURCES.has(requestedSource) ? requestedSource : 'other';

  try {
    const admin = createSupabaseAdmin();
    const { data: coupon, error } = await admin
      .from('coupons')
      .select('affiliate_id, is_active, archived_at, affiliate_accounts(status, self_code_enabled)')
      .eq('code', code)
      .eq('kind', 'affiliate')
      .maybeSingle();
    const affiliate = Array.isArray(coupon?.affiliate_accounts)
      ? coupon.affiliate_accounts[0]
      : coupon?.affiliate_accounts;

    if (error || !coupon || !coupon.is_active || coupon.archived_at
        || affiliate?.status !== 'approved' || !affiliate?.self_code_enabled) {
      return NextResponse.redirect(new URL('/?promocao=invalida', url));
    }

    const response = NextResponse.redirect(new URL('/', url));
    const options = {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    };
    response.cookies.set('nawabus_promo', code, options);
    response.cookies.set('nawabus_promo_source', source, options);
    return response;
  } catch (error) {
    console.error('Affiliate referral failed:', error);
    return NextResponse.redirect(new URL('/?promocao=erro', url));
  }
}
