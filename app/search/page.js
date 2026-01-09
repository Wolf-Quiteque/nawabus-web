'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Wifi, Wind, Plug, Bus, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import SearchForm from '@/components/search-form';

function SearchResults() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [outboundTrips, setOutboundTrips] = useState([]);
  const [returnTrips, setReturnTrips] = useState([]);
  const [selectedOutboundTrip, setSelectedOutboundTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const origin = searchParams.get('origin')?.trim() || '';
  const destination = searchParams.get('destination')?.trim() || '';
  const date = searchParams.get('date')?.trim() || '';
  const returnDate = searchParams.get('returnDate')?.trim() || '';
  const tripType = searchParams.get('tripType') || 'one-way';

  const isRoundTrip = tripType === 'round-trip' && returnDate;

  const fetchTrips = useCallback(async (origin, destination, date, isReturn = false) => {
    if (!origin || !destination || !date) return [];

    try {
      let query = supabase
        .from('trips')
        .select(`
          id,
          departure_time,
          arrival_time,
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
            license_plate,
            companies!inner (
              name
            )
          )
        `)
        .eq('status', 'scheduled')
        .gt('available_seats', 0)
        .order('departure_time', { ascending: true });

      query = query.or(
  `origin_city.ilike.%${origin}%,origin_province.ilike.%${origin}%`,
  { foreignTable: 'routes' } // sometimes this key is `referencedTable`
);

query = query.or(
  `destination_city.ilike.%${destination}%,destination_province.ilike.%${destination}%`,
  { foreignTable: 'routes' }
);


      const startOfDay = new Date(`${date}T00:00:00`);
      const endOfDay = new Date(`${date}T23:59:59.999`);
      query = query
        .gte('departure_time', startOfDay.toISOString())
        .lte('departure_time', endOfDay.toISOString());

      const { data, error: tripError } = await query;

      if (tripError) throw tripError;
      return data || [];
    } catch (err) {
      console.error('Error fetching trips:', err);
      throw err;
    }
  }, [supabase]);

  useEffect(() => {
    const loadTrips = async () => {
      if (!origin || !destination || !date) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Fetch outbound trips
        const outbound = await fetchTrips(origin, destination, date);
        setOutboundTrips(outbound);

        // Fetch return trips if round-trip
        if (isRoundTrip) {
          const returns = await fetchTrips(destination, origin, returnDate, true);
          setReturnTrips(returns);
        }
      } catch (err) {
        setError('Erro ao carregar viagens. Por favor, tente novamente.');
        setOutboundTrips([]);
        setReturnTrips([]);
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
    power_outlets: { icon: Plug, label: 'Tomadas' }
  };

  const translateSeatClass = (seatClass) => {
    const translations = {
      economy: 'Económica',
      business: 'Executiva',
      first: 'Primeira Classe'
    };
    return translations[seatClass] || seatClass;
  };

  const handleSelectOutboundTrip = (trip) => {
    if (isRoundTrip) {
      setSelectedOutboundTrip(trip);
      // Scroll to return trips section
      document.getElementById('return-trips')?.scrollIntoView({ behavior: 'smooth' });
    } else {
      router.push(`/booking?outboundTripId=${trip.id}`);
    }
  };

  const handleSelectReturnTrip = (returnTrip) => {
    if (selectedOutboundTrip) {
      router.push(`/booking?outboundTripId=${selectedOutboundTrip.id}&returnTripId=${returnTrip.id}`);
    }
  };

  const renderTripCard = (trip, onSelect, isSelected = false) => (
    <Card 
      key={trip.id} 
      className={`shadow-md hover:shadow-xl transition-shadow duration-300 overflow-hidden border-l-4 ${
        isSelected ? 'border-green-500 bg-green-50 dark:bg-green-900/10' : 'border-orange-500'
      }`}
    >
      <CardContent className="p-6 grid grid-cols-1 md:grid-cols-5 gap-6 items-center">
        <div className="md:col-span-3">
          <div className="flex justify-between items-center mb-4">
            <div className="text-left">
              <p className="text-2xl font-bold text-gray-800 dark:text-white">
                {formatTime(trip.departure_time)}
              </p>
              <p className="text-md text-gray-600 dark:text-gray-400">
                {trip.routes.origin_city}
              </p>
            </div>
            <div className="text-center flex-grow px-4">
              <div className="relative">
                <div className="w-full border-t-2 border-dashed border-gray-300 dark:border-gray-600"></div>
                <Bus className="w-6 h-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 text-orange-500 px-1" />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {formatDuration(trip.departure_time, trip.arrival_time)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-800 dark:text-white">
                {formatTime(trip.arrival_time)}
              </p>
              <p className="text-md text-gray-600 dark:text-gray-400">
                {trip.routes.destination_city}
              </p>
            </div>
          </div>

          <div className="flex flex-col text-sm text-gray-500 dark:text-gray-400 gap-1">
            <span>
              <span className="font-semibold">Operador:</span>{' '}
              {trip.buses.companies.name} - {trip.buses.make} {trip.buses.model}
            </span>
            <span>
              <span className="font-semibold">Distância:</span>{' '}
              {trip.routes.distance_km ? `${trip.routes.distance_km.toFixed(0)} km` : 'N/A'}
              {' • '}
              <span className="font-semibold">Classe:</span>{' '}
              {translateSeatClass(trip.seat_class)}
            </span>
          </div>
        </div>

        <div className="md:col-span-1 flex flex-col items-center justify-center space-y-2 border-l border-r border-gray-200 dark:border-gray-700 px-4">
          <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300">Comodidades</h4>
          <div className="flex gap-3">
            {trip.buses.amenities && trip.buses.amenities.length > 0 ? (
              trip.buses.amenities.map((amenity) => {
                const amenityConfig = amenityIcons[amenity];
                if (!amenityConfig) return null;
                const AmenityIcon = amenityConfig.icon;
                return (
                  <AmenityIcon 
                    key={amenity} 
                    className="w-5 h-5 text-orange-500" 
                    title={amenityConfig.label} 
                  />
                );
              })
            ) : (
              <p className="text-xs text-gray-500">Nenhuma</p>
            )}
          </div>
        </div>

        <div className="md:col-span-1 text-center md:text-right">
          <p className="text-sm text-gray-500">Preço</p>
          <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">
            {trip.price_usd.toFixed(2)} Kz
          </p>
          <p className="text-xs text-gray-500 mb-3">
            {trip.available_seats} {trip.available_seats === 1 ? 'lugar disponível' : 'lugares disponíveis'}
          </p>
          <Button 
            onClick={() => onSelect(trip)} 
            className={`w-full md:w-auto ${
              isSelected 
                ? 'bg-green-500 hover:bg-green-600' 
                : 'bg-orange-500 hover:bg-orange-600'
            } text-white`}
          >
            {isSelected ? '✓ Selecionado' : 'Selecionar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="w-full max-w-6xl mx-auto py-8 px-4">
      <button 
        onClick={() => router.back()} 
        className="flex items-center gap-2 mb-4 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
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
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-orange-500 border-r-transparent"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">A carregar viagens...</p>
          </div>
        ) : (
          <>
            {/* Outbound Trips Section */}
            <div>
              <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">
                {isRoundTrip ? 'Viagens de Ida' : 'Viagens Disponíveis'}
              </h2>
              {outboundTrips.length > 0 ? (
                <div className="space-y-4">
                  {outboundTrips.map((trip) => renderTripCard(
                    trip, 
                    handleSelectOutboundTrip,
                    selectedOutboundTrip?.id === trip.id
                  ))}
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Não há viagens de ida disponíveis para a data selecionada.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Return Trips Section */}
            {isRoundTrip && selectedOutboundTrip && (
              <div id="return-trips" className="pt-8 border-t-2">
                <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">
                  Viagens de Volta
                </h2>
                <Alert className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Você selecionou a viagem de ida. Agora escolha sua viagem de volta.
                  </AlertDescription>
                </Alert>
                {returnTrips.length > 0 ? (
                  <div className="space-y-4">
                    {returnTrips.map((trip) => renderTripCard(trip, handleSelectReturnTrip))}
                  </div>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Não há viagens de volta disponíveis para a data selecionada.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </>
        )}
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