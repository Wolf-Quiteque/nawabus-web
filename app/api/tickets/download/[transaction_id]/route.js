import { createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

const DOWNLOADABLE_STATUSES = new Set(['active', 'used']);

function clientFingerprint(request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const address = forwarded || request.headers.get('x-real-ip') || 'unknown';
  const secret = process.env.TICKET_AUDIT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'nawabus';
  return createHmac('sha256', secret).update(address).digest('hex');
}

function safeUserAgent(request) {
  return (request.headers.get('user-agent') || 'unknown').slice(0, 500);
}

async function writeAccessLog(supabase, request, paymentReference, outcome, ticketIds = [], details = {}) {
  const { error } = await supabase.from('ticket_document_access_log').insert({
    payment_reference: paymentReference || null,
    ticket_ids: ticketIds,
    outcome,
    details,
    ip_hash: clientFingerprint(request),
    user_agent: safeUserAgent(request),
  });
  if (error) console.error('Ticket document audit failed:', error.message);
}

function errorResponse(message, status) {
  return NextResponse.json(
    { error: message },
    { status, headers: { 'Cache-Control': 'no-store, private' } }
  );
}

export async function GET(request, { params }) {
  const { transaction_id: transactionId } = await params;
  const reference = String(transactionId || '').trim();
  const supabase = createSupabaseAdmin();

  if (!reference || reference.length > 120 || !/^[A-Za-z0-9_-]+$/.test(reference)) {
    await writeAccessLog(supabase, request, reference, 'invalid_reference');
    return errorResponse('Referencia de pagamento invalida.', 400);
  }

  try {
    const { data: payment, error: paymentError } = await supabase
      .from('payment_transactions')
      .select('id, transaction_id, status, created_at, gateway_response')
      .eq('transaction_id', reference)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (paymentError) throw paymentError;
    if (!payment) {
      await writeAccessLog(supabase, request, reference, 'not_found');
      return errorResponse('Pagamento nao encontrado.', 404);
    }
    if (payment.status !== 'completed') {
      await writeAccessLog(supabase, request, reference, 'payment_incomplete', [], {
        payment_status: payment.status,
      });
      return errorResponse('Pagamento nao foi confirmado.', 409);
    }

    const { data: tickets, error: ticketsError } = await supabase
      .from('tickets')
      .select(`
        *,
        ticket_companions(name, phone),
        trips:trip_id(
          *,
          routes:route_id(*),
          buses:bus_id(id, make, model, license_plate, companies:company_id(name))
        )
      `)
      .eq('payment_reference', reference)
      .order('created_at', { ascending: true });

    if (ticketsError) throw ticketsError;
    if (!tickets?.length) {
      await writeAccessLog(supabase, request, reference, 'not_found');
      return errorResponse('Dados do bilhete nao encontrados.', 404);
    }

    const allTicketIds = tickets.map((ticket) => ticket.id);
    const eligibleTickets = tickets.filter((ticket) => (
      DOWNLOADABLE_STATUSES.has(ticket.status) && ticket.payment_status === 'paid'
    ));

    if (!eligibleTickets.length) {
      const hasRefund = tickets.some((ticket) => ticket.status === 'refunded' || ticket.payment_status === 'refunded');
      const hasCancelled = tickets.some((ticket) => ticket.status === 'cancelled');
      const outcome = hasRefund ? 'blocked_refunded' : hasCancelled ? 'blocked_cancelled' : 'blocked_unpaid';
      await writeAccessLog(supabase, request, reference, outcome, allTicketIds, {
        ticket_statuses: tickets.map((ticket) => ({
          ticket_id: ticket.id,
          status: ticket.status,
          payment_status: ticket.payment_status,
        })),
      });
      return errorResponse(
        hasRefund
          ? 'Este bilhete foi reembolsado e ja nao pode ser descarregado.'
          : 'Este bilhete ja nao esta disponivel para descarga.',
        410
      );
    }

    const eligibleIds = eligibleTickets.map((ticket) => ticket.id);
    const passengerIds = [...new Set(eligibleTickets.map((ticket) => ticket.passenger_id).filter(Boolean))];
    const [{ data: revisions, error: revisionError }, { data: profiles, error: profilesError }] = await Promise.all([
      supabase
        .from('ticket_itinerary_revisions')
        .select('*')
        .in('ticket_id', eligibleIds)
        .order('recorded_at', { ascending: false }),
      passengerIds.length
        ? supabase.from('profiles').select('id, first_name, last_name, phone_number').in('id', passengerIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (revisionError) throw revisionError;
    if (profilesError) throw profilesError;

    const latestRevisionByTicket = new Map();
    for (const revision of revisions || []) {
      if (!latestRevisionByTicket.has(revision.ticket_id)) {
        latestRevisionByTicket.set(revision.ticket_id, revision);
      }
    }
    const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));

    const safeTickets = eligibleTickets.map((ticket) => ({
      ...ticket,
      profiles: profileById.get(ticket.passenger_id) || null,
      booking_snapshot: latestRevisionByTicket.get(ticket.id) || null,
    }));
    const excludedTicketIds = allTicketIds.filter((id) => !eligibleIds.includes(id));

    await writeAccessLog(supabase, request, reference, 'authorized', eligibleIds, {
      excluded_ticket_ids: excludedTicketIds,
      itinerary_revision_ids: safeTickets.map((ticket) => ticket.booking_snapshot?.id).filter(Boolean),
    });

    return NextResponse.json({
      payment: {
        transaction_id: payment.transaction_id,
        status: payment.status,
        created_at: payment.created_at,
        gateway_response: payment.gateway_response?.booking_details
          ? { booking_details: payment.gateway_response.booking_details }
          : null,
      },
      tickets: safeTickets,
      excluded_ticket_count: excludedTicketIds.length,
    }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    console.error('Secure ticket download failed:', error);
    await writeAccessLog(supabase, request, reference, 'error', [], { message: error.message });
    return errorResponse('Nao foi possivel carregar o bilhete.', 500);
  }
}
