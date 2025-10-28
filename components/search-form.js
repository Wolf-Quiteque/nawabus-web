'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SearchForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [locations, setLocations] = useState([]);
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [departureDate, setDepartureDate] = useState(new Date().toISOString().split('T')[0]);
  const [returnDate, setReturnDate] = useState('');
  const [tripType, setTripType] = useState('one-way'); // 'one-way' or 'round-trip'

  useEffect(() => {
    // Prefill from URL
    const o = searchParams.get('origin');
    const d = searchParams.get('destination');
    const dt = searchParams.get('date');
    const rt = searchParams.get('returnDate');
    const tt = searchParams.get('tripType');
    
    if (o) setOrigin(o);
    if (d) setDestination(d);
    if (dt) setDepartureDate(dt);
    if (rt) setReturnDate(rt);
    if (tt) setTripType(tt);

    // Fetch locations (mock - replace with actual Supabase call)
    const fetchLocations = async () => {
      // Replace with your actual Supabase query
      const mockCities = ['Luanda', 'Benguela', 'Huambo', 'Lobito', 'Namibe'];
      setLocations(mockCities.map(city => ({ value: city.toLowerCase(), label: city })));
    };

    fetchLocations();
  }, [searchParams]);

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams({
      origin: origin.trim(),
      destination: destination.trim(),
      date: departureDate.trim(),
      tripType: tripType
    });
    
    if (tripType === 'round-trip' && returnDate) {
      params.append('returnDate', returnDate.trim());
    }
    
    router.push(`/search?${params.toString()}`);
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <Card className="w-full max-w-7xl mx-auto shadow-xl border-0">
      {/* <CardHeader className="pb-4">
        <CardTitle className="text-2xl text-center text-gray-800 dark:text-white font-bold">
          Pesquisar Viagem
        </CardTitle>
      </CardHeader> */}
      <CardContent className="px-8 pb-8">
        <form onSubmit={handleSearch} className="space-y-6">
          {/* Trip Type Selection */}
          <div className="flex gap-6 justify-center mb-2">
            <Label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <input
                type="radio"
                value="one-way"
                checked={tripType === 'one-way'}
                onChange={(e) => setTripType(e.target.value)}
                className="w-5 h-5 text-orange-500 focus:ring-orange-400"
              />
              <span className="text-base font-semibold">Só Ida</span>
            </Label>
            <Label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <input
                type="radio"
                value="round-trip"
                checked={tripType === 'round-trip'}
                onChange={(e) => setTripType(e.target.value)}
                className="w-5 h-5 text-orange-500 focus:ring-orange-400"
              />
              <span className="text-base font-semibold">Ida e Volta</span>
            </Label>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
            {/* Origin - Wider column */}
            <div className="lg:col-span-3">
              <label htmlFor="origin" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Origem
              </label>
              <Input
                id="origin"
                list="origin-cities"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="Selecione a origem"
                className="h-12 text-base border-gray-300 focus:border-orange-500 focus:ring-orange-500"
                required
              />
              <datalist id="origin-cities">
                {locations.map((opt) => (
                  <option key={opt.value} value={opt.label} />
                ))}
              </datalist>
            </div>
            
            {/* Destination - Wider column */}
            <div className="lg:col-span-3">
              <label htmlFor="destination" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Destino
              </label>
              <Input
                id="destination"
                list="destination-cities"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Selecione o destino"
                className="h-12 text-base border-gray-300 focus:border-orange-500 focus:ring-orange-500"
                required
              />
              <datalist id="destination-cities">
                {locations.map((opt) => (
                  <option key={opt.value} value={opt.label} />
                ))}
              </datalist>
            </div>
            
            {/* Departure Date */}
            <div className={tripType === 'round-trip' ? 'lg:col-span-2' : 'lg:col-span-3'}>
              <label htmlFor="departureDate" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Data de Ida
              </label>
              <Input
                id="departureDate"
                type="date"
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
                min={today}
                className="h-12 text-base border-gray-300 focus:border-orange-500 focus:ring-orange-500"
                required
              />
            </div>
            
            {/* Return Date - Only show for round trip */}
            {tripType === 'round-trip' && (
              <div className="lg:col-span-2">
                <label htmlFor="returnDate" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Data de Volta
                </label>
                <Input
                  id="returnDate"
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  min={departureDate || today}
                  className="h-12 text-base border-gray-300 focus:border-orange-500 focus:ring-orange-500"
                  required={tripType === 'round-trip'}
                />
              </div>
            )}
            
            {/* Search Button - Adjusted size */}
            <div className={tripType === 'round-trip' ? 'lg:col-span-2' : 'lg:col-span-3'}>
              <Button 
                type="submit" 
                className="w-full h-12 text-base font-semibold bg-orange-500 hover:bg-orange-600 text-white shadow-md hover:shadow-lg transition-all duration-200"
              >
                Pesquisar
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}