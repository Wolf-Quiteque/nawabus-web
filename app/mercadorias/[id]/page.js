import Link from 'next/link';
import QRCode from 'qrcode';
import {
  ArrowLeft,
  Banknote,
  CalendarClock,
  Camera,
  CheckCircle2,
  FileText,
  Fingerprint,
  MapPin,
  Package,
  Phone,
  Truck,
  User,
} from 'lucide-react';
import { notFound } from 'next/navigation';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const STATUS_LABELS = {
  received: 'Recebida',
  in_transit: 'Em trânsito',
  delivered: 'Entregue',
  cancelled: 'Cancelada',
};

const STATUS_CLASSES = {
  received: 'border-blue-200 bg-blue-50 text-blue-700',
  in_transit: 'border-amber-200 bg-amber-50 text-amber-700',
  delivered: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  cancelled: 'border-red-200 bg-red-50 text-red-700',
};

function formatMoney(value) {
  return new Intl.NumberFormat('pt-AO', {
    style: 'currency',
    currency: 'AOA',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('pt-AO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getCargoUrl(id) {
  return `https://www.nawabus.co.ao/mercadorias/${id}`;
}

async function getCargo(id) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from('cargo_shipments')
    .select(`
      id,
      tracking_number,
      client_name,
      client_phone,
      bi_number,
      item_description,
      notes,
      amount_kz,
      payment_method,
      status,
      photo_url,
      photo_path,
      qr_payload,
      created_at,
      updated_at,
      trip:trips(
        id,
        departure_time,
        route:routes(origin_city, destination_city),
        bus:buses(license_plate, make, model),
        driver:profiles!trips_driver_id_fkey(first_name, last_name)
      )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Cargo lookup failed:', error);
    throw error;
  }

  return data;
}

function Detail({ icon: Icon, label, value }) {
  return (
    <div className="flex min-h-20 gap-3 rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-neutral-950 text-white">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-neutral-500">{label}</p>
        <p className="mt-1 break-words text-sm font-semibold text-neutral-950">{value || '-'}</p>
      </div>
    </div>
  );
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  return {
    title: `Mercadoria ${id} | Nawabus`,
    description: 'Detalhes e rastreio de mercadoria Nawabus.',
  };
}

export default async function MercadoriaPage({ params }) {
  const { id } = await params;
  const cargo = await getCargo(id);

  if (!cargo) {
    notFound();
  }

  const route = cargo.trip?.route;
  const bus = cargo.trip?.bus;
  const driver = cargo.trip?.driver;
  const cargoUrl = getCargoUrl(cargo.id);
  const qrDataUrl = await QRCode.toDataURL(cargoUrl, { width: 240, margin: 1 });
  const statusClass = STATUS_CLASSES[cargo.status] || STATUS_CLASSES.received;
  const statusLabel = STATUS_LABELS[cargo.status] || cargo.status || 'Recebida';

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-950">
      <section className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-bold text-neutral-700 transition hover:text-neutral-950"
          >
            <ArrowLeft className="size-4" />
            Nawabus
          </Link>
          <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.18em] ${statusClass}`}>
            {statusLabel}
          </span>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          {cargo.photo_url ? (
            <img
              src={cargo.photo_url}
              alt={`Foto da mercadoria ${cargo.tracking_number}`}
              className="h-[420px] w-full object-cover"
            />
          ) : (
            <div className="flex h-[420px] flex-col items-center justify-center gap-3 bg-neutral-100 text-neutral-500">
              <Camera className="size-10" />
              <p className="text-sm font-semibold">Sem foto registada</p>
            </div>
          )}
        </div>

        <div className="flex flex-col justify-center">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-blue-700">
            Rastreio de mercadoria
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-neutral-950 sm:text-5xl">
            {cargo.tracking_number || cargo.id}
          </h1>
          <p className="mt-4 text-base leading-7 text-neutral-600">
            Informação oficial da mercadoria registada pela Nawabus. Use este ecrã para confirmar
            o item, remetente, rota e estado atual.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Detail icon={Package} label="Mercadoria" value={cargo.item_description} />
            <Detail icon={Banknote} label="Valor cobrado" value={formatMoney(cargo.amount_kz)} />
            <Detail icon={CalendarClock} label="Registada em" value={formatDate(cargo.created_at)} />
            <Detail icon={CheckCircle2} label="Última atualização" value={formatDate(cargo.updated_at)} />
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-6 px-4 pb-12 sm:px-6 lg:grid-cols-[1fr_320px] lg:px-8">
        <div className="grid gap-4 md:grid-cols-2">
          <Detail icon={User} label="Cliente" value={cargo.client_name} />
          <Detail icon={Phone} label="Telefone" value={cargo.client_phone} />
          <Detail icon={Fingerprint} label="BI" value={cargo.bi_number || 'Não informado'} />
          <Detail icon={FileText} label="Notas" value={cargo.notes || 'Sem notas internas'} />
          <Detail
            icon={MapPin}
            label="Rota"
            value={
              route
                ? `${route.origin_city || '-'} -> ${route.destination_city || '-'}`
                : 'Rota não associada'
            }
          />
          <Detail icon={CalendarClock} label="Partida" value={formatDate(cargo.trip?.departure_time)} />
          <Detail
            icon={Truck}
            label="Autocarro"
            value={
              bus
                ? [bus.make, bus.model, bus.license_plate].filter(Boolean).join(' - ')
                : 'Não associado'
            }
          />
          <Detail
            icon={User}
            label="Motorista"
            value={
              driver
                ? [driver.first_name, driver.last_name].filter(Boolean).join(' ')
                : 'Não associado'
            }
          />
        </div>

        <aside className="rounded-lg border border-neutral-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-neutral-500">
            QR de verificação
          </p>
          <div className="mt-4 flex justify-center rounded-lg bg-neutral-50 p-4">
            <img src={qrDataUrl} alt="QR da mercadoria" className="size-56" />
          </div>
          <p className="mt-4 break-all text-xs font-semibold leading-5 text-neutral-500">{cargoUrl}</p>
        </aside>
      </section>
    </main>
  );
}
