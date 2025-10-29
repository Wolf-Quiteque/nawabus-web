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
  const supabase = createClient();

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

  const proceedWithPayment = async (user) => {
    if (!bookingDetails) return;

    const { tripType, outboundTrip, returnTrip, totalPrice } = bookingDetails;
    const passengerId = user.id;

    try {
      // Create outbound ticket(s)
      const { data: outboundTicketData, error: outboundError } = await supabase
        .from('tickets')
        .insert({
          trip_id: outboundTrip.id,
          passenger_id: passengerId,
          booked_by: passengerId,
          seat_number: outboundTrip.selectedSeats.join(','),
          price_paid_usd: outboundTrip.price,
          payment_status: 'pending',
          payment_method: 'referencia',
          booking_source: 'online',
          seat_class: outboundTrip.seat_class || 'economy',
        })
        .select()
        .single();

      if (outboundError) throw outboundError;

      // ❗️ SAVE THE FULL TICKET OBJECT TO STATE
      setOutboundTicket(outboundTicketData);

      let returnTicketData = null;
      
      // Create return ticket(s) if round-trip
      if (tripType === 'round-trip' && returnTrip) {
        const { data: retTicket, error: returnError } = await supabase
          .from('tickets')
          .insert({
            trip_id: returnTrip.id,
            passenger_id: passengerId,
            booked_by: passengerId,
            seat_number: returnTrip.selectedSeats.join(','),
            price_paid_usd: returnTrip.price,
            payment_status: 'pending',
            payment_method: 'referencia',
            booking_source: 'online',
            seat_class: returnTrip.seat_class || 'economy',
          })
          .select()
          .single();

        if (returnError) throw returnError;
        returnTicketData = retTicket;
      }

      // Call payment API with combined price
      const response = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: outboundTicketData.id,
          return_ticket_id: returnTicketData?.id,
          amount: totalPrice,
          passenger_name: user.user_metadata.full_name || 'N/A',
          passenger_email: user.email,
          trip_type: tripType,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Falha ao criar referência de pagamento.');
      }

      setReference(result.reference_number);
      setTicketNumbers({
        outbound: outboundTicketData.ticket_number,
        return: returnTicketData?.ticket_number || null
      });
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
              phone_number: authPhoneNumber,
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
  const doc = new jsPDF(); // A4 portrait, unit mm by default (210 x 297)

  const orange = [255, 140, 0];
  const lightOrange = [255, 160, 50];

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
    logoImg.src = "/logo.png";
    await new Promise((resolve, reject) => {
      logoImg.onload = resolve;
      logoImg.onerror = reject;
      setTimeout(reject, 2000);
    });
    doc.addImage(logoImg, "PNG", 15, 10, 30, 30);
  } catch (e) {
    console.warn("Logo could not be loaded");
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont(undefined, "bold");
  doc.text("NawaBus", 105, 25, { align: "center" });

  doc.setFontSize(12);
  doc.setFont(undefined, "normal");
  doc.text(
    tripType === "round-trip" ? "Reserva Ida e Volta" : "Reserva de Bilhete",
    105,
    35,
    { align: "center" }
  );

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
  doc.text("Entidade: 1219", 25, 107);

  doc.setFontSize(18);
  doc.setFont(undefined, "bold");
  doc.text(`Referência: ${reference}`, 105, 115, { align: "center" });

  doc.setFontSize(14);
  doc.text(
    `Valor Total: ${Math.round(totalPrice)},00 Kz`,
    105,
    125,
    { align: "center" }
  );

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

  // Assentos
  doc.setFont(undefined, "bold");
  doc.text("Assentos:", 20, yPos);
  doc.setFont(undefined, "normal");
  renderText(
    Array.isArray(outboundTrip.selectedSeats)
      ? outboundTrip.selectedSeats.join(", ")
      : String(outboundTrip.selectedSeats || "N/A"),
    55,
    yPos
  );
  yPos += 8;

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
    doc.text("Assentos:", 20, yPos);
    doc.setFont(undefined, "normal");
    renderText(
      Array.isArray(returnTrip.selectedSeats)
        ? returnTrip.selectedSeats.join(", ")
        : String(returnTrip.selectedSeats || "N/A"),
      55,
      yPos
    );
    yPos += 8;

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
  const qrCodeData = JSON.stringify({
    ticketId: outboundTicket.id, // From state
    ticketNumber: outboundTicket.ticket_number, // From state (e.g., "NWA 2025 1234")
    passengerName: currentUser.user_metadata?.full_name ||
                   `${currentUser.user_metadata?.first_name || ""} ${currentUser.user_metadata?.last_name || ""}`.trim() ||
                   "Cliente",
    phone: currentUser.email?.replace("@nawabus.com", "") || "N/A",
    route: `${outboundTrip.routes?.origin_city || outboundTrip.origin} → ${outboundTrip.routes?.destination_city || outboundTrip.destination}`,
    departureTime: outboundTrip.departure_time,
    arrivalTime: outboundTrip.arrival_time || null, // Add this to bookingDetails if you have it
    seatNumber: outboundTicket.seat_number, // From state
    busPlate: outboundTrip.buses?.license_plate || outboundTrip.bus_plate || "N/A",
    company: "Nawabus",
    price: outboundTicket.price_paid_usd, // From state
    bookingTime: new Date(outboundTicket.created_at).toLocaleString("pt-PT") // From state
  });

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
  doc.text(
    "Reserva válida por 3 dias",
    105,
    footerY + 15,
    { align: "center" }
  );

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
                  <p className="font-semibold text-gray-800 dark:text-white">Lugares:</p>
                  <p className="font-mono text-orange-600">{outboundTrip.selectedSeats.join(', ')}</p>
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
                    <p className="font-semibold text-gray-800 dark:text-white">Lugares:</p>
                    <p className="font-mono text-orange-600">{returnTrip.selectedSeats.join(', ')}</p>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {returnTrip.bus_make} {returnTrip.bus_model} • {returnTrip.seat_class}
                  </p>
                </div>
              )}

              {/* Total */}
              <div className="border-t pt-4">
                <p className="text-xl font-bold flex justify-between text-gray-800 dark:text-white">
                  <span>Total:</span>
                  <span className="text-orange-600">{totalPrice.toFixed(2)} USD</span>
                </p>
                <p className="text-sm text-gray-500 text-right">
                  ≈ {Math.round(totalPrice )} Kz
                </p>
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
              <div>
                <Label>Método de Pagamento</Label>
                <div className="flex items-center space-x-2 p-3 border rounded-md bg-gray-50 dark:bg-gray-800">
                  <span className="font-medium">Pagamento por Referência</span>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Gere uma referência MULTICAIXA para pagar em qualquer terminal ou home banking.
                </p>
              </div>

              {reference ? (
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
                      Valor: {Math.round(totalPrice )},00 Kz
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
              ) : (
                <Button 
                  onClick={handlePayment} 
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white" 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent mr-2"></div>
                      A processar...
                    </>
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
                  className="bg-orange-500 hover:bg-orange-600 text-white min-w-32"
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
