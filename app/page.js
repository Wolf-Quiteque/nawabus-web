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

    </main>
  );
}