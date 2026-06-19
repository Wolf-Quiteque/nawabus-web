"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Loader2, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase-client";

const EVENT_DATES = [
  { value: "2026-06-20", label: "20th", copyLabel: "20th" },
  { value: "2026-06-21", label: "21th", copyLabel: "21th" },
];

const DIRECTIONS = [
  {
    key: "outbound",
    title: "Luanda - Mangais",
    originProvince: "Luanda",
    destinationProvince: "Barra",
    pointField: "origin_city",
    empty: "Sem passageiros pagos de Luanda para Mangais.",
  },
  {
    key: "return",
    title: "Mangais - Luanda",
    originProvince: "Barra",
    destinationProvince: "Luanda",
    pointField: "destination_city",
    empty: "Sem passageiros pagos de Mangais para Luanda.",
  },
];

const POINT_ORDER = ["Kilamba", "Gamek", "Porto"];

function getLuandaDayRange(date) {
  const start = new Date(`${date}T00:00:00+01:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function formatTime(value) {
  return new Intl.DateTimeFormat("pt-PT", {
    timeZone: "Africa/Luanda",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function normalizeTimeForCopy(time) {
  return time.replace(":00", "h");
}

function normalizePointName(point = "") {
  const lower = point.toLowerCase();
  if (lower.includes("kilamba")) return "Kilamba";
  if (lower.includes("gamek")) return "Gamek";
  if (lower.includes("porto")) return "Porto";
  return point || "Outro";
}

function pointSort(a, b) {
  const aIndex = POINT_ORDER.indexOf(a.point);
  const bIndex = POINT_ORDER.indexOf(b.point);
  if (aIndex !== -1 || bIndex !== -1) {
    return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
  }
  return a.point.localeCompare(b.point);
}

function buildDirectionSummary(dateLabel, directionTitle, groups) {
  const total = groups.reduce((sum, group) => sum + group.total, 0);
  const lines = [dateLabel, "", directionTitle, ""];

  if (!groups.length) {
    lines.push("Sem passageiros pagos.");
    lines.push("");
    lines.push("Total: 0 passageiros");
    return lines.join("\n");
  }

  groups.forEach((group, groupIndex) => {
    if (groupIndex > 0) lines.push("");
    lines.push(`${group.point}:`);
    group.times.forEach((item) => {
      lines.push(`${normalizeTimeForCopy(item.time)} - ${item.count} passageiro${item.count === 1 ? "" : "s"}`);
    });
  });

  lines.push("");
  lines.push(`Total: ${total} passageiro${total === 1 ? "" : "s"}`);

  return lines.join("\n");
}

function groupTicketsByPointAndTime(tickets, direction) {
  const pointMap = new Map();

  tickets.forEach((ticket) => {
    const trip = ticket.trips;
    const route = trip?.routes;
    if (!trip || !route) return;

    const point = normalizePointName(route[direction.pointField]);
    const time = formatTime(trip.departure_time);
    const pointBucket = pointMap.get(point) || new Map();
    pointBucket.set(time, (pointBucket.get(time) || 0) + 1);
    pointMap.set(point, pointBucket);
  });

  return [...pointMap.entries()]
    .map(([point, times]) => ({
      point,
      total: [...times.values()].reduce((sum, count) => sum + count, 0),
      times: [...times.entries()]
        .map(([time, count]) => ({ time, count }))
        .sort((a, b) => a.time.localeCompare(b.time)),
    }))
    .sort(pointSort);
}

export default function MangDashboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const [activeDate, setActiveDate] = useState(EVENT_DATES[0].value);
  const [data, setData] = useState({ outbound: [], return: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedKey, setCopiedKey] = useState("");

  const selectedDate = EVENT_DATES.find((date) => date.value === activeDate) || EVENT_DATES[0];

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const range = getLuandaDayRange(activeDate);
      const entries = await Promise.all(
        DIRECTIONS.map(async (direction) => {
          const { data: tickets, error: ticketError } = await supabase
            .from("tickets")
            .select(`
              id,
              trip_id,
              payment_status,
              status,
              trips:trip_id!inner (
                departure_time,
                routes:route_id!inner (
                  origin_city,
                  destination_city,
                  origin_province,
                  destination_province
                )
              )
            `)
            .eq("payment_status", "paid")
            .in("status", ["active", "used"])
            .gte("trips.departure_time", range.start)
            .lt("trips.departure_time", range.end)
            .ilike("trips.routes.origin_province", `%${direction.originProvince}%`)
            .ilike("trips.routes.destination_province", `%${direction.destinationProvince}%`);

          if (ticketError) throw ticketError;

          const filteredTickets = (tickets || []).filter((ticket) => Boolean(ticket.trips));
          return [direction.key, groupTicketsByPointAndTime(filteredTickets, direction)];
        })
      );

      setData(Object.fromEntries(entries));
    } catch (err) {
      console.error("Mang dashboard error:", err);
      setError(err.message || "Nao foi possivel carregar os dados.");
    } finally {
      setLoading(false);
    }
  }, [activeDate, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function copySummary(direction) {
    const summary = buildDirectionSummary(selectedDate.copyLabel, direction.title, data[direction.key] || []);
    try {
      await navigator.clipboard.writeText(summary);
      setCopiedKey(direction.key);
      window.setTimeout(() => setCopiedKey(""), 1800);
    } catch {
      window.prompt("Copie a informacao:", summary);
    }
  }

  const totals = {
    outbound: (data.outbound || []).reduce((sum, group) => sum + group.total, 0),
    return: (data.return || []).reduce((sum, group) => sum + group.total, 0),
  };

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-5 text-white sm:px-6">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <header className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-300">Mangais ops</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Passageiros por ponto e hora</h1>
            <p className="mt-1 text-sm text-neutral-400">Apenas bilhetes pagos. Use Atualizar antes de copiar.</p>
          </div>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#ff8c00] px-4 text-sm font-black text-black transition hover:bg-orange-400 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar
          </button>
        </header>

        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/30 p-2">
          {EVENT_DATES.map((date) => (
            <button
              key={date.value}
              type="button"
              onClick={() => setActiveDate(date.value)}
              className={`rounded-xl px-4 py-3 text-sm font-black transition ${
                activeDate === date.value
                  ? "bg-[#ff8c00] text-black"
                  : "bg-white/[0.06] text-neutral-300 hover:bg-white/[0.1]"
              }`}
            >
              {date.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-2xl border border-red-300/30 bg-red-500/15 p-4 text-sm font-bold text-red-100">
            {error}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {DIRECTIONS.map((direction) => (
            <DirectionCard
              key={direction.key}
              direction={direction}
              groups={data[direction.key] || []}
              total={totals[direction.key]}
              loading={loading}
              copied={copiedKey === direction.key}
              onCopy={() => copySummary(direction)}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

function DirectionCard({ direction, groups, total, loading, copied, onCopy }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06]">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 bg-white/[0.04] p-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-300">Rota</p>
          <h2 className="mt-1 text-xl font-black">{direction.title}</h2>
          <p className="mt-1 text-sm text-neutral-400">Total: {total} passageiros pagos</p>
        </div>
        <button
          type="button"
          onClick={onCopy}
          disabled={loading}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-60"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4 text-orange-300" />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>

      <div className="space-y-3 p-4">
        {loading && (
          <div className="flex items-center gap-2 rounded-xl bg-black/25 p-3 text-sm text-neutral-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            A carregar...
          </div>
        )}

        {!loading && groups.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/15 p-4 text-sm text-neutral-400">
            {direction.empty}
          </div>
        )}

        {!loading && groups.map((group) => (
          <section key={group.point} className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-lg font-black">{group.point}</h3>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-black">
                {group.total}
              </span>
            </div>
            <div className="space-y-2">
              {group.times.map((item) => (
                <div key={item.time} className="flex items-center justify-between rounded-lg bg-white/[0.06] px-3 py-2 text-sm">
                  <span className="font-black text-orange-200">{normalizeTimeForCopy(item.time)}</span>
                  <span className="font-bold text-neutral-100">
                    {item.count} passageiro{item.count === 1 ? "" : "s"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
