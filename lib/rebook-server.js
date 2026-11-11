// Server-only helpers for customer rebooking. Every rule — free or multa, the
// fare difference, the cap of three, seats and routes — lives in the database
// (rebook_ticket / rebook_group). These routes only prove who the customer is,
// carry the request there, and turn the answer into Portuguese.
import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export const fail = (status, error, code = null) =>
  NextResponse.json({ error, code }, { status, headers: { 'Cache-Control': 'no-store' } });

/** The signed-in customer, from their own access token. Never from the body. */
export async function requireCustomer(request) {
  const admin = createSupabaseAdmin();
  const token = String(request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return { error: fail(401, 'Entre na sua conta para reprogramar.') };
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user?.id) return { error: fail(401, 'Sessão expirada. Entre novamente.') };
  return { admin, user: data.user, token };
}

const MESSAGES = {
  REBOOK_SELF_SERVICE_OFF: 'A reprogramação online ainda não está disponível. Contacte uma agência.',
  REBOOK_NOT_YOUR_TICKET: 'Este bilhete pertence a outra conta.',
  REBOOK_TICKET_NOT_FOUND: 'Bilhete não encontrado.',
  REBOOK_TICKET_NOT_ACTIVE: 'Este bilhete já não pode ser reprogramado.',
  REBOOK_TICKET_NOT_PAID: 'Só se reprogramam bilhetes pagos.',
  REBOOK_ALREADY_BOARDED: 'Este passageiro já embarcou.',
  REBOOK_PAYMENT_PENDING: 'Já há uma reprogramação à espera de pagamento para este bilhete. Pague essa referência ou aguarde que expire.',
  REBOOK_LIMIT_REACHED: 'Este bilhete já foi reprogramado 3 vezes. Tem de comprar um bilhete novo.',
  REBOOK_TRIP_DEPARTED: 'A viagem original já partiu e não pode ser reprogramada.',
  REBOOK_NO_SHOW_WINDOW_PASSED: 'Passou o prazo para reprogramar depois da partida.',
  REBOOK_NEW_TRIP_NOT_FOUND: 'Viagem não encontrada.',
  REBOOK_SAME_TRIP_AND_SEAT: 'O bilhete já está nessa viagem e nesse lugar.',
  REBOOK_NEW_TRIP_UNAVAILABLE: 'Essa viagem já não está disponível.',
  REBOOK_NEW_TRIP_TOO_SOON: 'Essa viagem parte demasiado cedo. Escolha uma que parta daqui a mais de 30 minutos.',
  REBOOK_NEW_TRIP_TOO_FAR: 'Só pode reprogramar para os próximos 90 dias.',
  REBOOK_OTHER_COMPANY: 'Essa viagem é de outra empresa.',
  REBOOK_DIFFERENT_ROUTE: 'A nova viagem tem de ter a mesma origem e o mesmo destino.',
  REBOOK_BAD_SEAT: 'Lugar inválido para este autocarro.',
  REBOOK_SEAT_TAKEN: 'Um dos lugares escolhidos já foi ocupado. Escolha outros.',
  REBOOK_SEAT_HELD: 'Um dos lugares está reservado por outra compra em curso. Escolha outros.',
  REBOOK_GROUP_DUPLICATE_TICKET: 'O mesmo passageiro foi escolhido duas vezes.',
  REBOOK_GROUP_BAD_SIZE: 'Escolha entre 1 e 40 passageiros.',
  REBOOK_GROUP_BAD_ITEMS: 'Pedido inválido.',
  REBOOK_IDEMPOTENCY_CONFLICT: 'Este pedido já foi usado. Recarregue a página.',
  'Trip sales limit reached': 'Essa viagem está cheia. Escolha outra.',
};

const STATUS = {
  REBOOK_NOT_YOUR_TICKET: 403,
  REBOOK_TICKET_NOT_FOUND: 404,
  REBOOK_NEW_TRIP_NOT_FOUND: 404,
  REBOOK_BAD_SEAT: 400,
  REBOOK_GROUP_DUPLICATE_TICKET: 400,
  REBOOK_GROUP_BAD_SIZE: 400,
  REBOOK_GROUP_BAD_ITEMS: 400,
};

