'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, AlertCircle, Bus, Plug, Wifi, Wind } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import SearchForm from '@/components/search-form';
import { getClosedTodayPurchaseMessage, isDatePurchasable } from '@/lib/purchase-date';

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
    <Card
      key={trip.id}
      className={`overflow-hidden border-l-4 shadow-md transition-shadow duration-300 hover:shadow-xl ${
        isSelected ? 'border-green-500 bg-green-50 dark:bg-green-900/10' : 'border-yellow-500'
      }`}
    >
      <div className="flex items-center gap-3 border-b border-gray-100 px-6 pb-2 pt-4 dark:border-gray-700">
        {trip.buses.companies.logo_url ? (
          <img src={trip.buses.companies.logo_url} alt={trip.buses.companies.name} className="h-auto max-h-20 w-auto max-w-[160px] object-contain" />
        ) : (
          <span className="text-lg font-bold text-gray-800 dark:text-white">{trip.buses.companies.name}</span>
        )}
      </div>

      <CardContent className="grid grid-cols-1 items-center gap-6 p-6 md:grid-cols-5">
        <div className="md:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-left">
              <p className="text-2xl font-bold text-gray-800 dark:text-white">{formatTime(trip.departure_time)}</p>
              <p className="text-lg font-extrabold tracking-normal text-gray-950 dark:text-white md:text-xl">
                {trip.routes.origin_city}
              </p>
            </div>
            <div className="flex-grow px-4 text-center">
              <div className="relative">
                <div className="w-full border-t-2 border-dashed border-gray-300 dark:border-gray-600" />
                <Bus className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 bg-white px-1 text-yellow-500 dark:bg-gray-800" />
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {formatDuration(trip.departure_time, trip.arrival_time)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-800 dark:text-white">{formatTime(trip.arrival_time)}</p>
              <p className="text-lg font-extrabold tracking-normal text-gray-950 dark:text-white md:text-xl">
                {trip.routes.destination_city}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1 text-sm text-gray-500 dark:text-gray-400">
            <span><span className="font-semibold">Classe:</span> {translateSeatClass(trip.seat_class)}</span>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center space-y-2 border-l border-r border-gray-200 px-4 dark:border-gray-700 md:col-span-1">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Comodidades</h4>
          <div className="flex gap-3">
            {trip.buses.amenities?.length ? (
              trip.buses.amenities.map((amenity) => {
                const amenityConfig = amenityIcons[amenity];
                if (!amenityConfig) return null;
                const AmenityIcon = amenityConfig.icon;
                return <AmenityIcon key={amenity} className="h-5 w-5 text-yellow-500" title={amenityConfig.label} />;
              })
            ) : (
              <p className="text-xs text-gray-500">Nenhuma</p>
            )}
          </div>
        </div>

        <div className="text-center md:col-span-1 md:text-right">
          <p className="text-sm text-gray-500">Preco</p>
          <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
            {Number(trip.price_usd) === 0 ? 'Gratuito' : `${trip.price_usd.toFixed(2)} Kz`}
          </p>
          <p className="mb-3 text-xs text-gray-500">
            {trip.available_seats} {trip.available_seats === 1 ? 'lugar disponivel' : 'lugares disponiveis'}
          </p>
          <Button
            onClick={() => onSelect(trip)}
            className={`w-full text-white md:w-auto ${isSelected ? 'bg-green-500 hover:bg-green-600' : 'bg-yellow-500 hover:bg-yellow-600'}`}
          >
            {isSelected ? 'Selecionado' : 'Selecionar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen">
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <button
          onClick={() => router.back()}
          className="mb-4 flex items-center gap-2 text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Voltar</span>
        </button>

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
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-yellow-500 border-r-transparent" />
              <p className="mt-4 text-gray-600 dark:text-gray-400">A carregar viagens...</p>
            </div>
          ) : (
            <>
              <div>
                <h2 className="mb-4 text-2xl font-bold text-gray-800 dark:text-white">
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
                <div id="return-trips" className="border-t-2 pt-8">
                  <h2 className="mb-4 text-2xl font-bold text-gray-800 dark:text-white">Viagens de Volta</h2>
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
                          <Button type="button" onClick={handleContinueToBooking} className="bg-yellow-500 text-white hover:bg-yellow-600">
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
