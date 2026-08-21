import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  const cookieStore = await cookies();
  return NextResponse.json({
    code: cookieStore.get('nawabus_promo')?.value || null,
    source: cookieStore.get('nawabus_promo_source')?.value || null,
  });
}
