-- Prevent duplicate active/used seats across sibling trips that share the same
-- bus and departure minute. This protects paid webhook inserts from races.

CREATE OR REPLACE FUNCTION public.prevent_duplicate_active_bus_seat()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_bus_id uuid;
  v_departure_minute timestamptz;
BEGIN
  IF NEW.status NOT IN ('active', 'used') THEN
    RETURN NEW;
  END IF;

  SELECT bus_id, date_trunc('minute', departure_time)
    INTO v_bus_id, v_departure_minute
    FROM public.trips
   WHERE id = NEW.trip_id;

  IF v_bus_id IS NULL OR v_departure_minute IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      v_bus_id::text || ':' || v_departure_minute::text || ':' || NEW.seat_number::text,
      0
    )
  );

  IF EXISTS (
    SELECT 1
      FROM public.tickets t
      JOIN public.trips tr ON tr.id = t.trip_id
     WHERE tr.bus_id = v_bus_id
       AND date_trunc('minute', tr.departure_time) = v_departure_minute
       AND t.seat_number = NEW.seat_number
       AND t.status IN ('active', 'used')
       AND t.id <> NEW.id
  ) THEN
    RAISE EXCEPTION 'Seat % is already booked for this bus departure', NEW.seat_number
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS prevent_duplicate_active_bus_seat_trigger ON public.tickets;

CREATE TRIGGER prevent_duplicate_active_bus_seat_trigger
BEFORE INSERT OR UPDATE OF trip_id, seat_number, status
ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_active_bus_seat();
