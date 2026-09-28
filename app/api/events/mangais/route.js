import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { isTripPurchasable } from '@/lib/purchase-date';
import { isCopilotSeat } from '@/lib/seats';
import {
  MANGAIS_EVENT,
  MANGAIS_MAX_PASSENGERS,
  findMangaisPoint,
  findMangaisProduct,
  getMangaisDayRange,
} from '@/lib/events/mangais';

const fail = (status, error) =>
  NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });

const one = (value) => (Array.isArray(value) ? value[0] : value);

// GET /api/events/mangais?product=ida-e-volta&point=gamek&passengers=3
//
// The event trips for one pickup point, each with free seat numbers already
// chosen. Customers never pick seats for this event; checkout, the hold and the
// payment webhook still need numbers, so they are assigned here. The counts
// include seats held by other customers who are paying right now.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const product = findMangaisProduct(searchParams.get('product'));
  const point = findMangaisPoint(searchParams.get('point'));
  const passengers = Number(searchParams.get('passengers'));

  if (!product || !point) return fail(400, 'Escolha o tipo de bilhete e o ponto de recolha.');
  if (!Number.isInteger(passengers) || passengers < 1 || passengers > MANGAIS_MAX_PASSENGERS) {
    return fail(400, `Escolha entre 1 e ${MANGAIS_MAX_PASSENGERS} passageiros.`);
  }

  try {
    const admin = createSupabaseAdmin();
    const range = getMangaisDayRange();
    const routeByLeg = { outbound: point.outboundRouteId, return: point.returnRouteId };
    const routeIds = product.legs.map((leg) => routeByLeg[leg]);

    const { data: trips, error: tripsError } = await admin
      .from('trips')
      .select(`
        id, route_id, departure_time, arrival_time, created_at, price_usd, online_price_kz,
        seat_class, status, boarding_point, available_seats,
        routes!inner(origin_city, destination_city, origin_province, destination_province),
        buses!inner(capacity, make, model, amenities, is_active, companies(name, logo_url))
      `)
      .in('route_id', routeIds)
      .eq('status', 'scheduled')
      .eq('buses.is_active', true)
      .gte('departure_time', range.start)
      .lt('departure_time', range.end)
      .order('departure_time');
    if (tripsError) throw tripsError;

    const legs = [];
    for (const leg of product.legs) {
      const trip = (trips || []).find((row) => row.route_id === routeByLeg[leg]);
      if (!trip) {
        return fail(404, leg === 'outbound'
          ? 'A ida para Mangais ainda não está à venda neste ponto.'
          : 'A volta de Mangais ainda não está à venda neste ponto.');
      }
      if (!isTripPurchasable(trip)) {
        return fail(409, leg === 'outbound'
          ? `A ida das ${MANGAIS_EVENT.boardingTime} já partiu. Ainda pode comprar só a volta.`
          : 'A volta de Mangais já partiu.');
      }

      const { data: availability, error: availabilityError } = await admin.rpc('get_trip_seat_availability', {
        p_trip_ids: [trip.id],
      });
      if (availabilityError) throw availabilityError;

      const row = one(availability) || {};
      const taken = new Set((row.occupied_seats || []).map(Number));
      const capacity = Number(one(trip.buses)?.capacity || 0);
      const free = [];
      for (let seat = 1; seat <= capacity && free.length < passengers; seat += 1) {
        if (!isCopilotSeat(seat) && !taken.has(seat)) free.push(seat);
      }
      if (free.length < passengers || Number(row.available_seats || 0) < passengers) {
        return fail(409, 'Já não há lugares suficientes para este número de passageiros.');
      }

      legs.push({ leg, trip, seats: free });
    }

    return NextResponse.json(
      { event: MANGAIS_EVENT.key, point: point.code, product: product.code, legs },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Mangais seat assignment failed:', error);
    return fail(500, 'Não foi possível preparar a compra. Tente novamente.');
  }
}
