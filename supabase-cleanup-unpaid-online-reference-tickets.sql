-- Frees seats that were reserved by old website reference-payment attempts.
-- Run the SELECT first to review the affected rows, then run the UPDATE.
-- Keep the rows for audit/payment-reference history; cancelled tickets are not
-- counted by the available-seat trigger and are not shown as occupied online.

SELECT
  id,
  trip_id,
  passenger_id,
  seat_number,
  ticket_number,
  payment_reference,
  created_at
FROM public.tickets
WHERE booking_source = 'online'
  AND payment_method = 'referencia'
  AND payment_status = 'pending'
  AND status = 'active'
  AND created_at < now() - interval '15 minutes'
ORDER BY created_at;

UPDATE public.tickets
SET status = 'cancelled'
WHERE booking_source = 'online'
  AND payment_method = 'referencia'
  AND payment_status = 'pending'
  AND status = 'active'
  AND created_at < now() - interval '15 minutes';
