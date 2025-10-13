'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MdEventSeat } from 'react-icons/md';
import { GiSteeringWheel } from 'react-icons/gi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function SeatSelection({ tripDetails, occupiedSeats = [] }) {
  const router = useRouter();
  const [selectedSeats, setSelectedSeats] = useState([]);
  const totalSeats = tripDetails?.buses?.capacity || 0;

  const handleSeatClick = (seatNumber) => {
    if (occupiedSeats.includes(seatNumber)) return;

    setSelectedSeats((prev) =>
      prev.includes(seatNumber)
        ? prev.filter((s) => s !== seatNumber)
        : [...prev, seatNumber]
    );
  };

  const getSeatClass = (seatNumber) => {
    if (occupiedSeats.includes(seatNumber)) {
      return 'text-gray-400 cursor-not-allowed';
    }
    if (selectedSeats.includes(seatNumber)) {
      return 'text-orange-500';
    }
    return 'text-gray-600 hover:text-orange-400';
  };

  const renderSeats = () => {
    const seats = [];
    for (let i = 1; i <= totalSeats; i++) {
      const seatInRow = (i - 1) % 4;
      
      if (seatInRow === 2) {
        seats.push(<div key={`aisle-${i}`} className="col-span-1"></div>);
      }

      seats.push(
        <div
          key={i}
          className="flex flex-col items-center cursor-pointer"
          onClick={() => handleSeatClick(i)}
        >
          <MdEventSeat size={32} className={getSeatClass(i)} />
          <span className="text-xs font-medium">{i}</span>
        </div>
      );
    }
    return seats;
  };

  const totalPrice = selectedSeats.length * tripDetails.price_usd;

  const handleCheckout = () => {
    const bookingDetails = {
      tripDetails,
      selectedSeats,
      totalPrice,
    };
    localStorage.setItem('bookingDetails', JSON.stringify(bookingDetails));
    router.push('/checkout');
  };

  return (
    <div className="flex flex-col md:flex-row gap-8">
      <div className="w-full md:w-2/3 lg:w-1/2 mx-auto">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-center">Selecione os seus lugares</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <div className="p-4 border rounded-lg w-full max-w-xs bg-gray-50 dark:bg-gray-800">
              <div className="flex justify-end mb-4">
                <GiSteeringWheel size={32} className="text-gray-700 dark:text-gray-300" />
              </div>
              <div className="grid grid-cols-5 gap-y-4 gap-x-2">
                {renderSeats()}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="w-full md:w-1/3 lg:w-1/2 mx-auto">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Resumo da sua Viagem</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="font-semibold text-gray-800 dark:text-white">{tripDetails.routes.origin_city} → {tripDetails.routes.destination_city}</p>
                <p className="text-sm text-gray-500">{new Date(tripDetails.departure_time).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-800 dark:text-white">Lugares Selecionados:</p>
                {selectedSeats.length > 0 ? (
                  <p className="font-mono tracking-wider text-orange-600">{selectedSeats.sort((a, b) => a - b).join(', ')}</p>
                ) : (
                  <p className="text-sm text-gray-500">Nenhum lugar selecionado</p>
                )}
              </div>
              <div className="border-t pt-4">
                <p className="text-xl font-bold flex justify-between text-gray-800 dark:text-white">
                  <span>Total:</span>
                  <span className="text-orange-600">{totalPrice.toFixed(2)} Kz</span>
                </p>
              </div>
              <Button onClick={handleCheckout} className="w-full bg-orange-500 hover:bg-orange-600 text-white" disabled={selectedSeats.length === 0}>
                Continuar para Pagamento
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
