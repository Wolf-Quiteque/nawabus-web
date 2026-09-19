import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { onlineFare } from '@/lib/online-price';
import { isTripPurchasable } from '@/lib/purchase-date';
import { isCopilotSeat } from '@/lib/seats';

// Issues tickets that cost nothing — a 100% coupon or a free campaign trip.
//
// This used to happen in the browser: the checkout page inserted tickets
// straight into the database with whatever price_paid_usd and payment_status
// it chose, so any logged-in customer could give themselves a paid ticket at
// 0 Kz. Here the buyer comes from their verified session, every seat is
// re-priced on the server, and nothing is written unless the real total is 0.
// Anything that costs money goes through /api/create-payment instead.

const MAX_SEATS = 20;
const ATTRIBUTION_SOURCES = new Set(['website_code', 'referral_link', 'direct']);

const fail = (status, error) => NextResponse.json({ error }, { status });

function normalizePhone(phone) {
  const cleaned = String(phone || '').replace(/\D/g, '');
  if (!cleaned) return null;
  if (!cleaned.startsWith('244') && cleaned.length === 9 && cleaned.startsWith('9')) return `244${cleaned}`;
  return cleaned;
}

function readLeg(leg) {
  if (!leg) return null;
  const seats = Array.isArray(leg.seats) ? leg.seats.map(Number) : [];
  return { tripId: String(leg.trip_id || ''), seats, companions: leg.companions || {} };
}

export async function POST(request) {
  const admin = createSupabaseAdmin();

  const token = String(request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return fail(401, 'Inicie sessão para continuar.');
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData?.user) return fail(401, 'Sessão expirada. Inicie sessão novamente.');
  const passengerId = authData.user.id;

  const body = await request.json().catch(() => ({}));
  const code = String(body.coupon_code || '').trim().toUpperCase() || null;
  const legs = [readLeg(body.outbound), readLeg(body.return)].filter(Boolean);

  if (!legs.length || !legs[0].tripId) return fail(400, 'Selecione a viagem.');
  const allSeats = legs.flatMap((leg) => leg.seats);
  if (!allSeats.length || allSeats.length > MAX_SEATS) return fail(400, `Selecione entre 1 e ${MAX_SEATS} lugares.`);
  for (const leg of legs) {
    if (leg.seats.some((seat) => !Number.isInteger(seat) || seat < 1)
        || new Set(leg.seats).size !== leg.seats.length) {
      return fail(400, 'Lugares inválidos.');
    }
  }

  const { data: trips, error: tripsError } = await admin
    .from('trips')
    .select('id, status, departure_time, price_usd, online_price_kz, seat_class, bus:buses(is_active, capacity)')
    .in('id', legs.map((leg) => leg.tripId));
  if (tripsError) return fail(500, 'Não foi possível carregar a viagem.');
  const tripById = new Map((trips || []).map((trip) => [trip.id, trip]));

  // Price every leg here; the browser's own total is never trusted.
  const priced = [];
  for (const leg of legs) {
    const trip = tripById.get(leg.tripId);
    const bus = Array.isArray(trip?.bus) ? trip.bus[0] : trip?.bus;
    if (!trip || trip.status !== 'scheduled') return fail(404, 'Viagem indisponível.');
    if (!isTripPurchasable(trip)) return fail(409, 'Esta viagem já partiu.');
    if (bus && bus.is_active === false) return fail(409, 'Viagem indisponível.');
    const capacity = Number(bus?.capacity || 0);
    if (leg.seats.some((seat) => isCopilotSeat(seat) || seat > capacity)) return fail(400, 'Lugar inválido para este autocarro.');

    const fare = onlineFare(trip);
    let quote = { amount_due_kz: fare, passenger_discount_kz: 0, commission_amount_kz: 0, promotion_code_id: null, normalized_code: null };
    if (code) {
      const { data, error } = await admin.rpc('resolve_promotion_for_ticket', {
        p_code: code,
        p_base_fare_kz: fare,
        p_passenger_id: passengerId,
      });
      if (error) return fail(400, error.message || 'Código promocional inválido.');
      quote = Array.isArray(data) ? data[0] : data;
      if (!quote) return fail(400, 'Código promocional inválido.');
    }
    if (Number(quote.amount_due_kz) !== 0) {
      return fail(409, 'Esta reserva não é gratuita. Escolha o pagamento por referência.');
    }
    priced.push({ leg, trip, fare, quote });
  }

  const attribution = code
    ? (ATTRIBUTION_SOURCES.has(body.attribution_source) ? body.attribution_source : 'website_code')
    : null;
  const created = [];

  try {
    for (const { leg, trip, fare, quote } of priced) {
      for (const seat of leg.seats) {
        const { data: ticket, error } = await admin
          .from('tickets')
          .insert({
            trip_id: trip.id,
            passenger_id: passengerId,
            booked_by: passengerId,
            booking_source: 'online',
            seat_number: seat,
            seat_class: trip.seat_class || 'economy',
            price_paid_usd: 0,
            payment_status: 'paid',
            payment_method: 'cash',
            base_fare_kz: fare,
            passenger_discount_kz: Number(quote.passenger_discount_kz || 0),
            affiliate_commission_kz: Number(quote.commission_amount_kz || 0),
            promotion_code_id: quote.promotion_code_id || null,
            promotion_code_snapshot: quote.normalized_code || null,
            attribution_source: attribution,
          })
          .select('id, ticket_number, seat_number, trip_id')
          .single();
        if (error) {
          const taken = error.code === '23505' || /seat|assento/i.test(error.message || '');
          throw Object.assign(new Error(taken ? `O lugar ${seat} já está ocupado.` : 'Não foi possível emitir os bilhetes.'),
            { status: taken ? 409 : 500 });
        }
        created.push(ticket);

        const companion = leg.companions[seat] || leg.companions[String(seat)];
        if (companion?.name?.trim()) {
          const { error: companionError } = await admin.from('ticket_companions').insert({
            ticket_id: ticket.id,
            name: companion.name.trim(),
            phone: normalizePhone(companion.phone),
          });
          if (companionError) throw Object.assign(new Error('Não foi possível guardar os passageiros.'), { status: 500 });
        }
      }
    }
  } catch (err) {
    // All or nothing: a half-issued group is worse than a clear error.
    const ids = created.map((ticket) => ticket.id);
    if (ids.length) {
      await admin.from('ticket_companions').delete().in('ticket_id', ids);
      await admin.from('tickets').delete().in('id', ids);
    }
    return fail(err.status || 500, err.message || 'Não foi possível emitir os bilhetes.');
  }

  return NextResponse.json({ tickets: created }, { status: 201 });
}
