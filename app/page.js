'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import SearchForm from '@/components/search-form';
import FreteModal from '@/components/frete-modal';
import { getMinPurchaseDateKey } from '@/lib/purchase-date';

const HERO_SLIDES = [
  { src: '/heros/img1.png', alt: 'Autocarro NawaBus na estrada costeira de Angola' },
  { src: '/heros/img4.png', alt: 'Autocarro NawaBus ao pôr-do-sol' },
  { src: '/heros/img6.png', alt: 'Autocarro NawaBus no terminal com passageiros' },
];

const MARQUEE_STOPS = [
  'Luanda', 'Benguela', 'Lobito', 'Sumbe', 'Huambo', 'Lubango',
  'Malanje', 'Ndalatando', 'Uíge', 'Soyo', 'Cabinda', 'Namibe',
];

const WHATSAPP_URL = `https://wa.me/244930533405?text=${encodeURIComponent(
  'Olá NawaBus! Tenho uma questão.'
)}`;

/* Card with 3D mouse-tracking tilt + glare */
function TiltCard({ children, className = '', maxTilt = 9 }) {
  const ref = useRef(null);
  const frame = useRef(null);

  const handleMove = useCallback((e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      el.style.setProperty('--rx', `${(-py * maxTilt).toFixed(2)}deg`);
      el.style.setProperty('--ry', `${(px * maxTilt * 1.2).toFixed(2)}deg`);
      el.style.setProperty('--gx', `${((px + 0.5) * 100).toFixed(1)}%`);
      el.style.setProperty('--gy', `${((py + 0.5) * 100).toFixed(1)}%`);
    });
  }, [maxTilt]);

  const handleLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  }, []);

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={`tilt-card ${className}`}
    >
      <div className="tilt-card-inner">
        {children}
        <div className="tilt-glare" aria-hidden="true" />
      </div>
    </div>
  );
}

/* Fade-up on scroll */
function Reveal({ children, className = '', delay = 0 }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('is-visible');
          io.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ transitionDelay: `${delay}ms` }} className={`reveal ${className}`}>
      {children}
    </div>
  );
}

