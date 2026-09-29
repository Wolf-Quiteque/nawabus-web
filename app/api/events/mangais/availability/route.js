import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { fail, loadMangaisCapacity, loadMangaisTrips, noStore } from '@/lib/events/mangais-server';

// GET /api/events/mangais/availability
//
// Places left per direction, so /mangais can show "esgotado" and cap how many
// people fit in one purchase. Seats held by people still paying count as taken.
export async function GET() {
  try {
    const admin = createSupabaseAdmin();
    const capacity = await loadMangaisCapacity(admin, await loadMangaisTrips(admin));
    const pick = (entry) => (entry ? { limit: entry.limit, available: entry.available } : null);
    return NextResponse.json(
      { outbound: pick(capacity.outbound), return: pick(capacity.return) },
      { headers: noStore }
    );
  } catch (error) {
    console.error('Mangais availability failed:', error);
    return fail(500, 'Não foi possível ver os lugares disponíveis.');
  }
}
