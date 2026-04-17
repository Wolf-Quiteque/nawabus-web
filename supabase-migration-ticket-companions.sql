-- Migration: Create ticket_companions table
-- Stores name and phone for companion passengers (additional seats beyond the main passenger)

CREATE TABLE public.ticket_companions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  phone      TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ticket_companions_ticket_id ON public.ticket_companions(ticket_id);

ALTER TABLE public.ticket_companions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert companions for their tickets"
  ON public.ticket_companions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id
        AND (t.booked_by = auth.uid() OR t.passenger_id = auth.uid())
    )
  );

CREATE POLICY "Users can view companions for their tickets"
  ON public.ticket_companions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id
        AND (t.booked_by = auth.uid() OR t.passenger_id = auth.uid())
    )
  );
