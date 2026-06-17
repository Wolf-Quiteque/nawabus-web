'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, ArrowRight, CalendarDays, Check, Loader2, MapPin, Minus, Plus, UsersRound } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const EVENT_DATES = {
  '2026-06-20': { day: '20', label: '20 de Junho', weekday: 'Sabado' },
  '2026-06-21': { day: '21', label: '21 de Junho', weekday: 'Domingo' },
};

const directionOptions = [
  {
    value: 'one-way',
    title: 'So ida',
    description: 'Luanda para Mangais',
  },
  {
    value: 'return-only',
    title: 'So volta',
    description: 'Mangais para Luanda',
  },
  {
    value: 'round-trip',
    title: 'Ida e volta',
    description: 'Ir e voltar no mesmo dia',
  },
];

function minuteWindow(isoString) {
  const d = new Date(isoString);
  d.setSeconds(0, 0);
  return { start: d.toISOString(), end: new Date(d.getTime() + 60000).toISOString() };
}

async function getSiblingIds(supabase, busId, departureTime) {
  const { start, end } = minuteWindow(departureTime);
  const { data } = await supabase
    .from('trips')
    .select('id')
    .eq('bus_id', busId)
    .gte('departure_time', start)
    .lt('departure_time', end);

  return data?.map((trip) => trip.id) ?? [];
}

