import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  const cookieStore = await cookies();
  return NextResponse.json({
    code: cookieStore.get('nawabus_promo')?.value || null,
    source: cookieStore.get('nawabus_promo_source')?.value || null,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function DELETE() {
  const response = NextResponse.json({ cleared: true });
  const options = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  };

  response.cookies.set('nawabus_promo', '', options);
  response.cookies.set('nawabus_promo_source', '', options);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
