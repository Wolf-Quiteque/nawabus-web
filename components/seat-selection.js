'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { MdEventSeat } from 'react-icons/md';
import { GiSteeringWheel } from 'react-icons/gi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Info, User, Phone, Users } from 'lucide-react';
import { formatKzOrFree } from '@/lib/currency';
import { COPILOT_SEAT_NUMBER, isCopilotSeat } from '@/lib/seats';

export default function SeatSelection({
  outboundTrip,
  returnTrip = null,
  outboundOccupiedSeats = [],
  returnOccupiedSeats = [],
  userAlreadyBookedOutbound = false,
  userAlreadyBookedReturn = false,
  isSelectingReturn = false
}) {
  const router = useRouter();
  const seatSelectionRef = useRef(null);
  const [outboundSelectedSeats, setOutboundSelectedSeats] = useState([]);
  const [returnSelectedSeats, setReturnSelectedSeats] = useState([]);
  const [currentStep, setCurrentStep] = useState(isSelectingReturn ? 'return' : 'outbound');

  // Companion info: { [seatNumber]: { name: '', phone: '' } }
  const [outboundCompanions, setOutboundCompanions] = useState({});
  const [returnCompanions, setReturnCompanions] = useState({});

  const currentTrip = currentStep === 'outbound' ? outboundTrip : returnTrip;
  const currentOccupiedSeats = currentStep === 'outbound' ? outboundOccupiedSeats : returnOccupiedSeats;
  const currentSelectedSeats = currentStep === 'outbound' ? outboundSelectedSeats : returnSelectedSeats;
  const setCurrentSelectedSeats = currentStep === 'outbound' ? setOutboundSelectedSeats : setReturnSelectedSeats;
  const currentCompanions = currentStep === 'outbound' ? outboundCompanions : returnCompanions;
  const setCurrentCompanions = currentStep === 'outbound' ? setOutboundCompanions : setReturnCompanions;

  // If the user already has a ticket for this trip, ALL seats are for companions
  const currentUserAlreadyBooked = currentStep === 'outbound' ? userAlreadyBookedOutbound : userAlreadyBookedReturn;

  const totalSeats = currentTrip?.buses?.capacity || 0;

  // Get sorted seats
  const sortedCurrentSeats = [...currentSelectedSeats].sort((a, b) => a - b);
  // If user already booked: no main seat, all are companions
  // If not: first seat is main passenger, rest are companions
  const mainSeat = currentUserAlreadyBooked ? null : sortedCurrentSeats[0] || null;
  const companionSeats = currentUserAlreadyBooked ? sortedCurrentSeats : sortedCurrentSeats.slice(1);

  // Auto-manage companion entries when seats change
  useEffect(() => {
    setCurrentCompanions(prev => {
      const updated = {};
      for (const seat of companionSeats) {
        updated[seat] = prev[seat] || { name: '', phone: '' };
      }
      return updated;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSelectedSeats.join(','), currentStep, currentUserAlreadyBooked]);

  const handleSeatClick = (seatNumber) => {
    if (isCopilotSeat(seatNumber)) return;
    if (currentOccupiedSeats.includes(seatNumber)) return;

    setCurrentSelectedSeats((prev) =>
      prev.includes(seatNumber)
        ? prev.filter((s) => s !== seatNumber)
        : [...prev, seatNumber]
    );
  };

  const handleCompanionChange = (seatNumber, field, value) => {
    setCurrentCompanions(prev => ({
      ...prev,
      [seatNumber]: { ...prev[seatNumber], [field]: value }
    }));
  };

  const getSeatClass = (seatNumber) => {
    if (isCopilotSeat(seatNumber)) {
      return 'text-orange-500 cursor-not-allowed';
    }
    if (currentOccupiedSeats.includes(seatNumber)) {
      return 'text-stone-700 cursor-not-allowed';
    }
    if (currentSelectedSeats.includes(seatNumber)) {
      return 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.75)] scale-110';
    }
    return 'text-stone-400 hover:text-amber-300';
  };

  const renderSeats = () => {
    const seats = [];
    for (let i = 1; i <= totalSeats; i++) {
      const seatInRow = (i - 1) % 4;

      if (seatInRow === 2) {
        seats.push(<div key={`aisle-${i}`} className="col-span-1"></div>);
      }

      const copilot = isCopilotSeat(i);

      seats.push(
        <div
          key={i}
          className={`flex flex-col items-center ${copilot ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          onClick={() => handleSeatClick(i)}
          title={copilot ? 'Lugar reservado ao copiloto' : undefined}
          aria-disabled={copilot || undefined}
        >
          <MdEventSeat size={32} className={`transition-all duration-200 ${getSeatClass(i)}`} />
          <span className={`text-xs font-medium ${copilot ? 'text-orange-400' : 'text-stone-400'}`}>
            {copilot ? 'CP' : i}
          </span>
        </div>
      );
    }
    return seats;
  };

  // Check if all companion names are filled
  const allCompanionsValid = companionSeats.every(
    seat => currentCompanions[seat]?.name?.trim()
  );

  const outboundPrice = outboundSelectedSeats.length * (outboundTrip?.price_usd || 0);
  const returnPrice = returnSelectedSeats.length * (returnTrip?.price_usd || 0);
  const totalPrice = outboundPrice + returnPrice;

  const handleContinue = () => {
    if (currentStep === 'outbound' && returnTrip) {
      setCurrentStep('return');
      window.setTimeout(() => {
        seatSelectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    } else {
      // Build companions map for outbound
      // If user already booked, ALL seats are companions
      const outboundSorted = [...outboundSelectedSeats].sort((a, b) => a - b);
      const outboundCompanionData = {};
      const outboundCompanionSlice = userAlreadyBookedOutbound ? outboundSorted : outboundSorted.slice(1);
      for (const seat of outboundCompanionSlice) {
        if (outboundCompanions[seat]) {
          outboundCompanionData[seat] = outboundCompanions[seat];
        }
      }

      // Build companions map for return
      let returnCompanionData = {};
      if (returnTrip) {
        const returnSorted = [...returnSelectedSeats].sort((a, b) => a - b);
        const returnCompanionSlice = userAlreadyBookedReturn ? returnSorted : returnSorted.slice(1);
        for (const seat of returnCompanionSlice) {
          if (returnCompanions[seat]) {
            returnCompanionData[seat] = returnCompanions[seat];
          }
        }
      }

      const bookingDetails = {
        tripType: returnTrip ? 'round-trip' : 'one-way',
        allSeatsAreCompanions: userAlreadyBookedOutbound,
        outboundTrip: {
          ...outboundTrip,
          selectedSeats: outboundSelectedSeats,
          companions: outboundCompanionData,
          price: outboundPrice
        },
        ...(returnTrip && {
          returnTrip: {
            ...returnTrip,
            selectedSeats: returnSelectedSeats,
            companions: returnCompanionData,
            price: returnPrice
          }
        }),
        totalPrice
      };

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

  const canContinue = currentSelectedSeats.length > 0 && allCompanionsValid;

  return (
    <div ref={seatSelectionRef} className="flex flex-col md:flex-row gap-8 scroll-mt-4">
      {/* ── LEFT COLUMN: Seat Grid ── */}
      <div className="w-full md:w-5/12">
        <Card className="shadow-lg border-amber-200 dark:border-stone-700">
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
            <div className="relative p-5 w-full max-w-xs bg-stone-900 border border-stone-700 rounded-t-[2.5rem] rounded-b-2xl shadow-2xl overflow-hidden">
              {/* Windshield glow */}
              <div aria-hidden="true" className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-amber-400/15 to-transparent pointer-events-none"></div>
              <div className="flex justify-end mb-4">
                <GiSteeringWheel size={32} className="text-amber-500" />
              </div>
              <div className="grid grid-cols-5 gap-y-4 gap-x-2">
                {renderSeats()}
              </div>

              {/* Legend */}
              <div className="mt-6 grid grid-cols-2 gap-y-2 text-xs text-stone-300">
                <div className="flex items-center gap-1.5">
                  <MdEventSeat size={20} className="text-stone-400" />
                  <span>Disponivel</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MdEventSeat size={20} className="text-amber-400" />
                  <span>Selecionado</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MdEventSeat size={20} className="text-stone-700" />
                  <span>Ocupado</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MdEventSeat size={20} className="text-orange-500" />
                  <span>Copiloto</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── RIGHT COLUMN: Passageiros + Resumo da Reserva ── */}
      <div className="w-full md:w-7/12 space-y-6">

        {/* Passageiros Card */}
        <Card className="shadow-lg border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-amber-500" />
              Passageiros
            </CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              {sortedCurrentSeats.length === 0
                ? 'Selecione os lugares para adicionar passageiros'
                : currentUserAlreadyBooked
                  ? 'Voce ja tem bilhete para esta viagem. Preencha os dados de quem vai viajar.'
                  : companionSeats.length > 0
                    ? 'Preencha os dados dos passageiros adicionais'
                    : 'Passageiro principal'}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {currentUserAlreadyBooked && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 text-sm text-amber-800 dark:text-amber-300">
                Voce ja possui um bilhete para esta viagem. Os lugares selecionados devem ser atribuidos a outros passageiros.
              </div>
            )}

            {sortedCurrentSeats.length === 0 ? (
              <div className="text-center py-6 text-gray-400">
                <Users className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Nenhum lugar selecionado</p>
              </div>
            ) : (
              <>
                {/* Main passenger — first seat (only if user hasn't booked yet) */}
                {mainSeat && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-stone-950 text-sm font-bold shrink-0 shadow-md">
                      {mainSeat}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 dark:text-white text-sm">
                        Voce (passageiro principal)
                      </p>
                      <p className="text-xs text-gray-500">
                        Os seus dados serao usados na compra
                      </p>
                    </div>
                    <User className="h-4 w-4 text-amber-500 shrink-0" />
                  </div>
                )}

                {/* Companion passengers */}
                {companionSeats.map((seat, index) => (
                  <div
                    key={seat}
                    className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 space-y-2 transition-all duration-200"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-bold shrink-0">
                        {seat}
                      </div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Passageiro {index + 2}
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="flex-1 relative">
                        <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          type="text"
                          placeholder="Nome do passageiro *"
                          value={currentCompanions[seat]?.name || ''}
                          onChange={(e) => handleCompanionChange(seat, 'name', e.target.value)}
                          className="pl-8 h-9 text-sm"
                          required
                        />
                      </div>
                      <div className="sm:w-44 relative">
                        <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          type="tel"
                          placeholder="Telefone (opcional)"
                          value={currentCompanions[seat]?.phone || ''}
                          onChange={(e) => handleCompanionChange(seat, 'phone', e.target.value)}
                          className="pl-8 h-9 text-sm"
                        />
                      </div>
                    </div>
                    {currentCompanions[seat] && !currentCompanions[seat].name?.trim() && (
                      <p className="text-xs text-red-500 pl-1">Nome obrigatorio</p>
                    )}
                  </div>
                ))}

                {companionSeats.length > 0 && !allCompanionsValid && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 text-center pt-1">
                    Preencha o nome de todos os passageiros para continuar
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Resumo da Reserva Card */}
        <Card className="shadow-lg border-amber-200 dark:border-stone-700">
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
                    <p className="font-mono tracking-wider font-bold text-amber-600 dark:text-amber-400">
                      {[...outboundSelectedSeats].sort((a, b) => a - b).join(', ')}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400">Nenhum lugar selecionado</p>
                  )}
                  {outboundSelectedSeats.length > 0 && (
                    <p className="text-sm text-gray-600 mt-1">
                      Subtotal: {formatKzOrFree(outboundPrice)}
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
                      <p className="font-mono tracking-wider font-bold text-amber-600 dark:text-amber-400">
                        {[...returnSelectedSeats].sort((a, b) => a - b).join(', ')}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400">
                        {currentStep === 'outbound' ? 'Sera selecionado a seguir' : 'Nenhum lugar selecionado'}
                      </p>
                    )}
                    {returnSelectedSeats.length > 0 && (
                      <p className="text-sm text-gray-600 mt-1">
                        Subtotal: {formatKzOrFree(returnPrice)}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Total */}
              <div className="pt-2">
                <p className="text-xl font-bold flex justify-between items-center text-gray-800 dark:text-white">
                  <span>Total:</span>
                  <span className="text-2xl font-black bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">{formatKzOrFree(totalPrice)}</span>
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
                  className="w-full bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-stone-950 font-bold shadow-md hover:shadow-amber-500/40"
                  disabled={!canContinue}
                >
                  {currentStep === 'outbound' && returnTrip
                    ? 'Continuar para Volta'
                    : totalPrice === 0 ? 'Confirmar Reserva' : 'Continuar para Pagamento'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
