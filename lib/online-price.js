// A trip can be sold cheaper online than at the counter. `price_usd` is the
// counter price (Sunmi terminals, agents) and holds Kz despite its name;
// `online_price_kz`, when set, is what a website buyer pays instead.
//
// payment-api prices website bookings with the same rule and rejects any amount
// that does not match, so this file and validateAndPriceDeferredBooking there
// must agree.

/** The fare a website buyer pays for one seat on this trip. */
export function onlineFare(trip) {
  if (trip?.online_price_kz != null) return Number(trip.online_price_kz);
  return Number(trip?.price_usd ?? 0);
}

/**
 * The trip with `price_usd` replaced by the online fare. Applied where a trip
 * enters the website, so search, seat selection and checkout keep reading
 * `price_usd` and never have to know there are two prices.
 */
export function withOnlinePrice(trip) {
  if (!trip) return trip;
  return { ...trip, price_usd: onlineFare(trip) };
}
