'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import jsPDF from 'jspdf';
import QRCode from 'qrcode';

export default function CheckoutPage() {
  const router = useRouter();
  const [bookingDetails, setBookingDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [reference, setReference] = useState(null);
  const [ticketNumbers, setTicketNumbers] = useState({ outbound: null, return: null });
  const [outboundTicket, setOutboundTicket] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('referencia'); // 'cash' or 'referencia'
  const supabase = createClient();

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null); // { code, discount_percentage }
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');

  // Auth state
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authPhoneNumber, setAuthPhoneNumber] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const details = sessionStorage.getItem('bookingDetails');
    if (details) {
      setBookingDetails(JSON.parse(details));
    } else {
      router.push('/');
    }
    
    (async () => {
      const { data } = await supabase.auth.getUser();
      setCurrentUser(data?.user ?? null);
    })();
  }, [router, supabase]);

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponError('');
    try {
      const res = await fetch(`/api/validate-coupon?code=${encodeURIComponent(couponCode.trim())}`);
      const data = await res.json();
      if (data.valid) {
        setAppliedCoupon({ code: data.code, discount_percentage: data.discount_percentage });
      } else {
        setCouponError(data.message || 'Cupom inválido');
        setAppliedCoupon(null);
      }
    } catch {
      setCouponError('Erro ao validar cupom');
    } finally {
      setCouponLoading(false);
    }
  };

  // Normalize phone number to include Angola country code
  const normalizePhoneNumber = (phone) => {
    if (!phone) return null;
    const cleaned = phone.replace(/\D/g, '');
    if (!cleaned) return null;
    if (!cleaned.startsWith('244') && cleaned.length === 9 && cleaned.startsWith('9')) {
      return `244${cleaned}`;
    }
    return cleaned;
  };

  // Helper to create tickets for one trip (one ticket per seat)
  const createTicketsForTrip = async (trip, passengerId, perSeatPrice, paymentStatus, effectivePaymentMethod) => {
    const tickets = [];
    for (const seatNum of trip.selectedSeats) {
      const { data, error } = await supabase
        .from('tickets')
        .insert({
          trip_id: trip.id,
          passenger_id: passengerId,
          booked_by: passengerId,
          seat_number: seatNum,
          price_paid_usd: perSeatPrice,
          payment_status: paymentStatus,
          payment_method: effectivePaymentMethod,
          booking_source: 'online',
          seat_class: trip.seat_class || 'economy',
        })
        .select()
        .single();

      if (error) throw error;
      tickets.push(data);

      // Insert companion record if this seat has companion info
      const companions = trip.companions || {};
      if (companions[seatNum] && companions[seatNum].name?.trim()) {
        await supabase.from('ticket_companions').insert({
          ticket_id: data.id,
          name: companions[seatNum].name.trim(),
          phone: normalizePhoneNumber(companions[seatNum].phone),
        });
      }
    }
    return tickets;
  };

  // Send SMS to companions who provided a phone number
  const sendCompanionSms = async (allTickets, trip, user) => {
    const companions = trip.companions || {};
    const companionsToNotify = [];

    for (const ticket of allTickets) {
      const c = companions[ticket.seat_number];
      if (c && c.phone?.trim()) {
        companionsToNotify.push({
          name: c.name,
          phone: normalizePhoneNumber(c.phone),
          seatNumber: ticket.seat_number,
          ticketNumber: ticket.ticket_number,
        });
      }
    }

    if (companionsToNotify.length === 0) return;

    const mainName = user.user_metadata?.full_name ||
      `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() ||
      'Cliente';

    try {
      await fetch('/api/send-companion-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companions: companionsToNotify.map(c => ({
            ...c,
            route: `${trip.routes?.origin_city || trip.origin || 'Origem'} -> ${trip.routes?.destination_city || trip.destination || 'Destino'}`,
            departureTime: trip.departure_time,
          })),
          bookedBy: mainName,
        }),
      });
    } catch (err) {
      console.error('Failed to send companion SMS:', err);
    }
  };

  const proceedWithPayment = async (user) => {
    if (!bookingDetails) return;

    const { tripType, outboundTrip, returnTrip, totalPrice } = bookingDetails;
    const discountFactor = appliedCoupon ? (1 - appliedCoupon.discount_percentage / 100) : 1;
    const finalPrice = parseFloat((totalPrice * discountFactor).toFixed(2));
    const passengerId = user.id;

    const isFreeTrip = finalPrice === 0;

    try {
      const paymentStatus = isFreeTrip ? 'paid' : (paymentMethod === 'cash' ? 'paid' : 'pending');
      const effectivePaymentMethod = isFreeTrip ? 'cash' : paymentMethod;

      // Calculate per-seat price for outbound
      const outboundSeatCount = outboundTrip.selectedSeats.length;
      const outboundPerSeat = isFreeTrip ? 0 : parseFloat(
        (outboundTrip.price * discountFactor / outboundSeatCount).toFixed(2)
      );

      // Create one ticket per seat for outbound
      const outboundTickets = await createTicketsForTrip(
        outboundTrip, passengerId, outboundPerSeat, paymentStatus, effectivePaymentMethod
      );

      setOutboundTicket(outboundTickets[0]);

      let returnTickets = [];

      // Create return tickets if round-trip
      if (tripType === 'round-trip' && returnTrip) {
        const returnSeatCount = returnTrip.selectedSeats.length;
        const returnPerSeat = isFreeTrip ? 0 : parseFloat(
          (returnTrip.price * discountFactor / returnSeatCount).toFixed(2)
        );

        returnTickets = await createTicketsForTrip(
          returnTrip, passengerId, returnPerSeat, paymentStatus, effectivePaymentMethod
        );
      }

      const allTickets = [...outboundTickets, ...returnTickets];

      // Store ticket numbers (use first ticket as primary)
      setTicketNumbers({
        outbound: outboundTickets[0].ticket_number,
        return: returnTickets[0]?.ticket_number || null
      });

      if (isFreeTrip) {
        setReference('CAMPAIGN_FREE');
        // Send companion SMS for free trips too
        sendCompanionSms(outboundTickets, outboundTrip, user);
        if (returnTrip) sendCompanionSms(returnTickets, returnTrip, user);
        return;
      }

      if (paymentMethod === 'referencia') {
        // Call payment API with total price, using first ticket as primary
        const response = await fetch('/api/create-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticket_id: outboundTickets[0].id,
            amount: finalPrice,
            passenger_name: user.user_metadata.full_name || 'N/A',
            passenger_email: user.email,
            trip_type: tripType,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Falha ao criar referencia de pagamento.');
        }

        // Update ALL tickets with the same payment reference
        for (const ticket of allTickets) {
          const { error: updateErr } = await supabase
            .from('tickets')
            .update({ payment_reference: result.reference_number })
            .eq('id', ticket.id);

          if (updateErr) {
            console.error(`Failed to update ticket ${ticket.id} reference:`, updateErr);
          }
        }

        setReference(result.reference_number);
      } else {
        // Cash payment — send companion SMS immediately
        sendCompanionSms(outboundTickets, outboundTrip, user);
        if (returnTrip) sendCompanionSms(returnTickets, returnTrip, user);
        setReference('CASH_PAYMENT');
      }
    } catch (error) {
      console.error('Payment error:', error);
      alert(error.message);
    }
  };

  const handlePayment = async () => {
    setIsLoading(true);
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    
    if (!user) {
      setShowAuthDialog(true);
      setIsLoading(false);
      return;
    }

    try {
      await proceedWithPayment(user);
    } finally {
      setIsLoading(false);
    }
  };

  const ensureNames = (name) => {
    const trimmed = (name || '').trim();
    if (!trimmed) return { first_name: '', last_name: '' };
    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) return { first_name: parts[0], last_name: '' };
    return {
      first_name: parts[0],
      last_name: parts.slice(1).join(' '),
    };
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthSubmitting(true);

    try {
      const email = `${authPhoneNumber}@nawabus.com`;
      const normalizedPhone = normalizePhoneNumber(authPhoneNumber);

      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: authPassword,
        });
        if (error) {
          alert('Falha no login. Verifique o telefone e senha.');
          return;
        }
      } else {
        const { first_name, last_name } = ensureNames(authName);
        const { data, error } = await supabase.auth.signUp({
          email,
          password: authPassword,
          options: {
            data: {
              role: 'passenger',
              first_name,
              last_name,
              phone_number: normalizedPhone,
            },
          },
        });
        
        if (error) {
          alert('Falha no registo. Verifique os dados e tente novamente.');
          return;
        }

        if (!data?.session) {
          const { error: signInErr } = await supabase.auth.signInWithPassword({
            email,
            password: authPassword,
          });
          if (signInErr) {
            alert('Conta criada. Verifique seu email para confirmar e depois faça login.');
            return;
          }
        }
      }

      const { data: userData } = await supabase.auth.getUser();
      const authedUser = userData?.user;
      setCurrentUser(authedUser || null);

      if (!authedUser) {
        alert('Sessão não encontrada após autenticação.');
        return;
      }

      setShowAuthDialog(false);
      setIsLoading(true);
      await proceedWithPayment(authedUser);
      setIsLoading(false);
    } finally {
      setAuthSubmitting(false);
    }
  };


// Make sure you have:
// import { jsPDF } from "jspdf";
// import QRCode from "qrcode";

const handleDownloadPdf = async () => {
  if (!bookingDetails || !ticketNumbers.outbound || !currentUser || !reference || !outboundTicket) {
    alert("Não foi possível gerar o bilhete. Faltam detalhes.");
    return;
  }

  const { tripType, outboundTrip, returnTrip, totalPrice } = bookingDetails;
  const pdfDiscountFactor = appliedCoupon ? (1 - appliedCoupon.discount_percentage / 100) : 1;
  const pdfFinalPrice = parseFloat((totalPrice * pdfDiscountFactor).toFixed(2));
  const doc = new jsPDF(); // A4 portrait, unit mm by default (210 x 297)

  const orange = [245, 158, 11];
  const lightOrange = [252, 191, 73];

  const trimmedOutbound =
    ticketNumbers.outbound.length > 9
      ? ticketNumbers.outbound.substring(9)
      : ticketNumbers.outbound;

  // -------------------------
  // HEADER / BRANDING
  // -------------------------
  doc.setFillColor(...orange);
  doc.rect(0, 0, 210, 50, "F");

  doc.setFillColor(...lightOrange);
  doc.circle(5, 5, 8, "F");
  doc.circle(205, 5, 8, "F");

  try {
    const logoImg = new Image();
    logoImg.src = "/nawabus_white.png";
    await new Promise((resolve, reject) => {
      logoImg.onload = resolve;
      logoImg.onerror = reject;
      setTimeout(reject, 2000);
    });
    doc.addImage(logoImg, "PNG", 70, 10, 70, 35);
  } catch (e) {
    console.warn("Logo could not be loaded");
  }

  // -------------------------
  // COMPANY INFO STRIP
  // -------------------------
  doc.setTextColor(60, 60, 60);
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(15, 55, 180, 20, 3, 3, "F");

  doc.setFontSize(9);
  doc.text(
    "NIF: 5000451738 |  Tel: +244 930 533 405",
    105,
    67,
    { align: "center" }
  );

  // -------------------------
  // PAGAMENTO BOX
  // -------------------------
  doc.setFillColor(...orange);
  doc.roundedRect(15, 85, 180, 45, 5, 5, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont(undefined, "bold");
  doc.text("INFORMAÇÕES DE PAGAMENTO", 105, 95, { align: "center" });

  doc.setFontSize(11);
  doc.setFont(undefined, "normal");

  if (pdfFinalPrice === 0 || paymentMethod === 'campaign') {
    doc.setFontSize(16);
    doc.setFont(undefined, "bold");
    doc.text("VIAGEM SOLIDÁRIA — GRATUITA", 105, 110, { align: "center" });

    doc.setFontSize(14);
    doc.text("Campanha SOS Benguela", 105, 125, { align: "center" });
  } else if (paymentMethod === 'cash') {
    doc.setFontSize(16);
    doc.setFont(undefined, "bold");
    doc.text("Método: PAGAMENTO EM CASH", 105, 110, { align: "center" });

    doc.setFontSize(14);
    doc.text(
      `Valor Total: ${Math.round(pdfFinalPrice)},00 Kz`,
      105,
      125,
      { align: "center" }
    );
  } else {
    // Referencia payment information
    doc.text("Entidade: 1219", 25, 107);

    doc.setFontSize(18);
    doc.setFont(undefined, "bold");
    doc.text(`Referência: ${reference}`, 105, 115, { align: "center" });

    doc.setFontSize(14);
    doc.text(
      `Valor Total: ${Math.round(pdfFinalPrice)},00 Kz`,
      105,
      125,
      { align: "center" }
    );
  }

  // -------------------------
  // VIAGEM DE IDA / VOLTA BLOCK
  // -------------------------
  // Outer box (trip details block)
  const tripBoxY = 140;
  const tripBoxHeight = tripType === "round-trip" ? 110 : 65;
  doc.setDrawColor(...orange);
  doc.setLineWidth(0.5);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(15, tripBoxY, 180, tripBoxHeight, 3, 3, "FD");

  // Left text content inside trip box
  let yPos = 150;

  // Helper to render safely
  const renderText = (text, x, y) => {
    doc.text(String(text || "N/A"), x, y);
  };

  // Section: VIAGEM DE IDA
  doc.setTextColor(...orange);
  doc.setFontSize(12);
  doc.setFont(undefined, "bold");
  doc.text("VIAGEM DE IDA", 20, yPos);

  doc.setTextColor(60, 60, 60);
  doc.setFontSize(10);
  doc.setFont(undefined, "normal");

  yPos += 10;

  // Passageiro
  doc.setFont(undefined, "bold");
  doc.text("Passageiro:", 20, yPos);
  doc.setFont(undefined, "normal");
  renderText(
    currentUser.user_metadata?.full_name ||
      `${currentUser.user_metadata?.first_name || ""} ${
        currentUser.user_metadata?.last_name || ""
      }`.trim() ||
      "Cliente",
    55,
    yPos
  );
  yPos += 8;

  // Nº Bilhete
  doc.setFont(undefined, "bold");
  doc.text("Nº Bilhete:", 20, yPos);
  doc.setFont(undefined, "normal");
  renderText(trimmedOutbound, 55, yPos);
  yPos += 8;

  // Rota
  doc.setFont(undefined, "bold");
  doc.text("Rota:", 20, yPos);
  doc.setFont(undefined, "normal");
  renderText(
    `${outboundTrip.routes?.origin_city || "Origem"} → ${
      outboundTrip.routes?.destination_city || "Destino"
    }`,
    55,
    yPos
  );
  yPos += 8;

  // Partida
  doc.setFont(undefined, "bold");
  doc.text("Partida:", 20, yPos);
  doc.setFont(undefined, "normal");
  renderText(
    outboundTrip.departure_time
      ? new Date(outboundTrip.departure_time).toLocaleString("pt-PT")
      : "Data não definida",
    55,
    yPos
  );
  yPos += 8;

  // Passageiros por assento
  doc.setFont(undefined, "bold");
  doc.text("Passageiros:", 20, yPos);
  doc.setFont(undefined, "normal");
  const outboundSorted = Array.isArray(outboundTrip.selectedSeats)
    ? [...outboundTrip.selectedSeats].sort((a, b) => a - b)
    : [];
  const outboundCompanions = outboundTrip.companions || {};
  if (outboundSorted.length > 0) {
    outboundSorted.forEach((seat, idx) => {
      const label = idx === 0
        ? `Lugar ${seat}: ${
            currentUser.user_metadata?.full_name ||
            [currentUser.user_metadata?.first_name, currentUser.user_metadata?.last_name].filter(Boolean).join(' ') ||
            'Voce'
          }`
        : `Lugar ${seat}: ${outboundCompanions[seat]?.name || '—'}`;
      renderText(label, 55, yPos);
      yPos += 6;
    });
  } else {
    renderText("N/A", 55, yPos);
    yPos += 6;
  }
  yPos += 2;

  // Autocarro
  doc.setFont(undefined, "bold");
  doc.text("Autocarro:", 20, yPos);
  doc.setFont(undefined, "normal");
  renderText(
    outboundTrip.buses?.license_plate ||
      outboundTrip.bus_plate ||
      "N/A",
    55,
    yPos
  );
  yPos += 8;

  // If round-trip, add "VIAGEM DE VOLTA"
  if (tripType === "round-trip" && returnTrip) {
    yPos += 5; // spacing before divider

    doc.setDrawColor(...orange);
    doc.line(20, yPos, 190, yPos);
    yPos += 8;

    doc.setTextColor(...orange);
    doc.setFont(undefined, "bold");
    doc.text("VIAGEM DE VOLTA", 20, yPos);

    doc.setTextColor(60, 60, 60);
    doc.setFont(undefined, "normal");
    yPos += 8;

    if (ticketNumbers.return) {
      const trimmedReturn =
        ticketNumbers.return.length > 9
          ? ticketNumbers.return.substring(9)
          : ticketNumbers.return;

      doc.setFont(undefined, "bold");
      doc.text("Nº Bilhete:", 20, yPos);
      doc.setFont(undefined, "normal");
      renderText(trimmedReturn, 55, yPos);
      yPos += 8;
    }

    doc.setFont(undefined, "bold");
    doc.text("Rota:", 20, yPos);
    doc.setFont(undefined, "normal");
    renderText(
      `${returnTrip.routes?.origin_city || "Origem"} → ${
        returnTrip.routes?.destination_city || "Destino"
      }`,
      55,
      yPos
    );
    yPos += 8;

    doc.setFont(undefined, "bold");
    doc.text("Partida:", 20, yPos);
    doc.setFont(undefined, "normal");
    renderText(
      returnTrip.departure_time
        ? new Date(returnTrip.departure_time).toLocaleString("pt-PT")
        : "Data não definida",
      55,
      yPos
    );
    yPos += 8;

    doc.setFont(undefined, "bold");
    doc.text("Passageiros:", 20, yPos);
    doc.setFont(undefined, "normal");
    const returnSorted = Array.isArray(returnTrip.selectedSeats)
      ? [...returnTrip.selectedSeats].sort((a, b) => a - b)
      : [];
    const returnCompanions = returnTrip.companions || {};
    if (returnSorted.length > 0) {
      returnSorted.forEach((seat, idx) => {
        const label = idx === 0
          ? `Lugar ${seat}: ${
              currentUser.user_metadata?.full_name ||
              [currentUser.user_metadata?.first_name, currentUser.user_metadata?.last_name].filter(Boolean).join(' ') ||
              'Voce'
            }`
          : `Lugar ${seat}: ${returnCompanions[seat]?.name || '—'}`;
        renderText(label, 55, yPos);
        yPos += 6;
      });
    } else {
      renderText("N/A", 55, yPos);
      yPos += 6;
    }
    yPos += 2;

    doc.setFont(undefined, "bold");
    doc.text("Autocarro:", 20, yPos);
    doc.setFont(undefined, "normal");
    renderText(
      returnTrip.buses?.license_plate ||
        returnTrip.bus_plate ||
        "N/A",
      55,
      yPos
    );

    // yPos ends roughly ~230-240-ish
  }

// -------------------------
// QR CODE BOX (right side)
// -------------------------

  // ❗️ REPLACE your old qrCodeData with this:
  const qrCodeData = outboundTicket.id; // Just the ticket ID

  const qrCodeUrl = await QRCode.toDataURL(qrCodeData, {
    width: 300,
    margin: 1,
  });

  // QR wrapper box mirrors the trip box height
  doc.setDrawColor(...orange);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(
    142,
    tripBoxY,
    53,
    tripBoxHeight,
    3,
    3,
    "FD"
  );

  doc.setFontSize(8);
  doc.setTextColor(...orange);
  doc.text("Escaneie aqui", 168.5, 148, { align: "center" });
  doc.addImage(qrCodeUrl, "PNG", 147, 152, 43, 43);

  // -------------------------
  // PAGE BREAK LOGIC ⭐
  // -------------------------
  const pageHeight = doc.internal.pageSize.getHeight(); // ~297mm for A4
  const instructionsBlockHeight = 35;  // "IMPORTANTE" box height
  const footerBlockHeight = 30;        // footer content height (~line + text + circles)
  const gapAfterInstructions = 10;     // space between instructions block and footer

  // Where we *want* to start the instructions block if it fits on page 1
  let instructionsY =
    tripType === "round-trip" ? 260 : 215;

  // Predict bottom of footer if we keep everything on this page
  const projectedBottom =
    instructionsY +
    instructionsBlockHeight +
    gapAfterInstructions +
    footerBlockHeight;

  // If it won't fit, start fresh on a new page ⭐
  if (projectedBottom > pageHeight) {
    doc.addPage();
    instructionsY = 20; // top margin on new page
  }

  // -------------------------
  // INSTRUÇÕES DE PAGAMENTO
  // -------------------------
  doc.setFillColor(255, 248, 240);
  doc.setDrawColor(...orange);
  doc.roundedRect(
    15,
    instructionsY,
    180,
    instructionsBlockHeight,
    3,
    3,
    "FD"
  );

  doc.setTextColor(230, 120, 0);
  doc.setFontSize(11);
  doc.setFont(undefined, "bold");
  doc.text("IMPORTANTE", 20, instructionsY + 10);

  doc.setTextColor(60, 60, 60);
  doc.setFontSize(9);
  doc.setFont(undefined, "normal");

  if (pdfFinalPrice === 0 || paymentMethod === 'campaign') {
    doc.text(
      "• Este bilhete é gratuito — Campanha Solidária SOS Benguela",
      20,
      instructionsY + 18
    );
    doc.text(
      "• Apresente este bilhete impresso ou digital no embarque",
      20,
      instructionsY + 24
    );
    doc.text(
      "• Obrigado pela sua solidariedade!",
      20,
      instructionsY + 30
    );
  } else if (paymentMethod === 'cash') {
    doc.text(
      "• Pagamento será feito em dinheiro no balcão da empresa",
      20,
      instructionsY + 18
    );
    doc.text(
      "• Leve este bilhete impresso ou digital ao balcão",
      20,
      instructionsY + 24
    );
    doc.text(
      "• O bilhete está confirmado, mas só será válido após pagamento",
      20,
      instructionsY + 30
    );
  } else {
    // Referencia payment instructions
    doc.text(
      "• Sua reserva será confirmada após o recebimento do pagamento",
      20,
      instructionsY + 18
    );
    doc.text(
      "• Dirija-se a qualquer MULTICAIXA ou use home banking",
      20,
      instructionsY + 24
    );
    doc.text(
      "• Utilize os dados de pagamento acima (Entidade 1219)",
      20,
      instructionsY + 30
    );
  }

  // -------------------------
  // FOOTER (MAY BE ON PAGE 2) ⭐
  // -------------------------
  let footerY = instructionsY + instructionsBlockHeight + gapAfterInstructions;

  // Line separator
  doc.setDrawColor(...lightOrange);
  doc.setLineWidth(1);
  doc.line(15, footerY, 195, footerY);

  // Footer text
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `Data de Impressão: ${new Date().toLocaleString("pt-PT")}`,
    20,
    footerY + 8
  );

  doc.setTextColor(...orange);
  doc.setFont(undefined, "bold");
  if (pdfFinalPrice === 0 || paymentMethod === 'campaign') {
    doc.text(
      "Bilhete solidário confirmado",
      105,
      footerY + 15,
      { align: "center" }
    );
  } else if (paymentMethod === 'cash') {
    doc.text(
      "Bilhete confirmado - Pague no balcão",
      105,
      footerY + 15,
      { align: "center" }
    );
  } else {
    doc.text(
      "Reserva válida por 3 dias",
      105,
      footerY + 15,
      { align: "center" }
    );
  }

  doc.setFontSize(10);
  doc.text(
    "Obrigado por escolher NawaBus!",
    105,
    footerY + 25,
    { align: "center" }
  );

  // Decorative circles
  doc.setFillColor(...lightOrange);
  doc.circle(5, footerY + 22, 5, "F");
  doc.circle(205, footerY + 22, 5, "F");

  // -------------------------
  // SAVE
  // -------------------------
  const now = new Date();
  const formattedDate = `${now.getFullYear()}${String(
    now.getMonth() + 1
  ).padStart(2, "0")}${String(now.getDate()).padStart(
    2,
    "0"
  )}`;
  const fileName = `nawabus-${trimmedOutbound}-${formattedDate}.pdf`;

  doc.save(fileName);

  // cleanup
  sessionStorage.removeItem("bookingDetails");
  router.push("/");
};



  if (!bookingDetails) {
    return <div className="text-center py-10">A carregar detalhes da reserva...</div>;
  }

  const { tripType, outboundTrip, returnTrip, totalPrice } = bookingDetails;
  const discountAmount = appliedCoupon ? parseFloat((totalPrice * appliedCoupon.discount_percentage / 100).toFixed(2)) : 0;
  const finalPrice = totalPrice - discountAmount;

  return (
    <div className="w-full max-w-4xl mx-auto py-8 px-4">
      <button 
        onClick={() => router.back()} 
        className="flex items-center gap-2 mb-4 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100"
      >
        <ArrowLeft />
        <span>Voltar</span>
      </button>
      
      <h1 className="text-3xl font-bold text-center mb-8 text-gray-800 dark:text-white">
        Finalizar Compra
      </h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Order Summary */}
        <div>
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Resumo do Pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Outbound Trip */}
              <div className="border-b pb-4">
                <h3 className="font-semibold text-lg text-gray-800 dark:text-white mb-2">
                  Viagem de Ida
                </h3>
                <p className="font-semibold text-gray-800 dark:text-white">
                  {outboundTrip.origin} → {outboundTrip.destination}
                </p>
                <p className="text-sm text-gray-500">
                  {new Date(outboundTrip.departure_time).toLocaleString('pt-PT', { 
                    dateStyle: 'full', 
                    timeStyle: 'short' 
                  })}
                </p>
                <div className="mt-2">
                  <p className="font-semibold text-gray-800 dark:text-white">Passageiros:</p>
                  <div className="space-y-1 mt-1">
                    {[...outboundTrip.selectedSeats].sort((a, b) => a - b).map((seat, i) => (
                      <p key={seat} className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-mono text-yellow-600">Lugar {seat}</span>
                        {' — '}
                        {i === 0
                          ? <span className="font-medium">Voce</span>
                          : <span>{outboundTrip.companions?.[seat]?.name || '—'}</span>
                        }
                      </p>
                    ))}
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {outboundTrip.bus_make} {outboundTrip.bus_model} • {outboundTrip.seat_class}
                </p>
              </div>

              {/* Return Trip */}
              {tripType === 'round-trip' && returnTrip && (
                <div className="border-b pb-4">
                  <h3 className="font-semibold text-lg text-gray-800 dark:text-white mb-2">
                    Viagem de Volta
                  </h3>
                  <p className="font-semibold text-gray-800 dark:text-white">
                    {returnTrip.origin} → {returnTrip.destination}
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(returnTrip.departure_time).toLocaleString('pt-PT', {
                      dateStyle: 'full',
                      timeStyle: 'short'
                    })}
                  </p>
                  <div className="mt-2">
                    <p className="font-semibold text-gray-800 dark:text-white">Passageiros:</p>
                    <div className="space-y-1 mt-1">
                      {[...returnTrip.selectedSeats].sort((a, b) => a - b).map((seat, i) => (
                        <p key={seat} className="text-sm text-gray-600 dark:text-gray-400">
                          <span className="font-mono text-yellow-600">Lugar {seat}</span>
                          {' — '}
                          {i === 0
                            ? <span className="font-medium">Voce</span>
                            : <span>{returnTrip.companions?.[seat]?.name || '—'}</span>
                          }
                        </p>
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {returnTrip.bus_make} {returnTrip.bus_model} • {returnTrip.seat_class}
                  </p>
                </div>
              )}

              {/* Coupon - hidden for free trips */}
              {totalPrice > 0 && <div className="border-t pt-4">
                {!appliedCoupon ? (
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Código de Desconto</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Inserir código..."
                        value={couponCode}
                        onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(''); }}
                        onKeyDown={(e) => e.key === 'Enter' && applyCoupon()}
                        className="flex-1 border rounded-md px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-yellow-400 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                        disabled={!!reference}
                      />
                      <button
                        onClick={applyCoupon}
                        disabled={couponLoading || !couponCode.trim() || !!reference}
                        className="px-4 py-2 text-sm font-medium bg-yellow-500 hover:bg-yellow-600 text-white rounded-md disabled:opacity-50 transition-colors"
                      >
                        {couponLoading ? '...' : 'Aplicar'}
                      </button>
                    </div>
                    {couponError && <p className="text-sm text-red-500 mt-1">{couponError}</p>}
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-md px-3 py-2">
                    <div>
                      <span className="text-sm font-semibold text-green-700 dark:text-green-300">🏷 {appliedCoupon.code}</span>
                      <span className="text-sm text-green-600 dark:text-green-400 ml-2">–{appliedCoupon.discount_percentage}% de desconto</span>
                    </div>
                    {!reference && (
                      <button onClick={() => { setAppliedCoupon(null); setCouponCode(''); }} className="text-xs text-gray-500 hover:text-red-500 ml-2">✕</button>
                    )}
                  </div>
                )}
              </div>}

              {/* Total */}
              <div className="border-t pt-4">
                {appliedCoupon && (
                  <p className="text-sm flex justify-between text-gray-500 line-through">
                    <span>Subtotal:</span>
                    <span>{totalPrice.toFixed(2)} USD</span>
                  </p>
                )}
                {appliedCoupon && (
                  <p className="text-sm flex justify-between text-green-600 mb-1">
                    <span>Desconto ({appliedCoupon.discount_percentage}%):</span>
                    <span>–{discountAmount.toFixed(2)} USD</span>
                  </p>
                )}
                <p className="text-xl font-bold flex justify-between text-gray-800 dark:text-white">
                  <span>Total:</span>
                  <span className="text-yellow-600">
                    {finalPrice === 0 ? 'Gratuito' : `${finalPrice.toFixed(2)} USD`}
                  </span>
                </p>
                {finalPrice > 0 && (
                  <p className="text-sm text-gray-500 text-right">
                    ≈ {Math.round(finalPrice)} Kz
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment Section */}
        <div>
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Pagamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {finalPrice > 0 && (
              <div>
                <Label className="text-base font-semibold">Método de Pagamento</Label>
                <div className="space-y-3 mt-3">
                  {/* Cash Payment Option */}
                  <div
                    className={`flex items-start space-x-3 p-4 border-2 rounded-lg transition-all ${
                      reference
                        ? 'opacity-50 cursor-not-allowed'
                        : 'cursor-pointer'
                    } ${
                      paymentMethod === 'cash'
                        ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }`}
                    onClick={() => !reference && setPaymentMethod('cash')}
                  >
                    <input
                      type="radio"
                      name="payment-method"
                      value="cash"
                      checked={paymentMethod === 'cash'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      disabled={!!reference}
                      className="mt-1 h-4 w-4 text-yellow-600 focus:ring-yellow-500"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-gray-800 dark:text-white">💵 Pagamento em Cash</div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Pague em dinheiro no balcão da empresa. O bilhete será confirmado imediatamente.
                      </p>
                    </div>
                  </div>

                  {/* Referencia Payment Option */}
                  <div
                    className={`flex items-start space-x-3 p-4 border-2 rounded-lg transition-all ${
                      reference
                        ? 'opacity-50 cursor-not-allowed'
                        : 'cursor-pointer'
                    } ${
                      paymentMethod === 'referencia'
                        ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }`}
                    onClick={() => !reference && setPaymentMethod('referencia')}
                  >
                    <input
                      type="radio"
                      name="payment-method"
                      value="referencia"
                      checked={paymentMethod === 'referencia'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      disabled={!!reference}
                      className="mt-1 h-4 w-4 text-yellow-600 focus:ring-yellow-500"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-gray-800 dark:text-white">🏦 Pagamento em Referência</div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Gere uma referência MULTICAIXA para pagar em qualquer terminal ou home banking.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              )}

              {reference === 'CAMPAIGN_FREE' ? (
                <div className="text-center p-6 border-2 border-green-500 border-dashed rounded-lg bg-green-50 dark:bg-green-900/20">
                  <div className="mb-4">
                    <p className="text-2xl mb-3">🙏</p>
                    <p className="font-semibold text-green-700 dark:text-green-300 mb-2">
                      Bilhete Solidário Confirmado!
                    </p>
                    <p className="text-lg font-semibold text-green-700 dark:text-green-300">
                      Viagem gratuita — Campanha SOS Benguela
                    </p>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Apresente este bilhete no embarque. Obrigado pela sua solidariedade!
                  </p>
                  <Button
                    onClick={handleDownloadPdf}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    📄 Baixar Bilhete (PDF)
                  </Button>
                </div>
              ) : reference && reference !== 'CASH_PAYMENT' ? (
                <div className="text-center p-6 border-2 border-green-500 border-dashed rounded-lg bg-green-50 dark:bg-green-900/20">
                  <div className="mb-4">
                    <p className="font-semibold text-green-700 dark:text-green-300 mb-2">
                      Pague com esta referência:
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Entidade: 1219</p>
                    <p className="text-3xl font-bold text-green-600 tracking-widest my-3">
                      {reference}
                    </p>
                    <p className="text-lg font-semibold text-green-700 dark:text-green-300">
                      Valor: {Math.round(finalPrice)},00 Kz
                    </p>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">
                    Dirija-se a um multicaixa ou utilize o seu home banking.
                  </p>
                  <Button 
                    onClick={handleDownloadPdf} 
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    📄 Baixar Bilhete (PDF)
                  </Button>
                </div>
              ) : reference === 'CASH_PAYMENT' ? (
                <div className="text-center p-6 border-2 border-green-500 border-dashed rounded-lg bg-green-50 dark:bg-green-900/20">
                  <div className="mb-4">
                    <p className="text-2xl mb-3">✅</p>
                    <p className="font-semibold text-green-700 dark:text-green-300 mb-2">
                      Bilhete Reservado com Sucesso!
                    </p>
                    <p className="text-lg font-semibold text-green-700 dark:text-green-300">
                      Pagamento: Cash
                    </p>
                    <p className="text-lg font-semibold text-green-700 dark:text-green-300 mt-1">
                      Valor: {Math.round(finalPrice)},00 Kz
                    </p>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Pague em dinheiro no balcão da empresa. Leve este bilhete impresso ou digital.
                  </p>
                  <Button
                    onClick={handleDownloadPdf}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    📄 Baixar Bilhete (PDF)
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={handlePayment}
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-white"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent mr-2"></div>
                      A processar...
                    </>
                  ) : finalPrice === 0 ? (
                    '🙏 Confirmar Reserva Solidária'
                  ) : paymentMethod === 'cash' ? (
                    '🎫 Confirmar Reserva (Pagamento em Cash)'
                  ) : (
                    '🎫 Gerar Referência de Pagamento'
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Auth Dialog */}
      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {authMode === 'login' ? 'Entrar na Sua Conta' : 'Criar Nova Conta'}
            </DialogTitle>
            <DialogDescription>
              {authMode === 'login' 
                ? 'Entre na sua conta para finalizar a compra.' 
                : 'Crie uma conta para gerir as suas reservas e receber notificações.'
              }
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleAuthSubmit}>
            <div className="space-y-2">
              <Label htmlFor="auth-phoneNumber">Número de Telefone</Label>
              <Input
                id="auth-phoneNumber"
                type="tel"
                value={authPhoneNumber}
                onChange={(e) => setAuthPhoneNumber(e.target.value)}
                placeholder="Ex: 923456789"
                required
              />
              <p className="text-xs text-gray-500">
                Será usado para login e notificações
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="auth-password">Senha</Label>
              <Input
                id="auth-password"
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            {authMode === 'signup' && (
              <div className="space-y-2">
                <Label htmlFor="auth-name">Nome Completo</Label>
                <Input
                  id="auth-name"
                  type="text"
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  placeholder="O seu nome completo"
                  required
                />
              </div>
            )}

            <DialogFooter>
              <div className="flex w-full flex-col sm:flex-row items-center justify-between gap-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                  className="text-sm"
                >
                  {authMode === 'login' 
                    ? '📝 Não tem conta? Criar agora' 
                    : '🔐 Já tem conta? Fazer login'
                  }
                </Button>
                <Button
                  type="submit"
                  disabled={authSubmitting}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white min-w-32"
                >
                  {authSubmitting ? (
                    <>
                      <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent mr-2"></div>
                      Processando...
                    </>
                  ) : (
                    authMode === 'login' ? 'Entrar' : 'Criar Conta'
                  )}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
