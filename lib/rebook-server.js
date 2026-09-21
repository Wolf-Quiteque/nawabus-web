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
