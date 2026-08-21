import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request) {
  try {
    const body = await request.json();
    const code = String(body.code || '').trim().toUpperCase();
    const passengerId = String(body.passengerId || '').trim() || null;
    const items = Array.isArray(body.items) ? body.items.map((item) => ({
      tripId: String(item.tripId || '').trim(),
      seatCount: Number(item.seatCount),
    })) : [];
    const totalSeats = items.reduce((sum, item) => sum + item.seatCount, 0);

    if (!code || items.length < 1 || items.length > 4
        || items.some((item) => !item.tripId || !Number.isInteger(item.seatCount) || item.seatCount < 1)
        || totalSeats > 20) {
      return NextResponse.json({ valid: false, message: 'Pedido de promocao invalido.' }, { status: 400 });
    }

    const admin = createSupabaseAdmin();
    const tripIds = [...new Set(items.map((item) => item.tripId))];
    const { data: trips, error: tripsError } = await admin
      .from('trips')
      .select('id, price_usd')
      .in('id', tripIds);
    if (tripsError) throw tripsError;
    const fareByTrip = new Map((trips || []).map((trip) => [trip.id, Number(trip.price_usd)]));
    if (fareByTrip.size !== tripIds.length) {
      return NextResponse.json({ valid: false, message: 'Uma das viagens nao existe.' }, { status: 404 });
    }

    const quoteByTrip = new Map();
    for (const tripId of tripIds) {
      const { data, error } = await admin.rpc('resolve_promotion_for_ticket', {
        p_code: code,
        p_base_fare_kz: fareByTrip.get(tripId),
        p_passenger_id: passengerId,
      });
      if (error) {
        return NextResponse.json({
          valid: false,
          message: error.message || 'Codigo promocional invalido.',
        }, { status: 400 });
      }
      quoteByTrip.set(tripId, Array.isArray(data) ? data[0] : data);
    }

    const quotedItems = items.map((item) => {
      const quote = quoteByTrip.get(item.tripId);
      return {
        tripId: item.tripId,
        seatCount: item.seatCount,
        baseFareKz: fareByTrip.get(item.tripId),
        discountPerTicketKz: Number(quote.passenger_discount_kz),
        amountDuePerTicketKz: Number(quote.amount_due_kz),
      };
    });
    const totals = quotedItems.reduce((result, item) => ({
      baseAmountKz: result.baseAmountKz + item.baseFareKz * item.seatCount,
      discountAmountKz: result.discountAmountKz + item.discountPerTicketKz * item.seatCount,
      amountDueKz: result.amountDueKz + item.amountDuePerTicketKz * item.seatCount,
    }), { baseAmountKz: 0, discountAmountKz: 0, amountDueKz: 0 });
    const firstQuote = quoteByTrip.values().next().value;

    return NextResponse.json({
      valid: true,
      code: firstQuote.normalized_code,
      kind: firstQuote.promotion_kind,
      items: quotedItems,
      totals,
    });
  } catch (error) {
    console.error('Promotion quote failed:', error);
    return NextResponse.json({ valid: false, message: 'Erro ao validar promocao.' }, { status: 500 });
  }
}
