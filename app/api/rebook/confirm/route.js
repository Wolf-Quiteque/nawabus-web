import { NextResponse } from 'next/server';
import {
  requireCustomer,
  fail,
  cleanItems,
  callRebookGroup,
  rebookFailure,
  shapeQuote,
  rebookPaymentUrl,
} from '@/lib/rebook-server';

// POST /api/rebook/confirm  { items: [...], idempotency_key }
//
// Nothing to pay -> the passengers are moved now.
// Something to pay -> the seats are held and ONE Multicaixa reference is
// created for the whole group; the tickets move only when ProxyPay confirms
// the payment (payment-api webhook -> finalize_rebook_payment).
export async function POST(request) {
  const auth = await requireCustomer(request);
  if (auth.error) return auth.error;
  const { admin, user, token } = auth;

  const body = await request.json().catch(() => ({}));
  const items = cleanItems(body.items);
  if (!items) return fail(400, 'Escolha os passageiros, a viagem e os lugares.');
  const key = typeof body.idempotency_key === 'string' && body.idempotency_key.length <= 100
    ? 'web-' + body.idempotency_key
    : null;

  // An earlier attempt whose hold has lapsed would still block these tickets
  // as "payment pending"; release anything past its time first.
  await admin.rpc('expire_pending_rebooks');

  const { data, error } = await callRebookGroup(admin, user.id, items, { dryRun: false, idempotencyKey: key });
  if (error) return rebookFailure(error);
  const result = shapeQuote(data);

  if (result.lines.every((l) => l.status === 'completed')) {
    return NextResponse.json({ status: 'completed', ...result }, { headers: { 'Cache-Control': 'no-store' } });
  }

  // Pending: one reference for the group. The amount is decided by payment-api
  // from the database, not sent from here.
  try {
    const res = await fetch(rebookPaymentUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ group_id: result.group_id }),
      cache: 'no-store',
    });
    const payment = await res.json().catch(() => ({}));
    if (!res.ok || !payment.reference_id) {
      throw new Error(payment.error || `payment-api ${res.status}`);
    }
    return NextResponse.json(
      {
        status: 'pending_payment',
        ...result,
        reference_id: payment.reference_id,
        amount: payment.amount,
        expires_at: payment.expires_at,
        entity: '1219',
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    // No reference means nothing can be paid: undo the pending group so the
    // tickets are free to try again instead of locked for the hold period.
    console.error('Rebook reference failed:', err.message);
    await admin.rpc('cancel_pending_rebook_group', { p_group_id: result.group_id });
    return fail(502, 'Não foi possível gerar a referência de pagamento. Tente de novo dentro de momentos.');
  }
}
