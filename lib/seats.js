/**
 * The co-pilot seat is permanently reserved and can never be sold.
 *
 * This mirrors public.copilot_seat_number() in the database, which rejects
 * any ticket written to this seat. Keep the two in sync.
 */
export const COPILOT_SEAT_NUMBER = 3;

export function isCopilotSeat(seatNumber) {
  return Number(seatNumber) === COPILOT_SEAT_NUMBER;
}

/** Seats a passenger may actually choose, given the bus capacity. */
export function sellableSeatCount(capacity) {
  return Math.max(Number(capacity || 0) - 1, 0);
}

/** True when a seat is an integer passenger seat inside this bus. */
export function isSellableSeat(seatNumber, capacity) {
  const seat = Number(seatNumber);
  const busCapacity = Number(capacity);
  return Number.isInteger(seat)
    && Number.isInteger(busCapacity)
    && seat >= 1
    && seat <= busCapacity
    && !isCopilotSeat(seat);
}
