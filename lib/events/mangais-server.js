import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { MANGAIS_ROUTE_IDS, describeMangaisRoute, getMangaisDayRange } from '@/lib/events/mangais';

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
    .gte('departure_time', range.start)
    .lt('departure_time', range.end);
  if (error) throw error;
  return (data || [])
    .map((trip) => ({ ...trip, place: describeMangaisRoute(trip.route_id) }))
    .filter((trip) => trip.place);
}

/**
 * Places per direction. The three pickup points of a direction ride one
 * placeholder bus at one time, so they share one pool and one limit
 * (trips.sales_capacity_limit, set with set_trip_sales_capacity_limit).
 */
export async function loadMangaisCapacity(admin, trips) {
  const result = {};
  for (const direction of ['outbound', 'return']) {
    const legs = trips.filter((trip) => trip.place.direction === direction);
    if (!legs.length) {
      result[direction] = null;
      continue;
    }
    const { data, error } = await admin.rpc('get_trip_seat_availability', { p_trip_ids: [legs[0].id] });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    const bus = Array.isArray(legs[0].buses) ? legs[0].buses[0] : legs[0].buses;
    const physical = Math.max(Number(bus?.capacity || 0) - 1, 0);
    const limits = legs.map((leg) => leg.sales_capacity_limit).filter((value) => value != null);
    result[direction] = {
      tripId: legs[0].id,
      limit: limits.length ? Math.min(...limits) : physical,
      maxLimit: physical,
      taken: (row?.occupied_seats || []).length,
      available: Number(row?.available_seats || 0),
    };
  }
  return result;
}
