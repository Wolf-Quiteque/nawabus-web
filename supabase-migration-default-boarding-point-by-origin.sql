-- Every departure from a city without an agency of ours must carry its
-- boarding point (trips.boarding_point), so the address reaches the search
-- card, checkout, "meus bilhetes" and the ticket PDFs. Until now it was typed
-- per trip, so some Sumbe -> Luanda trips had it and others did not.
--
-- This migration:
--   1. keeps the boarding point per origin city in origin_boarding_points,
--      seeded from the address already used on Sumbe trips;
--   2. fills every existing trip leaving that city that has no boarding point;
--   3. fills it on every future trip (insert, or a route change) that is
--      created without one. A boarding point typed on a trip still wins.
--
-- To change the Sumbe address later, update origin_boarding_points and re-run
-- step 2 with the old address in the WHERE clause if existing trips should
-- follow.

CREATE TABLE IF NOT EXISTS public.origin_boarding_points (
  origin_city text PRIMARY KEY,
  boarding_point text NOT NULL CHECK (btrim(boarding_point) <> ''),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.origin_boarding_points ENABLE ROW LEVEL SECURITY;

-- Cities are matched case- and space-insensitively.
CREATE OR REPLACE FUNCTION public.normalize_origin_city(city text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT lower(btrim(city));
$function$;

-- 1. Seed Sumbe with the address already entered on its trips (the most used
--    one), so the wording matches the tickets already issued.
INSERT INTO public.origin_boarding_points (origin_city, boarding_point)
SELECT 'sumbe', tr.boarding_point
  FROM public.trips tr
  JOIN public.routes r ON r.id = tr.route_id
 WHERE public.normalize_origin_city(r.origin_city) = 'sumbe'
   AND nullif(btrim(tr.boarding_point), '') IS NOT NULL
 GROUP BY tr.boarding_point
 ORDER BY count(*) DESC, max(tr.departure_time) DESC
 LIMIT 1
ON CONFLICT (origin_city) DO NOTHING;

DO $check$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.origin_boarding_points WHERE origin_city = 'sumbe') THEN
    RAISE EXCEPTION 'No Sumbe trip has a boarding_point yet: insert the address into public.origin_boarding_points (origin_city = ''sumbe'') and run this migration again.';
  END IF;
END
$check$;

-- 3. Future trips: fill the boarding point from the origin city when missing.
CREATE OR REPLACE FUNCTION public.fill_trip_boarding_point()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF nullif(btrim(NEW.boarding_point), '') IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT obp.boarding_point
    INTO NEW.boarding_point
    FROM public.routes r
    JOIN public.origin_boarding_points obp
      ON obp.origin_city = public.normalize_origin_city(r.origin_city)
   WHERE r.id = NEW.route_id;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS fill_trip_boarding_point ON public.trips;
CREATE TRIGGER fill_trip_boarding_point
  BEFORE INSERT OR UPDATE OF route_id, boarding_point ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.fill_trip_boarding_point();

-- 2. Existing trips (past and future departures) missing the address.
UPDATE public.trips tr
   SET boarding_point = obp.boarding_point
  FROM public.routes r
  JOIN public.origin_boarding_points obp
    ON obp.origin_city = public.normalize_origin_city(r.origin_city)
 WHERE r.id = tr.route_id
   AND nullif(btrim(tr.boarding_point), '') IS NULL;
