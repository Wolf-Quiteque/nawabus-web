// Brunch Mangais — transport from Luanda to Mangais Golf Resort (Barra do Cuanza).
//
// Everything that changes from one edition to the next lives here: the date,
// the boarding points, the times and the price. The trips themselves are rows in
// `trips` on the placeholder bus EVT-MANGAIS; their routes stay inactive so the
// event never shows up in the normal search, only on /mangais.
//
// Customers do not pick seats. Seat numbers still exist (holds and tickets need
// them) and are assigned by /api/events/mangais, but they are never shown: staff
// put passengers into cars on the day from the list at /mang.

export const MANGAIS_EVENT = {
  key: 'mangais',
  name: 'Brunch Mangais',
  venue: 'Mangais Golf Resort',
  area: 'Barra do Cuanza',
  date: '2026-11-01',
  weekday: 'Domingo',
  dateLabel: '1 de novembro',
  dayNumber: '1',
  monthShort: 'Nov',
  boardingTime: '08h00',
  returnTime: '21h30',
  // After the morning buses leave only "só volta" is still on sale; after the
  // return bus leaves, nothing is.
  outboundDepartureIso: '2026-11-01T07:00:00+00:00',
  lastDepartureIso: '2026-11-01T20:30:00+00:00',
  legPriceKz: 3700,
};

// Pontos de recolha, named as on the event poster ("Cidade: Porto de Luanda").
export const MANGAIS_POINTS = [
  {
    code: 'porto',
    area: 'Cidade',
    place: 'Porto de Luanda',
    outboundRouteId: 'bc9b1cd8-86bf-41a6-a9f2-3eccd79d3217',
    returnRouteId: '767d75c6-f358-4ee3-bfb7-47b84e54e320',
  },
  {
    code: 'gamek',
    area: 'Gamek',
    place: 'Terminal Nosso Centro',
    outboundRouteId: 'a3a15d0a-e66f-42d3-9fa4-cd040ca7ba53',
    returnRouteId: '0f912a8b-e8dd-49ea-96ee-1f8ce9668501',
  },
  {
    code: 'kilamba',
    area: 'Kilamba',
    place: 'Autarquias',
    outboundRouteId: '708746e7-4bca-482c-96a5-da1cc33b19da',
    returnRouteId: 'c0a954d4-b331-4974-98e9-8f82612f5eda',
  },
];

/** "Gamek: Terminal Nosso Centro" */
export function mangaisPointLabel(point) {
  return point ? `${point.area}: ${point.place}` : '';
}

export const MANGAIS_PRODUCTS = [
  {
    code: 'ida-e-volta',
    title: 'Ida e volta',
    detail: `Embarque ${MANGAIS_EVENT.boardingTime} · Regresso ${MANGAIS_EVENT.returnTime}`,
    legs: ['outbound', 'return'],
  },
  {
    code: 'ida',
    title: 'Só ida',
    detail: `Luanda → Mangais, embarque ${MANGAIS_EVENT.boardingTime}`,
    legs: ['outbound'],
  },
  {
    code: 'volta',
    title: 'Só volta',
    detail: `Mangais → Luanda, saída ${MANGAIS_EVENT.returnTime}`,
    legs: ['return'],
  },
];

export const MANGAIS_MAX_PASSENGERS = 10;

export const MANGAIS_ROUTE_IDS = MANGAIS_POINTS.flatMap((point) => [
  point.outboundRouteId,
  point.returnRouteId,
]);

export function findMangaisPoint(code) {
  return MANGAIS_POINTS.find((point) => point.code === code) || null;
}

export function findMangaisProduct(code) {
  return MANGAIS_PRODUCTS.find((product) => product.code === code) || null;
}

/** Which point and direction a trip's route belongs to. */
export function describeMangaisRoute(routeId) {
  for (const point of MANGAIS_POINTS) {
    if (point.outboundRouteId === routeId) return { point, direction: 'outbound' };
    if (point.returnRouteId === routeId) return { point, direction: 'return' };
  }
  return null;
}

export function mangaisProductPrice(productCode, passengers = 1) {
  const product = findMangaisProduct(productCode);
  if (!product) return 0;
  return product.legs.length * MANGAIS_EVENT.legPriceKz * Math.max(1, Number(passengers) || 1);
}

/** The event's Luanda calendar day as a UTC range. */
export function getMangaisDayRange() {
  const start = new Date(`${MANGAIS_EVENT.date}T00:00:00+01:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** True until the return bus leaves; after that the page and banner go away. */
export function isMangaisSaleOpen(now = new Date()) {
  return now.getTime() < new Date(MANGAIS_EVENT.lastDepartureIso).getTime();
}

/** The ticket types still on sale right now. */
export function availableMangaisProducts(now = new Date()) {
  const outboundGone = now.getTime() >= new Date(MANGAIS_EVENT.outboundDepartureIso).getTime();
  return MANGAIS_PRODUCTS.filter((product) => !outboundGone || !product.legs.includes('outbound'));
}

export function isMangaisBooking(details) {
  return details?.event === MANGAIS_EVENT.key;
}

/** Whole kwanzas, as on the poster: "7.400 Kz". */
export function formatEventKz(value) {
  const amount = Math.round(Number(value) || 0);
  return `${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} Kz`;
}
