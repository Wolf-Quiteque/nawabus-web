import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getClosedTodayPurchaseMessage, isTripPurchasable } from '@/lib/purchase-date';

class PurchaseBlockedError extends Error {}

async function validateTripsBeforePayment({ ticketId, bookingDetails }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase server credentials are not configured');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const tripIds = [
    bookingDetails?.outbound_trip?.trip_id,
    bookingDetails?.return_trip?.trip_id,
  ].filter(Boolean);

  if (ticketId) {
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('trip_id')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket?.trip_id) {
      throw new PurchaseBlockedError('Bilhete nao encontrado ou indisponivel para pagamento.');
    }
    tripIds.push(ticket.trip_id);
  }

  const uniqueTripIds = [...new Set(tripIds)];
  if (!uniqueTripIds.length) {
    throw new PurchaseBlockedError('Viagem nao encontrada para pagamento.');
  }

  const { data: trips, error: tripsError } = await supabase
    .from('trips')
    .select('id, departure_time, status, buses!inner(is_active)')
    .in('id', uniqueTripIds);

  if (tripsError) throw tripsError;

  if ((trips || []).length !== uniqueTripIds.length) {
    throw new PurchaseBlockedError('Viagem nao encontrada ou indisponivel para pagamento.');
  }

  const now = new Date();
  for (const trip of trips) {
    const bus = Array.isArray(trip.buses) ? trip.buses[0] : trip.buses;
    if (trip.status !== 'scheduled' || !bus || bus.is_active === false) {
      throw new PurchaseBlockedError('Esta viagem nao esta disponivel para compra.');
    }
    if (!isTripPurchasable(trip, now)) {
      throw new PurchaseBlockedError(getClosedTodayPurchaseMessage());
    }
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { ticket_id, amount, passenger_name, passenger_email, booking_details } = body;

    if ((!ticket_id && !booking_details) || !amount || amount <= 0) {
      return NextResponse.json({ 
        error: 'Missing or invalid fields: amount and ticket_id or booking_details are required' 
      }, { status: 400 });
    }

    await validateTripsBeforePayment({
      ticketId: ticket_id,
      bookingDetails: booking_details,
    });

    // This should point to your separate payment API service
    const paymentApiUrl = process.env.PAYMENT_API_URL || 'http://localhost:3000/api/create-payment';

    const apiResponse = await fetch(paymentApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ticket_id,
        amount,
        passenger_name,
        passenger_email,
        booking_details,
      }),
    });

    const result = await apiResponse.json();

    if (!apiResponse.ok) {
      console.error('Payment API Error:', result);
      return NextResponse.json({ error: result.error || 'Failed to create payment reference' }, { status: apiResponse.status });
    }

    return NextResponse.json(result, { status: 201 });

  } catch (error) {
    if (error instanceof PurchaseBlockedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('Error in /api/create-payment route:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
