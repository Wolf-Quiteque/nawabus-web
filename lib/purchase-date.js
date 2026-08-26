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

export function getLuandaTodayDateKey() {
  return formatLuandaDateKey(new Date());
}

export function getMinPurchaseDateKey() {
  return getLuandaTodayDateKey();
}

export function isDatePurchasable(dateKey) {
  if (!dateKey) return false;
  return String(dateKey) >= getMinPurchaseDateKey();
}

export function clampToMinPurchaseDate(dateKey) {
  const minDate = getMinPurchaseDateKey();
  return isDatePurchasable(dateKey) ? dateKey : minDate;
}

export function isDeparturePurchasable(departureTime, now = new Date()) {
  if (!departureTime) return false;

  const departure = new Date(departureTime);
  const currentTime = now instanceof Date ? now : new Date(now);

  if (Number.isNaN(departure.getTime()) || Number.isNaN(currentTime.getTime())) {
    return false;
  }

  return departure.getTime() > currentTime.getTime();
}

export function isTripPurchasable(trip, now = new Date()) {
  return isDeparturePurchasable(trip?.departure_time, now);
}

export function getClosedTodayPurchaseMessage() {
  return 'Esta viagem ja partiu. Escolha uma viagem disponivel.';
}
