'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MdEventSeat } from 'react-icons/md';
import { GiSteeringWheel } from 'react-icons/gi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';

export default function SeatSelection({ 
  outboundTrip, 
  returnTrip = null, 
  outboundOccupiedSeats = [], 
  returnOccupiedSeats = [],
  isSelectingReturn = false 
}) {
  const router = useRouter();
  const [outboundSelectedSeats, setOutboundSelectedSeats] = useState([]);
  const [returnSelectedSeats, setReturnSelectedSeats] = useState([]);
  const [currentStep, setCurrentStep] = useState(isSelectingReturn ? 'return' : 'outbound');

  const currentTrip = currentStep === 'outbound' ? outboundTrip : returnTrip;
  const currentOccupiedSeats = currentStep === 'outbound' ? outboundOccupiedSeats : returnOccupiedSeats;
  const currentSelectedSeats = currentStep === 'outbound' ? outboundSelectedSeats : returnSelectedSeats;
  const setCurrentSelectedSeats = currentStep === 'outbound' ? setOutboundSelectedSeats : setReturnSelectedSeats;
  
  const totalSeats = currentTrip?.buses?.capacity || 0;

  const handleSeatClick = (seatNumber) => {
    if (currentOccupiedSeats.includes(seatNumber)) return;

    setCurrentSelectedSeats((prev) =>
      prev.includes(seatNumber)
        ? prev.filter((s) => s !== seatNumber)
        : [...prev, seatNumber]
    );
  };

  const getSeatClass = (seatNumber) => {
    if (currentOccupiedSeats.includes(seatNumber)) {
      return 'text-gray-400 cursor-not-allowed';
    }
    if (currentSelectedSeats.includes(seatNumber)) {
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

  const outboundPrice = outboundSelectedSeats.length * (outboundTrip?.price_usd || 0);
  const returnPrice = returnSelectedSeats.length * (returnTrip?.price_usd || 0);
  const totalPrice = outboundPrice + returnPrice;

  const handleContinue = () => {
    if (currentStep === 'outbound' && returnTrip) {
      // Move to return trip seat selection
      setCurrentStep('return');
    } else {
      // Go to checkout
      const bookingDetails = {
        tripType: returnTrip ? 'round-trip' : 'one-way',
        outboundTrip: {
          ...outboundTrip,
          selectedSeats: outboundSelectedSeats,
          price: outboundPrice
        },
        ...(returnTrip && {
          returnTrip: {
            ...returnTrip,
            selectedSeats: returnSelectedSeats,
            price: returnPrice
          }
        }),
        totalPrice
      };
      
      // Store in memory (not localStorage as per restrictions)
      sessionStorage.setItem('bookingDetails', JSON.stringify(bookingDetails));
      router.push('/checkout');
    }
  };

  const handleBack = () => {
    if (currentStep === 'return') {
      setCurrentStep('outbound');
    } else {
      router.back();
    }
  };

  const canContinue = currentSelectedSeats.length > 0;

  return (
    <div className="flex flex-col md:flex-row gap-8">
      <div className="w-full md:w-2/3 lg:w-1/2 mx-auto">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-center">
              {currentStep === 'outbound' ? 'Selecione os lugares de Ida' : 'Selecione os lugares de Volta'}
            </CardTitle>
            {returnTrip && (
              <Alert className="mt-4">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  {currentStep === 'outbound' 
                    ? 'Primeiro selecione os lugares para a viagem de ida'
                    : 'Agora selecione os lugares para a viagem de volta'}
                </AlertDescription>
              </Alert>
            )}
          </CardHeader>
          <CardContent className="flex justify-center">
            <div className="p-4 border rounded-lg w-full max-w-xs bg-gray-50 dark:bg-gray-800">
              <div className="flex justify-end mb-4">
                <GiSteeringWheel size={32} className="text-gray-700 dark:text-gray-300" />
              </div>
              <div className="grid grid-cols-5 gap-y-4 gap-x-2">
                {renderSeats()}
              </div>
              
              {/* Legend */}
              <div className="mt-6 flex justify-around text-xs">
                <div className="flex items-center gap-1">
                  <MdEventSeat size={20} className="text-gray-600" />
                  <span>Disponível</span>
                </div>
                <div className="flex items-center gap-1">
                  <MdEventSeat size={20} className="text-orange-500" />
                  <span>Selecionado</span>
                </div>
                <div className="flex items-center gap-1">
                  <MdEventSeat size={20} className="text-gray-400" />
                  <span>Ocupado</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="w-full md:w-1/3 lg:w-1/2 mx-auto">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Resumo da Reserva</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Outbound Trip Summary */}
              <div className="pb-4 border-b">
                <p className="text-sm font-semibold text-gray-500 mb-2">VIAGEM DE IDA</p>
                <p className="font-semibold text-gray-800 dark:text-white">
                  {outboundTrip?.routes?.origin_city} → {outboundTrip?.routes?.destination_city}
                </p>
                <p className="text-sm text-gray-500">
                  {new Date(outboundTrip?.departure_time).toLocaleString('pt-PT', { 
                    dateStyle: 'short', 
                    timeStyle: 'short' 
                  })}
                </p>
                <div className="mt-2">
                  <p className="text-sm font-medium text-gray-600">Lugares selecionados:</p>
                  {outboundSelectedSeats.length > 0 ? (
                    <p className="font-mono tracking-wider text-orange-600">
                      {outboundSelectedSeats.sort((a, b) => a - b).join(', ')}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400">Nenhum lugar selecionado</p>
                  )}
                  {outboundSelectedSeats.length > 0 && (
                    <p className="text-sm text-gray-600 mt-1">
                      Subtotal: {outboundPrice.toFixed(2)} Kz
                    </p>
                  )}
                </div>
              </div>

              {/* Return Trip Summary */}
              {returnTrip && (
                <div className="pb-4 border-b">
                  <p className="text-sm font-semibold text-gray-500 mb-2">VIAGEM DE VOLTA</p>
                  <p className="font-semibold text-gray-800 dark:text-white">
                    {returnTrip?.routes?.origin_city} → {returnTrip?.routes?.destination_city}
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(returnTrip?.departure_time).toLocaleString('pt-PT', { 
                      dateStyle: 'short', 
                      timeStyle: 'short' 
                    })}
                  </p>
                  <div className="mt-2">
                    <p className="text-sm font-medium text-gray-600">Lugares selecionados:</p>
                    {returnSelectedSeats.length > 0 ? (
                      <p className="font-mono tracking-wider text-orange-600">
                        {returnSelectedSeats.sort((a, b) => a - b).join(', ')}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400">
                        {currentStep === 'outbound' ? 'Será selecionado a seguir' : 'Nenhum lugar selecionado'}
                      </p>
                    )}
                    {returnSelectedSeats.length > 0 && (
                      <p className="text-sm text-gray-600 mt-1">
                        Subtotal: {returnPrice.toFixed(2)} Kz
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Total */}
              <div className="pt-2">
                <p className="text-xl font-bold flex justify-between text-gray-800 dark:text-white">
                  <span>Total:</span>
                  <span className="text-orange-600">{totalPrice.toFixed(2)} Kz</span>
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                {currentStep === 'return' && (
                  <Button 
                    onClick={handleBack} 
                    variant="outline"
                    className="w-full"
                  >
                    Voltar para Ida
                  </Button>
                )}
                <Button 
                  onClick={handleContinue} 
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white" 
                  disabled={!canContinue}
                >
                  {currentStep === 'outbound' && returnTrip 
                    ? 'Continuar para Volta' 
                    : 'Continuar para Pagamento'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}