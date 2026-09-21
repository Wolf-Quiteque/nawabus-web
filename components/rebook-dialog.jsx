"use client";

// Customer rebooking, one leg of a booking at a time: who travels, which day,
// which departure, which seats, then the server's price. Nothing here works out
// money — the multa and fare difference come from /api/rebook/quote, and a paid
// rebook moves the tickets only when the Multicaixa reference is paid.
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Copy, Check, X } from "lucide-react";
import { formatLuandaDateTime } from "@/lib/date-time";
import { isCopilotSeat } from "@/lib/seats";

const kz = (n) => `${new Intl.NumberFormat("pt-AO").format(Number(n) || 0)} Kz`;

function luandaToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Luanda", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  return parts;
}

export default function RebookDialog({ open, onClose, tickets, nameOf, supabase, onDone }) {
  // Boarded tickets travelled; only the rest can move.
  const movable = useMemo(
    () => (tickets || []).filter((t) => ["active", "expired"].includes(t.status)),
    [tickets]
  );

  const [step, setStep] = useState("who");
  const [picked, setPicked] = useState(() => new Set());
  const [date, setDate] = useState(luandaToday());
  const [trips, setTrips] = useState(null);
  const [trip, setTrip] = useState(null);
  const [seats, setSeats] = useState([]);
  const [quote, setQuote] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(null);
  const idemKey = useRef(null);

  useEffect(() => {
    if (!open) return;
    setStep("who");
    setPicked(new Set(movable.map((t) => t.id)));
    setDate(luandaToday());
    setTrips(null);
    setTrip(null);
    setSeats([]);
    setQuote(null);
    setResult(null);
    setError(null);
    idemKey.current = null;
  }, [open, movable]);

  if (!open) return null;

  const chosen = movable.filter((t) => picked.has(t.id));

  async function api(path, init = {}) {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) throw new Error("Sessão expirada. Entre novamente.");
    const res = await fetch(path, {
      ...init,
      headers: { ...(init.headers || {}), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      cache: "no-store",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Não foi possível continuar.");
    return body;
  }

  async function loadTrips() {
    setBusy(true);
    setError(null);
    try {
      const body = await api(`/api/rebook/options?ticket_id=${encodeURIComponent(chosen[0].id)}&date=${date}`);
      setTrips(body.trips || []);
      setStep("trip");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function pickTrip(t) {
    // Seats these passengers already hold on this very departure stay theirs.
    const own = new Set(chosen.filter((c) => c.trip_id === t.trip_id).map((c) => Number(c.seat_number)));
    const taken = new Set(t.occupied_seats.filter((s) => !own.has(s)));
    const pre = [];
    for (let s = 1; s <= t.capacity && pre.length < chosen.length; s++) {
      if (!isCopilotSeat(s) && !taken.has(s)) pre.push(s);
    }
    if (pre.length < chosen.length) {
      setError(`Esta viagem só tem ${pre.length} lugar(es) livre(s) para ${chosen.length} passageiro(s).`);
      return;
    }
    setError(null);
    setTrip({ ...t, taken });
    setSeats(pre);
    setStep("seats");
  }

  function toggleSeat(s) {
    setSeats((cur) => {
      if (cur.includes(s)) return cur.filter((x) => x !== s);
      if (cur.length >= chosen.length) return cur;
      return [...cur, s];
    });
  }

  const sortedSeats = [...seats].sort((a, b) => a - b);
  const items = () => chosen.map((t, i) => ({ ticket_id: t.id, new_trip_id: trip.trip_id, new_seat_number: sortedSeats[i] }));

  async function getQuote() {
    setBusy(true);
    setError(null);
    try {
      const body = await api("/api/rebook/quote", { method: "POST", body: JSON.stringify({ items: items() }) });
      setQuote(body.quote);
      idemKey.current = crypto.randomUUID();
      setStep("quote");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const body = await api("/api/rebook/confirm", {
        method: "POST",
        body: JSON.stringify({ items: items(), idempotency_key: idemKey.current }),
      });
      setResult(body);
      setStep("done");
      if (body.status === "completed") onDone?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function copy(field, text) {
    try {
      await navigator.clipboard.writeText(String(text));
      setCopied(field);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard unavailable — the value is on screen */
    }
  }

  const back = { trip: "who", seats: "trip", quote: "seats" }[step];
  const title = {
    who: "Quem vai viajar?",
    trip: "Escolha a nova viagem",
    seats: "Escolha os lugares",
    quote: "Resumo",
    done: result?.status === "completed" ? "Reprogramado" : "Pague para confirmar",
  }[step];

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#141414] text-white sm:rounded-3xl">
        <div className="flex items-center gap-3 border-b border-white/10 p-4">
          {back && step !== "done" ? (
            <button type="button" onClick={() => { setError(null); setStep(back); }} aria-label="Voltar"
              className="rounded-xl p-1.5 hover:bg-white/10">
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : null}
          <h2 className="flex-1 text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-xl p-1.5 hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {step === "who" && (
            <>
              <p className="text-sm text-neutral-400">
                Desmarque quem não vai. A multa é somada só de quem viajar.
              </p>
              {movable.length === 0 ? (
                <p className="text-sm text-neutral-300">Nenhum passageiro desta viagem pode ser reprogramado.</p>
              ) : (
                <div className="space-y-2">
                  {movable.map((t) => (
                    <label key={t.id}
                      className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                      <input type="checkbox" className="h-5 w-5 accent-[#FF8C00]" checked={picked.has(t.id)}
                        onChange={(e) => {
                          const next = new Set(picked);
                          if (e.target.checked) next.add(t.id); else next.delete(t.id);
                          setPicked(next);
                        }} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{nameOf(t)}</span>
                        <span className="text-xs text-neutral-500">Lugar {t.seat_number}{t.status === "expired" ? " · faltou à viagem" : ""}</span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <label className="block text-sm">
                <span className="text-neutral-400">Nova data</span>
                <input type="date" value={date} min={luandaToday()} onChange={(e) => setDate(e.target.value)}
                  className="mt-1 h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-3 text-white" />
              </label>
            </>
          )}

          {step === "trip" && (
            trips?.length ? (
              <div className="space-y-2">
                {trips.map((t) => (
                  <button key={t.trip_id} type="button" disabled={t.available < chosen.length} onClick={() => pickTrip(t)}
                    className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-left transition hover:bg-white/10 disabled:opacity-40">
                    <span>
                      <span className="block text-sm font-semibold">{formatLuandaDateTime(t.departure_time)}</span>
                      <span className="text-xs text-neutral-500">{t.bus_plate}</span>
                    </span>
                    <span className="text-xs font-semibold text-neutral-300">
                      {t.available >= chosen.length ? `${t.available} livres` : "Sem lugares"}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-300">Não há viagens nesta data. Volte e escolha outro dia.</p>
            )
          )}

          {step === "seats" && trip && (
            <>
              <div className="grid grid-cols-[repeat(2,2.5rem)_1rem_repeat(2,2.5rem)] justify-center gap-1.5">
                {Array.from({ length: trip.capacity }, (_, i) => i + 1).flatMap((s) => {
                  const cells = [];
                  if ((s - 1) % 4 === 2) cells.push(<span key={`a${s}`} />);
                  const copilot = isCopilotSeat(s);
                  const taken = copilot || trip.taken.has(s);
                  const mine = seats.includes(s);
                  cells.push(
                    <button key={s} type="button" disabled={taken} onClick={() => toggleSeat(s)}
                      className={`h-10 rounded-xl text-xs font-bold ${
                        copilot ? "bg-orange-900/40 text-orange-300"
                          : taken ? "bg-neutral-800 text-neutral-600"
                          : mine ? "bg-[#FF8C00] text-black"
                          : "bg-white/10 text-white hover:bg-white/20"
                      }`}>
                      {copilot ? "CP" : s}
                    </button>
                  );
                  return cells;
                })}
              </div>
              <div className="space-y-1 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm">
                {chosen.map((t, i) => (
                  <div key={t.id} className="flex justify-between gap-3">
                    <span className="truncate text-neutral-300">{nameOf(t)}</span>
                    <span className="shrink-0 font-semibold">{sortedSeats[i] ? `lugar ${sortedSeats[i]}` : "—"}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-neutral-500">
                {seats.length < chosen.length
                  ? `Escolha mais ${chosen.length - seats.length} lugar(es).`
                  : "Toque num lugar escolhido para o trocar."}
              </p>
            </>
          )}

          {step === "quote" && quote && (
            <>
              <p className="text-sm text-neutral-400">
                {formatLuandaDateTime(trip.departure_time)} · {trip.bus_plate}
              </p>
              <div className="space-y-1 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm">
                {quote.lines.map((l) => {
                  const t = chosen.find((c) => c.id === l.ticket_id);
                  return (
                    <div key={l.ticket_id} className="flex justify-between gap-3">
                      <span className="truncate text-neutral-300">{t ? nameOf(t) : l.ticket_number} → lugar {l.new_seat_number}</span>
                      <span className="shrink-0">{l.total_kz > 0 ? kz(l.total_kz) : "grátis"}</span>
                    </div>
                  );
                })}
              </div>
              <dl className="space-y-1 text-sm">
                {quote.fee_kz > 0 && (
                  <div className="flex justify-between"><dt className="text-neutral-400">Multa</dt><dd>{kz(quote.fee_kz)}</dd></div>
                )}
                {quote.difference_kz > 0 && (
                  <div className="flex justify-between"><dt className="text-neutral-400">Diferença de tarifa</dt><dd>{kz(quote.difference_kz)}</dd></div>
                )}
                <div className="flex justify-between border-t border-white/10 pt-2 text-base font-semibold">
                  <dt>Total a pagar</dt><dd className="text-[#FF8C00]">{kz(quote.total_kz)}</dd>
                </div>
              </dl>
              {quote.total_kz > 0 ? (
                <p className="text-xs text-neutral-500">
                  Vamos reservar os lugares e gerar uma referência Multicaixa. Os bilhetes mudam de viagem assim que o pagamento for confirmado.
                </p>
              ) : (
                <p className="text-xs text-emerald-300">Sem custo — dentro do prazo gratuito.</p>
              )}
            </>
          )}

          {step === "done" && result && (
            result.status === "completed" ? (
              <div className="space-y-3 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
                <p className="text-sm text-neutral-300">
                  {result.lines.length} passageiro(s) reprogramado(s). Os bilhetes já mostram a nova viagem.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-neutral-300">
                  Pague esta referência no Multicaixa Express, ATM ou banco. Os bilhetes mudam de viagem assim que o pagamento for confirmado.
                </p>
                {[
                  ["entity", "Entidade", result.entity],
                  ["ref", "Referência", result.reference_id],
                  ["amount", "Montante", kz(result.amount)],
                ].map(([field, label, value]) => (
                  <button key={field} type="button" onClick={() => copy(field, field === "amount" ? result.amount : value)}
                    className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-left">
                    <span>
                      <span className="block text-xs uppercase tracking-[0.14em] text-neutral-500">{label}</span>
                      <span className="text-lg font-semibold">{value}</span>
                    </span>
                    {copied === field ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4 text-neutral-400" />}
                  </button>
                ))}
                {result.expires_at && (
                  <p className="text-xs text-amber-300">
                    Válida até {formatLuandaDateTime(result.expires_at)}. Depois disso os lugares são libertados.
                  </p>
                )}
              </div>
            )
          )}

          {error && (
            <p className="rounded-2xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>
          )}
        </div>

        <div className="border-t border-white/10 p-4">
          {step === "who" && (
            <button type="button" disabled={busy || chosen.length === 0 || !date} onClick={loadTrips}
              className="w-full rounded-2xl bg-[#FF8C00] px-4 py-3 text-sm font-semibold text-black disabled:opacity-50">
              {busy ? "A procurar..." : `Ver viagens (${chosen.length} passageiro${chosen.length === 1 ? "" : "s"})`}
            </button>
          )}
          {step === "seats" && (
            <button type="button" disabled={busy || seats.length !== chosen.length} onClick={getQuote}
              className="w-full rounded-2xl bg-[#FF8C00] px-4 py-3 text-sm font-semibold text-black disabled:opacity-50">
              {busy ? "A calcular..." : seats.length === chosen.length ? "Ver valor a pagar" : `Faltam ${chosen.length - seats.length} lugar(es)`}
            </button>
          )}
          {step === "quote" && quote && (
            <button type="button" disabled={busy} onClick={confirm}
              className="w-full rounded-2xl bg-[#FF8C00] px-4 py-3 text-sm font-semibold text-black disabled:opacity-50">
              {busy ? "Um momento..." : quote.total_kz > 0 ? `Gerar referência de ${kz(quote.total_kz)}` : "Confirmar reprogramação"}
            </button>
          )}
          {(step === "done" || step === "trip") && (
            <button type="button" onClick={step === "done" ? onClose : () => setStep("who")}
              className="w-full rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10">
              {step === "done" ? "Fechar" : "Escolher outra data"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
