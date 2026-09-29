'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Caveat } from 'next/font/google';
import { ArrowLeft, ArrowRight, Loader2, MapPin, Minus, Plus, UsersRound } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  MANGAIS_EVENT,
  MANGAIS_MAX_PASSENGERS,
  MANGAIS_POINTS,
  availableMangaisProducts,
  findMangaisPoint,
  findMangaisProduct,
  formatEventKz,
  isMangaisSaleOpen,
  mangaisPointLabel,
  mangaisProductPrice,
} from '@/lib/events/mangais';
import { buildMangaisBookingDetails, fetchMangaisLegs } from '@/lib/events/mangais-booking';

const script = Caveat({ subsets: ['latin'], weight: ['600', '700'] });

// Poster palette: forest green, the lime-yellow of "Pontos de recolha", cream text.
const LIME = 'text-[#e4f46f]';

// Below this many places left, the page says how many remain.
const FEW_PLACES = 40;

function emptyCompanion() {
  return { name: '', phone: '' };
}

export default function MangaisPage() {
  const router = useRouter();
  const [productCode, setProductCode] = useState('');
  const [pointCode, setPointCode] = useState('');
  const [passengers, setPassengers] = useState(1);
  const [countConfirmed, setCountConfirmed] = useState(false);
  const [companions, setCompanions] = useState([]);
  const [namesConfirmed, setNamesConfirmed] = useState(false);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState('');

  // Places left per direction (the staff can change the limit in /mang or NAWASOFT).
  const [availability, setAvailability] = useState(null);
  useEffect(() => {
    fetch('/api/events/mangais/availability', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => body && setAvailability(body))
      .catch(() => {});
  }, []);

  const saleOpen = isMangaisSaleOpen();
  // Unknown until loaded: nothing is hidden meanwhile, the server checks again anyway.
  const placesLeft = (leg) => availability?.[leg]?.available ?? Infinity;
  const placesFor = (item) => Math.min(...item.legs.map(placesLeft));
  const timeOpenProducts = useMemo(() => availableMangaisProducts(), []);
  const products = timeOpenProducts.filter((item) => placesFor(item) > 0);
  const soldOutLegs = ['outbound', 'return'].filter((leg) => placesLeft(leg) <= 0);
  const product = findMangaisProduct(productCode);
  const maxPassengers = product
    ? Math.max(1, Math.min(MANGAIS_MAX_PASSENGERS, placesFor(product)))
    : MANGAIS_MAX_PASSENGERS;
  const point = findMangaisPoint(pointCode);
  const total = mangaisProductPrice(productCode, passengers);

  const step = !productCode
    ? 'product'
    : !pointCode
      ? 'point'
      : !countConfirmed
        ? 'count'
        : passengers > 1 && !namesConfirmed
          ? 'names'
          : 'review';

  const setCount = (next) => {
    const count = Math.max(1, Math.min(maxPassengers, next));
    setPassengers(count);
    setCompanions((current) => Array.from({ length: count - 1 }, (_, i) => current[i] || emptyCompanion()));
  };

  const updateCompanion = (index, field, value) => {
    setCompanions((current) => current.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const goBack = () => {
    setError('');
    if (step === 'point') setProductCode('');
    else if (step === 'count') setPointCode('');
    else if (step === 'names') setCountConfirmed(false);
    else if (step === 'review') {
      if (passengers > 1) setNamesConfirmed(false);
      else setCountConfirmed(false);
    }
  };

  const continueToCheckout = async () => {
    setBuilding(true);
    setError('');
    try {
      const legs = await fetchMangaisLegs({ product: productCode, point: pointCode, passengers });
      const details = buildMangaisBookingDetails({ legs, productCode, pointCode, companions });
      sessionStorage.setItem('bookingDetails', JSON.stringify(details));
      router.push('/checkout');
    } catch (err) {
      setError(err.message || 'Não foi possível preparar a compra.');
      setBuilding(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0b2412] text-[#fbfbe8]">
      <div className="pointer-events-none fixed inset-0">
        <Image src="/wallpaper.jpg" alt="" fill priority sizes="100vw" className="object-cover opacity-20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(228,244,111,0.22),transparent_45%),linear-gradient(160deg,rgba(18,64,28,0.94)_0%,rgba(10,40,18,0.95)_55%,rgba(5,20,9,0.98)_100%)]" />
      </div>

      <section className="relative z-10 mx-auto flex w-full max-w-6xl flex-col px-4 pb-10 pt-5 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-sm font-bold backdrop-blur-md transition hover:bg-white/15"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
          <img src="/nawabus_logo_white.webp" alt="Nawabus" className="h-9 w-auto sm:h-11" />
        </div>

        <div className="grid items-center gap-8 pt-8 lg:grid-cols-[1fr_1.05fr] lg:gap-12">
          <EventPoster />

          <div className="relative rounded-[2rem] border border-white/15 bg-white/[0.08] p-4 shadow-2xl shadow-black/40 backdrop-blur-2xl sm:p-6">
            {!saleOpen ? (
              <Notice text="As vendas para o Brunch Mangais terminaram. Obrigado a todos os que viajaram connosco!" />
            ) : (
              <>
                {error && <Notice text={error} tone="error" />}

                <Step active={step === 'product'}>
                  <QuestionTitle title="O que queres comprar?" description="Transporte de ida e volta para o Brunch Mangais. Não precisas de escolher lugar." />
                  <div className="grid gap-3">
                    {products.map((item) => (
                      <ChoiceButton
                        key={item.code}
                        title={item.title}
                        detail={
                          placesFor(item) <= FEW_PLACES
                            ? `${item.detail} · restam ${placesFor(item)} ${placesFor(item) === 1 ? 'lugar' : 'lugares'}`
                            : item.detail
                        }
                        badge={formatEventKz(mangaisProductPrice(item.code, 1))}
                        onClick={() => {
                          setProductCode(item.code);
                          setCount(Math.min(passengers, placesFor(item)));
                        }}
                      />
                    ))}
                    {products.length === 0 && (
                      <Notice text="Os lugares para o Brunch Mangais esgotaram. Obrigado pelo interesse!" />
                    )}
                    {products.length > 0 && soldOutLegs.length === 1 && (
                      <Notice text={soldOutLegs[0] === 'outbound' ? 'A ida para Mangais esgotou. Ainda há lugares para a volta.' : 'A volta de Mangais esgotou. Ainda há lugares para a ida.'} />
                    )}
                    {products.length > 0 && soldOutLegs.length === 0 && timeOpenProducts.length < 3 && (
                      <Notice text={`Os autocarros de ida já partiram às ${MANGAIS_EVENT.boardingTime}. Ainda podes comprar a volta.`} />
                    )}
                  </div>
                </Step>

                <Step active={step === 'point'}>
                  <QuestionTitle
                    title="Ponto de recolha"
                    description={
                      product?.legs.includes('outbound')
                        ? `Onde entras no autocarro às ${MANGAIS_EVENT.boardingTime}.${product.legs.includes('return') ? ' O regresso deixa-te no mesmo ponto.' : ''}`
                        : `Onde queres ficar no regresso das ${MANGAIS_EVENT.returnTime}.`
                    }
                  />
                  <div className="grid gap-3">
                    {MANGAIS_POINTS.map((item) => (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => setPointCode(item.code)}
                        className="group flex w-full items-center justify-between gap-4 rounded-[1.4rem] border border-white/12 bg-white/10 p-4 text-left transition duration-300 hover:-translate-y-0.5 hover:border-[#e4f46f] hover:bg-[#e4f46f] hover:text-[#10321a]"
                      >
                        <span className="flex items-start gap-3">
                          <MapPin className={`mt-1 h-5 w-5 shrink-0 ${LIME} group-hover:text-[#10321a]`} />
                          <span>
                            <span className={`block text-sm font-black uppercase tracking-[0.14em] ${LIME} group-hover:text-[#10321a]`}>{item.area}</span>
                            <span className="block text-xl font-black">{item.place}</span>
                          </span>
                        </span>
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fbfbe8] text-[#10321a]">
                          <ArrowRight className="h-5 w-5" />
                        </span>
                      </button>
                    ))}
                  </div>
                </Step>

                <Step active={step === 'count'}>
                  <QuestionTitle title="Quantas pessoas vão?" description="Conta contigo. Todos viajam no mesmo carro, a partir do mesmo ponto." />
                  <div className="mx-auto flex max-w-xs items-center justify-center gap-4 rounded-[1.7rem] border border-white/15 bg-white/10 p-5">
                    <button
                      type="button"
                      aria-label="Menos uma pessoa"
                      onClick={() => setCount(passengers - 1)}
                      disabled={passengers <= 1}
                      className="flex h-12 w-12 items-center justify-center rounded-full bg-[#fbfbe8] text-[#10321a] transition hover:bg-white disabled:opacity-40"
                    >
                      <Minus className="h-5 w-5" />
                    </button>
                    <div className="min-w-20 text-center">
                      <p className="text-5xl font-black">{passengers}</p>
                      <p className={`text-xs font-bold uppercase tracking-[0.14em] ${LIME}`}>
                        {passengers === 1 ? 'pessoa' : 'pessoas'}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Mais uma pessoa"
                      onClick={() => setCount(passengers + 1)}
                      disabled={passengers >= maxPassengers}
                      className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e4f46f] text-[#10321a] transition hover:bg-[#eef8a0] disabled:opacity-40"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                  <p className="mt-3 text-center text-sm font-bold text-[#fbfbe8]/80">Total: {formatEventKz(total)}</p>
                  {maxPassengers < MANGAIS_MAX_PASSENGERS && (
                    <p className={`mt-1 text-center text-xs font-bold ${LIME}`}>
                      Só {maxPassengers === 1 ? 'resta 1 lugar' : `restam ${maxPassengers} lugares`} para esta opção.
                    </p>
                  )}
                  <PrimaryButton onClick={() => setCountConfirmed(true)}>Continuar</PrimaryButton>
                </Step>

                <Step active={step === 'names'}>
                  <QuestionTitle title="Quem vai contigo?" description="O nome aparece no bilhete de cada pessoa. O telefone é opcional." />
                  <div className="max-h-[22rem] space-y-3 overflow-y-auto pr-1">
                    {companions.map((companion, index) => (
                      <div key={index} className="rounded-2xl border border-white/12 bg-white/10 p-3">
                        <p className={`mb-2 text-sm font-black ${LIME}`}>Pessoa {index + 2}</p>
                        <div className="grid gap-2 sm:grid-cols-[1fr_11rem]">
                          <Input
                            value={companion.name}
                            onChange={(event) => updateCompanion(index, 'name', event.target.value)}
                            placeholder="Nome completo"
                            autoComplete="off"
                            className="h-11 border-white/20 bg-white text-gray-950"
                          />
                          <Input
                            value={companion.phone}
                            onChange={(event) => updateCompanion(index, 'phone', event.target.value)}
                            placeholder="Telefone (opcional)"
                            inputMode="tel"
                            className="h-11 border-white/20 bg-white text-gray-950"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <PrimaryButton
                    onClick={() => setNamesConfirmed(true)}
                    disabled={companions.some((companion) => !companion.name.trim())}
                  >
                    Continuar
                  </PrimaryButton>
                </Step>

                <Step active={step === 'review'}>
                  <QuestionTitle title="Está tudo pronto" description="Pagas por referência Multicaixa. Os lugares ficam reservados durante 1 hora enquanto pagas." />
                  <div className="space-y-3 rounded-[1.5rem] border border-white/15 bg-white/10 p-4 text-sm font-bold">
                    <SummaryRow label="Evento" value={`${MANGAIS_EVENT.name} · ${MANGAIS_EVENT.weekday}, ${MANGAIS_EVENT.dateLabel}`} />
                    <SummaryRow label="Bilhete" value={product?.title || ''} />
                    <SummaryRow label="Ponto de recolha" value={mangaisPointLabel(point)} />
                    {product?.legs.includes('outbound') && <SummaryRow label="Embarque" value={MANGAIS_EVENT.boardingTime} />}
                    {product?.legs.includes('return') && <SummaryRow label="Regresso" value={MANGAIS_EVENT.returnTime} />}
                    <SummaryRow label="Pessoas" value={String(passengers)} />
                    <div className="border-t border-white/15 pt-3">
                      <SummaryRow label="Total" value={formatEventKz(total)} strong />
                    </div>
                  </div>
                  <PrimaryButton onClick={continueToCheckout} disabled={building} big>
                    {building ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        A preparar...
                      </>
                    ) : (
                      <>
                        Ir para pagamento
                        <ArrowRight className="h-5 w-5" />
                      </>
                    )}
                  </PrimaryButton>
                </Step>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#fbfbe8]/75">
                    <UsersRound className="h-4 w-4" />
                    {passengers} {passengers === 1 ? 'pessoa' : 'pessoas'}
                    {productCode ? ` · ${formatEventKz(total)}` : ''}
                  </div>
                  {step !== 'product' && (
                    <button
                      type="button"
                      onClick={goBack}
                      className="rounded-full border border-white/15 px-4 py-2 text-sm font-bold transition hover:bg-white/10"
                    >
                      Voltar
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

/** The event poster, redrawn: the green circle with the pickup points. */
function EventPoster() {
  return (
    <div className="mx-auto w-full max-w-[26rem] px-3 sm:px-5">
      <div className="relative">
      <div className="absolute -inset-3 rounded-full border border-white/35 sm:-inset-5" aria-hidden />
      <div className="relative flex aspect-square flex-col items-center justify-center rounded-full bg-[radial-gradient(circle_at_35%_28%,#5cc45c_0%,#34a043_42%,#217a30_100%)] px-8 text-center shadow-[0_30px_80px_rgba(0,0,0,0.45),inset_0_0_60px_rgba(255,255,255,0.12)]">
        <img src="/nawabus_logo_white.webp" alt="Nawabus" className="h-9 w-auto sm:h-11" />
        <p className={`mt-4 text-lg font-black sm:text-xl ${LIME}`}>Pontos de recolha:</p>
        <ul className="mt-2 space-y-1 text-[0.95rem] font-extrabold leading-snug sm:text-lg">
          {MANGAIS_POINTS.map((point) => (
            <li key={point.code}>
              <span className={LIME}>{point.area}:</span> {point.place}
            </li>
          ))}
        </ul>
        <p className={`${script.className} mt-3 text-4xl leading-none sm:text-5xl`}>
          Brunch <span className="text-[#fbfbe8]/90">mangais</span>
        </p>
        <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-[#fbfbe8]/85">
          Embarque {MANGAIS_EVENT.boardingTime} · Regresso {MANGAIS_EVENT.returnTime}
        </p>
      </div>
      </div>
      <div className="mt-8 text-center lg:text-left">
        <p className={`text-5xl font-black leading-none ${LIME}`}>
          {MANGAIS_EVENT.weekday.slice(0, 3).toUpperCase()}&rsquo;{MANGAIS_EVENT.dayNumber.padStart(2, '0')}
        </p>
        <p className={`text-xl font-black tracking-wide ${LIME}`}>
          {MANGAIS_EVENT.dateLabel.split(' ').pop().toUpperCase()}/{MANGAIS_EVENT.date.slice(0, 4)}
        </p>
        <p className="mt-2 text-sm font-semibold text-[#fbfbe8]/80">
          {MANGAIS_EVENT.venue}, {MANGAIS_EVENT.area} · ida e volta {formatEventKz(mangaisProductPrice('ida-e-volta', 1))}
        </p>
      </div>
    </div>
  );
}

function Step({ active, children }) {
  if (!active) return null;
  return <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">{children}</div>;
}

function QuestionTitle({ title, description }) {
  return (
    <div className="mb-5">
      <h2 className="text-2xl font-black leading-tight sm:text-3xl">{title}</h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-[#fbfbe8]/78">{description}</p>
    </div>
  );
}

function ChoiceButton({ title, detail, badge, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center justify-between gap-4 rounded-[1.4rem] border border-white/12 bg-white/10 p-4 text-left shadow-lg shadow-black/10 transition duration-300 hover:-translate-y-0.5 hover:border-[#e4f46f] hover:bg-[#e4f46f] hover:text-[#10321a]"
    >
      <span>
        <span className="block text-lg font-black">{title}</span>
        <span className="mt-1 block text-sm font-semibold text-[#fbfbe8]/75 group-hover:text-[#10321a]/75">{detail}</span>
      </span>
      <span className="shrink-0 rounded-full bg-[#fbfbe8] px-3 py-2 text-sm font-black text-[#10321a]">{badge}</span>
    </button>
  );
}

function PrimaryButton({ children, onClick, disabled, big }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#e4f46f] font-black text-[#10321a] transition hover:bg-[#eef8a0] disabled:opacity-60 ${big ? 'h-14 text-base' : 'h-12'}`}
    >
      {children}
    </button>
  );
}

function SummaryRow({ label, value, strong }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[#fbfbe8]/70">{label}</span>
      <span className={`text-right ${strong ? `text-xl font-black ${LIME}` : ''}`}>{value}</span>
    </div>
  );
}

function Notice({ text, tone }) {
  return (
    <div
      className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-bold ${
        tone === 'error' ? 'border-red-200/60 bg-red-500/20 text-red-50' : 'border-[#e4f46f]/40 bg-[#e4f46f]/10 text-[#fbfbe8]'
      }`}
    >
      {text}
    </div>
  );
}
