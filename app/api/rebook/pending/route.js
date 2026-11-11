import { NextResponse } from 'next/server';
import { requireCustomer, fail, listOwedRebooks } from '@/lib/rebook-server';

// GET /api/rebook/pending
//
// The signed-in customer's rebooks that still owe money: the Multicaixa
// reference to pay, or — once it expired — the move that can get a new one
// from /api/rebook/renew.
export async function GET(request) {
  const auth = await requireCustomer(request);
  if (auth.error) return auth.error;
  const { admin, user } = auth;

  try {
    // Lapsed holds still read "pending_payment" until this runs.
    await admin.rpc('expire_pending_rebooks');
    const rebooks = await listOwedRebooks(admin, user.id);
    return NextResponse.json({ rebooks }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Pending rebooks failed:', err.message);
    return fail(500, 'Não foi possível carregar as reprogramações por pagar.');
  }
}
