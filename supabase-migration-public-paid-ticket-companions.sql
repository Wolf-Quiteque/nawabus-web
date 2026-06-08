-- Allow the public payment-reference ticket page to show companion passenger
-- names for paid tickets. The reference link already exposes the paid tickets;
-- this only makes the companion row visible for those same confirmed tickets.

CREATE POLICY "Public can view companions for paid reference tickets"
ON public.ticket_companions
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.tickets t
    WHERE t.id = ticket_companions.ticket_id
      AND t.payment_status = 'paid'
      AND t.status IN ('active', 'used')
      AND t.payment_reference IS NOT NULL
      AND t.payment_reference <> ''
  )
);
