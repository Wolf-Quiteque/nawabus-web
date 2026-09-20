export const LUANDA_TIME_ZONE = 'Africa/Luanda';

export function formatLuandaDateTime(value, options = {}) {
  if (!value) return 'Data nao especificada';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data nao especificada';

  return date.toLocaleString('pt-PT', {
    timeZone: LUANDA_TIME_ZONE,
    ...options,
  });
}

export function ticketDepartureTime(ticket) {
  return ticket?.booking_snapshot?.departure_time || ticket?.trips?.departure_time || null;
}
