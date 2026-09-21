import { NextResponse } from 'next/server';
import { requireCustomer, fail, cleanItems, callRebookGroup, rebookFailure, shapeQuote } from '@/lib/rebook-server';

// POST /api/rebook/quote  { items: [{ ticket_id, new_trip_id, new_seat_number }] }
//
// What moving these passengers would cost, from the engine, writing nothing.
// The website never adds up a multa itself; it shows this.
export async function POST(request) {
  const auth = await requireCustomer(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const items = cleanItems(body.items);
  if (!items) return fail(400, 'Escolha os passageiros, a viagem e os lugares.');

  const { data, error } = await callRebookGroup(auth.admin, auth.user.id, items, { dryRun: true });
  if (error) return rebookFailure(error);
  return NextResponse.json({ quote: shapeQuote(data) }, { headers: { 'Cache-Control': 'no-store' } });
}
