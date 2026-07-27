'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, AlertCircle, Bus, Plug, Wifi, Wind } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import SearchForm from '@/components/search-form';
import { getClosedTodayPurchaseMessage, isDatePurchasable } from '@/lib/purchase-date';
import { formatKzOrFree } from '@/lib/currency';

function SearchResults() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [outboundTrips, setOutboundTrips] = useState([]);
  const [returnTrips, setReturnTrips] = useState([]);
  const [selectedOutboundTrip, setSelectedOutboundTrip] = useState(null);
  const [selectedReturnTrip, setSelectedReturnTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const origin = searchParams.get('origin')?.trim() || '';
  const destination = searchParams.get('destination')?.trim() || '';
  const date = searchParams.get('date')?.trim() || '';
  const returnDate = searchParams.get('returnDate')?.trim() || '';
  const tripType = searchParams.get('tripType') || 'one-way';
  const isRoundTrip = tripType === 'round-trip' && returnDate;

  const fetchTrips = useCallback(async (tripOrigin, tripDestination, tripDate) => {
    if (!tripOrigin || !tripDestination || !tripDate) return [];

    let query = supabase
      .from('trips')
      .select(`
        id,
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
          distance_km,
          estimated_duration_hours
        ),
        buses!inner (
          make,
          model,
          amenities,
          companies!inner (
            name,
            logo_url
          )
        )
      `)
      .eq('status', 'scheduled')
      .gt('available_seats', 0)
      .ilike('routes.origin_province', `%${tripOrigin}%`)
      .ilike('routes.destination_province', `%${tripDestination}%`)
      .order('departure_time', { ascending: true });

    const startOfDay = new Date(`${tripDate}T00:00:00`);
    const endOfDay = new Date(`${tripDate}T23:59:59.999`);
    query = query
      .gte('departure_time', startOfDay.toISOString())
      .lte('departure_time', endOfDay.toISOString());

    const { data, error: tripError } = await query;
    if (tripError) throw tripError;
    return data || [];
  }, [supabase]);

  useEffect(() => {
    const loadTrips = async () => {
      if (!origin || !destination || !date) {
        setLoading(false);
        return;
      }

      if (!isDatePurchasable(date) || (isRoundTrip && returnDate && !isDatePurchasable(returnDate))) {
        setError(getClosedTodayPurchaseMessage());
        setOutboundTrips([]);
        setReturnTrips([]);
        setSelectedOutboundTrip(null);
        setSelectedReturnTrip(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const outbound = await fetchTrips(origin, destination, date);
        setOutboundTrips(outbound);
        setSelectedOutboundTrip(null);
        setSelectedReturnTrip(null);

        if (isRoundTrip) {
          const returns = await fetchTrips(destination, origin, returnDate);
          setReturnTrips(returns);
        } else {
          setReturnTrips([]);
        }
      } catch (err) {
        console.error('Error fetching trips:', err);
        setError('Erro ao carregar viagens. Por favor, tente novamente.');
        setOutboundTrips([]);
        setReturnTrips([]);
        setSelectedOutboundTrip(null);
        setSelectedReturnTrip(null);
      } finally {
        setLoading(false);
      }
    };

    loadTrips();
  }, [origin, destination, date, returnDate, isRoundTrip, fetchTrips]);

  const formatDuration = (departureTime, arrivalTime) => {
    const hours = (new Date(arrivalTime).getTime() - new Date(departureTime).getTime()) / (1000 * 60 * 60);
    return `${hours.toFixed(1)}h`;
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  };

  const amenityIcons = {
    wifi: { icon: Wifi, label: 'Wi-Fi' },
    ac: { icon: Wind, label: 'Ar Condicionado' },
    power_outlets: { icon: Plug, label: 'Tomadas' },
  };

  const translateSeatClass = (seatClass) => {
    const translations = {
      economy: 'Economica',
      business: 'Executiva',
      first: 'Primeira Classe',
    };
    return translations[seatClass] || seatClass;
  };

  const handleSelectOutboundTrip = (trip) => {
    if (isRoundTrip) {
      setSelectedOutboundTrip(trip);
      setSelectedReturnTrip(null);
      setTimeout(() => {
        document.getElementById('return-trips')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    } else {
      router.push(`/booking?outboundTripId=${trip.id}`);
    }
  };

  const handleContinueToBooking = () => {
    if (!selectedOutboundTrip || !selectedReturnTrip) return;
    router.push(`/booking?outboundTripId=${selectedOutboundTrip.id}&returnTripId=${selectedReturnTrip.id}`);
  };

  const renderTripCard = (trip, onSelect, isSelected = false) => (
    <div
      key={trip.id}
      className={`relative overflow-hidden rounded-2xl text-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${
        isSelected
          ? 'bg-gradient-to-br from-emerald-500 via-green-500 to-green-600'
          : 'bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500'
      }`}
    >
      <div className="flex flex-col md:flex-row">
        {/* ── Main section ── */}
        <div className="flex-1 p-5 md:p-6">
          {/* NawaBus white logo + operator + class chip */}
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <img
                src="/nawabus_logo_white.webp"
                alt="NawaBus"
                className="h-7 w-auto self-start md:h-8"
              />
              {trip.buses.companies.name && (
                <span className="text-[11px] font-medium text-white/75">
                  Operado por {trip.buses.companies.name}
                </span>
              )}
            </div>
            <span className="shrink-0 rounded-full border border-white/40 bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-widest backdrop-blur-sm">
              {translateSeatClass(trip.seat_class)}
            </span>
          </div>

          {/* Route + times */}
          <div className="flex items-center justify-between gap-2">
            <div className="text-left">
              <p className="text-2xl font-black leading-none drop-shadow-sm md:text-3xl">{formatTime(trip.departure_time)}</p>
              <p className="mt-1.5 text-sm font-extrabold uppercase tracking-wide text-white/95 md:text-base">
                {trip.routes.origin_city}
              </p>
            </div>
            <div className="flex-grow px-2 text-center md:px-4">
              <div className="relative">
                <div className="w-full border-t-2 border-dashed border-white/50" />
                <span className={`absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-md ${isSelected ? 'text-green-600' : 'text-amber-600'}`}>
                  <Bus className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-3 text-xs font-semibold text-white/80">
                {formatDuration(trip.departure_time, trip.arrival_time)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black leading-none drop-shadow-sm md:text-3xl">{formatTime(trip.arrival_time)}</p>
              <p className="mt-1.5 text-sm font-extrabold uppercase tracking-wide text-white/95 md:text-base">
                {trip.routes.destination_city}
              </p>
            </div>
          </div>

          {/* Amenities */}
          <div className="mt-5 flex items-center gap-3">
            <span className="text-[11px] font-bold uppercase tracking-widest text-white/70">Comodidades</span>
            <div className="flex items-center gap-2.5">
              {trip.buses.amenities?.length ? (
                trip.buses.amenities.map((amenity) => {
                  const amenityConfig = amenityIcons[amenity];
                  if (!amenityConfig) return null;
                  const AmenityIcon = amenityConfig.icon;
                  return <AmenityIcon key={amenity} className="h-4 w-4 text-white/90" title={amenityConfig.label} />;
                })
              ) : (
                <span className="text-xs text-white/70">Nenhuma</span>
              )}
            </div>
          </div>
        </div>

        {/* ── Perforated stub ── */}
        <div className="relative flex shrink-0 flex-row items-center justify-between gap-3 border-t-2 border-dashed border-white/50 bg-black/10 p-5 text-center md:w-60 md:flex-col md:justify-center md:border-l-2 md:border-t-0 md:p-6">
          {/* Punched notches on the perforation line */}
          <span aria-hidden="true" className="absolute left-0 top-0 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-stone-50 dark:bg-stone-950"></span>
          <span aria-hidden="true" className="absolute right-0 top-0 h-7 w-7 -translate-y-1/2 translate-x-1/2 rounded-full bg-stone-50 dark:bg-stone-950 md:hidden"></span>
          <span aria-hidden="true" className="absolute bottom-0 left-0 hidden h-7 w-7 -translate-x-1/2 translate-y-1/2 rounded-full bg-stone-50 dark:bg-stone-950 md:block"></span>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">Preco</p>
            <p className="text-2xl font-black drop-shadow-sm md:text-3xl">
              {formatKzOrFree(trip.price_usd)}
            </p>
            <p className="mt-0.5 text-xs text-white/80">
              {trip.available_seats} {trip.available_seats === 1 ? 'lugar disponivel' : 'lugares disponiveis'}
            </p>
          </div>

          <div className="flex flex-col items-center gap-2.5">
            <Button
              onClick={() => onSelect(trip)}
              className={`w-full font-black shadow-md transition-transform hover:scale-105 md:w-40 ${
                isSelected
                  ? 'bg-white text-green-600 hover:bg-white'
                  : 'bg-white text-stone-900 hover:bg-amber-50'
              }`}
            >
              {isSelected ? 'Selecionado' : 'Selecionar'}
            </Button>
            {/* Barcode */}
            <div
              aria-hidden="true"
              className="hidden h-7 w-40 opacity-80 md:block"
              style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.95) 0 2px, transparent 2px 5px)' }}
            />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-amber-50/70 via-stone-50 to-amber-50/40 dark:from-stone-950 dark:via-stone-900 dark:to-stone-950 overflow-x-clip">
      {/* Warm glow accents */}
      <div aria-hidden="true" className="absolute top-0 left-1/4 w-96 h-96 bg-amber-200/30 dark:bg-amber-900/10 rounded-full blur-3xl pointer-events-none"></div>
      <div aria-hidden="true" className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-300/20 dark:bg-orange-800/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-8">
        <button
          onClick={() => router.back()}
          className="mb-4 flex items-center gap-2 text-stone-600 transition-colors hover:text-amber-600 dark:text-stone-400 dark:hover:text-amber-400 font-medium"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Voltar</span>
        </button>

        {/* Route header */}
        <div className="mb-6 text-center">
          <span className="text-amber-600 dark:text-amber-400 font-bold tracking-[0.3em] text-xs uppercase">
            A tua viagem
          </span>
          {origin && destination ? (
            <h1 className="mt-2 text-3xl md:text-4xl font-black tracking-tight text-stone-900 dark:text-white flex items-center justify-center gap-3 flex-wrap">
              {origin}
              <svg className="w-7 h-7 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
              <span className="bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">
                {destination}
              </span>
            </h1>
          ) : (
            <h1 className="mt-2 text-3xl md:text-4xl font-black tracking-tight text-stone-900 dark:text-white">
              Pesquisar <span className="bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">viagens</span>
            </h1>
          )}
        </div>

        <div className="mb-8">
          <SearchForm />
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-8">
          {loading ? (
            <div className="py-12 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-amber-500 border-r-transparent" />
              <p className="mt-4 text-gray-600 dark:text-gray-400">A carregar viagens...</p>
            </div>
          ) : (
            <>
              <div>
                <h2 className="mb-4 text-2xl font-black tracking-tight text-stone-900 dark:text-white">
                  {isRoundTrip ? 'Viagens de Ida' : 'Viagens Disponiveis'}
                </h2>
                {outboundTrips.length > 0 ? (
                  <div className="space-y-4">
                    {(isRoundTrip && selectedOutboundTrip ? [selectedOutboundTrip] : outboundTrips).map((trip) => renderTripCard(
                      trip,
                      handleSelectOutboundTrip,
                      selectedOutboundTrip?.id === trip.id
                    ))}
                    {isRoundTrip && selectedOutboundTrip && (
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setSelectedOutboundTrip(null);
                            setSelectedReturnTrip(null);
                          }}
                        >
                          Alterar viagem de ida
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>Nao ha viagens de ida disponiveis para a data selecionada.</AlertDescription>
                  </Alert>
                )}
              </div>

              {isRoundTrip && selectedOutboundTrip && (
                <div id="return-trips" className="border-t-2 border-amber-200 dark:border-stone-700 pt-8">
                  <h2 className="mb-4 text-2xl font-black tracking-tight text-stone-900 dark:text-white">
                    Viagens de Volta
                  </h2>
                  <Alert className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>Voce selecionou a viagem de ida. Agora escolha sua viagem de volta.</AlertDescription>
                  </Alert>
                  {returnTrips.length > 0 ? (
                    <div className="space-y-4">
                      {(selectedReturnTrip ? [selectedReturnTrip] : returnTrips).map((trip) => renderTripCard(
                        trip,
                        setSelectedReturnTrip,
                        selectedReturnTrip?.id === trip.id
                      ))}
                      {selectedReturnTrip && (
                        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                          <Button type="button" variant="outline" onClick={() => setSelectedReturnTrip(null)}>
                            Alterar viagem de volta
                          </Button>
                          <Button type="button" onClick={handleContinueToBooking} className="bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-stone-950 font-bold shadow-md">
                            Continuar para escolher lugares
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>Nao ha viagens de volta disponiveis para a data selecionada.</AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchResults />
    </Suspense>
  );
}
