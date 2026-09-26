'use client';

import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { getMinPurchaseDateKey } from '@/lib/purchase-date';

// Buses to Luanda leave from two places, so "Bilhetes para Luanda" cannot
// assume one. The search filters by province, and Sumbe is filed under
// Cuanza Sul.
const BOARDING_POINTS = [
  {
    city: 'Sumbe',
    province: 'Cuanza Sul',
    detail: 'Escola E15, em frente ao Shoprite',
  },
  {
    city: 'Benguela',
    province: 'Benguela',
    detail: 'Terminal da Nawabus em Benguela',
  },
];

export default function BoardingChoiceModal({ open, onOpenChange, destination = 'Luanda' }) {
  const router = useRouter();

  const go = (province) => {
    const params = new URLSearchParams({
      origin: province,
      destination,
      date: getMinPurchaseDateKey(),
      tripType: 'one-way',
    });
    onOpenChange(false);
    router.push(`/search?${params.toString()}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle className="text-2xl font-black text-stone-900 dark:text-white">
          Onde vai embarcar?
        </DialogTitle>
        <DialogDescription className="text-stone-600 dark:text-stone-300">
          Escolha o seu local de partida para a viagem até {destination}.
        </DialogDescription>

        <div className="mt-5 space-y-3">
          {BOARDING_POINTS.map((point) => (
            <button
              key={point.province}
              type="button"
              onClick={() => go(point.province)}
              className="group flex w-full items-center justify-between gap-3 rounded-2xl border-2 border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-5 py-4 text-left transition-all hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-stone-700 hover:shadow-lg"
            >
              <span className="min-w-0">
                <span className="block text-lg font-black text-stone-900 dark:text-white">
                  Embarco no {point.city}
                </span>
                <span className="block truncate text-sm text-stone-500 dark:text-stone-400">
                  {point.detail}
                </span>
              </span>
              <svg
                className="h-5 w-5 shrink-0 text-amber-600 transition-transform group-hover:translate-x-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
