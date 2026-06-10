import { NextResponse } from 'next/server';

function getHeldSeatsApiUrl(requestUrl) {
  const explicitUrl = process.env.PAYMENT_API_HELD_SEATS_URL;
  if (explicitUrl) return explicitUrl;

  const createPaymentUrl = process.env.PAYMENT_API_URL || 'http://localhost:3000/api/create-payment';
  return createPaymentUrl.replace(/\/api\/create-payment\/?$/, '/api/held-seats');
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const tripIds = searchParams.get('trip_ids');

    if (!tripIds) {
      return NextResponse.json({ error: 'trip_ids is required' }, { status: 400 });
    }

    const heldSeatsApiUrl = new URL(getHeldSeatsApiUrl(request.url));
    heldSeatsApiUrl.searchParams.set('trip_ids', tripIds);

    const apiResponse = await fetch(heldSeatsApiUrl.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    const result = await apiResponse.json();

    if (!apiResponse.ok) {
      return NextResponse.json(
        { error: result.error || 'Failed to load held seats' },
        { status: apiResponse.status }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in /api/held-seats route:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
