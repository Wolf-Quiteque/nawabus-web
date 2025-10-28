'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import SeatSelection from '@/components/seat-selection';

export default function BookingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [outboundTrip, setOutboundTrip] = useState(null);
  const [returnTrip, setReturnTrip] = useState(null);
  const [outboundOccupiedSeats, setOutboundOccupiedSeats] = useState([]);
  const [returnOccupiedSeats, setReturnOccupiedSeats] = useState([]);
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
        // Fetch outbound trip details
        const { data: outboundData, error: outboundError } = await supabase
          .from('trips')
          .select(`
            id,
            departure_time,
            arrival_time,
            price_usd,
            seat_class,
            routes (
              origin_city,
              destination_city
            ),
            buses (
              capacity,
              license_plate
            )
          `)
          .eq('id', outboundTripId)
          .single();

        if (outboundError) throw outboundError;
        setOutboundTrip(outboundData);

        // Fetch outbound occupied seats
        const { data: outboundTickets, error: outboundTicketsError } = await supabase
          .from('tickets')
          .select('seat_number')
          .eq('trip_id', outboundTripId)
          .in('status', ['active', 'used']);

        if (outboundTicketsError) throw outboundTicketsError;
        setOutboundOccupiedSeats(outboundTickets ? outboundTickets.map(t => t.seat_number) : []);

        // If return trip exists, fetch it too
        if (returnTripId) {
          const { data: returnData, error: returnError } = await supabase
            .from('trips')
            .select(`
              id,
              departure_time,
              arrival_time,
              price_usd,
              seat_class,
              routes (
                origin_city,
                destination_city
              ),
              buses (
                capacity,
                license_plate
              )
            `)
            .eq('id', returnTripId)
            .single();

          if (returnError) throw returnError;
          setReturnTrip(returnData);

          // Fetch return occupied seats
          const { data: returnTickets, error: returnTicketsError } = await supabase
            .from('tickets')
            .select('seat_number')
            .eq('trip_id', returnTripId)
            .in('status', ['active', 'used']);

          if (returnTicketsError) throw returnTicketsError;
          setReturnOccupiedSeats(returnTickets ? returnTickets.map(t => t.seat_number) : []);
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
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-orange-500 border-r-transparent"></div>
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
    <div className="w-full max-w-6xl mx-auto py-8 px-4">
      <button 
        onClick={() => router.back()} 
        className="flex items-center gap-2 mb-4 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100"
      >
        <ArrowLeft />
        <span>Voltar à pesquisa</span>
      </button>
      
      <h1 className="text-3xl font-bold text-center mb-2 text-gray-800 dark:text-white">
        Seleção de Assentos
      </h1>
      
      <p className="text-center text-gray-500 mb-8">
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
      />
    </div>
  );
}