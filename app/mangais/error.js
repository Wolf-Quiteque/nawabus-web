'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function MangaisError({ error, reset }) {
  useEffect(() => {
    console.error('Mangais flow error:', error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b2412] p-4 text-[#fbfbe8]">
      <section className="w-full max-w-md rounded-[1.75rem] border border-white/15 bg-white/10 p-6 text-center shadow-2xl backdrop-blur-xl">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#e4f46f]">Brunch Mangais</p>
        <h1 className="mt-3 text-2xl font-black">Não foi possível continuar</h1>
        <p className="mt-3 text-sm leading-6 text-[#fbfbe8]/80">
          A compra encontrou um erro no navegador. Tenta novamente; se continuar, reabre a compra do evento.
        </p>
        <div className="mt-6 grid gap-3">
          <Button
            type="button"
            onClick={reset}
            className="h-12 rounded-2xl bg-[#e4f46f] font-black text-[#10321a] hover:bg-[#eef8a0]"
          >
            Tentar novamente
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              window.location.href = '/mangais';
            }}
            className="h-12 rounded-2xl border-white/25 bg-white/10 font-black text-white hover:bg-white/20 hover:text-white"
          >
            Reabrir compra
          </Button>
        </div>
      </section>
    </main>
  );
}
