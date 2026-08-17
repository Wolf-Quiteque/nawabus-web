import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { isCopilotSeat } from '@/lib/seats';

function normalizeBus(bus) {
  return Array.isArray(bus) ? bus[0] : bus;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const origin = searchParams.get('origin')?.trim();
    const destination = searchParams.get('destination')?.trim();
    const date = searchParams.get('date')?.trim();
    if (!origin || !destination || !date) {
      return NextResponse.json({ error: 'Origem, destino e data são obrigatórios.' }, { status: 400 });
    }

    const start = new Date(`${date}T00:00:00+01:00`);
    const end = new Date(`${date}T23:59:59.999+01:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return NextResponse.json({ error: 'Data inválida.' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: trips, error: tripsError } = await supabase
      .from('trips')
      .select(`
        id, departure_time, arrival_time, created_at, price_usd, seat_class, status,
        routes!inner(origin_city, destination_city, origin_province, destination_province, distance_km, estimated_duration_hours),
        buses!inner(make, model, amenities, capacity, is_active, companies!inner(name, logo_url))
      `)
      .eq('status', 'scheduled')
      .eq('buses.is_active', true)
      .ilike('routes.origin_province', `%${origin}%`)
      .ilike('routes.destination_province', `%${destination}%`)
      .gte('departure_time', start.toISOString())
      .lte('departure_time', end.toISOString())
      .order('departure_time', { ascending: true });
    if (tripsError) throw tripsError;

    const siblingsByTrip = new Map();
    await Promise.all((trips || []).map(async (trip) => {
      const { data, error } = await supabase.rpc('get_overlapping_trip_ids', { p_trip_id: trip.id });
      if (error) throw error;
      siblingsByTrip.set(trip.id, data?.map((row) => row.id) || [trip.id]);
    }));

    const siblingIds = [...new Set([...siblingsByTrip.values()].flat())];
    if (!siblingIds.length) return NextResponse.json({ trips: [] });
    const now = new Date().toISOString();
    const [{ data: tickets, error: ticketsError }, { data: holds, error: holdsError }] = await Promise.all([
      supabase.from('tickets').select('trip_id, seat_number').in('trip_id', siblingIds).in('status', ['active', 'pending', 'used']),
      supabase.from('online_bookings').select('trip_id, seat_number').in('trip_id', siblingIds).gt('expires_at', now),
    ]);
    if (ticketsError || holdsError) throw ticketsError || holdsError;

    const seatsByTrip = new Map();
    for (const row of [...(tickets || []), ...(holds || [])]) {
      if (!seatsByTrip.has(row.trip_id)) seatsByTrip.set(row.trip_id, new Set());
      seatsByTrip.get(row.trip_id).add(row.seat_number);
    }

    const availableTrips = (trips || []).map((trip) => {
      const occupied = new Set();
      for (const siblingId of siblingsByTrip.get(trip.id) || [trip.id]) {
        for (const seat of seatsByTrip.get(siblingId) || []) occupied.add(seat);
      }
      const capacity = Number(normalizeBus(trip.buses)?.capacity || 0);
      // Seat 1 is reserved for the co-pilot and is never sellable.
      const occupiedPassengerSeats = [...occupied].filter((seat) => !isCopilotSeat(seat));
      return { ...trip, available_seats: Math.max(capacity - 1 - occupiedPassengerSeats.length, 0) };
    }).filter((trip) => trip.available_seats > 0);

    return NextResponse.json({ trips: availableTrips });
  } catch (error) {
    console.error('Error searching trips with shared availability:', error);
    return NextResponse.json({ error: 'Não foi possível carregar as viagens.' }, { status: 500 });
  }
}
