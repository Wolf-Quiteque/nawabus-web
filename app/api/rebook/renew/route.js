import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  requireCustomer,
  fail,
  callRebookGroup,
  rebookFailure,
  shapeQuote,
  listOwedRebooks,
  requestGroupReference,
} from '@/lib/rebook-server';

const noStore = { headers: { 'Cache-Control': 'no-store' } };

// POST /api/rebook/renew  { group_id }
//
// A rebook whose reference expired: place the same move again (same new trip
// and seats) and make a fresh reference. The engine prices it again, so the
// amount can change, and refuses if a seat was taken in the meantime — then
// the customer picks again with "Reprogramar".
export async function POST(request) {
  const auth = await requireCustomer(request);
  if (auth.error) return auth.error;
  const { admin, user, token } = auth;

  const body = await request.json().catch(() => ({}));
  const groupId = typeof body.group_id === 'string' ? body.group_id : null;
  if (!groupId) return fail(400, 'Pedido inválido.');

  try {
    await admin.rpc('expire_pending_rebooks');
    const owed = await listOwedRebooks(admin, user.id);
    const group = owed.find((g) => g.group_id === groupId);
    if (!group) {
      return fail(409, 'Esta reprogramação já não pode ser renovada. Abra o bilhete e use "Reprogramar".', 'REBOOK_NOT_RENEWABLE');
    }
    // Still valid (a double tap, or another tab already renewed it).
    if (group.status === 'pending_payment') {
      return NextResponse.json({ status: 'pending_payment', ...group }, noStore);
    }

    const items = group.lines.map((l) => ({
      ticket_id: l.ticket_id,
      new_trip_id: l.new_trip_id,
      new_seat_number: l.new_seat_number,
    }));
    // A fresh key every time: a replay of an earlier key would hand back that
    // attempt, which is the expired (or cancelled) one.
    const { data, error } = await callRebookGroup(admin, user.id, items, {
      dryRun: false,
      idempotencyKey: `web-renew-${randomUUID()}`,
    });
    if (error) {
      // Renewed a moment ago by another request: show that reference.
      if (String(error.message || '').includes('REBOOK_PAYMENT_PENDING')) {
        const again = (await listOwedRebooks(admin, user.id)).find((g) =>
          g.status === 'pending_payment' && g.lines.some((l) => items.some((i) => i.ticket_id === l.ticket_id))
        );
        if (again) return NextResponse.json({ status: 'pending_payment', ...again }, noStore);
      }
      return rebookFailure(error);
    }

    const result = shapeQuote(data);
    if (result.lines.every((l) => l.status === 'completed')) {
      return NextResponse.json({ status: 'completed', ...result }, noStore);
    }

    try {
      const payment = await requestGroupReference(token, result.group_id);
      return NextResponse.json({ status: 'pending_payment', ...result, ...payment }, noStore);
    } catch (err) {
      console.error('Rebook renew reference failed:', err.message);
      await admin.rpc('cancel_pending_rebook_group', { p_group_id: result.group_id });
      return fail(502, 'Não foi possível gerar a referência de pagamento. Tente de novo dentro de momentos.');
    }
  } catch (err) {
    console.error('Rebook renew failed:', err.message);
    return fail(500, 'Não foi possível gerar uma nova referência. Tente de novo.');
  }
}
