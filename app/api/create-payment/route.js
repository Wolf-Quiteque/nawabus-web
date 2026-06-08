import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    const { ticket_id, amount, passenger_name, passenger_email, booking_details } = body;

    if ((!ticket_id && !booking_details) || !amount || amount <= 0) {
      return NextResponse.json({ 
        error: 'Missing or invalid fields: amount and ticket_id or booking_details are required' 
      }, { status: 400 });
    }

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
    console.error('Error in /api/create-payment route:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
