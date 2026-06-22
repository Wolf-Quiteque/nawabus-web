'use client';

import Image from 'next/image';
import { Suspense } from 'react';
import SearchForm from '@/components/search-form';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-900">
      <section className="relative min-h-[72svh] overflow-hidden bg-slate-950 text-white">
        <Image
          src="/bus22.webp"
          alt="Autocarro Nawabus"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center opacity-65"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-black/85 via-black/60 to-black/35" />

        <div className="relative z-10 mx-auto flex min-h-[72svh] w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <img
              src="/nawabus_logo_white.webp"
              alt="Nawabus"
              className="h-10 w-auto sm:h-12"
            />
          </div>

          <div className="flex flex-1 items-center py-16">
            <div className="max-w-2xl">
              <p className="text-sm font-black uppercase tracking-[0.24em] text-yellow-300">
                Nawabus Angola
              </p>
              <h1 className="mt-4 text-4xl font-black leading-tight sm:text-6xl">
                Viaja com conforto, rapidez e confianca.
              </h1>
              <p className="mt-5 max-w-xl text-base font-semibold leading-7 text-white/85 sm:text-lg">
                Pesquisa rotas disponiveis, escolhe o horario e compra o teu bilhete online.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="relative z-10 mx-auto -mt-20 w-full max-w-4xl px-4">
        <Suspense>
          <SearchForm />
        </Suspense>
      </div>

      <section className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-16 md:grid-cols-3">
        <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800">
          <h2 className="text-lg font-black text-gray-900 dark:text-white">Compra simples</h2>
          <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
            Escolhe origem, destino, data e horario num fluxo rapido.
          </p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800">
          <h2 className="text-lg font-black text-gray-900 dark:text-white">Bilhetes digitais</h2>
          <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
            Depois do pagamento, podes baixar o bilhete na area do cliente.
          </p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800">
          <h2 className="text-lg font-black text-gray-900 dark:text-white">Viagem organizada</h2>
          <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
            Guarda o QR code e apresenta-o no embarque.
          </p>
        </div>
      </section>
    </main>
  );
}
