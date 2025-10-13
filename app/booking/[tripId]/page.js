'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import SeatSelection from '@/components/seat-selection';

export default function BookingPage() {
  const router = useRouter();
  const params = useParams();
  const { tripId } = params;
  
  const [tripDetails, setTripDetails] = useState(null);
  const [occupiedSeats, setOccupiedSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (!tripId) return;

    const fetchTripData = async () => {
      setLoading(true);
      
      // Fetch trip details
      const { data: tripData, error: tripError } = await supabase
        .from('trips')
        .select(`
          id,
          departure_time,
          arrival_time,
          price_usd,
          routes (
            origin_city,
            destination_city
          ),
          buses (
            capacity
          )
        `)
        .eq('id', tripId)
        .single();

      if (tripError) {
        console.error('Error fetching trip details:', tripError);
        setLoading(false);
        return;
      }

      // Fetch occupied seats
      const { data: ticketsData, error: ticketsError } = await supabase
        .from('tickets')
        .select('seat_number')
        .eq('trip_id', tripId)
        .in('status', ['active', 'used']); // or whatever statuses mean occupied

      if (ticketsError) {
        console.error('Error fetching occupied seats:', ticketsError);
      }

      setTripDetails(tripData);
      setOccupiedSeats(ticketsData ? ticketsData.map(t => t.seat_number) : []);
      setLoading(false);
    };

    fetchTripData();
  }, [tripId]);

  if (loading) {
    return <div className="text-center py-10">A carregar detalhes da viagem...</div>;
  }

  if (!tripDetails) {
    return <div className="text-center py-10">Viagem não encontrada.</div>;
  }

  return (
    <div className="w-full max-w-6xl mx-auto py-8 px-4">
      <button onClick={() => router.back()} className="flex items-center gap-2 mb-4 text-gray-600 hover:text-gray-800">
        <ArrowLeft />
        <span>Voltar à pesquisa</span>
      </button>
      <h1 className="text-3xl font-bold text-center mb-2 text-gray-800 dark:text-white">Seleção de Assentos</h1>
      <p className="text-center text-gray-500 mb-8">Escolha os seus lugares para a viagem de {tripDetails.routes.origin_city} para {tripDetails.routes.destination_city}.</p>
      <SeatSelection tripDetails={tripDetails} occupiedSeats={occupiedSeats} />
    </div>
  );
}