/** Turns a database refusal into a response the customer can act on. */
export function rebookFailure(error) {
  const raw = [error?.message, error?.details, error?.hint].filter(Boolean).join(' ');
  const code = Object.keys(MESSAGES).find((k) => raw.includes(k));
  if (!code) {
    console.error('Rebook failed:', raw);
    return fail(500, 'Não foi possível reprogramar. Tente de novo.');
  }
  return fail(STATUS[code] || 409, MESSAGES[code], code);
}

/** Only { ticket_id, new_trip_id, new_seat_number } per line, nothing else. */
export function cleanItems(items) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 40) return null;
  const out = [];
  for (const it of items) {
    const seat = Number(it?.new_seat_number);
    if (!it?.ticket_id || !it?.new_trip_id || !Number.isInteger(seat) || seat < 1) return null;
    out.push({ ticket_id: String(it.ticket_id), new_trip_id: String(it.new_trip_id), new_seat_number: seat });
  }
  return out;
}

/** The engine's lines, trimmed to what the screen needs. */
export function shapeQuote(rows) {
  const head = rows?.[0] || {};
  return {
    group_id: head.group_id || null,
    total_kz: Number(head.group_total_kz) || 0,
    fee_kz: Number(head.group_fee_kz) || 0,
    difference_kz: Number(head.group_difference_kz) || 0,
    lines: (rows || []).map((r) => ({
      ticket_id: r.ticket_id,
      ticket_number: r.ticket_number,
      status: r.status,
      new_seat_number: r.new_seat_number,
      is_free: r.is_free,
      rebooks_used: r.rebooks_used,
      rebooks_allowed: r.rebooks_allowed,
      fee_percent: Number(r.fee_percent) || 0,
      fee_kz: Number(r.fee_kz) || 0,
      fare_difference_kz: Number(r.fare_difference_kz) || 0,
      total_kz: Number(r.total_kz) || 0,
      receipt_number: r.receipt_number || null,
      expires_at: r.expires_at || null,
    })),
  };
}

export async function callRebookGroup(admin, userId, items, { dryRun, idempotencyKey = null }) {
  return admin.rpc('rebook_group', {
    p_items: items,
    p_channel: 'website',
    p_actor_user_id: userId,
    p_idempotency_key: idempotencyKey,
    p_payment_method: null,
    p_waive_fee: false,
    p_waiver_reason: null,
    p_dry_run: dryRun,
    p_payment_reference: null,
  });
}

/** payment-api's rebook endpoint, next to the create-payment one it already uses. */
export function rebookPaymentUrl() {
  const createUrl = process.env.PAYMENT_API_URL || 'http://localhost:3000/api/create-payment';
  return createUrl.replace(/\/api\/create-payment\/?$/, '/api/rebook-payment');
}

// Multicaixa shows the entity as 1219 in Express but 01219 at an ATM.
export const ENTITY = '1219';
export const ENTITY_ATM = '01219';

/**
 * One Multicaixa reference for a pending group. payment-api reads the amount
 * from the database; nothing about money is sent from here. Throws when no
 * reference could be made — the caller then cancels the group.
 */
export async function requestGroupReference(token, groupId) {
  const res = await fetch(rebookPaymentUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ group_id: groupId }),
    cache: 'no-store',
  });
  const payment = await res.json().catch(() => ({}));
  if (!res.ok || !payment.reference_id) {
    throw new Error(payment.error || `payment-api ${res.status}`);
  }
  return {
    reference_id: payment.reference_id,
    amount: payment.amount,
    expires_at: payment.expires_at,
    entity: ENTITY,
    entity_atm: ENTITY_ATM,
  };
}

// How long an expired rebook keeps offering "Gerar nova referência".
const RENEW_WINDOW_DAYS = 14;

/**
 * The customer's website rebooks that still owe money: references waiting to
 * be paid, and recent ones whose reference expired but that can be placed again
 * (same new trip and seats, a fresh reference). Superseded attempts, departed
 * trips and tickets that can no longer move are left out.
 */
