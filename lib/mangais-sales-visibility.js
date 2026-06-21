const MANGAIS_EVENT_DATES = new Set(['2026-06-20', '2026-06-21']);
const ALLOWED_MANGAIS_RETURN_DESTINATIONS = ['gamek', 'porto', 'kilamba'];

function getLuandaTripDateKey(value) {
  if (!value) return '';

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Luanda',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));

  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function normalize(value = '') {
  return String(value).toLowerCase();
}

export function isMangaisOutboundSaleClosedTrip(trip) {
  const route = trip?.routes || {};
  const dateKey = getLuandaTripDateKey(trip?.departure_time);
  const destinationCity = normalize(route.destination_city || trip?.destination);

  return MANGAIS_EVENT_DATES.has(dateKey) && destinationCity.includes('mangais');
}

export function filterOpenMangaisSaleTrips(trips) {
  return (trips || []).filter((trip) => !isMangaisOutboundSaleClosedTrip(trip));
}

export function isAllowedMangaisReturnSaleTrip(trip) {
  const route = trip?.routes || {};
  const dateKey = getLuandaTripDateKey(trip?.departure_time);
  const originCity = normalize(route.origin_city || trip?.origin);
  const destinationCity = normalize(route.destination_city || trip?.destination);

  if (!MANGAIS_EVENT_DATES.has(dateKey) || !originCity.includes('mangais')) {
    return true;
  }

  return ALLOWED_MANGAIS_RETURN_DESTINATIONS.some((destination) => destinationCity.includes(destination));
}

export function filterAllowedMangaisReturnSaleTrips(trips) {
  return (trips || []).filter(isAllowedMangaisReturnSaleTrip);
}
