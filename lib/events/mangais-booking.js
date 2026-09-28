import { MANGAIS_EVENT, findMangaisProduct } from '@/lib/events/mangais';

// Builds the `bookingDetails` the normal checkout reads from sessionStorage, for
// an event purchase. Seats come from /api/events/mangais; the customer only gave
// the pickup point, the ticket type and the other travellers' names.

const one = (value) => (Array.isArray(value) ? value[0] : value);

export async function fetchMangaisLegs({ product, point, passengers }) {
  const params = new URLSearchParams({ product, point, passengers: String(passengers) });
  const response = await fetch(`/api/events/mangais?${params.toString()}`, { cache: 'no-store' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Não foi possível preparar a compra.');
  return body.legs || [];
}

function toCheckoutTrip({ leg, trip, seats }, companions) {
  const sorted = [...seats].sort((a, b) => a - b);
  const unitPrice = Number(trip.price_usd || 0);
  const bus = one(trip.buses);
  // Seat 1 of the purchase is the buyer; the others carry the names given.
  const companionMap = Object.fromEntries(
    sorted.slice(1).map((seat, index) => [
      seat,
      { name: (companions[index]?.name || '').trim(), phone: (companions[index]?.phone || '').trim() },
    ])
  );
  return {
    ...trip,
    eventLeg: leg,
    origin: trip.routes?.origin_city,
    destination: trip.routes?.destination_city,
    bus_make: bus?.make,
    bus_model: bus?.model,
    selectedSeats: sorted,
    companions: companionMap,
    price_usd: unitPrice,
    price: Number((unitPrice * sorted.length).toFixed(2)),
  };
}

export function buildMangaisBookingDetails({ legs, productCode, pointCode, companions = [] }) {
  const trips = legs.map((leg) => toCheckoutTrip(leg, companions));
  const [outboundTrip, returnTrip] = trips;
  return {
    tripType: returnTrip ? 'round-trip' : 'one-way',
    event: MANGAIS_EVENT.key,
    eventDate: MANGAIS_EVENT.date,
    eventProduct: productCode,
    eventPoint: pointCode,
    eventCompanions: companions,
    outboundTrip,
    ...(returnTrip && { returnTrip }),
    totalPrice: Number(trips.reduce((sum, trip) => sum + trip.price, 0).toFixed(2)),
  };
}

/** Same purchase, fresh seat numbers — for when another buyer took ours first. */
export async function repickMangaisSeats(details) {
  const product = findMangaisProduct(details.eventProduct);
  const passengers = details.outboundTrip?.selectedSeats?.length || 0;
  if (!product || !passengers) throw new Error('Volte à página do evento e tente novamente.');
  const legs = await fetchMangaisLegs({ product: product.code, point: details.eventPoint, passengers });
  return buildMangaisBookingDetails({
    legs,
    productCode: product.code,
    pointCode: details.eventPoint,
    companions: details.eventCompanions || [],
  });
}
