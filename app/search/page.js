'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Wifi, Wind, Plug, Bus, AlertCircle, CalendarDays, Leaf, MapPin, Music2 } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import SearchForm from '@/components/search-form';
import { getClosedTodayPurchaseMessage, isDatePurchasable } from '@/lib/purchase-date';
import { filterAllowedMangaisReturnSaleTrips, filterOpenMangaisSaleTrips } from '@/lib/mangais-sales-visibility';

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
  const normalizedOrigin = origin.toLowerCase();
  const normalizedDestination = destination.toLowerCase();
  const isMangaisCampaign =
    ['2026-06-20', '2026-06-21'].includes(date) &&
    normalizedOrigin.includes('luanda') &&
    normalizedDestination.includes('barra') &&
    normalizedDestination.includes('cuanza');
  const campaignDateLabel = date === '2026-06-20' ? '20 de Junho' : '21 de Junho';

  const fetchTrips = useCallback(async (origin, destination, date, isReturn = false) => {
    if (!origin || !destination || !date) return [];

    try {
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
        .order('departure_time', { ascending: true });

      query = query.ilike('routes.origin_province', `%${origin}%`);
      query = query.ilike('routes.destination_province', `%${destination}%`);

      const startOfDay = new Date(`${date}T00:00:00`);
      const endOfDay = new Date(`${date}T23:59:59.999`);
      query = query
        .gte('departure_time', startOfDay.toISOString())
        .lte('departure_time', endOfDay.toISOString());

      const { data, error: tripError } = await query;

      if (tripError) throw tripError;
      return filterAllowedMangaisReturnSaleTrips(filterOpenMangaisSaleTrips(data || []));
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
        // Fetch outbound trips
        const outbound = await fetchTrips(origin, destination, date);
        setOutboundTrips(outbound);
        setSelectedOutboundTrip(null);
        setSelectedReturnTrip(null);

        // Fetch return trips if round-trip
        if (isRoundTrip) {
          const returns = await fetchTrips(destination, origin, returnDate, true);
          setReturnTrips(returns);
        } else {
          setReturnTrips([]);
        }
      } catch (err) {
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
      setSelectedReturnTrip(null);
      // Scroll to return trips section
      setTimeout(() => {
        document.getElementById('return-trips')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    } else {
      router.push(`/booking?outboundTripId=${trip.id}`);
    }
  };

  const handleSelectReturnTrip = (returnTrip) => {
    setSelectedReturnTrip(returnTrip);
  };

  const handleContinueToBooking = () => {
    if (!selectedOutboundTrip || !selectedReturnTrip) return;
    router.push(`/booking?outboundTripId=${selectedOutboundTrip.id}&returnTripId=${selectedReturnTrip.id}`);
  };

  const getCampaignBoardingPoint = useCallback((originCity = '') => {
    const normalizedCity = originCity.toLowerCase();

    if (normalizedCity.includes('gamek')) {
      return {
        title: 'Gamek - Nosso centro',
        detail: '(Terminal Interprovincial)',
      };
    }

    if (normalizedCity.includes('kilamba')) {
      return {
        title: 'Kilamba - Próximo das Autarquias',
        detail: null,
      };
    }

    return null;
  }, []);

  const getTripGroupKey = useCallback((trip) => {
    const departure = new Date(trip.departure_time);
    const day = departure.toISOString().slice(0, 10);
    const time = departure.toISOString().slice(11, 16);
    const route = `${trip.routes.origin_city}->${trip.routes.destination_city}`;
    const boardingPoint = getCampaignBoardingPoint(trip.routes.origin_city)?.title || trip.routes.origin_city;
    return `${route}|${day}|${time}|${boardingPoint}`;
  }, [getCampaignBoardingPoint]);

  const groupCampaignTrips = useCallback((trips) => {
    if (!isMangaisCampaign) return trips;

    const groups = new Map();
    [...trips]
      .sort((a, b) => {
        const departureDiff = new Date(a.departure_time).getTime() - new Date(b.departure_time).getTime();
        if (departureDiff !== 0) return departureDiff;

        const createdDiff = new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
        if (createdDiff !== 0) return createdDiff;

        return String(a.id).localeCompare(String(b.id));
      })
      .forEach((trip) => {
        const key = getTripGroupKey(trip);
        if (!groups.has(key)) groups.set(key, trip);
      });

    return [...groups.values()];
  }, [getTripGroupKey, isMangaisCampaign]);

  const visibleOutboundTrips = useMemo(() => {
    if (isRoundTrip && selectedOutboundTrip) return [selectedOutboundTrip];
    return groupCampaignTrips(outboundTrips);
  }, [groupCampaignTrips, isRoundTrip, selectedOutboundTrip, outboundTrips]);

  const visibleReturnTrips = useMemo(() => {
    if (selectedReturnTrip) return [selectedReturnTrip];
    return groupCampaignTrips(returnTrips);
  }, [groupCampaignTrips, selectedReturnTrip, returnTrips]);

  const renderTripCard = (trip, onSelect, isSelected = false) => {
    const campaignBoardingPoint = isMangaisCampaign
      ? getCampaignBoardingPoint(trip.routes.origin_city)
      : null;

    return (
    <Card 
      key={trip.id} 
      className={`shadow-md hover:shadow-xl transition-shadow duration-300 overflow-hidden border-l-4 ${
        isSelected
          ? 'border-green-500 bg-green-50 dark:bg-green-900/10'
          : isMangaisCampaign
            ? 'border-lime-300 bg-white/95 dark:bg-green-950/40'
            : 'border-yellow-500'
      }`}
    >
      <div className={`flex items-center gap-3 px-6 pt-4 pb-2 border-b ${
        isMangaisCampaign ? 'border-green-100 bg-green-50/70 dark:border-lime-100/10 dark:bg-green-950/30' : 'border-gray-100 dark:border-gray-700'
      }`}>
        {trip.buses.companies.logo_url ? (
          <img src={trip.buses.companies.logo_url} alt={trip.buses.companies.name} className="h-auto w-auto max-h-20 max-w-[160px] object-contain" />
        ) : (
          <span className="text-lg font-bold text-gray-800 dark:text-white">{trip.buses.companies.name}</span>
        )}
      </div>
      <CardContent className="p-6 grid grid-cols-1 md:grid-cols-5 gap-6 items-center">
        <div className="md:col-span-3">
          <div className="flex justify-between items-center mb-4">
            <div className="text-left">
              <p className="text-2xl font-bold text-gray-800 dark:text-white">
                {formatTime(trip.departure_time)}
              </p>
              {campaignBoardingPoint ? (
                <div className="max-w-[8.5rem] md:max-w-[13rem]">
                  <p className="text-base font-extrabold leading-tight text-gray-950 dark:text-white md:text-xl">
                    {campaignBoardingPoint.title}
                  </p>
                  {campaignBoardingPoint.detail && (
                    <p className="mt-0.5 text-[0.68rem] font-bold leading-snug text-green-700 dark:text-lime-200 md:text-xs">
                      {campaignBoardingPoint.detail}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-lg md:text-xl font-extrabold text-gray-950 dark:text-white tracking-normal">
                  {trip.routes.origin_city}
                </p>
              )}
            </div>
            <div className="text-center flex-grow px-4">
              <div className="relative">
                <div className={`w-full border-t-2 border-dashed ${isMangaisCampaign ? 'border-lime-500/60 dark:border-lime-200/40' : 'border-gray-300 dark:border-gray-600'}`}></div>
                <Bus className={`w-6 h-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 px-1 ${isMangaisCampaign ? 'text-green-700 dark:text-lime-200' : 'text-yellow-500'}`} />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {formatDuration(trip.departure_time, trip.arrival_time)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-800 dark:text-white">
                {formatTime(trip.arrival_time)}
              </p>
              <p className="text-lg md:text-xl font-extrabold text-gray-950 dark:text-white tracking-normal">
                {trip.routes.destination_city}
              </p>
            </div>
          </div>

          <div className="flex flex-col text-sm text-gray-500 dark:text-gray-400 gap-1">
            <span>
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
                    className={`w-5 h-5 ${isMangaisCampaign ? 'text-green-700 dark:text-lime-200' : 'text-yellow-500'}`}
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
          <p className={`text-3xl font-bold ${isMangaisCampaign ? 'text-green-700 dark:text-lime-200' : 'text-yellow-600 dark:text-yellow-400'}`}>
            {Number(trip.price_usd) === 0 ? 'Gratuito' : `${trip.price_usd.toFixed(2)} Kz`}
          </p>
          <p className="text-xs text-gray-500 mb-3">
            {trip.available_seats} {trip.available_seats === 1 ? 'lugar disponível' : 'lugares disponíveis'}
          </p>
          <Button 
            onClick={() => onSelect(trip)} 
            className={`w-full md:w-auto ${
              isSelected 
                ? 'bg-green-500 hover:bg-green-600' 
                : isMangaisCampaign
                  ? 'bg-green-700 hover:bg-green-800'
                  : 'bg-yellow-500 hover:bg-yellow-600'
            } text-white`}
          >
            {isSelected ? 'Selecionado' : 'Selecionar'}
          </Button>
        </div>
      </CardContent>
    </Card>
    );
  };

  return (
    <div className={`min-h-screen ${isMangaisCampaign ? 'bg-[#07180d] bg-[radial-gradient(circle_at_15%_5%,rgba(223,255,132,0.18),transparent_24%),linear-gradient(180deg,#0d2a15_0%,#f7faf3_24%,#f8fafc_100%)] dark:bg-[linear-gradient(180deg,#07180d_0%,#07180d_100%)]' : ''}`}>
    <div className="w-full max-w-6xl mx-auto py-8 px-4">
      <button 
        onClick={() => router.back()} 
        className={`flex items-center gap-2 mb-4 transition-colors ${
          isMangaisCampaign
            ? 'text-lime-50/90 hover:text-white'
            : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
        }`}
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Voltar</span>
      </button>

      {isMangaisCampaign && (
        <section className="relative mb-6 overflow-hidden rounded-3xl border border-lime-100/20 bg-green-950 text-white shadow-2xl shadow-green-950/20">
          <Image
            src="/wallpaper.jpg"
            alt=""
            fill
            sizes="100vw"
            className="object-cover opacity-20"
          />
          <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(5,32,14,0.96),rgba(9,73,28,0.88))]" />
          <div className="relative grid gap-5 p-5 sm:p-7 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#dfff84] px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-green-950">
                <Music2 className="h-4 w-4" />
                Brunch Mangais
              </div>
              <h1 className="text-3xl font-black leading-tight sm:text-4xl">
                Viagens para Mangais
              </h1>
              <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-lime-50/88 sm:text-base">
                A Nawabus leva-te de Luanda até Mangais <span className="text-xs sm:text-sm">(Barra do Cuanza)</span>. Escolhe o horário ideal e continua para garantir o teu lugar.
              </p>
            </div>
            <div className="grid gap-2 rounded-2xl border border-lime-100/20 bg-white/10 p-4 text-sm font-bold backdrop-blur-md">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-[#dfff84]" />
                {campaignDateLabel} de 2026
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-[#dfff84]" />
                Luanda - Mangais
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#dfff84]" />
                <span className="leading-5">
                  Gamek - Nosso centro <span className="text-xs">(Terminal Interprovincial)</span><br />
                  Kilamba - Próximo das Autarquias
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Leaf className="h-5 w-5 text-[#dfff84]" />
                Evento especial
              </div>
            </div>
          </div>
        </section>
      )}

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
            <div className={`inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-r-transparent ${isMangaisCampaign ? 'border-green-700' : 'border-yellow-500'}`}></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">A carregar viagens...</p>
          </div>
        ) : (
          <>
            {/* Outbound Trips Section */}
            <div>
              <h2 className={`text-2xl font-bold mb-4 ${isMangaisCampaign ? 'text-green-950 dark:text-white' : 'text-gray-800 dark:text-white'}`}>
                {isRoundTrip ? 'Viagens de Ida' : 'Viagens Disponíveis'}
              </h2>
              {visibleOutboundTrips.length > 0 ? (
                <div className="space-y-4">
                  {visibleOutboundTrips.map((trip) => renderTripCard(
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
                  <AlertDescription>
                    Não há viagens de ida disponíveis para a data selecionada.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Return Trips Section */}
            {isRoundTrip && selectedOutboundTrip && (
              <div id="return-trips" className="pt-8 border-t-2">
                <h2 className={`text-2xl font-bold mb-4 ${isMangaisCampaign ? 'text-green-950 dark:text-white' : 'text-gray-800 dark:text-white'}`}>
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
                    {visibleReturnTrips.map((trip) => renderTripCard(
                      trip,
                      handleSelectReturnTrip,
                      selectedReturnTrip?.id === trip.id
                    ))}
                    {selectedReturnTrip && (
                      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setSelectedReturnTrip(null)}
                        >
                          Alterar viagem de volta
                        </Button>
                        <Button
                          type="button"
                          onClick={handleContinueToBooking}
                          className={isMangaisCampaign ? 'bg-green-700 hover:bg-green-800 text-white' : 'bg-yellow-500 hover:bg-yellow-600 text-white'}
                        >
                          Continuar para escolher lugares
                        </Button>
                      </div>
                    )}
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