async function getHeldSeatNumbers(tripIds) {
  if (!tripIds?.length) return [];

  const response = await fetch(`/api/held-seats?trip_ids=${encodeURIComponent(tripIds.join(','))}`, {
    cache: 'no-store',
  });

  if (!response.ok) return [];

  const result = await response.json();
  return (result.held_seats || []).map((hold) => Number(hold.seat_number)).filter(Number.isFinite);
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

function normalizeStopName(city = '') {
  const normalized = city.toLowerCase();
  if (normalized.includes('gamek')) return 'Gamek - Nosso centro';
  if (normalized.includes('kilamba')) return 'Kilamba - Proximo das Autarquias';
  if (normalized.includes('porto')) return 'Porto';
  return city || 'Ponto de embarque';
}

function getStopDetail(city = '') {
  return city.toLowerCase().includes('gamek') ? 'Terminal Interprovincial' : null;
}

function tripStopKey(trip, direction) {
  return direction === 'return'
    ? trip.routes?.destination_city || ''
    : trip.routes?.origin_city || '';
}

function getTripOptionKey(trip, direction) {
  const departure = new Date(trip.departure_time);
  return [
    tripStopKey(trip, direction),
    departure.toISOString().slice(0, 10),
    departure.toISOString().slice(11, 16),
  ].join('|');
}

function sortTrips(a, b) {
  const departureDiff = new Date(a.departure_time).getTime() - new Date(b.departure_time).getTime();
  if (departureDiff !== 0) return departureDiff;

  const createdDiff = new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
  if (createdDiff !== 0) return createdDiff;

  return String(a.id).localeCompare(String(b.id));
}

function getGroupedVisibleTrips(trips, direction) {
  const groups = new Map();
  [...trips].sort(sortTrips).forEach((trip) => {
    const departure = new Date(trip.departure_time);
    const key = [
      trip.routes?.origin_city,
      trip.routes?.destination_city,
      departure.toISOString().slice(0, 10),
      departure.toISOString().slice(11, 16),
      tripStopKey(trip, direction),
    ].join('|');

    if (!groups.has(key)) groups.set(key, trip);
  });

  return [...groups.values()].sort(sortTrips);
}

function getPointOptions(trips, direction) {
  const options = new Map();

  getGroupedVisibleTrips(trips, direction).forEach((trip) => {
    const city = tripStopKey(trip, direction);
    const optionKey = getTripOptionKey(trip, direction);
    if (!city || options.has(optionKey)) return;

    options.set(optionKey, {
      value: optionKey,
      city,
      title: normalizeStopName(city),
      detail: getStopDetail(city),
      time: formatTime(trip.departure_time),
      arrival: formatTime(trip.arrival_time),
      availableSeats: trip.available_seats,
    });
  });

  return [...options.values()];
}

function getPlaceOptions(timeOptions) {
  const places = new Map();

  timeOptions.forEach((option) => {
    if (!option.city || places.has(option.city)) return;
    places.set(option.city, {
      value: option.city,
      title: option.title,
      detail: option.detail,
    });
  });

  return [...places.values()];
}

function getTimeOptions(timeOptions, city) {
  return timeOptions.filter((option) => option.city === city);
}

function getSelectedOptionLabel(options, value) {
  const option = options.find((item) => item.value === value);
  if (!option) return '';
  return `${option.title} - ${option.time}`;
}

function findBestSeats(availableSeats, count) {
  for (let index = 0; index <= availableSeats.length - count; index += 1) {
    const candidate = availableSeats.slice(index, index + count);
    const isTogether = candidate.every((seat, seatIndex) => seatIndex === 0 || seat === candidate[seatIndex - 1] + 1);
    if (isTogether) return candidate;
  }

  return availableSeats.slice(0, count);
}

function EventStep({ children, active }) {
  return (
    <div
      className={`transition-all duration-500 ${
        active
          ? 'translate-y-0 opacity-100'
          : 'pointer-events-none absolute inset-x-0 top-0 translate-y-8 opacity-0'
      }`}
    >
      {children}
    </div>
  );
}

function MangaisEventFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const initialDate = searchParams.get('date');
  const [eventDate, setEventDate] = useState(EVENT_DATES[initialDate] ? initialDate : '');
  const [direction, setDirection] = useState('');
  const [outboundPlace, setOutboundPlace] = useState('');
  const [outboundPoint, setOutboundPoint] = useState('');
  const [returnPlace, setReturnPlace] = useState('');
  const [returnPoint, setReturnPoint] = useState('');
  const [companionCount, setCompanionCount] = useState(0);
  const companionCountRef = useRef(0);
  const [passengerCountConfirmed, setPassengerCountConfirmed] = useState(false);
  const [passengerNamesConfirmed, setPassengerNamesConfirmed] = useState(false);
  const [companions, setCompanions] = useState([]);
  const [outboundTrips, setOutboundTrips] = useState([]);
  const [returnTrips, setReturnTrips] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [buildingBooking, setBuildingBooking] = useState(false);
  const [error, setError] = useState('');

  const needsOutbound = direction === 'one-way' || direction === 'round-trip';
  const needsReturn = direction === 'return-only' || direction === 'round-trip';
  const totalPassengers = companionCount + 1;

  const step = useMemo(() => {
    if (!eventDate) return 'date';
    if (!direction) return 'direction';
    if (needsOutbound && !outboundPlace) return 'outbound-point';
    if (needsOutbound && !outboundPoint) return 'outbound-time';
    if (needsReturn && !returnPlace) return 'return-point';
    if (needsReturn && !returnPoint) return 'return-time';
    if (!passengerCountConfirmed) return 'count';
    if (companionCount > 0 && !passengerNamesConfirmed) return 'names';
    return 'review';
  }, [companionCount, direction, eventDate, needsOutbound, needsReturn, outboundPlace, outboundPoint, passengerCountConfirmed, passengerNamesConfirmed, returnPlace, returnPoint]);

  const fetchTrips = useCallback(async (date, isReturn = false) => {
    const startOfDay = new Date(`${date}T00:00:00`);
    const endOfDay = new Date(`${date}T23:59:59.999`);

    let query = supabase
      .from('trips')
      .select(`
        id,
        bus_id,
        departure_time,
        arrival_time,
        created_at,
        price_usd,
        available_seats,
        seat_class,
        status,
        routes!inner (
          origin_city,
          destination_city,
          origin_province,
          destination_province
        ),
        buses!inner (
          capacity,
          make,
          model,
          amenities,
          companies (
            name,
            logo_url
          )
        )
      `)
      .eq('status', 'scheduled')
      .gt('available_seats', 0)
      .gte('departure_time', startOfDay.toISOString())
      .lte('departure_time', endOfDay.toISOString())
      .order('departure_time', { ascending: true });

    if (isReturn) {
      query = query
        .ilike('routes.origin_province', '%Barra%')
        .ilike('routes.destination_province', '%Luanda%');
    } else {
      query = query
        .ilike('routes.origin_province', '%Luanda%')
        .ilike('routes.destination_province', '%Barra%');
    }

    const { data, error: tripError } = await query;
    if (tripError) throw tripError;
    return data || [];
  }, [supabase]);

  useEffect(() => {
    if (!eventDate) return;

    const loadTrips = async () => {
      setLoadingTrips(true);
      setError('');

      try {
        const [outboundData, returnData] = await Promise.all([
          fetchTrips(eventDate, false),
          fetchTrips(eventDate, true),
        ]);
        setOutboundTrips(outboundData);
        setReturnTrips(returnData);
      } catch (err) {
        console.error('Mangais trips error:', err);
        setError('Nao foi possivel carregar as viagens do evento. Tente novamente.');
      } finally {
        setLoadingTrips(false);
      }
    };

    loadTrips();
  }, [eventDate, fetchTrips]);

  const updateCompanionCount = (nextCount) => {
    const normalizedCount = Math.max(0, Math.min(9, Number(nextCount) || 0));
    companionCountRef.current = normalizedCount;
    setCompanionCount(normalizedCount);
    setPassengerCountConfirmed(false);
    setPassengerNamesConfirmed(normalizedCount === 0);
    setCompanions((current) => (
      Array.from({ length: normalizedCount }, (_, index) => current[index] || { name: '', phone: '' })
    ));
  };

  const outboundOptions = useMemo(() => getPointOptions(outboundTrips, 'outbound'), [outboundTrips]);
  const returnOptions = useMemo(() => getPointOptions(returnTrips, 'return'), [returnTrips]);
  const outboundPlaceOptions = useMemo(() => getPlaceOptions(outboundOptions), [outboundOptions]);
  const returnPlaceOptions = useMemo(() => getPlaceOptions(returnOptions), [returnOptions]);
  const outboundTimeOptions = useMemo(() => getTimeOptions(outboundOptions, outboundPlace), [outboundOptions, outboundPlace]);
  const returnTimeOptions = useMemo(() => getTimeOptions(returnOptions, returnPlace), [returnOptions, returnPlace]);

  const pickTripAndSeats = async (trips, optionKey, tripDirection) => {
    const candidates = getGroupedVisibleTrips(trips, tripDirection)
      .filter((trip) => getTripOptionKey(trip, tripDirection) === optionKey)
      .filter((trip) => Number(trip.available_seats) >= totalPassengers);

    for (const trip of candidates) {
      const siblingIds = await getSiblingIds(supabase, trip.bus_id, trip.departure_time);
      const { data: tickets, error: ticketsError } = await supabase
        .from('tickets')
        .select('seat_number')
        .in('trip_id', siblingIds)
        .in('status', ['active', 'used']);

      if (ticketsError) throw ticketsError;

      const heldSeats = await getHeldSeatNumbers(siblingIds);
      const occupied = new Set([
        ...(tickets || []).map((ticket) => Number(ticket.seat_number)).filter(Number.isFinite),
        ...heldSeats,
      ]);
      const capacity = Number(trip.buses?.capacity || 0);
      const availableSeats = Array.from({ length: capacity }, (_, index) => index + 1)
        .filter((seat) => !occupied.has(seat));

      if (availableSeats.length >= totalPassengers) {
        return {
          trip,
          selectedSeats: findBestSeats(availableSeats, totalPassengers),
        };
      }
    }

    throw new Error('Nao ha lugares suficientes nesse horario. Escolha outro horario ou tente mais tarde.');
  };

  const buildCompanionMap = (selectedSeats) => {
    const sortedSeats = [...selectedSeats].sort((a, b) => a - b);
    const companionSeats = sortedSeats.slice(1);

    return Object.fromEntries(
      companionSeats.map((seat, index) => [
        seat,
        {
          name: companions[index]?.name?.trim() || '',
          phone: companions[index]?.phone?.trim() || '',
        },
      ])
    );
  };

  const normalizeTripForCheckout = ({ trip, selectedSeats }) => {
    const unitPrice = Number(trip.price_usd || 0);

    return {
      ...trip,
      origin: trip.routes?.origin_city,
      destination: trip.routes?.destination_city,
      bus_make: trip.buses?.make,
      bus_model: trip.buses?.model,
      selectedSeats,
      companions: buildCompanionMap(selectedSeats),
      price: Number((unitPrice * selectedSeats.length).toFixed(2)),
      price_usd: unitPrice,
    };
  };

  const continueToCheckout = async () => {
    setBuildingBooking(true);
    setError('');

    try {
      let outboundSelection = null;
      let returnSelection = null;

      if (needsOutbound) {
        outboundSelection = await pickTripAndSeats(outboundTrips, outboundPoint, 'outbound');
      }

      if (needsReturn) {
        returnSelection = await pickTripAndSeats(returnTrips, returnPoint, 'return');
      }

      const primarySelection = outboundSelection || returnSelection;
      const checkoutOutbound = normalizeTripForCheckout(primarySelection);
      const checkoutReturn = direction === 'round-trip' && returnSelection
        ? normalizeTripForCheckout(returnSelection)
        : null;

      const bookingDetails = {
        tripType: direction === 'round-trip' ? 'round-trip' : 'one-way',
        event: 'mangais',
        eventDate,
        outboundTrip: checkoutOutbound,
        ...(checkoutReturn && { returnTrip: checkoutReturn }),
        totalPrice: Number((checkoutOutbound.price + (checkoutReturn?.price || 0)).toFixed(2)),
      };

      sessionStorage.setItem('bookingDetails', JSON.stringify(bookingDetails));
      router.push('/checkout');
    } catch (err) {
      console.error('Could not build Mangais booking:', err);
      setError(err.message || 'Nao foi possivel preparar a compra.');
    } finally {
      setBuildingBooking(false);
    }
  };

  const resetAfterDirection = () => {
    setOutboundPlace('');
    setOutboundPoint('');
    setReturnPlace('');
    setReturnPoint('');
    companionCountRef.current = 0;
    setCompanionCount(0);
    setPassengerCountConfirmed(false);
    setPassengerNamesConfirmed(false);
    setCompanions([]);
  };

  const selectedDateMeta = EVENT_DATES[eventDate];

  return (
    <main className="min-h-screen overflow-hidden bg-[#07180d] text-white">
      <div className="fixed inset-0">
        <Image
          src="/wallpaper.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_10%,rgba(223,255,132,0.28),transparent_25%),linear-gradient(145deg,rgba(5,26,11,0.96)_0%,rgba(8,76,30,0.9)_48%,rgba(3,12,7,0.98)_100%)]" />
      </div>

      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-5 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-sm font-bold text-lime-50 backdrop-blur-md transition hover:bg-white/15"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
          <img src="/nawabus_logo_white.webp" alt="Nawabus" className="h-9 w-auto sm:h-11" />
        </div>

        <div className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#dfff84] px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-green-950">
              <CalendarDays className="h-4 w-4" />
              Brunch Mangais
            </div>
            <h1 className="mt-5 text-4xl font-black leading-[0.95] text-[#f4ffd5] sm:text-6xl">
              Compra simples para Mangais
            </h1>
            <p className="mt-5 max-w-xl text-base font-semibold leading-7 text-lime-50/86 sm:text-lg">
              Responde a poucos passos. Nos escolhemos os lugares automaticamente e depois geras a referencia MULTICAIXA.
            </p>
            <div className="mt-6 grid gap-3 text-sm font-bold text-lime-50/90 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/12 bg-white/10 p-4 backdrop-blur-md">
                1. Escolhe ida ou volta
              </div>
              <div className="rounded-2xl border border-white/12 bg-white/10 p-4 backdrop-blur-md">
                2. Escolhe o ponto
              </div>
              <div className="rounded-2xl border border-white/12 bg-white/10 p-4 backdrop-blur-md">
                3. Paga por referencia
              </div>
            </div>
          </div>

          <div className="relative min-h-[34rem] rounded-[2rem] border border-lime-100/25 bg-white/12 p-4 shadow-2xl shadow-black/45 backdrop-blur-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-white/12 bg-black/20 p-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-lime-200">Evento</p>
                <p className="text-lg font-black">Mangais Golf Resort</p>
              </div>
              {selectedDateMeta && (
                <div className="flex h-16 w-16 flex-col items-center justify-center rounded-2xl bg-[#dfff84] text-green-950">
                  <span className="text-2xl font-black leading-none">{selectedDateMeta.day}</span>
                  <span className="text-[0.62rem] font-black uppercase tracking-[0.16em]">Jun</span>
                </div>
              )}
            </div>

            {loadingTrips && (
              <div className="mb-4 flex items-center gap-2 rounded-2xl border border-lime-200/20 bg-lime-100/10 px-4 py-3 text-sm font-bold text-lime-50">
                <Loader2 className="h-4 w-4 animate-spin" />
                A procurar autocarros disponiveis...
              </div>
            )}

            {error && (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-500/15 px-4 py-3 text-sm font-bold text-red-50">
                {error}
              </div>
            )}

            <div className="relative min-h-[24rem]">
              <EventStep active={step === 'date'}>
                <QuestionTitle title="Escolhe o dia do evento" description="Toca no dia em que queres viajar." />
                <div className="grid gap-3 sm:grid-cols-2">
                  {Object.entries(EVENT_DATES).map(([value, meta]) => (
                    <ChoiceButton
                      key={value}
                      title={meta.label}
                      detail={meta.weekday}
                      onClick={() => setEventDate(value)}
                    />
                  ))}
                </div>
              </EventStep>

              <EventStep active={step === 'direction'}>
                <QuestionTitle title="O que queres comprar?" description="Escolhe a opcao mais simples para a tua viagem." />
                <div className="grid gap-3">
                  {directionOptions.map((option) => (
                    <ChoiceButton
                      key={option.value}
                      title={option.title}
                      detail={option.description}
                      onClick={() => {
                        setDirection(option.value);
                        resetAfterDirection();
                      }}
                    />
                  ))}
                </div>
              </EventStep>

              <EventStep active={step === 'outbound-point'}>
                <QuestionTitle title="Embarque para Mangais" description="De onde vais sair?" />
                <PlaceChoices
                  options={outboundPlaceOptions}
                  emptyText="Ainda nao encontramos pontos de ida para esta data."
                  onSelect={(place) => {
                    setOutboundPlace(place);
                    setOutboundPoint('');
                  }}
                />
              </EventStep>

              <EventStep active={step === 'outbound-time'}>
                <QuestionTitle title="Horario de ida" description={`Escolhe a hora de saida em ${normalizeStopName(outboundPlace)}.`} />
                <PointChoices
                  options={outboundTimeOptions}
                  emptyText="Ainda nao encontramos horarios para este ponto."
                  onSelect={setOutboundPoint}
                />
              </EventStep>

              <EventStep active={step === 'return-point'}>
                <QuestionTitle title="Volta para onde?" description="Escolhe onde queres sair no regresso." />
                <PlaceChoices
                  options={returnPlaceOptions}
                  emptyText="Ainda nao encontramos pontos de volta para esta data."
                  onSelect={(place) => {
                    setReturnPlace(place);
                    setReturnPoint('');
                  }}
                />
              </EventStep>

              <EventStep active={step === 'return-time'}>
                <QuestionTitle title="Horario de volta" description={`Escolhe a hora de volta para ${normalizeStopName(returnPlace)}.`} />
                <PointChoices
                  options={returnTimeOptions}
                  emptyText="Ainda nao encontramos horarios para este ponto."
                  onSelect={setReturnPoint}
                />
              </EventStep>

              <EventStep active={step === 'count'}>
                <QuestionTitle title="Vais levar mais alguem?" description="Nao contes contigo. Exemplo: se vais sozinho, deixa 0." />
                <div className="mx-auto flex max-w-xs items-center justify-center gap-4 rounded-[1.7rem] border border-white/15 bg-white/10 p-5">
                  <button
                    type="button"
                    onClick={() => updateCompanionCount(companionCountRef.current - 1)}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-green-950 transition hover:bg-lime-100"
                  >
                    <Minus className="h-5 w-5" />
                  </button>
                  <div className="min-w-20 text-center">
                    <p className="text-5xl font-black">{companionCount}</p>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-lime-100">passageiros</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateCompanionCount(companionCountRef.current + 1)}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-[#dfff84] text-green-950 transition hover:bg-lime-200"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
                <Button
                  type="button"
                  onClick={() => {
                    const count = companionCountRef.current;
                    setCompanionCount(count);
                    setPassengerCountConfirmed(true);
                    if (count === 0) {
                      setPassengerNamesConfirmed(true);
                      setCompanions([]);
                    } else {
                      setPassengerNamesConfirmed(false);
                      setCompanions((current) => (
                        Array.from({ length: count }, (_, index) => current[index] || { name: '', phone: '' })
                      ));
                    }
                  }}
                  className="mt-5 h-12 w-full rounded-2xl bg-[#dfff84] font-black text-green-950 hover:bg-lime-200"
                >
                  Continuar
                </Button>
              </EventStep>

              <EventStep active={step === 'names'}>
                <QuestionTitle title="Nome dos passageiros" description="O telefone e opcional. O nome ajuda o motorista a conferir o bilhete." />
                <div className="max-h-[21rem] space-y-3 overflow-y-auto pr-1">
                  {companions.map((companion, index) => (
                    <div key={index} className="rounded-2xl border border-white/12 bg-white/10 p-3">
                      <p className="mb-2 text-sm font-black text-lime-50">Passageiro {index + 2}</p>
                      <div className="grid gap-2 sm:grid-cols-[1fr_12rem]">
                        <Input
                          value={companion.name}
                          onChange={(event) => {
                            const next = [...companions];
                            next[index] = { ...next[index], name: event.target.value };
                            setPassengerNamesConfirmed(false);
                            setCompanions(next);
                          }}
                          placeholder="Nome completo"
                          className="h-11 border-white/20 bg-white text-gray-950"
                        />
                        <Input
                          value={companion.phone}
                          onChange={(event) => {
                            const next = [...companions];
                            next[index] = { ...next[index], phone: event.target.value };
                            setPassengerNamesConfirmed(false);
                            setCompanions(next);
                          }}
                          placeholder="Telefone opcional"
                          className="h-11 border-white/20 bg-white text-gray-950"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  onClick={() => setPassengerNamesConfirmed(true)}
                  disabled={companions.some((companion) => !companion.name.trim())}
                  className="mt-5 h-12 w-full rounded-2xl bg-[#dfff84] font-black text-green-950 hover:bg-lime-200 disabled:opacity-60"
                >
                  Continuar
                </Button>
              </EventStep>

              <EventStep active={step === 'review'}>
                <QuestionTitle title="Esta tudo pronto" description="Vamos escolher automaticamente os lugares disponiveis e abrir o pagamento." />
                <div className="space-y-3 rounded-[1.5rem] border border-white/15 bg-white/10 p-4 text-sm font-bold text-lime-50">
                  <SummaryRow label="Data" value={selectedDateMeta?.label || ''} />
                  <SummaryRow label="Tipo" value={directionOptions.find((option) => option.value === direction)?.title || ''} />
                  {outboundPoint && <SummaryRow label="Ida" value={getSelectedOptionLabel(outboundOptions, outboundPoint)} />}
                  {returnPoint && <SummaryRow label="Volta" value={getSelectedOptionLabel(returnOptions, returnPoint)} />}
                  <SummaryRow label="Total" value={`${totalPassengers} passageiro${totalPassengers === 1 ? '' : 's'}`} />
                </div>
                <Button
                  type="button"
                  onClick={continueToCheckout}
                  disabled={buildingBooking || loadingTrips}
                  className="mt-5 h-14 w-full rounded-2xl bg-[#dfff84] py-6 text-base font-black text-green-950 hover:bg-lime-200"
                >
                  {buildingBooking ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      A escolher lugares...
                    </>
                  ) : (
                    <>
                      Ir para pagamento
                      <ArrowRight className="h-5 w-5" />
                    </>
                  )}
                </Button>
              </EventStep>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
              <div className="flex items-center gap-2 text-xs font-bold text-lime-100/80">
                <UsersRound className="h-4 w-4" />
                Voce + {companionCount} passageiro{companionCount === 1 ? '' : 's'}
              </div>
              {step !== 'date' && (
                <button
                  type="button"
                  onClick={() => {
                    if (step === 'direction') setEventDate('');
                    else if (step === 'outbound-point') setDirection('');
                    else if (step === 'outbound-time') setOutboundPlace('');
                    else if (step === 'return-point') {
                      if (needsOutbound) setOutboundPoint('');
                      else setDirection('');
                    } else if (step === 'return-time') {
                      setReturnPlace('');
                    } else if (step === 'count') {
                      if (needsReturn) setReturnPoint('');
                      else setOutboundPoint('');
                    } else if (step === 'names') {
                      setPassengerCountConfirmed(false);
                      setPassengerNamesConfirmed(false);
                    } else {
                      setPassengerNamesConfirmed(false);
                    }
                  }}
                  className="rounded-full border border-white/15 px-4 py-2 text-sm font-bold text-lime-50 transition hover:bg-white/10"
                >
                  Voltar
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function QuestionTitle({ title, description }) {
  return (
    <div className="mb-5">
      <h2 className="text-2xl font-black leading-tight text-white sm:text-3xl">{title}</h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-lime-50/78">{description}</p>
    </div>
  );
}

function ChoiceButton({ title, detail, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center justify-between gap-4 rounded-[1.4rem] border border-white/12 bg-white/10 p-4 text-left shadow-lg shadow-black/10 transition duration-300 hover:-translate-y-0.5 hover:border-lime-200 hover:bg-[#dfff84] hover:text-green-950"
    >
      <span>
        <span className="block text-lg font-black">{title}</span>
        <span className="mt-1 block text-sm font-semibold text-lime-50/75 group-hover:text-green-900/70">{detail}</span>
      </span>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-green-950">
        <ArrowRight className="h-5 w-5" />
      </span>
    </button>
  );
}

function PlaceChoices({ options, emptyText, onSelect }) {
  if (!options.length) {
    return (
      <div className="rounded-2xl border border-amber-200/40 bg-amber-300/15 p-4 text-sm font-bold text-amber-50">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onSelect(option.value)}
          className="group grid w-full grid-cols-[1fr_auto] items-center gap-4 rounded-[1.4rem] border border-white/12 bg-white/10 p-4 text-left transition duration-300 hover:-translate-y-0.5 hover:border-lime-200 hover:bg-[#dfff84] hover:text-green-950"
        >
          <span>
            <span className="flex items-center gap-2 text-lg font-black">
              <MapPin className="h-5 w-5 text-lime-200 group-hover:text-green-950" />
              {option.title}
            </span>
            {option.detail && (
              <span className="mt-1 block text-xs font-bold text-lime-50/72 group-hover:text-green-900/70">
                {option.detail}
              </span>
            )}
          </span>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-green-950">
            <ArrowRight className="h-5 w-5" />
          </span>
        </button>
      ))}
    </div>
  );
}

function PointChoices({ options, emptyText, onSelect }) {
  if (!options.length) {
    return (
      <div className="rounded-2xl border border-amber-200/40 bg-amber-300/15 p-4 text-sm font-bold text-amber-50">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onSelect(option.value)}
          className="group grid w-full grid-cols-[1fr_auto] items-center gap-4 rounded-[1.4rem] border border-white/12 bg-white/10 p-4 text-left transition duration-300 hover:-translate-y-0.5 hover:border-lime-200 hover:bg-[#dfff84] hover:text-green-950"
        >
          <span>
            <span className="flex items-center gap-2 text-lg font-black">
              <MapPin className="h-5 w-5 text-lime-200 group-hover:text-green-950" />
              {option.title}
            </span>
            {option.detail && (
              <span className="mt-1 block text-xs font-bold text-lime-50/72 group-hover:text-green-900/70">
                {option.detail}
              </span>
            )}
            <span className="mt-2 block text-sm font-bold text-lime-50/78 group-hover:text-green-900/70">
              Saida {option.time} - chegada {option.arrival}
            </span>
            <span className="mt-1 block text-xs font-bold text-lime-100/70 group-hover:text-green-900/60">
              {option.availableSeats} lugares disponiveis neste horario
            </span>
          </span>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-green-950">
            <Check className="h-5 w-5" />
          </span>
        </button>
      ))}
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-lime-100/70">{label}</span>
      <span className="text-right text-white">{value}</span>
    </div>
  );
}

export default function MangaisPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07180d] text-white">A carregar...</div>}>
      <MangaisEventFlow />
    </Suspense>
  );
}
