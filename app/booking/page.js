'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import SeatSelection from '@/components/seat-selection';
import { getClosedTodayPurchaseMessage, isTripPurchasable } from '@/lib/purchase-date';

async function getSiblingIds(supabase, tripId) {
  const { data, error } = await supabase
    .rpc('get_overlapping_trip_ids', { p_trip_id: tripId });
  if (error) {
    console.warn('Unable to resolve sibling trips, falling back to trip itself', error);
    return [tripId];
  }
  return data?.map(t => t.id) ?? [tripId];
}

async function getHeldSeatNumbers(tripIds) {
  if (!tripIds?.length) return [];

  const response = await fetch(`/api/held-seats?trip_ids=${encodeURIComponent(tripIds.join(','))}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    console.warn('Unable to load temporary seat holds');
    return [];
  }

  const result = await response.json();
  return (result.held_seats || []).map(hold => hold.seat_number);
}

function uniqueSeatNumbers(seats) {
  return [...new Set((seats || []).map(seat => Number(seat)).filter(Number.isFinite))];
}

function BookingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [outboundTrip, setOutboundTrip] = useState(null);
  const [returnTrip, setReturnTrip] = useState(null);
  const [outboundOccupiedSeats, setOutboundOccupiedSeats] = useState([]);
  const [returnOccupiedSeats, setReturnOccupiedSeats] = useState([]);
  const [userAlreadyBookedOutbound, setUserAlreadyBookedOutbound] = useState(false);
  const [userAlreadyBookedReturn, setUserAlreadyBookedReturn] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const outboundTripId = searchParams.get('outboundTripId');
  const returnTripId = searchParams.get('returnTripId');

  useEffect(() => {
    console.log('Outbound Trip ID:', outboundTripId);
    console.log('Return Trip ID:', returnTripId);

    if (!outboundTripId) {
      router.push('/');
      return;
    }

    const fetchTripData = async () => {
      setLoading(true);

      try {
        // Fetch outbound trip details (include bus_id for sibling resolution)
        const { data: outboundData, error: outboundError } = await supabase
          .from('trips')
          .select(`
            id,
            bus_id,
            departure_time,
            arrival_time,
            price_usd,
            seat_class,
            routes (
              origin_city,
              destination_city
            ),
            buses (
              capacity
            )
          `)
          .eq('id', outboundTripId)
          .single();

        if (outboundError) throw outboundError;
        if (!isTripPurchasable(outboundData)) {
          alert(getClosedTodayPurchaseMessage());
          router.replace('/');
          return;
        }

        setOutboundTrip(outboundData);

        // Fetch outbound occupied seats across all sibling trips (same bus + departure minute)
        const outboundSiblingIds = await getSiblingIds(supabase, outboundTripId);
        const { data: outboundTickets, error: outboundTicketsError } = await supabase
          .from('tickets')
          .select('seat_number')
          .in('trip_id', outboundSiblingIds)
          .in('status', ['active', 'used']);

        if (outboundTicketsError) throw outboundTicketsError;
        const outboundHeldSeats = await getHeldSeatNumbers(outboundSiblingIds);
        setOutboundOccupiedSeats(uniqueSeatNumbers([
          ...(outboundTickets ? outboundTickets.map(t => t.seat_number) : []),
          ...outboundHeldSeats,
        ]));

        // Check if the current user already has a ticket for this trip
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
          const { data: existingOutbound } = await supabase
            .from('tickets')
            .select('id')
            .in('trip_id', outboundSiblingIds)
            .eq('passenger_id', userData.user.id)
            .in('status', ['active', 'used'])
            .limit(1);
          setUserAlreadyBookedOutbound(existingOutbound && existingOutbound.length > 0);
        }

        // If return trip exists, fetch it too
        if (returnTripId) {
          const { data: returnData, error: returnError } = await supabase
            .from('trips')
            .select(`
              id,
              bus_id,
              departure_time,
              arrival_time,
              price_usd,
              seat_class,
              routes (
                origin_city,
                destination_city
              ),
              buses (
                capacity
              )
            `)
            .eq('id', returnTripId)
            .single();

          if (returnError) throw returnError;
          if (!isTripPurchasable(returnData)) {
            alert(getClosedTodayPurchaseMessage());
            router.replace('/');
            return;
          }

          setReturnTrip(returnData);

          // Fetch return occupied seats across all sibling trips
          const returnSiblingIds = await getSiblingIds(supabase, returnTripId);
          const { data: returnTickets, error: returnTicketsError } = await supabase
            .from('tickets')
            .select('seat_number')
            .in('trip_id', returnSiblingIds)
            .in('status', ['active', 'used']);

          if (returnTicketsError) throw returnTicketsError;
          const returnHeldSeats = await getHeldSeatNumbers(returnSiblingIds);
          setReturnOccupiedSeats(uniqueSeatNumbers([
            ...(returnTickets ? returnTickets.map(t => t.seat_number) : []),
            ...returnHeldSeats,
          ]));

          // Check if user already booked for return trip
          if (userData?.user) {
            const { data: existingReturn } = await supabase
              .from('tickets')
              .select('id')
              .in('trip_id', returnSiblingIds)
              .eq('passenger_id', userData.user.id)
              .in('status', ['active', 'used'])
              .limit(1);
            setUserAlreadyBookedReturn(existingReturn && existingReturn.length > 0);
          }
        }
      } catch (error) {
        console.error('Error fetching trip data:', error);
        alert('Erro ao carregar detalhes da viagem.');
      } finally {
        setLoading(false);
      }
    };

    fetchTripData();
  }, [outboundTripId, returnTripId, supabase, router]);

  if (loading) {
    return (
      <div className="w-full max-w-6xl mx-auto py-8 px-4">
        <div className="text-center py-10">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-amber-500 border-r-transparent"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">A carregar detalhes da viagem...</p>
        </div>
      </div>
    );
  }

  if (!outboundTrip) {
    return (
      <div className="w-full max-w-6xl mx-auto py-8 px-4">
        <div className="text-center py-10">Viagem não encontrada.</div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-stone-50 via-amber-50/40 to-stone-50 dark:from-stone-950 dark:via-stone-900 dark:to-stone-950">
      <div className="relative w-full max-w-6xl mx-auto py-8 px-4">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 mb-4 text-stone-600 hover:text-amber-600 dark:text-stone-400 dark:hover:text-amber-400 font-medium"
      >
        <ArrowLeft />
        <span>Voltar à pesquisa</span>
      </button>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-6 text-xs font-bold uppercase tracking-wider">
        <span className="flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-3 py-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
          Pesquisa
        </span>
        <span className="w-6 h-0.5 bg-amber-300 dark:bg-amber-700 rounded-full"></span>
        <span className="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-stone-950 px-3 py-1.5 shadow-md">
          2 · Lugares
        </span>
        <span className="w-6 h-0.5 bg-stone-300 dark:bg-stone-700 rounded-full"></span>
        <span className="rounded-full bg-stone-200 dark:bg-stone-800 text-stone-500 dark:text-stone-400 px-3 py-1.5">
          3 · Pagamento
        </span>
      </div>

      <h1 className="text-3xl md:text-4xl font-black tracking-tight text-center mb-2 text-stone-900 dark:text-white">
        Escolhe os teus <span className="bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">lugares</span>
      </h1>

      <p className="text-center text-stone-500 dark:text-stone-400 mb-8">
        {returnTrip
          ? `Escolha os seus lugares para a viagem de ${outboundTrip.routes.origin_city} e volta`
          : `Escolha os seus lugares para a viagem de ${outboundTrip.routes.origin_city} para ${outboundTrip.routes.destination_city}`
        }
      </p>

      <SeatSelection
        outboundTrip={outboundTrip}
        returnTrip={returnTrip}
        outboundOccupiedSeats={outboundOccupiedSeats}
        returnOccupiedSeats={returnOccupiedSeats}
        userAlreadyBookedOutbound={userAlreadyBookedOutbound}
        userAlreadyBookedReturn={userAlreadyBookedReturn}
      />
      </div>
    </div>
  );
}

export default function BookingPageWrapper() {
  return (
    <Suspense fallback={<div className="w-full max-w-6xl mx-auto py-8 px-4"><div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-amber-500 border-r-transparent"></div></div>}>
      <BookingPage />
    </Suspense>
  );
}
