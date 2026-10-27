import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { MANGAIS_EVENT, MANGAIS_POINTS, MANGAIS_ROUTE_IDS, describeMangaisRoute, getMangaisDayRange } from '@/lib/events/mangais';

// Server-only helpers for the Mangais event routes.

export const noStore = { 'Cache-Control': 'no-store' };
export const fail = (status, error) => NextResponse.json({ error }, { status, headers: noStore });

const STAFF_ROLES = new Set(['admin', 'agent']);

/** A signed-in admin or agent; `roles` narrows it further (e.g. admin only). */
export async function requireStaff(request, roles = STAFF_ROLES) {
  const admin = createSupabaseAdmin();
  const token = String(request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return { error: fail(401, 'Entre com a sua conta.') };

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user?.id) return { error: fail(401, 'Sessão expirada. Entre novamente.') };

  const { data: profile } = await admin.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
  if (!roles.has(profile?.role)) {
    return { error: fail(403, roles.size === 1 ? 'Só um administrador pode fazer isto.' : 'Esta conta não tem acesso à lista de passageiros.') };
  }
  return { admin, user: data.user, role: profile.role };
}

/** The event's trips on its day, each tagged with pickup point and direction. */
export async function loadMangaisTrips(admin) {
  const range = getMangaisDayRange();
  const { data, error } = await admin
    .from('trips')
    .select('id, route_id, departure_time, status, sales_capacity_limit, buses(capacity)')
    .in('route_id', MANGAIS_ROUTE_IDS)
    .neq('status', 'cancelled')
    .gte('departure_time', range.start)
    .lt('departure_time', range.end);
  if (error) throw error;
  return (data || [])
    .map((trip) => ({ ...trip, place: describeMangaisRoute(trip.route_id) }))
    .filter((trip) => trip.place);
}

/**
 * Places per pickup point and direction. Each event point has its own fixed
 * allocation, so sales at Porto, Gamek and Kilamba cannot consume each
 * other's places. A point can have several buses in one direction (the return
 * runs at 18h00, 20h00 and, for the first buyers, 21h30); they share it.
 */
export async function loadMangaisCapacity(admin, trips) {
  const result = { points: {} };
  const tripIds = trips.map((trip) => trip.id);
  const [ticketsResult, holdsResult] = await Promise.all([
    admin.from('tickets').select('trip_id, seat_number').in('trip_id', tripIds).in('status', ['active', 'pending', 'used', 'expired']),
    admin.from('online_bookings').select('trip_id, seat_number').in('trip_id', tripIds).gt('expires_at', new Date().toISOString()),
  ]);
  if (ticketsResult.error) throw ticketsResult.error;
  if (holdsResult.error) throw holdsResult.error;
  const occupiedByTrip = new Map();
  for (const row of [...(ticketsResult.data || []), ...(holdsResult.data || [])]) {
    const seats = occupiedByTrip.get(row.trip_id) || new Set();
    seats.add(Number(row.seat_number));
    occupiedByTrip.set(row.trip_id, seats);
  }
  for (const direction of ['outbound', 'return']) {
    const legs = trips.filter((trip) => trip.place.direction === direction);
    if (!legs.length) {
      result[direction] = null;
      continue;
    }
    let limit = 0;
    let taken = 0;
    let available = 0;
    for (const point of MANGAIS_POINTS) {
      const pointLegs = legs.filter((leg) => leg.place.point.code === point.code);
      if (!pointLegs.length) continue;
      const occupied = pointLegs.reduce((sum, leg) => sum + (occupiedByTrip.get(leg.id)?.size || 0), 0);
      const pointLimit = Number(point.capacity || 0);
      const pointTaken = Math.max(occupied - Number(point.baselineTaken?.[direction] || 0), 0);
      // Closed by the owner: nothing more is sold in that direction, even if a
      // cancellation or an expired hold frees a place.
      const closed = MANGAIS_EVENT.closedDirections?.includes(direction);
      const pointAvailable = closed ? 0 : Math.max(pointLimit - pointTaken, 0);
      const entry = {
        tripIds: pointLegs.map((leg) => leg.id),
        limit: pointLimit,
        maxLimit: pointLimit,
        taken: pointTaken,
        available: pointAvailable,
      };
      result.points[point.code] = { ...(result.points[point.code] || {}), [direction]: entry };
      limit += pointLimit;
      taken += pointTaken;
      available += pointAvailable;
    }
    result[direction] = { limit, maxLimit: limit, taken, available };
  }
  return result;
}
