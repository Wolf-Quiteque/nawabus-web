import { NextResponse } from 'next/server';
import { fail, loadMangaisCapacity, loadMangaisTrips, noStore, requireStaff } from '@/lib/events/mangais-server';

// PATCH /api/events/mangais/limit   { direction: 'outbound' | 'return', limit: number }
//
// Admins raise or lower how many places a direction sells. It goes through
// set_trip_sales_capacity_limit — the same function NAWASOFT's "Limite de
// vendas" uses — which applies it to all three pickup points at once and
// refuses a limit below the places already sold or held.
const MESSAGES = [
  [/cannot be below the (\d+) seats/i, (m) => `Não pode ser menos de ${m[1]}: já há ${m[1]} lugares vendidos ou reservados.`],
  [/must be between 0 and (\d+)/i, (m) => `O máximo possível é ${m[1]} lugares.`],
];

export async function PATCH(request) {
  const auth = await requireStaff(request, new Set(['admin']));
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const direction = body.direction === 'return' ? 'return' : body.direction === 'outbound' ? 'outbound' : null;
  const limit = Number(body.limit);
  if (!direction) return fail(400, 'Escolha ida ou volta.');
  if (!Number.isInteger(limit) || limit < 0) return fail(400, 'O limite tem de ser um número inteiro, 0 ou mais.');

  try {
    const trips = await loadMangaisTrips(auth.admin);
    const leg = trips.find((trip) => trip.place.direction === direction);
    if (!leg) return fail(404, 'Viagem do evento não encontrada.');

    const { error } = await auth.admin.rpc('set_trip_sales_capacity_limit', { p_trip_id: leg.id, p_limit: limit });
    if (error) {
      const hit = MESSAGES.find(([re]) => re.test(error.message || ''));
      return fail(400, hit ? hit[1](error.message.match(hit[0])) : error.message);
    }

    // Read the trips again: the limit lives on them and has just changed.
    const capacity = await loadMangaisCapacity(auth.admin, await loadMangaisTrips(auth.admin));
    return NextResponse.json({ capacity }, { headers: noStore });
  } catch (error) {
    console.error('Mangais limit change failed:', error);
    return fail(500, 'Não foi possível alterar o limite.');
  }
}
