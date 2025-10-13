'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function SearchForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [locations, setLocations] = useState([]);
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const supabase = createClient();

  useEffect(() => {
    // Prefill from URL (supports using this form on /search as well)
    const o = searchParams.get('origin');
    const d = searchParams.get('destination');
    const dt = searchParams.get('date');
    if (o) setOrigin(o);
    if (d) setDestination(d);
    if (dt) setDate(dt);

    const fetchLocations = async () => {
      const { data, error } = await supabase
        .from('routes')
        .select('origin_city, destination_city');

      if (error) {
        console.error('Error fetching locations:', error);
      } else {
        const originCities = [...new Set(data.map(item => item.origin_city))];
        const destCities = [...new Set(data.map(item => item.destination_city))];
        const allCities = [...new Set([...originCities, ...destCities])];
        setLocations(allCities.map(city => ({ value: city.toLowerCase(), label: city })));
      }
    };

    fetchLocations();
  }, [searchParams]);

  const handleSearch = (e) => {
    e.preventDefault();
    const o = encodeURIComponent(origin.trim());
    const d = encodeURIComponent(destination.trim());
    const dt = encodeURIComponent(date.trim());
    router.push(`/search?origin=${o}&destination=${d}&date=${dt}`);
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl text-center text-gray-800 dark:text-white">
          Pesquisar Viagem
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div className="md:col-span-1">
            <label htmlFor="origin" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Origem
            </label>
            <Input
              id="origin"
              list="origin-cities"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="Selecione a origem"
            />
            <datalist id="origin-cities">
              {locations.map((opt) => (
                <option key={opt.value} value={opt.label} />
              ))}
            </datalist>
          </div>
          <div className="md:col-span-1">
            <label htmlFor="destination" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Destino
            </label>
            <Input
              id="destination"
              list="destination-cities"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Selecione o destino"
            />
            <datalist id="destination-cities">
              {locations.map((opt) => (
                <option key={opt.value} value={opt.label} />
              ))}
            </datalist>
          </div>
          <div className="md:col-span-1">
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Data
            </label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} min={today} />
          </div>
          <div className="md:col-span-1">
            <label htmlFor="passengers" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Passageiros
            </label>
            <Input id="passengers" type="number" placeholder="1" min="1" defaultValue="1" />
          </div>
          <Button type="submit" className="w-full md:col-span-1 bg-orange-500 hover:bg-orange-600 text-white">
            Pesquisar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
