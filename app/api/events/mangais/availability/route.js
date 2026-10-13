import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { fail, loadMangaisCapacity, loadMangaisTrips, noStore } from '@/lib/events/mangais-server';

// GET /api/events/mangais/availability
//
// Places left at every pickup point, so /mangais can show the correct local
// availability. Seats held by people still paying count as taken.
export async function GET() {
  try {
    const admin = createSupabaseAdmin();
    const capacity = await loadMangaisCapacity(admin, await loadMangaisTrips(admin));
    const pick = (entry) => (entry ? { limit: entry.limit, available: entry.available } : null);
    const points = Object.fromEntries(Object.entries(capacity.points || {}).map(([code, legs]) => [
      code,
      Object.fromEntries(Object.entries(legs).map(([direction, entry]) => [direction, pick(entry)])),
    ]));
    return NextResponse.json(
      { points },
      { headers: noStore }
    );
  } catch (error) {
    console.error('Mangais availability failed:', error);
    return fail(500, 'Não foi possível ver os lugares disponíveis.');
  }
}