export default function Home() {
  const [heroIndex, setHeroIndex] = useState(0);
  const [currentAdSeries, setCurrentAdSeries] = useState(1);
  const [freteOpen, setFreteOpen] = useState(false);

  // Hero slideshow
  useEffect(() => {
    const t = setTimeout(() => {
      setHeroIndex((i) => (i + 1) % HERO_SLIDES.length);
    }, 6500);
    return () => clearTimeout(t);
  }, [heroIndex]);

  // Auto-rotate partner ads every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentAdSeries((prev) => (prev === 1 ? 2 : 1));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const buyHref = (origin, destination) => {
    const params = new URLSearchParams({
      origin,
      destination,
      date: getMinPurchaseDateKey(),
      tripType: 'one-way',
    });
    return `/search?${params.toString()}`;
  };

  return (
    <main className="flex flex-col min-h-screen bg-stone-50 dark:bg-stone-950">

      {/* ============ HERO ============ */}
      <section className="relative min-h-[100svh] overflow-hidden bg-stone-950">
        {HERO_SLIDES.map((slide, i) => (
          <div
            key={slide.src}
            className={`absolute inset-0 transition-opacity duration-[1500ms] ease-in-out ${
              i === heroIndex ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <Image
              src={slide.src}
              alt={slide.alt}
              fill
              priority={i === 0}
              sizes="100vw"
              className={`object-cover ${i === heroIndex ? 'animate-kenburns' : ''}`}
            />
          </div>
        ))}

        {/* Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/40 to-stone-950/30"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-stone-950/70 via-transparent to-transparent"></div>

        {/* Top nav */}
        <header className="absolute top-0 inset-x-0 z-40">
          <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-5">
            <img
              src="/nawabus_logo_white.webp"
              alt="NawaBus"
              className="h-8 sm:h-9 md:h-11 w-auto"
            />
            <nav className="flex items-center gap-6">
              <a href="#servicos" className="hidden md:inline text-sm font-medium text-white/80 hover:text-amber-300 transition-colors">
                Serviços
              </a>
              <a href="#sobre" className="hidden md:inline text-sm font-medium text-white/80 hover:text-amber-300 transition-colors">
                Sobre nós
              </a>
              <a href="#parceiros" className="hidden md:inline text-sm font-medium text-white/80 hover:text-amber-300 transition-colors">
                Parceiros
              </a>
              <a
                href="#frete"
                className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-amber-400/60 bg-white/10 backdrop-blur-sm px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-bold text-amber-300 hover:bg-amber-400 hover:text-stone-950 transition-all duration-300"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1" />
                </svg>
                Aluguer de Frete
              </a>
            </nav>
          </div>
        </header>

        {/* Hero content */}
        <div className="relative z-30 max-w-7xl mx-auto px-5 sm:px-6 pt-32 sm:pt-40 md:pt-48 pb-64">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-6 animate-fade-in-up" style={{ animationDelay: '0s' }}>
              <span className="samakaka-strip w-16 rounded-full"></span>
              <span className="text-amber-300 font-bold tracking-[0.35em] text-xs md:text-sm uppercase">
                Angola em movimento
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tight text-white leading-[1.08] md:leading-[1.05] mb-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              Angola inteira,{' '}
              <span className="bg-gradient-to-r from-amber-300 via-yellow-400 to-orange-500 bg-clip-text text-transparent">
                à distância de um bilhete.
              </span>
            </h1>

            <p className="text-lg md:text-xl text-white/85 leading-relaxed mb-10 max-w-2xl animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              Compra o teu bilhete de autocarro em minutos — escolhe o lugar,
              paga por referência Multicaixa e recebe tudo no telemóvel.
            </p>

            {/* Big obvious CTAs */}
            <div className="flex flex-wrap items-center gap-4 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
              <Link
                href={buyHref('Luanda', 'Benguela')}
                className="group inline-flex w-full sm:w-auto justify-center items-center gap-3 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-6 sm:px-7 py-4 text-base md:text-lg font-black text-stone-950 shadow-[0_10px_40px_rgba(245,158,11,0.45)] hover:shadow-[0_14px_50px_rgba(245,158,11,0.65)] hover:scale-[1.03] transition-all duration-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
                Bilhetes para Benguela
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>

              <Link
                href={buyHref('Benguela', 'Luanda')}
                className="group inline-flex w-full sm:w-auto justify-center items-center gap-3 rounded-2xl bg-white/95 px-6 sm:px-7 py-4 text-base md:text-lg font-black text-stone-900 shadow-xl hover:bg-white hover:scale-[1.03] transition-all duration-300"
              >
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Bilhetes para Luanda
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>

            <a
              href="#pesquisar"
              className="inline-flex items-center gap-2 mt-8 text-white/70 hover:text-amber-300 font-semibold text-sm transition-colors animate-fade-in-up"
              style={{ animationDelay: '0.4s' }}
            >
              <svg className="w-4 h-4 animate-floaty" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              Ou pesquisa outra rota abaixo
            </a>
          </div>
        </div>

        {/* Slide dots */}
        <div className="hidden md:flex flex-col gap-3 absolute right-8 top-1/2 -translate-y-1/2 z-30">
          {HERO_SLIDES.map((slide, i) => (
            <button
              key={slide.src}
              onClick={() => setHeroIndex(i)}
              aria-label={`Imagem ${i + 1}`}
              className={`w-2.5 rounded-full transition-all duration-500 ${
                i === heroIndex ? 'h-10 bg-amber-400' : 'h-2.5 bg-white/40 hover:bg-white/70'
              }`}
            />
          ))}
        </div>

        {/* Samakaka edge */}
        <div className="samakaka-strip absolute bottom-0 inset-x-0 z-20 opacity-90"></div>
      </section>

      {/* ============ SEARCH (overlapping hero) ============ */}
      <div id="pesquisar" className="relative w-full max-w-5xl px-4 mx-auto -mt-44 z-30 scroll-mt-24">
        <Suspense>
          <SearchForm />
        </Suspense>

        {/* Trust chips */}
        <div className="flex flex-wrap justify-center gap-3 mt-6">
          {[
            {
              label: 'Pagamento por referência Multicaixa',
              icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
            },
            {
              label: 'Bilhete digital no telemóvel',
              icon: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z',
            },
            {
              label: 'Escolhes o teu lugar',
              icon: 'M5 13l4 4L19 7',
            },
          ].map((chip) => (
            <div
              key={chip.label}
              className="flex items-center gap-2 rounded-full bg-white dark:bg-stone-800 px-4 py-2 shadow-md border border-amber-100 dark:border-stone-700"
            >
              <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={chip.icon} />
              </svg>
              <span className="text-xs md:text-sm font-semibold text-stone-700 dark:text-stone-200">{chip.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ============ PROVINCE MARQUEE ============ */}
      <div className="mt-16 bg-stone-950 py-5 overflow-hidden" aria-hidden="true">
        <div className="flex w-max animate-marquee">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex items-center shrink-0">
              {MARQUEE_STOPS.map((stop) => (
                <span key={`${copy}-${stop}`} className="flex items-center">
                  <span className="text-amber-400/90 font-bold tracking-[0.3em] text-sm uppercase px-6">
                    {stop}
                  </span>
                  <svg className="w-3 h-3 text-orange-600" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M6 0l6 6-6 6-6-6z" />
                  </svg>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ============ DESTAQUES: BENGUELA / LUANDA ============ */}
      <section className="py-24 px-4 bg-gradient-to-b from-stone-50 via-amber-50/60 to-stone-50 dark:from-stone-950 dark:via-stone-900 dark:to-stone-950 relative overflow-hidden">
        <div className="absolute inset-0 samakaka-bg opacity-40 dark:opacity-10"></div>
        <div className="absolute top-20 -left-32 w-96 h-96 bg-amber-300/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 -right-32 w-96 h-96 bg-orange-400/15 rounded-full blur-3xl"></div>

        <div className="max-w-6xl mx-auto relative z-10">
          <Reveal className="text-center mb-14">
            <span className="text-amber-600 dark:text-amber-400 font-bold tracking-[0.3em] text-xs uppercase">
              Rotas em destaque
            </span>
            <h2 className="text-4xl md:text-6xl font-black tracking-tight text-stone-900 dark:text-white mt-4 mb-4">
              Compra o teu <span className="bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">bilhete</span>
            </h2>
            <p className="text-lg text-stone-600 dark:text-stone-300 max-w-2xl mx-auto">
              Viagens diárias entre as duas maiores cidades do litoral. Parte hoje mesmo.
            </p>
          </Reveal>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Benguela card */}
            <Reveal>
              <Link href={buyHref('Luanda', 'Benguela')} className="block group">
                <TiltCard className="rounded-3xl h-[440px]">
                  <div className="absolute inset-0 rounded-3xl overflow-hidden shadow-2xl">
                    <Image
                      src="/heros/img2.png"
                      alt="Viagem para Benguela ao pôr-do-sol"
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/20 to-transparent"></div>
                    <div className="absolute top-5 left-5 rounded-full bg-stone-950/60 backdrop-blur-sm border border-amber-400/40 px-4 py-1.5 text-xs font-bold tracking-widest text-amber-300 uppercase">
                      Desde Luanda
                    </div>
                  </div>
                  <div className="absolute bottom-0 inset-x-0 p-7 tilt-pop">
                    <h3 className="text-4xl md:text-5xl font-black text-white mb-1">Benguela</h3>
                    <p className="text-amber-200/90 font-medium mb-5">Praias, sol e a Baía Azul à tua espera.</p>
                    <span className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-3 font-black text-stone-950 shadow-lg group-hover:shadow-amber-500/50 group-hover:scale-105 transition-all duration-300">
                      Comprar bilhete
                      <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </span>
                  </div>
                </TiltCard>
              </Link>
            </Reveal>

            {/* Luanda card */}
            <Reveal delay={120}>
              <Link href={buyHref('Benguela', 'Luanda')} className="block group">
                <TiltCard className="rounded-3xl h-[440px]">
                  <div className="absolute inset-0 rounded-3xl overflow-hidden shadow-2xl">
                    <Image
                      src="/heros/img5.png"
                      alt="Viagem para Luanda, a capital"
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/20 to-transparent"></div>
                    <div className="absolute top-5 left-5 rounded-full bg-stone-950/60 backdrop-blur-sm border border-amber-400/40 px-4 py-1.5 text-xs font-bold tracking-widest text-amber-300 uppercase">
                      Desde Benguela
                    </div>
                  </div>
                  <div className="absolute bottom-0 inset-x-0 p-7 tilt-pop">
                    <h3 className="text-4xl md:text-5xl font-black text-white mb-1">Luanda</h3>
                    <p className="text-amber-200/90 font-medium mb-5">A capital, a marginal e mil oportunidades.</p>
                    <span className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-black text-stone-900 shadow-lg group-hover:scale-105 transition-all duration-300">
                      Comprar bilhete
                      <svg className="w-5 h-5 text-amber-600 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </span>
                  </div>
                </TiltCard>
              </Link>
            </Reveal>
          </div>

          {/* ============ ALUGUER DE FRETE BANNER ============ */}
          <Reveal delay={100} className="mt-8">
            <div id="frete" className="scroll-mt-24">
              <TiltCard className="rounded-3xl min-h-[340px]" maxTilt={5}>
                <div className="absolute inset-0 rounded-3xl overflow-hidden shadow-2xl">
                  <Image
                    src="/heros/img3.png"
                    alt="Autocarro NawaBus disponível para aluguer de frete"
                    fill
                    sizes="100vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-stone-950/30 via-transparent to-amber-50/40"></div>
                </div>
                <div className="relative min-h-[340px] flex items-center justify-end p-6 md:p-12">
                  <div className="tilt-pop-sm max-w-lg w-full rounded-2xl bg-white/90 dark:bg-stone-900/90 backdrop-blur-md p-8 shadow-2xl border-2 border-amber-400/60">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="samakaka-strip w-12 rounded-full"></span>
                      <span className="text-amber-700 dark:text-amber-400 font-bold tracking-[0.25em] text-xs uppercase">
                        Para grupos e empresas
                      </span>
                    </div>
                    <h3 className="text-3xl md:text-4xl font-black text-stone-900 dark:text-white mb-3">
                      Aluguer de <span className="text-amber-600">Frete</span>
                    </h3>
                    <p className="text-stone-600 dark:text-stone-300 leading-relaxed mb-6">
                      Autocarros modernos para eventos, excursões, igrejas e empresas.
                      Pede o teu orçamento em minutos — respondemos no máximo em 24 horas.
                    </p>
                    <div className="flex flex-wrap items-center gap-4">
                      <button
                        type="button"
                        onClick={() => setFreteOpen(true)}
                        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-3.5 font-black text-stone-950 shadow-lg hover:shadow-amber-500/50 hover:scale-105 transition-all duration-300"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Pedir orçamento
                      </button>
                      <a
                        href="tel:+244930533405"
                        className="inline-flex items-center gap-2 font-bold text-stone-700 dark:text-stone-200 hover:text-amber-600 transition-colors"
                      >
                        <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        +244 930 533 405
                      </a>
                    </div>
                  </div>
                </div>
              </TiltCard>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ COMO FUNCIONA ============ */}
      <section className="py-24 px-4 bg-white dark:bg-stone-900 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-100 dark:bg-amber-900/10 rounded-full blur-3xl opacity-60"></div>

        <div className="max-w-6xl mx-auto relative z-10">
          <Reveal className="text-center mb-16">
            <span className="text-amber-600 dark:text-amber-400 font-bold tracking-[0.3em] text-xs uppercase">
              Simples e rápido
            </span>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-stone-900 dark:text-white mt-4">
              Como funciona
            </h2>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Pesquisa a tua rota',
                text: 'Escolhe origem, destino e data. Vês logo os horários e preços disponíveis.',
                icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
              },
              {
                step: '02',
                title: 'Escolhe o teu lugar',
                text: 'Vê o mapa do autocarro e escolhe exatamente onde queres viajar.',
                icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
              },
              {
                step: '03',
                title: 'Paga e recebe no telemóvel',
                text: 'Paga por referência Multicaixa e o bilhete digital chega diretamente ao teu telemóvel.',
                icon: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z',
              },
            ].map((item, i) => (
              <Reveal key={item.step} delay={i * 120}>
                <div className="group relative rounded-2xl bg-gradient-to-b from-amber-50 to-white dark:from-stone-800 dark:to-stone-900 p-8 border border-amber-100 dark:border-stone-700 shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 h-full">
                  <div className="text-6xl font-black bg-gradient-to-b from-amber-300 to-orange-400 bg-clip-text text-transparent mb-4 select-none">
                    {item.step}
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-4 group-hover:rotate-6 group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                    </svg>
                  </div>
                  <h3 className="text-xl font-black text-stone-900 dark:text-white mb-2">{item.title}</h3>
                  <p className="text-stone-600 dark:text-stone-300 leading-relaxed text-sm">{item.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ SERVIÇOS ============ */}
      <section id="servicos" className="py-24 px-4 bg-gradient-to-b from-stone-50 to-amber-50/50 dark:from-stone-950 dark:to-stone-900 relative overflow-hidden scroll-mt-24">
        <div className="absolute inset-0 samakaka-bg opacity-30 dark:opacity-10"></div>

        <div className="max-w-6xl mx-auto relative z-10">
          <Reveal className="text-center mb-16">
            <span className="text-amber-600 dark:text-amber-400 font-bold tracking-[0.3em] text-xs uppercase">
              Muito mais que bilhetes
            </span>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-stone-900 dark:text-white mt-4 mb-4">
              Os nossos <span className="bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">serviços</span>
            </h2>
            <p className="text-lg text-stone-600 dark:text-stone-300 max-w-2xl mx-auto">
              Soluções completas de mobilidade e turismo para todas as tuas necessidades
            </p>
          </Reveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: 'Bilhetes Interprovinciais',
                text: 'Venda regular de bilhetes de passagem para todas as províncias angolanas, com reservas fáceis e seguras através da nossa plataforma digital ou rede física.',
                icon: 'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z',
              },
              {
                title: 'Aluguer de Viaturas',
                text: 'Autocarros e miniautocarros modernos e confortáveis disponíveis para aluguer, ideais para grupos, eventos corporativos ou viagens em família.',
                icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
              },
              {
                title: 'Fretamento Corporativo',
                text: 'Soluções personalizadas de transporte para empresas, garantindo mobilidade eficiente e segura para colaboradores e equipas.',
                icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
              },
              {
                title: 'Envio de Encomendas Nacional',
                text: 'Serviço confiável de transporte de mercadorias e encomendas para todo o território angolano, com rastreamento e segurança garantida.',
                icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
              },
              {
                title: 'Pacotes Turísticos',
                text: 'Distribuição de experiências turísticas únicas que destacam a beleza e diversidade cultural de Angola, desde praias paradisíacas às maravilhas do interior.',
                icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
              },
            ].map((service, i) => (
              <Reveal key={service.title} delay={(i % 3) * 100} className={i === 4 ? 'md:col-span-2 lg:col-span-1' : ''}>
                <div className="group relative rounded-2xl bg-white dark:bg-stone-800 p-7 shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 overflow-hidden h-full border-t-4 border-amber-500">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
                  <div className="relative">
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center mb-4 group-hover:rotate-6 transition-transform duration-300">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={service.icon} />
                      </svg>
                    </div>
                    <h3 className="text-xl font-black text-stone-900 dark:text-white mb-3">{service.title}</h3>
                    <p className="text-stone-600 dark:text-stone-300 leading-relaxed text-sm">{service.text}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ HISTÓRIA / SOBRE ============ */}
      <section id="sobre" className="relative bg-stone-950 overflow-hidden scroll-mt-24">
        <div className="samakaka-strip opacity-80"></div>
        <div className="py-24 px-4 relative">
          <div className="absolute top-20 left-10 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl"></div>

          <div className="max-w-6xl mx-auto relative z-10">
            <div className="grid md:grid-cols-2 gap-14 items-center">
              <Reveal>
                <TiltCard className="rounded-3xl h-[420px]" maxTilt={7}>
                  <div className="absolute inset-0 rounded-3xl overflow-hidden shadow-2xl border border-amber-500/30">
                    <Image
                      src="/nawabusimg.jpg"
                      alt="NAWABUS Angola"
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-stone-950/70 to-transparent"></div>
                  </div>
                  <div className="absolute bottom-6 left-6 tilt-pop">
                    <div className="rounded-xl bg-stone-950/70 backdrop-blur-md border border-amber-400/40 px-5 py-3">
                      <span className="text-amber-300 font-black text-lg">Desde 2019</span>
                      <span className="block text-white/70 text-sm">a mover Angola</span>
                    </div>
                  </div>
                </TiltCard>
              </Reveal>

              <Reveal delay={120}>
                <span className="text-amber-400 font-bold tracking-[0.3em] text-xs uppercase">
                  A nossa história
                </span>
                <h2 className="text-4xl md:text-5xl font-black tracking-tight text-white mt-4 mb-6">
                  Sobre a <span className="bg-gradient-to-r from-amber-300 to-orange-500 bg-clip-text text-transparent">NAWABUS</span>
                </h2>
                <p className="text-lg text-stone-300 leading-relaxed mb-4">
                  A <strong className="text-amber-400">NAWABUS, LDA</strong> é uma startup inovadora que está a
                  revolucionar o sector de Transportes e Turismo em Angola. Desde <strong className="text-white">2019</strong>,
                  construímos soluções digitais que melhoram a experiência de viagem dos angolanos —
                  conectando pessoas, destinos e oportunidades.
                </p>
                <p className="text-stone-400 leading-relaxed mb-8">
                  Atuamos no transporte rodoviário de passageiros com viagens interprovinciais,
                  transporte de mercadorias, experiências turísticas e transfers para todo o território nacional.
                </p>

                {/* Stats */}
                <div className="flex items-center gap-8 flex-wrap mb-8">
                  <div>
                    <div className="text-4xl font-black bg-gradient-to-r from-amber-300 to-orange-500 bg-clip-text text-transparent">2019</div>
                    <div className="text-stone-400 text-sm">Fundação</div>
                  </div>
                  <div className="w-px h-12 bg-stone-700"></div>
                  <div>
                    <div className="text-4xl font-black bg-gradient-to-r from-amber-300 to-orange-500 bg-clip-text text-transparent">21</div>
                    <div className="text-stone-400 text-sm">Províncias</div>
                  </div>
                  <div className="w-px h-12 bg-stone-700"></div>
                  <div>
                    <div className="text-4xl font-black bg-gradient-to-r from-amber-300 to-orange-500 bg-clip-text text-transparent">100%</div>
                    <div className="text-stone-400 text-sm">Digital</div>
                  </div>
                </div>

                {/* Why us chips */}
                <div className="space-y-3">
                  {[
                    { title: 'Rede Integrada', text: 'Agências e quiosques por todo o país' },
                    { title: 'Conexão Inteligente', text: 'Operadoras e passageiros ligados por tecnologia' },
                    { title: 'Inovação Contínua', text: 'Gestão de viagens e encomendas simplificada' },
                  ].map((chip) => (
                    <div key={chip.title} className="flex items-center gap-4 rounded-xl bg-stone-900/80 border border-stone-800 px-5 py-3">
                      <div className="w-9 h-9 shrink-0 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                        <svg className="w-5 h-5 text-stone-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <span className="font-bold text-white">{chip.title}</span>
                        <span className="text-stone-400 text-sm block md:inline md:ml-2">{chip.text}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ============ NAWATUR ============ */}
      <section className="py-24 px-4 bg-gradient-to-br from-amber-50 via-white to-stone-100 dark:from-stone-900 dark:via-stone-800 dark:to-stone-950 relative overflow-hidden">
        <div className="absolute inset-0 samakaka-bg opacity-30 dark:opacity-10"></div>
        <div className="absolute top-10 right-20 w-72 h-72 bg-amber-200 dark:bg-amber-900/30 rounded-full blur-3xl opacity-30"></div>
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-stone-300 dark:bg-stone-700/30 rounded-full blur-3xl opacity-30"></div>

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <Reveal>
              <TiltCard className="rounded-3xl h-[400px]" maxTilt={7}>
                <a
                  href="https://www.nawatur.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block absolute inset-0 rounded-3xl overflow-hidden shadow-2xl border-2 border-amber-400/70 group cursor-pointer"
                >
                  <Image
                    src="/wallpaper.jpg"
                    alt="Nawatur Travel"
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-stone-900/20 to-transparent group-hover:from-stone-950/90 transition-all duration-300"></div>
                  <div className="absolute bottom-6 left-6 right-6">
                    <div className="bg-white/95 dark:bg-stone-800/95 backdrop-blur-md rounded-xl p-4 border-2 border-amber-400 dark:border-amber-400">
                      <div className="flex items-center justify-center gap-3">
                        <img src="/about-locationimage.png" alt="Nawatur Logo" className="w-12 h-12" />
                        <span className="text-amber-900 dark:text-amber-100 font-black text-lg">Nawatur</span>
                      </div>
                    </div>
                  </div>
                </a>
              </TiltCard>
            </Reveal>

            <Reveal delay={120} className="space-y-6">
              <div>
                <span className="text-amber-700 dark:text-amber-400 font-bold tracking-[0.3em] text-xs uppercase">
                  Turismo
                </span>
                <h2 className="text-4xl md:text-5xl font-black tracking-tight text-stone-800 dark:text-white mt-4 mb-4">
                  Descobre Angola com a <span className="bg-gradient-to-r from-yellow-500 to-amber-500 bg-clip-text text-transparent">Nawatur</span>
                </h2>
              </div>

              <p className="text-xl text-stone-700 dark:text-stone-200 leading-relaxed">
                A Nawatur ajuda-te a viajar com confiança — dentro de Angola e para o mundo.
                Organizamos experiências seguras, memoráveis e acessíveis, desde praias tropicais
                em Benguela até aventuras culturais pelo país.
              </p>

              <a
                href="https://www.nawatur.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 bg-gradient-to-r from-yellow-400 to-amber-500 text-stone-950 px-8 py-4 rounded-xl font-black text-lg hover:from-yellow-500 hover:to-amber-600 transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-105 group"
              >
                <span>Explora com a Nawatur</span>
                <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>

              <div className="flex items-center gap-6 pt-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-stone-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-stone-700 dark:text-stone-200 font-semibold">Experiências Seguras</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-stone-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-stone-700 dark:text-stone-200 font-semibold">Memoráveis</span>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============ PARCEIROS (ads) ============ */}
      <section id="parceiros" className="py-24 px-4 bg-gradient-to-br from-stone-50 via-amber-50/60 to-stone-50 dark:from-stone-950 dark:via-stone-900 dark:to-stone-950 relative overflow-hidden scroll-mt-24">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-200/30 dark:bg-amber-900/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-300/20 dark:bg-orange-800/10 rounded-full blur-3xl"></div>

        <div className="max-w-7xl mx-auto relative z-10">
          <Reveal className="text-center mb-16">
            <span className="text-amber-600 dark:text-amber-400 font-bold tracking-[0.3em] text-xs uppercase">
              Quem viaja connosco
            </span>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-stone-900 dark:text-white mt-4 mb-4">
              Os nossos <span className="bg-gradient-to-r from-yellow-500 to-amber-500 bg-clip-text text-transparent">parceiros</span>
            </h2>
            <p className="text-lg text-stone-600 dark:text-stone-300 max-w-2xl mx-auto">
              Descubra as marcas que confiam em nós
            </p>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-8 items-center relative">
            {/* Ad Series 1: masterplanangola */}
            <div className={`absolute inset-0 grid md:grid-cols-3 gap-8 items-center transition-opacity duration-1000 ${currentAdSeries === 1 ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>
              <a
                href="https://masterplanangola.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden md:block group relative h-[400px] rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-500 animate-fade-in-left cursor-pointer"
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <Image
                  src="/ads/ad1left.jpg"
                  alt="Masterplan Angola"
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                />
                <div className="absolute inset-0 ring-2 ring-amber-500/0 group-hover:ring-amber-500/50 transition-all duration-300 rounded-2xl"></div>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="bg-gradient-to-r from-yellow-400 to-amber-500 text-stone-950 px-6 py-3 rounded-full font-black shadow-2xl transform group-hover:scale-110 transition-transform duration-300">
                    Visitar Site
                  </div>
                </div>
              </a>

              <a
                href="https://masterplanangola.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative h-[400px] rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-500 animate-fade-in-up md:scale-105 cursor-pointer block"
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <Image
                  src="/ads/ad1center.jpg"
                  alt="Masterplan Angola - Destaque"
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                />
                <div className="absolute inset-0 ring-2 ring-amber-500/0 group-hover:ring-amber-500/50 transition-all duration-300 rounded-2xl"></div>
                <div className="absolute top-4 right-4 bg-gradient-to-r from-yellow-400 to-amber-500 text-stone-950 px-4 py-2 rounded-full text-sm font-black shadow-lg">
                  Destaque
                </div>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="bg-gradient-to-r from-yellow-400 to-amber-500 text-stone-950 px-6 py-3 rounded-full font-black shadow-2xl transform group-hover:scale-110 transition-transform duration-300">
                    Visitar Site
                  </div>
                </div>
              </a>

              <a
                href="https://masterplanangola.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden md:block group relative h-[400px] rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-500 animate-fade-in-right cursor-pointer"
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <Image
                  src="/ads/ad1right.jpg"
                  alt="Masterplan Angola"
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                />
                <div className="absolute inset-0 ring-2 ring-amber-500/0 group-hover:ring-amber-500/50 transition-all duration-300 rounded-2xl"></div>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="bg-gradient-to-r from-yellow-400 to-amber-500 text-stone-950 px-6 py-3 rounded-full font-black shadow-2xl transform group-hover:scale-110 transition-transform duration-300">
                    Visitar Site
                  </div>
                </div>
              </a>
            </div>

            {/* Ad Series 2: nawatur */}
            <div className={`absolute inset-0 grid md:grid-cols-3 gap-8 items-center transition-opacity duration-1000 ${currentAdSeries === 2 ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>
              <a
                href="https://www.nawatur.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden md:block group relative h-[400px] rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-500 cursor-pointer"
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <Image
                  src="/ads/ad2left.jpg"
                  alt="Nawatur"
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                />
                <div className="absolute inset-0 ring-2 ring-amber-500/0 group-hover:ring-amber-500/50 transition-all duration-300 rounded-2xl"></div>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="bg-gradient-to-r from-yellow-400 to-amber-500 text-stone-950 px-6 py-3 rounded-full font-black shadow-2xl transform group-hover:scale-110 transition-transform duration-300">
                    Visitar Site
                  </div>
                </div>
              </a>

              <a
                href="https://www.nawatur.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative h-[400px] rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-500 md:scale-105 cursor-pointer block"
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <Image
                  src="/ads/ad2center.jpeg"
                  alt="Nawatur - Destaque"
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                />
                <div className="absolute inset-0 ring-2 ring-amber-500/0 group-hover:ring-amber-500/50 transition-all duration-300 rounded-2xl"></div>
                <div className="absolute top-4 right-4 bg-gradient-to-r from-yellow-400 to-amber-500 text-stone-950 px-4 py-2 rounded-full text-sm font-black shadow-lg">
                  Destaque
                </div>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="bg-gradient-to-r from-yellow-400 to-amber-500 text-stone-950 px-6 py-3 rounded-full font-black shadow-2xl transform group-hover:scale-110 transition-transform duration-300">
                    Visitar Site
                  </div>
                </div>
              </a>

              <a
                href="https://www.nawatur.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden md:block group relative h-[400px] rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-500 cursor-pointer"
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <Image
                  src="/ads/ad2ri.jpg"
                  alt="Nawatur"
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                />
                <div className="absolute inset-0 ring-2 ring-amber-500/0 group-hover:ring-amber-500/50 transition-all duration-300 rounded-2xl"></div>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="bg-gradient-to-r from-yellow-400 to-amber-500 text-stone-950 px-6 py-3 rounded-full font-black shadow-2xl transform group-hover:scale-110 transition-transform duration-300">
                    Visitar Site
                  </div>
                </div>
              </a>
            </div>

            {/* Spacer to maintain height */}
            <div className="h-[400px] col-span-full md:col-span-1"></div>
            <div className="h-[400px] hidden md:block"></div>
            <div className="h-[400px] hidden md:block"></div>
          </div>
        </div>
      </section>

      {/* ============ MISSÃO ============ */}
      <section className="relative overflow-hidden">
        <div className="samakaka-strip"></div>
        <div className="py-24 px-4 bg-gradient-to-br from-yellow-400 via-amber-400 to-amber-500 relative">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-full h-full" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}></div>
          </div>

          <div className="max-w-4xl mx-auto relative z-10 text-center">
            <Reveal>
              <h2 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-10">
                A Nossa Missão
              </h2>

              <div className="bg-white/10 backdrop-blur-md rounded-3xl p-10 border border-white/20 shadow-2xl">
                <p className="text-xl md:text-2xl text-white leading-relaxed mb-8 font-light">
                  Contribuir ativamente para o melhoramento da qualidade de vida da população angolana
                  através de soluções de transporte acessíveis, seguras e eficientes
                </p>

                <div className="relative">
                  <div className="absolute -left-4 top-0 text-6xl text-white/30">&ldquo;</div>
                  <div className="absolute -right-4 bottom-0 text-6xl text-white/30">&rdquo;</div>
                  <p className="text-lg md:text-xl text-white italic font-medium px-8">
                    Conectamos Angola, uma viagem de cada vez, com tecnologia, compromisso e inovação
                    ao serviço das pessoas
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="bg-stone-950 pt-16 pb-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-12 mb-12">
            {/* Brand */}
            <div>
              <img src="/nawabus_logo_white.webp" alt="NawaBus" className="h-10 w-auto mb-4" />
              <p className="text-stone-400 text-sm leading-relaxed mb-6">
                Bilhetes de autocarro online para toda Angola. Orgulhosamente angolana, desde 2019.
              </p>
              <div className="flex items-center gap-3">
                <a
                  href="https://www.facebook.com/nawabus0"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="w-10 h-10 rounded-full bg-stone-900 border border-stone-800 flex items-center justify-center text-stone-400 hover:text-amber-400 hover:border-amber-500/50 hover:scale-110 transition-all duration-300"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </a>
                <a
                  href="https://www.instagram.com/nawabus_lda/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="w-10 h-10 rounded-full bg-stone-900 border border-stone-800 flex items-center justify-center text-stone-400 hover:text-amber-400 hover:border-amber-500/50 hover:scale-110 transition-all duration-300"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </a>
                <a
                  href="https://ao.linkedin.com/company/nawabus"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn"
                  className="w-10 h-10 rounded-full bg-stone-900 border border-stone-800 flex items-center justify-center text-stone-400 hover:text-amber-400 hover:border-amber-500/50 hover:scale-110 transition-all duration-300"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Links */}
            <div>
              <h4 className="text-white font-black uppercase tracking-widest text-sm mb-5">Navegação</h4>
              <ul className="space-y-3 text-sm">
                <li>
                  <Link href={buyHref('Luanda', 'Benguela')} className="text-stone-400 hover:text-amber-400 transition-colors font-medium">
                    Bilhetes para Benguela
                  </Link>
                </li>
                <li>
                  <Link href={buyHref('Benguela', 'Luanda')} className="text-stone-400 hover:text-amber-400 transition-colors font-medium">
                    Bilhetes para Luanda
                  </Link>
                </li>
                <li>
                  <a href="#frete" className="text-stone-400 hover:text-amber-400 transition-colors font-medium">
                    Aluguer de Frete
                  </a>
                </li>
                <li>
                  <a href="#servicos" className="text-stone-400 hover:text-amber-400 transition-colors font-medium">
                    Nossos Serviços
                  </a>
                </li>
                <li>
                  <a href="#sobre" className="text-stone-400 hover:text-amber-400 transition-colors font-medium">
                    Sobre Nós
                  </a>
                </li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-white font-black uppercase tracking-widest text-sm mb-5">Contactos</h4>
              <ul className="space-y-3 text-sm text-stone-400">
                <li>
                  <a href="tel:+244930533405" className="flex items-center gap-3 hover:text-amber-400 transition-colors font-medium">
                    <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    +244 930 533 405
                  </a>
                </li>
                <li className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Luanda, Angola
                </li>
                <li className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  NIF: 5000451738
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-stone-800 flex flex-col md:flex-row items-center justify-between gap-4 text-stone-500 text-sm">
            <p>&copy; {new Date().getFullYear()} Nawabus. Todos os direitos reservados.</p>
            <a href="#termos" className="hover:text-amber-400 transition-colors">
              Termos e Políticas
            </a>
          </div>
        </div>
      </footer>

      {/* Frete request modal */}
      <FreteModal open={freteOpen} onOpenChange={setFreteOpen} />

      {/* Floating WhatsApp */}
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Falar connosco no WhatsApp"
        className="fixed bottom-5 left-5 z-50 w-14 h-14 rounded-full bg-[#25D366] shadow-[0_8px_30px_rgba(37,211,102,0.5)] flex items-center justify-center hover:scale-110 transition-transform duration-300"
      >
        <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      </a>
    </main>
  );
}
