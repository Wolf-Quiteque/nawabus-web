import { NextResponse } from 'next/server';
import { requireCustomer, fail } from '@/lib/rebook-server';

// GET /api/rebook/options?ticket_id=...&date=YYYY-MM-DD
//
// The departures a customer can move this ticket to on a given day: the same
// route only (a different destination is a new ticket), still scheduled, and
// leaving at least 30 minutes from now. Each comes with its seat map, counted
// across the whole bus run and including seats held by purchases in progress.
export async function GET(request) {
  const auth = await requireCustomer(request);
  if (auth.error) return auth.error;
  const { admin, user } = auth;

  const { searchParams } = new URL(request.url);
  const ticketId = searchParams.get('ticket_id');
  const date = searchParams.get('date') || '';
  if (!ticketId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail(400, 'Indique o bilhete e a data.');

  const { data: ticket, error: ticketError } = await admin
    .from('tickets')
    .select('id, passenger_id, booked_by, trip:trips!inner(route_id, company_id)')
    .eq('id', ticketId)
    .maybeSingle();
  if (ticketError) return fail(500, 'Não foi possível carregar o bilhete.');
  if (!ticket) return fail(404, 'Bilhete não encontrado.');
  if (ticket.passenger_id !== user.id && ticket.booked_by !== user.id) {
    return fail(403, 'Este bilhete pertence a outra conta.');
  }

  // A Luanda calendar day, and never a bus about to leave.
  const dayStart = new Date(`${date}T00:00:00+01:00`);
  const dayEnd = new Date(`${date}T23:59:59+01:00`);
  const earliest = new Date(Date.now() + 30 * 60 * 1000);
  const from = dayStart > earliest ? dayStart : earliest;
  if (from > dayEnd) return NextResponse.json({ trips: [] });

  const { data: trips, error: tripsError } = await admin
    .from('trips')
    .select('id, departure_time, arrival_time, price_usd, online_price_kz, bus:buses!inner(license_plate, capacity, is_active)')
    .eq('route_id', ticket.trip.route_id)
    .eq('company_id', ticket.trip.company_id)
    .eq('status', 'scheduled')
    .eq('bus.is_active', true)
    .gte('departure_time', from.toISOString())
    .lte('departure_time', dayEnd.toISOString())
    .order('departure_time');
  if (tripsError) return fail(500, 'Não foi possível carregar as viagens.');
  if (!trips?.length) return NextResponse.json({ trips: [] });

  const { data: availability, error: availError } = await admin.rpc('get_trip_seat_availability', {
    p_trip_ids: trips.map((t) => t.id),
  });
  if (availError) return fail(500, 'Não foi possível carregar os lugares.');
  const byTrip = new Map((availability || []).map((a) => [a.trip_id, a]));

  return NextResponse.json(
    {
      trips: trips.map((t) => {
        const a = byTrip.get(t.id);
        return {
          trip_id: t.id,
          departure_time: t.departure_time,
          arrival_time: t.arrival_time,
          bus_plate: t.bus?.license_plate || '',
          capacity: Number(t.bus?.capacity) || 0,
          available: Number(a?.available_seats) || 0,
          occupied_seats: (a?.occupied_seats || []).map(Number),
          online_price_kz: Number(t.online_price_kz ?? t.price_usd) || 0,
        };
      }),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
