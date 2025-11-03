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
      <div className="relative w-full h-[480px] shadow-lg overflow-hidden">
        {/* Background image layer */}
        <Image
          
          src="/bus2.png"
          alt=""
          fill
          priority
          sizes="130vw"
          className="object-cover"
        />

        {/* Logo */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
          <img
            src="/nawabus_logo_white.webp"
            alt="Nawabus Logo"
            className="w-auto h-auto object-cover"
          />
        </div>

        {/* Dark overlay + heading */}
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
        
        </div>
      </div>

      <div className="relative w-full max-w-4xl px-4 mx-auto -mt-24 z-10">
        <Suspense>
          <SearchForm />
        </Suspense>
      </div>

      {/* About Section */}
      <section className="py-20 px-4 bg-white dark:bg-gray-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
              Sobre a <span className="text-orange-500">NAWABUS</span>
            </h2>
            <div className="w-24 h-1 bg-gradient-to-r from-orange-400 to-orange-600 mx-auto mb-8"></div>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="relative h-[400px] rounded-2xl overflow-hidden shadow-2xl">
              <Image
                src="/nawabusimg.jpg"
                alt="NAWABUS Angola"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-orange-500/30 to-transparent"></div>
            </div>

            <div className="space-y-6">
              <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                A <strong className="text-orange-500">NAWABUS, LDA</strong> é uma startup inovadora que está a revolucionar o sector de Transportes e Turismo em Angola. Desde <strong>2019</strong>, temos vindo a construir soluções digitais que melhoram significativamente a experiência de viagem dos angolanos, conectando pessoas, destinos e oportunidades através de uma plataforma moderna e acessível.
              </p>
              <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                Com uma visão clara de transformação social, atuamos no mercado de transporte rodoviário de passageiros, oferecendo serviços abrangentes que incluem <strong className="text-orange-500">viagens interprovinciais</strong>, transporte de mercadorias, experiências turísticas memoráveis e transfers para todo o território nacional.
              </p>
              <div className="flex items-center gap-4 pt-4">
                <div className="flex-1 h-1 bg-gradient-to-r from-orange-400 to-transparent"></div>
                <span className="text-orange-500 font-semibold">Desde 2019</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-orange-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
              A Nossa <span className="text-orange-500">Plataforma Digital</span>
            </h2>
            <div className="w-24 h-1 bg-gradient-to-r from-orange-400 to-orange-600 mx-auto"></div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="group bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-t-4 border-orange-500">
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center transform group-hover:rotate-12 transition-transform duration-300">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3 text-center">
                Rede Integrada
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-center leading-relaxed text-sm">
                Agências e quiosques estrategicamente posicionados por todo o país, garantindo acessibilidade e proximidade com os nossos clientes
              </p>
            </div>

            {/* Card 2 */}
            <div className="group bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-t-4 border-orange-500">
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center transform group-hover:rotate-12 transition-transform duration-300">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3 text-center">
                Conexão Inteligente
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-center leading-relaxed text-sm">
                Ligamos operadoras de transporte intermunicipal e interprovincial aos passageiros através de tecnologia inovadora
              </p>
            </div>

            {/* Card 3 */}
            <div className="group bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-t-4 border-orange-500">
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center transform group-hover:rotate-12 transition-transform duration-300">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3 text-center">
                Inovação Contínua
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-center leading-relaxed text-sm">
                Utilizamos meios estratégicos e digitais para simplificar a gestão de viagens e envio de encomendas
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-20 px-4 bg-white dark:bg-gray-800 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-100 dark:bg-orange-900/20 rounded-full blur-3xl -z-0 opacity-50"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-orange-100 dark:bg-orange-900/20 rounded-full blur-3xl -z-0 opacity-50"></div>

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
              Os Nossos <span className="text-orange-500">Serviços Completos</span>
            </h2>
            <div className="w-24 h-1 bg-gradient-to-r from-orange-400 to-orange-600 mx-auto mb-6"></div>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Soluções completas de mobilidade e turismo para todas as suas necessidades
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Service 1 */}
            <div className="group relative bg-gradient-to-br from-white to-orange-50 dark:from-gray-800 dark:to-gray-700 rounded-xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full -mr-16 -mt-16"></div>
              <div className="relative">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                  Bilhetes Interprovinciais
                </h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">
                  Venda regular de bilhetes de passagem para todas as províncias angolanas, com reservas fáceis e seguras através da nossa plataforma digital ou rede física
                </p>
              </div>
            </div>

            {/* Service 2 */}
            <div className="group relative bg-gradient-to-br from-white to-orange-50 dark:from-gray-800 dark:to-gray-700 rounded-xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full -mr-16 -mt-16"></div>
              <div className="relative">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                  Aluguer de Viaturas
                </h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">
                  Autocarros e miniautocarros modernos e confortáveis disponíveis para aluguer, ideais para grupos, eventos corporativos ou viagens em família
                </p>
              </div>
            </div>

            {/* Service 3 */}
            <div className="group relative bg-gradient-to-br from-white to-orange-50 dark:from-gray-800 dark:to-gray-700 rounded-xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full -mr-16 -mt-16"></div>
              <div className="relative">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                  Fretamento Corporativo
                </h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">
                  Soluções personalizadas de transporte para empresas, garantindo mobilidade eficiente e segura para colaboradores e equipas
                </p>
              </div>
            </div>

            {/* Service 4 */}
            <div className="group relative bg-gradient-to-br from-white to-orange-50 dark:from-gray-800 dark:to-gray-700 rounded-xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full -mr-16 -mt-16"></div>
              <div className="relative">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                  Envio de Encomendas Nacional
                </h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">
                  Serviço confiável de transporte de mercadorias e encomendas para todo o território angolano, com rastreamento e segurança garantida
                </p>
              </div>
            </div>

            {/* Service 5 */}
            <div className="group relative bg-gradient-to-br from-white to-orange-50 dark:from-gray-800 dark:to-gray-700 rounded-xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden md:col-span-2 lg:col-span-1">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full -mr-16 -mt-16"></div>
              <div className="relative">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                  Pacotes Turísticos
                </h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">
                  Distribuição de experiências turísticas únicas que destacam a beleza e diversidade cultural de Angola, desde praias paradisíacas às maravilhas naturais do interior
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Nawatur Travel Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-amber-50 via-white to-stone-100 dark:from-stone-900 dark:via-stone-800 dark:to-amber-950 relative overflow-hidden">
        {/* Circular/Curvy Background Patterns */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 left-0 w-full h-full" style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' viewBox=\'0 0 100 100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M50 10 A 40 40 0 1 1 50 90 A 40 40 0 1 1 50 10 Z\' fill=\'none\' stroke=\'%23a16207\' stroke-width=\'0.5\' opacity=\'0.2\'/%3E%3Ccircle cx=\'20\' cy=\'30\' r=\'15\' fill=\'%23d97706\' opacity=\'0.1\'/%3E%3Ccircle cx=\'80\' cy=\'70\' r=\'20\' fill=\'%2378350f\' opacity=\'0.1\'/%3E%3Cpath d=\'M 30 0 Q 50 30 70 0\' fill=\'none\' stroke=\'%23a16207\' stroke-width=\'1\' opacity=\'0.15\'/%3E%3C/svg%3E")'}}></div>
        </div>

        {/* Decorative circles */}
        <div className="absolute top-10 right-20 w-72 h-72 bg-amber-200 dark:bg-amber-900/30 rounded-full blur-3xl opacity-20"></div>
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-stone-300 dark:bg-stone-700/30 rounded-full blur-3xl opacity-20"></div>

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Image side */}
            <div className="relative h-[400px] rounded-2xl overflow-hidden shadow-2xl group cursor-pointer border-4 border-amber-800 dark:border-amber-600" onClick={() => window.open('https://wolf-quiteque.github.io/nawatur/', '_blank')}>
              <Image
                src="/wallpaper.jpg"
                alt="Nawatur Travel"
                fill
                className="object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-amber-950/80 via-amber-900/20 to-transparent group-hover:from-amber-950/90 transition-all duration-300"></div>
              <div className="absolute bottom-6 left-6 right-6">
                <div className="bg-white/95 dark:bg-stone-800/95 backdrop-blur-md rounded-xl p-4 border-2 border-amber-700 dark:border-amber-500">
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-12 h-12 bflex items-center justify-center">
                     <img src="/about-locationimage.png" alt="Nawatur Logo" className="w-12 h-12" />
                    </div>
                    <span className="text-amber-900 dark:text-amber-100 font-bold text-lg">Nawatur </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Content side */}
            <div className="space-y-6">
              <div>
                <h2 className="text-4xl md:text-5xl font-bold text-stone-800 dark:text-white mb-4">
                  Descobre Angola com a <span className="text-amber-700 dark:text-amber-500">Nawatur</span>
                </h2>
                <div className="w-24 h-1 bg-gradient-to-r from-amber-700 to-stone-600 mb-6"></div>
              </div>

              <p className="text-xl text-stone-700 dark:text-stone-200 leading-relaxed">
                A Nawatur ajuda-te a viajar com confiança — dentro de Angola e para o mundo. Organizamos experiências seguras, memoráveis e acessíveis, desde praias tropicais em Benguela até aventuras culturais pelo país.
              </p>

              <p className="text-lg text-stone-600 dark:text-stone-300 leading-relaxed">
                A tua viagem começa connosco. Deixa-nos criar momentos inesquecíveis enquanto exploras a beleza natural e a rica cultura de Angola.
              </p>

              <a
                href="https://wolf-quiteque.github.io/nawatur/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 bg-gradient-to-r from-amber-700 to-amber-900 text-white px-8 py-4 rounded-xl font-bold text-lg hover:from-amber-800 hover:to-stone-800 transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-105 group"
              >
                <span>Explora com a Nawatur</span>
                <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>

              <div className="flex items-center gap-6 pt-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-amber-700 dark:bg-amber-800 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-stone-700 dark:text-stone-200 font-medium">Experiências Seguras</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-amber-700 dark:bg-amber-800 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-stone-700 dark:text-stone-200 font-medium">Memoráveis</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-orange-500 to-orange-600 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-full h-full" style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")'}}></div>
        </div>

        <div className="max-w-4xl mx-auto relative z-10">
          <div className="text-center">
            <div className="inline-block mb-8">
              <div className="w-24 h-24 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-white/30">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
            </div>

            <h2 className="text-4xl md:text-5xl font-bold text-white mb-8">
              A Nossa Missão
            </h2>

            <div className="bg-white/10 backdrop-blur-md rounded-3xl p-10 border border-white/20 shadow-2xl">
              <p className="text-xl md:text-2xl text-white leading-relaxed mb-8 font-light">
                Contribuir ativamente para o melhoramento da qualidade de vida da população angolana através de soluções de transporte acessíveis, seguras e eficientes
              </p>

              <div className="relative">
                <div className="absolute -left-4 top-0 text-6xl text-white/30">"</div>
                <div className="absolute -right-4 bottom-0 text-6xl text-white/30">"</div>
                <p className="text-lg md:text-xl text-white italic font-medium px-8">
                  Conectamos Angola, uma viagem de cada vez, com tecnologia, compromisso e inovação ao serviço das pessoas
                </p>
              </div>
            </div>

            <div className="mt-12 flex items-center justify-center gap-8 flex-wrap">
              <div className="text-center">
                <div className="text-4xl font-bold text-white mb-2">2019</div>
                <div className="text-white/80">Fundação</div>
              </div>
              <div className="w-px h-16 bg-white/30"></div>
              <div className="text-center">
                <div className="text-4xl font-bold text-white mb-2">21</div>
                <div className="text-white/80">Províncias</div>
              </div>
              <div className="w-px h-16 bg-white/30"></div>
              <div className="text-center">
                <div className="text-4xl font-bold text-white mb-2">100%</div>
                <div className="text-white/80">Digital</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
