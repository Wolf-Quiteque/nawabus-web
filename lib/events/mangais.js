// Brunch Mangais — transport from Luanda to Mangais Golf Resort (Barra do Cuanza).
//
// Everything that changes from one edition to the next lives here: the date,
// the boarding points, the times and the price. The trips themselves are rows in
// `trips` on the placeholder bus EVT-MANGAIS; their routes stay inactive so the
// event never shows up in the normal search, only on /mangais.
//
// Customers do not pick seats. Seat numbers still exist (holds and tickets need
// them) and are assigned by /api/events/mangais, but they are never shown — not
// on the page, the checkout or any PDF — and neither is a bus: staff put
// passengers into cars on the day from the list at /mang.

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
  // Return times on sale. With more than one, the customer picks; with one, the
  // page does not ask. The first sale had a single return at 21h30: that bus
  // still runs for everyone who bought it, but it is no longer sold (since
  // 15 Oct 2026). 18h00 was offered for a few hours that day and dropped
  // before anyone bought it.
  returnTimes: [
    { code: '20h', label: '20h00', departureIso: '2026-11-01T19:00:00+00:00' },
  ],
  returnTimesLabel: '20h00',
  // After the morning buses leave only "só volta" is still on sale; after the
  // last return on sale leaves, nothing is.
  outboundDepartureIso: '2026-11-01T07:00:00+00:00',
  lastDepartureIso: '2026-11-01T19:00:00+00:00',
  legPriceKz: 4000,
};

// Pontos de recolha, named as on the event poster ("Cidade: Porto de Luanda").
//
// `capacity` is how many places a point still sells in each direction on top of
// `baselineTaken`, what that point had already sold when the places were opened
// (15 Oct 2026: +40 Porto, +80 Gamek, +80 Kilamba). The return count covers all
// of a point's return buses together (21h30 and 20h00). 27 Oct: one place moved
// from Kilamba to Gamek with a passenger switched by hand, so Gamek stays sold
// out and Kilamba keeps the places it had.
export const MANGAIS_POINTS = [
  {
    code: 'porto',
    area: 'Cidade',
    place: 'Porto de Luanda',
    capacity: 40,
    baselineTaken: { outbound: 81, return: 80 },
    outboundRouteId: 'bc9b1cd8-86bf-41a6-a9f2-3eccd79d3217',
    returnRouteId: '767d75c6-f358-4ee3-bfb7-47b84e54e320',
  },
  {
    code: 'gamek',
    area: 'Gamek',
    place: 'Terminal Nosso Centro',
    capacity: 81,
    baselineTaken: { outbound: 104, return: 104 },
    outboundRouteId: 'a3a15d0a-e66f-42d3-9fa4-cd040ca7ba53',
    returnRouteId: '0f912a8b-e8dd-49ea-96ee-1f8ce9668501',
  },
  {
    code: 'kilamba',
    area: 'Kilamba',
    place: 'Autarquias',
    capacity: 79,
    baselineTaken: { outbound: 115, return: 116 },
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
    detail: `Partida às ${MANGAIS_EVENT.boardingTime} · Regresso às ${MANGAIS_EVENT.returnTimesLabel}`,
    legs: ['outbound', 'return'],
  },
  {
    code: 'ida',
    title: 'Só ida',
    detail: `Luanda → Mangais, partida às ${MANGAIS_EVENT.boardingTime}`,
    legs: ['outbound'],
  },
  {
    code: 'volta',
    title: 'Só volta',
    detail: `Mangais → Luanda, saída às ${MANGAIS_EVENT.returnTimesLabel}`,
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

export function findMangaisReturnTime(code) {
  return MANGAIS_EVENT.returnTimes.find((time) => time.code === code) || null;
}

/** Return times whose bus has not left yet. */
export function availableMangaisReturnTimes(now = new Date()) {
  return MANGAIS_EVENT.returnTimes.filter((time) => now.getTime() < new Date(time.departureIso).getTime());
}

/** "18h00", "20h00" or "21h30" for a return trip's departure (Luanda time). */
export function mangaisTimeLabel(departureTime) {
  const parts = new Intl.DateTimeFormat('pt-PT', {
    timeZone: 'Africa/Luanda', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(departureTime));
  const part = (type) => parts.find((item) => item.type === type)?.value || '00';
  return `${part('hour')}h${part('minute')}`;
}

/** A ticket (or trip) of the event: no seat and no bus is ever printed for it. */
export function isMangaisTrip(trip) {
  const route = Array.isArray(trip?.routes) ? trip.routes[0] : trip?.routes;
  return MANGAIS_ROUTE_IDS.includes(trip?.route_id)
    || route?.origin_city === 'Mangais'
    || route?.destination_city === 'Mangais';
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

/** Whole kwanzas, as on the poster: "8.000 Kz". */
export function formatEventKz(value) {
  const amount = Math.round(Number(value) || 0);
  return `${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} Kz`;
}
