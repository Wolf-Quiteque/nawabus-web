CREATE OR REPLACE FUNCTION public.notify_payment_confirmed_sms()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  phone_raw        text;
  passenger_name   text;
  origin_city      text;
  dest_city        text;
  departure_ts     timestamptz;
  seat_text        text;
  code_text        text;
  download_url     text;
  website_base_url text;
  msg              text;
  api_url          text;
  secret           text;
  sender_id        text;
  headers          jsonb;
  body             jsonb;
  req_id           bigint;
  phone_clean      text;
BEGIN
  IF OLD.payment_status = 'pending' AND NEW.payment_status = 'paid' THEN
    SELECT p.phone_number,
           NULLIF(TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')), '')
      INTO phone_raw, passenger_name
      FROM public.profiles p
     WHERE p.id = NEW.passenger_id
     LIMIT 1;

    IF phone_raw IS NULL OR phone_raw = '' THEN
      RETURN NEW;
    END IF;

    phone_clean := REGEXP_REPLACE(phone_raw, '\D', '', 'g');
    IF phone_clean = '' THEN
      RETURN NEW;
    END IF;

    IF LENGTH(phone_clean) = 9 AND LEFT(phone_clean, 1) = '9' AND phone_clean NOT LIKE '244%' THEN
      phone_clean := '244' || phone_clean;
    END IF;

    SELECT t.departure_time, r.origin_city, r.destination_city
      INTO departure_ts, origin_city, dest_city
      FROM public.trips t
      LEFT JOIN public.routes r ON r.id = t.route_id
     WHERE t.id = NEW.trip_id;

    code_text := COALESCE(NEW.ticket_number::text, NEW.id::text);
    seat_text := COALESCE(NEW.seat_number::text, '-');
    website_base_url := RTRIM(public._get_secret('WEBSITE_BASE_URL', 'https://www.nawabus.co.ao'), '/');
    download_url := website_base_url || '/bilhetes/' || COALESCE(NEW.payment_reference, NEW.id::text);

    msg := FORMAT(
'NAWABUS - Pagamento confirmado

Ola %s,
Recebemos o seu pagamento.

Baixe o(s) seu(s) bilhete(s):
%s

Detalhes do bilhete:
- Codigo: %s
- Passageiro: %s
- Rota: %s -> %s
- Assento(s): %s
- Partida: %s
- Ref. Pagamento: %s

O seu bilhete esta ATIVO. Apresente o PDF ou este SMS no embarque.
Viajar aqui e facil.',
      COALESCE(passenger_name, 'Cliente'),
      download_url,
      code_text,
      COALESCE(passenger_name, 'Cliente'),
      COALESCE(origin_city, 'Origem'),
      COALESCE(dest_city, 'Destino'),
      seat_text,
      CASE WHEN departure_ts IS NULL
           THEN '-'
           ELSE TO_CHAR(departure_ts AT TIME ZONE 'Africa/Luanda', 'DD/MM/YYYY "as" HH24:MI')
      END,
      COALESCE(NEW.payment_reference, '-')
    );

    IF CHAR_LENGTH(msg) > 1000 THEN
      msg := SUBSTRING(msg FROM 1 FOR 1000);
    END IF;

    api_url   := public._get_secret('SMS_API_URL', 'https://mimo-sms-rest-api.vercel.app/send-sms');
    secret    := public._get_secret('SMS_WEBHOOK_SECRET', NULL);
    sender_id := public._get_secret('SMS_SENDER', NULL);

    headers := JSONB_BUILD_OBJECT('Content-Type','application/json');
    IF secret IS NOT NULL THEN
      headers := headers || JSONB_BUILD_OBJECT('X-Webhook-Secret', secret);
    END IF;

    body := JSONB_BUILD_OBJECT('to', phone_clean, 'text', msg);
    IF sender_id IS NOT NULL AND sender_id <> '' THEN
      body := body || JSONB_BUILD_OBJECT('sender', sender_id);
    END IF;

    BEGIN
      req_id := net.http_post(
        url := api_url,
        body := body,
        headers := headers,
        timeout_milliseconds := 8000
      );
    EXCEPTION WHEN OTHERS THEN
      RETURN NEW;
    END;
  END IF;

  RETURN NEW;
END;
$function$;