export async function listOwedRebooks(admin, userId) {
  const since = new Date(Date.now() - RENEW_WINDOW_DAYS * 864e5).toISOString();
  const { data: rows, error } = await admin
    .from('ticket_rebooking_fees')
    .select('group_id, ticket_id, status, new_trip_id, new_seat_number, total_kz, payment_reference, expires_at, created_at')
    .eq('actor_user_id', userId)
    .eq('channel', 'website')
    .in('status', ['pending_payment', 'expired'])
    .gte('created_at', since);
  if (error) throw error;
  if (!rows?.length) return [];

  const ticketIds = [...new Set(rows.map((r) => r.ticket_id))];
  const tripIds = [...new Set(rows.map((r) => r.new_trip_id))];
  const [history, ticketRes, tripRes] = await Promise.all([
    admin.from('ticket_rebooking_fees').select('ticket_id, group_id, status, created_at').in('ticket_id', ticketIds),
    admin.from('tickets')
      .select('id, ticket_number, status, payment_status, trip_id, seat_number, passenger_id, ticket_companions(name)')
      .in('id', ticketIds),
    admin.from('trips')
      .select('id, departure_time, status, routes:route_id(origin_city, destination_city)')
      .in('id', tripIds),
  ]);
  for (const r of [history, ticketRes, tripRes]) if (r.error) throw r.error;

  const passengerIds = [...new Set((ticketRes.data || []).map((t) => t.passenger_id).filter(Boolean))];
  const { data: profiles } = passengerIds.length
    ? await admin.from('profiles').select('id, first_name, last_name').in('id', passengerIds)
    : { data: [] };
  const profileById = new Map((profiles || []).map((p) => [p.id, p]));
  const ticketById = new Map((ticketRes.data || []).map((t) => [t.id, t]));
  const tripById = new Map((tripRes.data || []).map((t) => [t.id, t]));

  const groups = new Map();
  for (const r of rows) {
    if (!groups.has(r.group_id)) groups.set(r.group_id, []);
    groups.get(r.group_id).push(r);
  }

  const now = Date.now();
  const out = [];
  for (const [groupId, lines] of groups) {
    const createdAt = lines.map((l) => l.created_at).sort().pop();
    // A later attempt on any of these tickets (paid, waiting or expired)
    // replaces this one. A group cancelled because no reference could be made
    // never existed for the customer, so it does not count.
    const superseded = (history.data || []).some((h) =>
      h.group_id !== groupId &&
      ['completed', 'pending_payment', 'expired'].includes(h.status) &&
      lines.some((l) => l.ticket_id === h.ticket_id) &&
      h.created_at > createdAt
    );
    if (superseded) continue;

    const reference = lines.find((l) => l.payment_reference)?.payment_reference || null;
    const expiresAt = lines.map((l) => l.expires_at).filter(Boolean).sort()[0] || null;
    const live = lines.every((l) => l.status === 'pending_payment') && reference &&
      expiresAt && new Date(expiresAt).getTime() > now;

    if (!live) {
      // Only worth renewing while every passenger can still be moved onto a
      // departure that has not left. Otherwise they start again from the ticket.
      const renewable = lines.every((l) => {
        const t = ticketById.get(l.ticket_id);
        const trip = tripById.get(l.new_trip_id);
        return t && ['active', 'expired'].includes(t.status) && t.payment_status === 'paid' &&
          !(t.trip_id === l.new_trip_id && Number(t.seat_number) === Number(l.new_seat_number)) &&
          trip && trip.status === 'scheduled' && new Date(trip.departure_time).getTime() > now + 30 * 60e3;
      });
      if (!renewable) continue;
    }

    out.push({
      group_id: groupId,
      status: live ? 'pending_payment' : 'expired',
      reference_id: live ? reference : null,
      expired_reference_id: live ? null : reference,
      amount: lines.reduce((sum, l) => sum + Number(l.total_kz || 0), 0),
      expires_at: expiresAt,
      entity: ENTITY,
      entity_atm: ENTITY_ATM,
      created_at: createdAt,
      lines: lines.map((l) => {
        const t = ticketById.get(l.ticket_id);
        const p = profileById.get(t?.passenger_id);
        const trip = tripById.get(l.new_trip_id);
        return {
          ticket_id: l.ticket_id,
          ticket_number: t?.ticket_number || null,
          passenger_name: t?.ticket_companions?.[0]?.name?.trim() ||
            [p?.first_name, p?.last_name].filter(Boolean).join(' ') || null,
          new_trip_id: l.new_trip_id,
          new_seat_number: l.new_seat_number,
          departure_time: trip?.departure_time || null,
          origin_city: trip?.routes?.origin_city || null,
          destination_city: trip?.routes?.destination_city || null,
        };
      }),
    });
  }

  // Waiting references first, then the newest expired ones.
  return out.sort((a, b) =>
    (a.status === b.status ? 0 : a.status === 'pending_payment' ? -1 : 1) ||
    (b.created_at > a.created_at ? 1 : -1)
  );
}
