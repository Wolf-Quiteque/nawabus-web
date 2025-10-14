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

  const [trips, setTrips] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Extract search parameters
  const origin = searchParams.get('origin')?.trim() || '';
  const destination = searchParams.get('destination')?.trim() || '';
  const date = searchParams.get('date')?.trim() || '';

  // Fetch routes as fallback
  const fetchRoutes = async () => {
    try {
      let routeQuery = supabase
        .from('routes')
        .select('id, origin_city, destination_city, base_price_usd, estimated_duration_hours, distance_km, typical_departure_times')
        .eq('is_active', true);

      if (origin) {
        routeQuery = routeQuery.ilike('origin_city', `%${origin}%`);
      }
      if (destination) {
        routeQuery = routeQuery.ilike('destination_city', `%${destination}%`);
      }

      const { data, error: routeError } = await routeQuery;

      if (routeError) throw routeError;

      setRoutes(data || []);
      setTrips([]);
    } catch (err) {
      console.error('Error fetching routes:', err);
      setRoutes([]);
    }
  };

  // Fetch trips with improved query structure
  const fetchTrips = useCallback(async () => {
    if (!origin && !destination && !date) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Build the query dynamically
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
            companies!inner (
              name
            )
          )
        `)
        .eq('status', 'scheduled')
        .gt('available_seats', 0)
        .order('departure_time', { ascending: true });

      // Apply filters
      if (origin) {
        query = query.ilike('routes.origin_city', `%${origin}%`);
      }
      if (destination) {
        query = query.ilike('routes.destination_city', `%${destination}%`);
      }
      if (date) {
        const startOfDay = new Date(`${date}T00:00:00`);
        const endOfDay = new Date(`${date}T23:59:59.999`);
        query = query
          .gte('departure_time', startOfDay.toISOString())
          .lte('departure_time', endOfDay.toISOString());
      }

      const { data, error: tripError } = await query;

      if (tripError) throw tripError;

      if (data && data.length > 0) {
        setTrips(data);
        setRoutes([]);
      } else {
        // No trips found: just clear routes and show message on UI
        setTrips([]);
        setRoutes([]);
      }
    } catch (err) {
      console.error('Error fetching trips:', err);
      setError('Erro ao carregar viagens. Por favor, tente novamente.');
      setTrips([]);
      setRoutes([]);
    } finally {
      setLoading(false);
    }
  }, [origin, destination, date, supabase]);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  // Helper function to format duration
  const formatDuration = (departureTime, arrivalTime) => {
    const hours = (new Date(arrivalTime).getTime() - new Date(departureTime).getTime()) / (1000 * 60 * 60);
    return `${hours.toFixed(1)}h`;
  };

  // Helper function to format time
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  };

  const handleSelectTrip = (tripId) => {
    router.push(`/booking/${tripId}`);
  };

  const handleExploreRoute = (originCity, destinationCity) => {
    const params = new URLSearchParams({
      origin: originCity,
      destination: destinationCity
    });
    router.push(`/search?${params.toString()}`);
  };

  // Amenity icons mapping
  const amenityIcons = {
    wifi: { icon: Wifi, label: 'Wi-Fi' },
    ac: { icon: Wind, label: 'Ar Condicionado' },
    power_outlets: { icon: Plug, label: 'Tomadas' }
  };

  // Helper to translate seat class
  const translateSeatClass = (seatClass) => {
    const translations = {
      economy: 'Económica',
      business: 'Executiva',
      first: 'Primeira Classe'
    };
    return translations[seatClass] || seatClass;
  };

  return (
    <div className="w-full max-w-6xl mx-auto py-8 px-4">
      {/* Back button */}
      <button 
        onClick={() => router.back()} 
        className="flex items-center gap-2 mb-4 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Voltar</span>
      </button>

      {/* Search form */}
      <div className="mb-8">
        <SearchForm />
      </div>

      {/* Error message */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Results */}
      <div className="space-y-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-orange-500 border-r-transparent"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">A carregar viagens...</p>
          </div>
        ) : trips.length > 0 ? (
          // Display trips
          trips.map((trip) => (
            <Card key={trip.id} className="shadow-md hover:shadow-xl transition-shadow duration-300 overflow-hidden border-l-4 border-orange-500">
              <CardContent className="p-6 grid grid-cols-1 md:grid-cols-5 gap-6 items-center">
                {/* Trip Details */}
                <div className="md:col-span-3">
                  {/* Time and Location */}
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

                  {/* Trip Info */}
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

                {/* Amenities */}
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

                {/* Price and CTA */}
                <div className="md:col-span-1 text-center md:text-right">
                  <p className="text-sm text-gray-500">Preço</p>
                  <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                    {trip.price_usd.toFixed(2)} Kz
                  </p>
                  <p className="text-xs text-gray-500 mb-3">
                    {trip.available_seats} {trip.available_seats === 1 ? 'lugar disponível' : 'lugares disponíveis'}
                  </p>
                  <Button 
                    onClick={() => handleSelectTrip(trip.id)} 
                    className="w-full md:w-auto bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    Selecionar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : ((origin || destination || date) ? (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Não há viagens agendadas para a data selecionada. Veja as rotas disponíveis:
            </AlertDescription>
          </Alert>
        ) : null)}
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
