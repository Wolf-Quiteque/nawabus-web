const CLOSED_MANGAIS_OUTBOUND_DEPARTURES = {
  '2026-06-20': new Set(['08:00']),
};

function normalize(value) {
  return String(value || '').toLowerCase();
}

export function getLuandaDateTimeParts(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Luanda',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    dateKey: `${byType.year}-${byType.month}-${byType.day}`,
    timeKey: `${byType.hour}:${byType.minute}`,
  };
}

export function isClosedMangaisOutboundDeparture(value) {
  const parts = getLuandaDateTimeParts(value);
  if (!parts) return false;

  return CLOSED_MANGAIS_OUTBOUND_DEPARTURES[parts.dateKey]?.has(parts.timeKey) || false;
}

export function isMangaisOutboundRoute(route) {
  const origin = normalize(`${route?.origin_province || ''} ${route?.origin_city || ''}`);
  const destination = normalize(`${route?.destination_province || ''} ${route?.destination_city || ''}`);

  const startsInLuanda =
    origin.includes('luanda') ||
    origin.includes('kilamba') ||
    origin.includes('gamek') ||
    origin.includes('porto');
  const endsInMangais =
    destination.includes('barra') ||
    destination.includes('cuanza') ||
    destination.includes('kuanza') ||
    destination.includes('mangais');

  return startsInLuanda && endsInMangais;
}

export function isClosedMangaisOutboundTrip(trip) {
  return isMangaisOutboundRoute(trip?.routes) && isClosedMangaisOutboundDeparture(trip?.departure_time);
}
