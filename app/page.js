'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Suspense } from 'react';
import SearchForm from '@/components/search-form';

export default function Home() {
  const router = useRouter();

  const handleSearch = (e) => {
    e.preventDefault();
    router.push('/search');
  };

  return (
    <main className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="relative w-full h-[500px] shadow-lg overflow-hidden">
        {/* Background image layer */}
        <Image
          src="/bus.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />

        {/* Logo */}
        <div className="absolute top-4 left-4 z-20">
          <img
            src="/logo.png"
            alt="Nawabus Logo"
            className="w-32 h-32 rounded-full object-cover bg-white border-4 border-white"
          />
        </div>

        {/* Dark overlay + heading */}
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
          <h1 className="text-5xl font-bold text-white text-center px-4">
            Sua Próxima Viagem Começa Aqui
          </h1>
        </div>
      </div>

      <div className="relative w-full max-w-4xl px-4 mx-auto -mt-24 z-10">
        <Suspense>
          <SearchForm />
        </Suspense>

        <div className="mt-12 text-center">
          <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Sobre a Nawabus</h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Na Nawabus, oferecemos uma experiência de viagem de autocarro premium, conectando cidades com conforto,
            segurança e pontualidade. As nossas modernas frotas estão equipadas para garantir que a sua viagem seja tão
            agradável quanto o seu destino.
          </p>
        </div>
      </div>
    </main>
  );
}
