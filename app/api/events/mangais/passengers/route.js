import { NextResponse } from 'next/server';
import { MANGAIS_EVENT } from '@/lib/events/mangais';
import { fail, loadMangaisCapacity, loadMangaisTrips, noStore, requireStaff } from '@/lib/events/mangais-server';

// GET /api/events/mangais/passengers   (Authorization: Bearer <staff session>)
//
// Everyone with a paid ticket for the event, per direction and pickup point,
// for staff to organise the cars, plus the places left against each
// direction's limit. Names and phone numbers are personal data, so only admin
// and agent accounts get an answer.

const PAGE = 1000; // PostgREST returns at most this many rows per request
const CHUNK = 150; // ids per `.in()` filter, to keep URLs short

async function allRows(buildQuery) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await buildQuery().range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE) return rows;
  }
}

async function inChunks(ids, fetchChunk) {
  const rows = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    rows.push(...(await fetchChunk(ids.slice(i, i + CHUNK))));
  }
  return rows;
}

const fullName = (profile) => [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim();

export async function GET(request) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;
  const { admin, role } = auth;

  try {
    const trips = await loadMangaisTrips(admin);
    const tripInfo = new Map(trips.map((trip) => [trip.id, { ...trip.place, departure_time: trip.departure_time }]));
    const capacity = await loadMangaisCapacity(admin, trips);
    const tripIds = [...tripInfo.keys()];
    if (!tripIds.length) {
      return NextResponse.json({ event: MANGAIS_EVENT, viewer_role: role, capacity, passengers: [], pending: [] }, { headers: noStore });
    }

    // Paid tickets. "expired" (a no-show) was still paid, so it stays listed.
    const tickets = await allRows(() => admin
      .from('tickets')
      .select('id, trip_id, ticket_number, status, payment_method, payment_reference, passenger_id, booked_by, created_at, ticket_companions(name, phone)')
      .in('trip_id', tripIds)
      .eq('payment_status', 'paid')
      .in('status', ['active', 'used', 'expired'])
      .order('created_at'));

    const personIds = [...new Set(tickets.flatMap((t) => [t.passenger_id, t.booked_by]).filter(Boolean))];
    const profiles = await inChunks(personIds, async (ids) => {
      const { data, error } = await admin.from('profiles').select('id, first_name, last_name, phone_number').in('id', ids);
      if (error) throw error;
      return data || [];
    });
    const profileById = new Map(profiles.map((p) => [p.id, p]));

    const scanned = new Set(await inChunks(tickets.map((t) => t.id), async (ids) => {
      const { data, error } = await admin.from('ticket_scans').select('ticket_id').in('ticket_id', ids).eq('scan_type', 'boarding');
      if (error) return []; // scans are a bonus; status 'used' already says boarded
      return (data || []).map((row) => row.ticket_id);
    }));

    const passengers = tickets.map((ticket) => {
      const place = tripInfo.get(ticket.trip_id);
      const companion = (ticket.ticket_companions || [])[0];
      const passenger = profileById.get(ticket.passenger_id);
      const buyer = profileById.get(ticket.booked_by || ticket.passenger_id);
      return {
        id: ticket.id,
        direction: place.direction,
        point: place.point.code,
        ticket_number: ticket.ticket_number,
        name: companion?.name?.trim() || fullName(passenger) || 'Sem nome',
        phone: companion?.phone || passenger?.phone_number || '',
        buyer_name: fullName(buyer),
        buyer_phone: buyer?.phone_number || '',
        reference: ticket.payment_reference,
        payment_method: ticket.payment_method,
        status: ticket.status,
        boarded: ticket.status === 'used' || scanned.has(ticket.id),
        bought_at: ticket.created_at,
      };
    });

    // Seats held right now by people who have a reference but have not paid.
    const holds = await allRows(() => admin
      .from('online_bookings')
      .select('trip_id, seat_number, temporary_hold_id')
      .in('trip_id', tripIds)
      .gt('expires_at', new Date().toISOString()));
    const pendingByKey = new Map();
    for (const hold of holds) {
      const place = tripInfo.get(hold.trip_id);
      const key = `${place.direction}|${place.point.code}`;
      const entry = pendingByKey.get(key) || {
        direction: place.direction,
        point: place.point.code,
        seats: 0,
        references: new Set(),
      };
      entry.seats += 1;
      entry.references.add(String(hold.temporary_hold_id || '').split(':')[0]);
      pendingByKey.set(key, entry);
    }
    const pending = [...pendingByKey.values()].map((entry) => ({
      direction: entry.direction,
      point: entry.point,
      seats: entry.seats,
      references: entry.references.size,
    }));

    return NextResponse.json(
      { event: MANGAIS_EVENT, viewer_role: role, capacity, generated_at: new Date().toISOString(), passengers, pending },
      { headers: noStore }
    );
  } catch (error) {
    console.error('Mangais passenger list failed:', error);
    return fail(500, 'Não foi possível carregar a lista. Tente novamente.');
  }
}
