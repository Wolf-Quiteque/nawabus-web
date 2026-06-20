function formatLuandaDateKey(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Luanda',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function addLuandaDays(dateKey, days) {
  const date = new Date(`${dateKey}T12:00:00+01:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return formatLuandaDateKey(date);
}

export function getLuandaTodayDateKey() {
  return formatLuandaDateKey(new Date());
}

export function getMinPurchaseDateKey() {
  return addLuandaDays(getLuandaTodayDateKey(), 1);
}

export function isDatePurchasable(dateKey) {
  if (!dateKey) return false;
  return String(dateKey) >= getMinPurchaseDateKey();
}

export function clampToMinPurchaseDate(dateKey) {
  const minDate = getMinPurchaseDateKey();
  return isDatePurchasable(dateKey) ? dateKey : minDate;
}

export function isTripPurchasable(trip) {
  if (!trip?.departure_time) return false;
  return isDatePurchasable(formatLuandaDateKey(new Date(trip.departure_time)));
}

export function getClosedTodayPurchaseMessage() {
  return 'As compras para hoje ja estao encerradas. Escolha uma viagem para amanha.';
}
