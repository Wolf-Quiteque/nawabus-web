'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Copy, Download, Loader2, LogOut, RefreshCw, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { MANGAIS_EVENT, MANGAIS_POINTS, findMangaisPoint, mangaisPointLabel } from '@/lib/events/mangais';

// Staff list for the Brunch Mangais transport: who paid, from which pickup
// point, in which direction — to organise the cars. Admin and agent accounts only.

const DIRECTIONS = [
  { key: 'outbound', title: `Ida · ${MANGAIS_EVENT.boardingTime}`, short: 'Ida' },
  { key: 'return', title: `Volta · ${MANGAIS_EVENT.returnTime}`, short: 'Volta' },
];

const LOGIN_DOMAIN = '@nawabus.com';

/** Staff sign in with an email, or with a phone number as customers do. */
function loginEmails(identifier) {
  const value = identifier.trim();
  if (value.includes('@')) return [value.toLowerCase()];
  const digits = value.replace(/\D/g, '');
  const local = digits.length >= 9 ? digits.slice(-9) : digits;
  if (!/^9\d{8}$/.test(local)) return [`${value}${LOGIN_DOMAIN}`];
  return [`244${local}`, local, `+244${local}`].map((id) => `${id}${LOGIN_DOMAIN}`);
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function formatLuanda(iso) {
  return new Intl.DateTimeFormat('pt-PT', {
    timeZone: 'Africa/Luanda',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function summarise(passengers, pending) {
  return DIRECTIONS.map((direction) => {
    const points = MANGAIS_POINTS.map((point) => {
      const list = passengers.filter((p) => p.direction === direction.key && p.point === point.code);
      const held = pending.find((p) => p.direction === direction.key && p.point === point.code);
      return {
        point,
        paid: list.length,
        boarded: list.filter((p) => p.boarded).length,
        pendingSeats: held?.seats || 0,
      };
    });
    return {
      direction,
      points,
      paid: points.reduce((sum, p) => sum + p.paid, 0),
      boarded: points.reduce((sum, p) => sum + p.boarded, 0),
      pendingSeats: points.reduce((sum, p) => sum + p.pendingSeats, 0),
    };
  });
}

function summaryText(summary) {
  const lines = [`${MANGAIS_EVENT.name} — ${MANGAIS_EVENT.weekday}, ${MANGAIS_EVENT.dateLabel}`];
  for (const block of summary) {
    lines.push('', block.direction.title, '');
    for (const row of block.points) {
      lines.push(`${mangaisPointLabel(row.point)} — ${plural(row.paid, 'passageiro', 'passageiros')}`);
    }
    lines.push('', `Total: ${plural(block.paid, 'passageiro', 'passageiros')} | ${block.boarded} embarcados`);
    if (block.pendingSeats) lines.push(`Por pagar: ${plural(block.pendingSeats, 'lugar', 'lugares')}`);
  }
  return lines.join('\n');
}

function toCsv(passengers) {
  const header = ['Sentido', 'Ponto de recolha', 'Nome', 'Telefone', 'Bilhete', 'Referência', 'Comprador', 'Telefone do comprador', 'Embarcou', 'Comprado em'];
  const escape = (value) => {
    const text = String(value ?? '');
    return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const rows = passengers.map((p) => [
    DIRECTIONS.find((d) => d.key === p.direction)?.short,
    mangaisPointLabel(findMangaisPoint(p.point)),
    p.name,
    p.phone,
    p.ticket_number,
    p.reference,
    p.buyer_name,
    p.buyer_phone,
    p.boarded ? 'Sim' : 'Não',
    formatLuanda(p.bought_at),
  ]);
  // Semicolons and a BOM: Excel in Portuguese opens it with accents intact.
  return '﻿' + [header, ...rows].map((row) => row.map(escape).join(';')).join('\r\n');
}

export default function MangaisStaffPage() {
  const supabase = useMemo(() => createClient(), []);
  const [session, setSession] = useState(undefined); // undefined = still checking
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const [direction, setDirection] = useState('outbound');
  const [pointFilter, setPointFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [limitDraft, setLimitDraft] = useState('');
  const [savingLimit, setSavingLimit] = useState(false);
  const [limitMessage, setLimitMessage] = useState(null); // { tone, text }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: result }) => setSession(result.session || null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next || null));
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  const load = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/events/mangais/passengers', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 403) {
        setForbidden(true);
        return;
      }
      if (response.status === 401) {
        await supabase.auth.signOut();
        return;
      }
      if (!response.ok) throw new Error(body.error || 'Não foi possível carregar a lista.');
      setForbidden(false);
      setData(body);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const signIn = async (event) => {
    event.preventDefault();
    setLoggingIn(true);
    setLoginError('');
    try {
      for (const email of loginEmails(identifier)) {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (!signInError) return;
        if (!/invalid login credentials/i.test(signInError.message)) throw signInError;
      }
      setLoginError('Email/telefone ou palavra-passe incorretos.');
    } catch (err) {
      setLoginError(err.message || 'Não foi possível entrar.');
    } finally {
      setLoggingIn(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setData(null);
    setForbidden(false);
  };

  const passengers = data?.passengers || [];
  const isAdmin = data?.viewer_role === 'admin';
  const places = data?.capacity?.[direction] || null;

  // The draft follows the direction shown until the admin types something.
  useEffect(() => {
    setLimitDraft(places ? String(places.limit) : '');
  }, [direction, places?.limit]);
  useEffect(() => {
    setLimitMessage(null);
  }, [direction]);

  const saveLimit = async () => {
    setSavingLimit(true);
    setLimitMessage(null);
    try {
      const response = await fetch('/api/events/mangais/limit', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ direction, limit: Number(limitDraft) }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Não foi possível alterar o limite.');
      setData((current) => ({ ...current, capacity: body.capacity }));
      setLimitMessage({ tone: 'ok', text: `Limite da ${direction === 'outbound' ? 'ida' : 'volta'} alterado para ${body.capacity?.[direction]?.limit} lugares.` });
    } catch (err) {
      setLimitMessage({ tone: 'error', text: err.message });
    } finally {
      setSavingLimit(false);
    }
  };
  const summary = useMemo(() => summarise(passengers, data?.pending || []), [passengers, data?.pending]);
  const current = summary.find((block) => block.direction.key === direction);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return passengers
      .filter((p) => p.direction === direction)
      .filter((p) => pointFilter === 'all' || p.point === pointFilter)
      .filter((p) => !q || [p.name, p.phone, p.ticket_number, p.reference, p.buyer_name, p.buyer_phone]
        .some((field) => String(field || '').toLowerCase().includes(q)))
      .sort((a, b) => a.point.localeCompare(b.point) || a.name.localeCompare(b.name, 'pt'));
  }, [passengers, direction, pointFilter, query]);

  const copySummary = async () => {
    const text = summaryText(summary);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copie o resumo:', text);
    }
  };

  const downloadCsv = () => {
    const blob = new Blob([toCsv(passengers)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `brunch-mangais-${MANGAIS_EVENT.date}-passageiros.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // --- signed out -------------------------------------------------------------
  if (session === undefined) {
    return <Shell><p className="flex items-center gap-2 text-sm text-neutral-300"><Loader2 className="h-4 w-4 animate-spin" />A verificar sessão...</p></Shell>;
  }

  if (!session) {
    return (
      <Shell>
        <form onSubmit={signIn} className="mx-auto w-full max-w-sm space-y-4 rounded-2xl border border-white/10 bg-white/[0.06] p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#e4f46f]">Equipa Nawabus</p>
            <h1 className="mt-1 text-2xl font-black">Lista do Brunch Mangais</h1>
            <p className="mt-1 text-sm text-neutral-400">Só contas de administrador ou agente.</p>
          </div>
          <label className="block text-sm font-bold">
            Email ou telefone
            <input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              className="mt-1 h-11 w-full rounded-xl border border-white/15 bg-black/30 px-3 text-white outline-none focus:border-[#e4f46f]"
            />
          </label>
          <label className="block text-sm font-bold">
            Palavra-passe
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="mt-1 h-11 w-full rounded-xl border border-white/15 bg-black/30 px-3 text-white outline-none focus:border-[#e4f46f]"
            />
          </label>
          {loginError && <p className="text-sm font-bold text-red-300">{loginError}</p>}
          <button
            type="submit"
            disabled={loggingIn || !identifier.trim() || !password}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#e4f46f] font-black text-[#10321a] disabled:opacity-60"
          >
            {loggingIn && <Loader2 className="h-4 w-4 animate-spin" />}
            Entrar
          </button>
        </form>
      </Shell>
    );
  }

  if (forbidden) {
    return (
      <Shell>
        <div className="mx-auto max-w-sm space-y-4 rounded-2xl border border-white/10 bg-white/[0.06] p-5 text-center">
          <p className="font-bold">Esta conta não tem acesso à lista de passageiros.</p>
          <button type="button" onClick={signOut} className="rounded-xl border border-white/15 px-4 py-2 text-sm font-bold hover:bg-white/10">
            Entrar com outra conta
          </button>
        </div>
      </Shell>
    );
  }

  // --- the list ---------------------------------------------------------------
  return (
    <Shell>
      <header className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#e4f46f]">{MANGAIS_EVENT.name} · {MANGAIS_EVENT.weekday}, {MANGAIS_EVENT.dateLabel}</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Passageiros por ponto de recolha</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Só bilhetes pagos.{data?.generated_at ? ` Atualizado às ${formatLuanda(data.generated_at).slice(-5)}.` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ToolButton onClick={load} disabled={loading} icon={loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}>Atualizar</ToolButton>
          <ToolButton onClick={copySummary} disabled={!data} icon={copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}>{copied ? 'Copiado' : 'Copiar resumo'}</ToolButton>
          <ToolButton onClick={downloadCsv} disabled={!passengers.length} icon={<Download className="h-4 w-4" />}>CSV</ToolButton>
          <ToolButton onClick={signOut} icon={<LogOut className="h-4 w-4" />}>Sair</ToolButton>
        </div>
      </header>

      {error && <div className="rounded-2xl border border-red-300/30 bg-red-500/15 p-4 text-sm font-bold text-red-100">{error}</div>}

      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/30 p-2">
        {summary.map((block) => (
          <button
            key={block.direction.key}
            type="button"
            onClick={() => setDirection(block.direction.key)}
            className={`rounded-xl px-3 py-3 text-left transition ${direction === block.direction.key ? 'bg-[#e4f46f] text-[#10321a]' : 'bg-white/[0.06] text-neutral-200 hover:bg-white/[0.1]'}`}
          >
            <span className="block text-sm font-black">{block.direction.title}</span>
            <span className="block text-2xl font-black">{block.paid}</span>
            <span className="block text-xs font-bold opacity-80">
              {block.boarded} embarcados{block.pendingSeats ? ` · ${block.pendingSeats} por pagar` : ''}
            </span>
            {data?.capacity?.[block.direction.key] && (
              <span className="mt-1 block text-xs font-black opacity-90">
                Limite {data.capacity[block.direction.key].limit} · restam {data.capacity[block.direction.key].available}
              </span>
            )}
          </button>
        ))}
      </div>

      {places && (
        <section className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#e4f46f]">
                Lugares à venda · {direction === 'outbound' ? 'ida' : 'volta'}
              </p>
              <p className="mt-1 text-2xl font-black">
                {places.taken} <span className="text-base font-bold text-neutral-400">de {places.limit}</span>
              </p>
              <p className="text-sm text-neutral-400">
                Vendidos ou reservados a pagar. Restam {places.available}. O limite vale para os três pontos de recolha juntos.
              </p>
            </div>
            {isAdmin ? (
              <div className="flex items-end gap-2">
                <label className="text-sm font-bold">
                  Novo limite
                  <input
                    type="number"
                    inputMode="numeric"
                    min={places.taken}
                    max={places.maxLimit}
                    value={limitDraft}
                    onChange={(e) => setLimitDraft(e.target.value)}
                    className="mt-1 block h-11 w-28 rounded-xl border border-white/15 bg-black/30 px-3 text-lg font-black text-white outline-none focus:border-[#e4f46f]"
                  />
                </label>
                <button
                  type="button"
                  onClick={saveLimit}
                  disabled={savingLimit || limitDraft === '' || Number(limitDraft) === places.limit}
                  className="flex h-11 items-center gap-2 rounded-xl bg-[#e4f46f] px-4 font-black text-[#10321a] disabled:opacity-50"
                >
                  {savingLimit && <Loader2 className="h-4 w-4 animate-spin" />}
                  Guardar
                </button>
              </div>
            ) : (
              <p className="text-xs text-neutral-500">Só um administrador pode alterar o limite.</p>
            )}
          </div>
          {limitMessage && (
            <p className={`mt-3 text-sm font-bold ${limitMessage.tone === 'ok' ? 'text-emerald-300' : 'text-red-300'}`}>{limitMessage.text}</p>
          )}
          {isAdmin && (
            <p className="mt-2 text-xs text-neutral-500">Máximo possível: {places.maxLimit}. Não pode ficar abaixo dos lugares já vendidos ou reservados.</p>
          )}
        </section>
      )}

      {current && (
        <div className="grid gap-3 sm:grid-cols-3">
          {current.points.map((row) => (
            <button
              key={row.point.code}
              type="button"
              onClick={() => setPointFilter(pointFilter === row.point.code ? 'all' : row.point.code)}
              className={`rounded-2xl border p-4 text-left transition ${pointFilter === row.point.code ? 'border-[#e4f46f] bg-[#e4f46f]/10' : 'border-white/10 bg-white/[0.06] hover:bg-white/[0.1]'}`}
            >
              <span className="block text-xs font-black uppercase tracking-[0.16em] text-[#e4f46f]">{row.point.area}</span>
              <span className="block text-lg font-black">{row.point.place}</span>
              <span className="mt-2 flex flex-wrap gap-2 text-xs font-black">
                <span className="rounded-full bg-white px-2.5 py-1 text-black">{row.paid} pagos</span>
                <span className="rounded-full bg-emerald-300 px-2.5 py-1 text-emerald-950">{row.boarded} embarcados</span>
                {row.pendingSeats > 0 && <span className="rounded-full bg-amber-300/25 px-2.5 py-1 text-amber-100">{row.pendingSeats} por pagar</span>}
              </span>
            </button>
          ))}
        </div>
      )}

      <section className="rounded-2xl border border-white/10 bg-white/[0.06]">
        <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-black">
            {plural(visible.length, 'passageiro', 'passageiros')}
            {pointFilter !== 'all' && <span className="text-neutral-400"> · {mangaisPointLabel(findMangaisPoint(pointFilter))}</span>}
          </h2>
          <label className="relative block sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nome, telefone, bilhete..."
              className="h-10 w-full rounded-xl border border-white/15 bg-black/30 pl-9 pr-3 text-sm text-white outline-none focus:border-[#e4f46f]"
            />
          </label>
        </div>

        {loading && !data ? (
          <p className="flex items-center gap-2 p-4 text-sm text-neutral-300"><Loader2 className="h-4 w-4 animate-spin" />A carregar...</p>
        ) : visible.length === 0 ? (
          <p className="p-4 text-sm text-neutral-400">Ainda não há passageiros pagos aqui.</p>
        ) : (
          <ol className="divide-y divide-white/10">
            {visible.map((p, index) => (
              <li key={p.id} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[2rem_1.4fr_1fr_1fr_auto] sm:items-center sm:gap-3">
                <span className="hidden text-neutral-500 sm:block">{index + 1}</span>
                <span className="font-bold">
                  {p.name}
                  {p.buyer_name && p.buyer_name !== p.name && (
                    <span className="block text-xs font-medium text-neutral-400">Comprado por {p.buyer_name}{p.buyer_phone ? ` · ${p.buyer_phone}` : ''}</span>
                  )}
                </span>
                <span className="text-neutral-300">{p.phone || '—'}</span>
                <span className="text-neutral-400">
                  {findMangaisPoint(p.point)?.place} · <span className="font-mono">{p.ticket_number}</span>
                </span>
                <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-black ${p.boarded ? 'bg-emerald-300 text-emerald-950' : 'bg-white/10 text-neutral-200'}`}>
                  {p.boarded ? 'Embarcou' : 'Pago'}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <main className="min-h-screen bg-[#07140b] px-4 py-5 text-white sm:px-6">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-5">{children}</section>
    </main>
  );
}

function ToolButton({ children, onClick, disabled, icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/15 px-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-50"
    >
      {icon}
      {children}
    </button>
  );
}
