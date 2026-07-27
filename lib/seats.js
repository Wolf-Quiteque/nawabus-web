/**
 * Seat 1 is permanently reserved for the co-pilot and can never be sold.
 *
 * This mirrors public.copilot_seat_number() in the database, which rejects
 * any ticket written to this seat. Keep the two in sync.
 */
export const COPILOT_SEAT_NUMBER = 1;

export function isCopilotSeat(seatNumber) {
  return Number(seatNumber) === COPILOT_SEAT_NUMBER;
}

/** Seats a passenger may actually choose, given the bus capacity. */
export function sellableSeatCount(capacity) {
  return Math.max(Number(capacity || 0) - 1, 0);
}
