'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';

function getTicketPassengerName(ticket) {
  const companionName = ticket?.ticket_companions?.[0]?.name?.trim();
  if (companionName) return companionName;

  const profileName = ticket?.profiles
    ? `${ticket.profiles.first_name || ''} ${ticket.profiles.last_name || ''}`.trim()
    : '';

  return profileName || 'Passageiro';
}

export default function DownloadTicketPage() {
  const params = useParams();
  const transactionId = params.transaction_id;
  const [ticketData, setTicketData] = useState(null);
  const [paymentData, setPaymentData] = useState(null); // Added state for payment data
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [error, setError] = useState(null);
  const supabase = createClient();

  useEffect(() => {
    const fetchTicketData = async () => {
      if (!transactionId) {
        setError('ID da transação não fornecido');
        setIsLoading(false);
        return;
      }

      try {
        // First, fetch the payment transaction
        const { data: paymentData, error: paymentError } = await supabase
          .from('payment_transactions')
          .select('*')
          .eq('transaction_id', transactionId)
          .single();

        if (paymentError) {
          console.error('Payment error:', paymentError);
          setError('Pagamento não encontrado');
          setIsLoading(false);
          return;
        }

        if (paymentData.status !== 'completed') {
          setError('Pagamento não foi confirmado. O bilhete ainda não está disponível.');
          setIsLoading(false);
          return;
        }

        const { data: ticketsData, error: ticketError } = await supabase
          .from('tickets')
          .select(`
            *,
            ticket_companions (
              name,
              phone
            ),
            trips: trip_id (
              *,
              routes: route_id (*),
              buses: bus_id (
                id,
                make,
                model,
                companies: company_id (name)
              )
            )
          `)
          .eq('payment_reference', transactionId)
          .order('created_at', { ascending: true });

        if (ticketError || !ticketsData || ticketsData.length === 0) {
          console.error('Ticket error:', ticketError);
          setError('Dados do bilhete não encontrados');
          setIsLoading(false);
          return;
        }

        const passengerIds = [...new Set(ticketsData.map(ticket => ticket.passenger_id).filter(Boolean))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, phone_number')
          .in('id', passengerIds);

        const profilesById = Object.fromEntries((profilesData || []).map(profile => [profile.id, profile]));
        const ticketsWithProfiles = ticketsData.map(ticket => ({
          ...ticket,
          profiles: profilesById[ticket.passenger_id] || null,
        }));

        setTicketData(ticketsWithProfiles);
        setPaymentData(paymentData); // Store payment data separately
        setIsLoading(false);

        // Auto-generate PDF after loading data. Some mobile browsers block this,
        // so the page also shows a manual download button below.
        setTimeout(() => {
          handleDownloadPdf(ticketsWithProfiles, paymentData)
            .catch((err) => console.error('Auto ticket PDF error:', err));
        }, 500);
      } catch (err) {
        console.error('Fetch error:', err);
        setError('Erro ao carregar dados do bilhete');
        setIsLoading(false);
      }
    };

    fetchTicketData();
  }, [transactionId, supabase]);

  const handleDownloadPdf = async (ticket, payment) => {
    if (!ticket || !payment) {
      console.log('Ticket or payment data missing:', { ticket, payment });
      alert("Não foi possível gerar o bilhete. Faltam detalhes.");
      return;
    }

    if (Array.isArray(ticket)) {
      const doc = new jsPDF();
      const orange = [245, 158, 11];
      const lightOrange = [252, 191, 73];

      for (let index = 0; index < ticket.length; index += 1) {
        const singleTicket = ticket[index];
        if (index > 0) doc.addPage();

        const passengerName = getTicketPassengerName(singleTicket);
        const ticketNumber = singleTicket.ticket_number && singleTicket.ticket_number.length > 9
          ? singleTicket.ticket_number.substring(9)
          : singleTicket.ticket_number || 'N/A';
        const routeName = singleTicket.trips?.routes
          ? `${singleTicket.trips.routes.origin_city || 'Origem'} -> ${singleTicket.trips.routes.destination_city || 'Destino'}`
          : 'Rota nao especificada';
        const departure = singleTicket.trips?.departure_time
          ? new Date(singleTicket.trips.departure_time).toLocaleString('pt-PT')
          : 'Data nao especificada';
        const price = singleTicket.price_paid_usd
          ? `${Math.round(singleTicket.price_paid_usd * 1000)},00 Kz`
          : 'Preco nao disponivel';
        const qrCodeUrl = await QRCode.toDataURL(singleTicket.id, { width: 300, margin: 1 });

        doc.setFillColor(...orange);
        doc.rect(0, 0, 210, 45, 'F');
        doc.setFillColor(...lightOrange);
        doc.circle(5, 5, 8, 'F');
        doc.circle(205, 5, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont(undefined, 'bold');
        doc.text(singleTicket.trips?.buses?.companies?.name || 'NawaBus', 105, 22, { align: 'center' });
        doc.setFontSize(12);
        doc.text('Bilhete Confirmado', 105, 34, { align: 'center' });

        doc.setTextColor(60, 60, 60);
        doc.setFillColor(250, 250, 250);
        doc.roundedRect(15, 55, 180, 20, 3, 3, 'F');
        doc.setFontSize(9);
        doc.text('NIF: 5000451738 | Tel: +244 930 533 405', 105, 67, { align: 'center' });

        doc.setFillColor(200, 255, 200);
        doc.roundedRect(15, 85, 180, 25, 5, 5, 'F');
        doc.setTextColor(0, 128, 0);
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('PAGAMENTO CONFIRMADO', 105, 95, { align: 'center' });
        doc.setFontSize(11);
        doc.text(`Referencia: ${payment.transaction_id}`, 105, 105, { align: 'center' });

        doc.setDrawColor(...orange);
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(15, 120, 120, 78, 3, 3, 'FD');
        doc.setTextColor(...orange);
        doc.setFontSize(12);
        doc.text(`Bilhete ${index + 1} de ${ticket.length}`, 20, 130);

        const rows = [
          ['Passageiro:', passengerName],
          ['No. Bilhete:', ticketNumber],
          ['Rota:', routeName],
          ['Partida:', departure],
          ['Assento:', String(singleTicket.seat_number || 'N/A')],
          ['Valor:', price],
        ];

        doc.setFontSize(10);
        rows.forEach(([label, value], rowIndex) => {
          const y = 142 + rowIndex * 8;
          doc.setTextColor(60, 60, 60);
          doc.setFont(undefined, 'bold');
          doc.text(label, 20, y);
          doc.setFont(undefined, 'normal');
          doc.text(String(value), 55, y, { maxWidth: 75 });
        });

        doc.setDrawColor(...orange);
        doc.roundedRect(142, 120, 53, 78, 3, 3, 'FD');
        doc.setFontSize(8);
        doc.setTextColor(...orange);
        doc.text('Escaneie aqui', 168.5, 128, { align: 'center' });
        doc.addImage(qrCodeUrl, 'PNG', 147, 135, 43, 43);

        doc.setFillColor(255, 248, 240);
        doc.setDrawColor(...orange);
        doc.roundedRect(15, 210, 180, 30, 3, 3, 'FD');
        doc.setTextColor(60, 60, 60);
        doc.setFontSize(9);
        doc.text('- Apresente este bilhete no embarque', 20, 224);
        doc.text('- Guarde este documento ate ao final da viagem', 20, 232);
      }

      doc.save(`nawabus-confirmed-${payment.transaction_id}.pdf`);
      return;
    }

    const trimmedTicketNumber = ticket.ticket_number && ticket.ticket_number.length > 9 
      ? ticket.ticket_number.substring(9) 
      : ticket.ticket_number || 'N/A';

    const doc = new jsPDF();

    // Brand colors
    const orange = [245, 158, 11];
    const darkOrange = [217, 119, 6];
    const lightOrange = [252, 191, 73];

    // --- Ticket Information ---
    const ticketInfo = {
      companyName: ticket.trips?.buses?.companies?.name || "NawaBus",
      nif: "5000451738",
      address: "",
      phone: "+244 930 533 405",
      passengerName: getTicketPassengerName(ticket),
      ticketNumber: trimmedTicketNumber,
      routeName: ticket.trips?.routes 
        ? `${ticket.trips.routes.origin_city || 'Origem'} → ${ticket.trips.routes.destination_city || 'Destino'}`
        : 'Rota não especificada',
      departure: ticket.trips?.departure_time 
        ? new Date(ticket.trips.departure_time).toLocaleString('pt-PT')
        : 'Data não especificada',
      seats: ticket.seat_number || 'N/A',
      price: ticket.price_paid_usd 
        ? `${Math.round(ticket.price_paid_usd * 1000)},00 Kz`
        : 'Preço não disponível',
      printDate: new Date().toLocaleString('pt-PT'),
    };

    // --- QR Code ---
    const qrCodeData = ticket.id; // Just the ticket ID
    
    const qrCodeUrl = await QRCode.toDataURL(qrCodeData, { width: 300, margin: 1 });

    // --- PDF Content ---

    // Orange header background
    doc.setFillColor(...orange);
    doc.rect(0, 0, 210, 50, 'F');

    // Decorative corner elements
    doc.setFillColor(...lightOrange);
    doc.circle(5, 5, 8, 'F');
    doc.circle(205, 5, 8, 'F');

    // Try to load and add logo
    try {
      const logoImg = new Image();
      logoImg.src = '/logo.png';
      await new Promise((resolve, reject) => {
        logoImg.onload = resolve;
        logoImg.onerror = reject;
        setTimeout(reject, 2000);
      });
      doc.addImage(logoImg, 'PNG', 15, 10, 30, 30);
    } catch (e) {
      console.warn('Logo could not be loaded');
    }

    // Company name in white
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.setFont(undefined, 'bold');
    doc.text(ticketInfo.companyName, 105, 25, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    doc.text("Bilhete Confirmado", 105, 35, { align: 'center' });

    // Reset text color
    doc.setTextColor(60, 60, 60);

    // Company Info in a subtle box
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(15, 55, 180, 20, 3, 3, 'F');
    doc.setFontSize(9);
    doc.text(`NIF: ${ticketInfo.nif}  |  ${ticketInfo.address}  |  Tel: ${ticketInfo.phone}`, 105, 67, { align: 'center' });

    // Payment Confirmed - Green Box
    doc.setFillColor(200, 255, 200);
    doc.roundedRect(15, 85, 180, 25, 5, 5, 'F');

    doc.setTextColor(0, 128, 0);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text("PAGAMENTO CONFIRMADO", 105, 95, { align: 'center' });

    doc.setFontSize(11);
    doc.text(`Transação: ${payment.transaction_id}`, 105, 105, { align: 'center' });

    // Passenger & Trip Details Card
    doc.setDrawColor(...orange);
    doc.setLineWidth(0.5);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(15, 120, 120, 70, 3, 3, 'FD');

    doc.setTextColor(...orange);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text("Detalhes do Bilhete", 20, 130);

    doc.setTextColor(60, 60, 60);
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');

    const detailsY = 140;
    const lineHeight = 8;
    doc.setFont(undefined, 'bold');
    doc.text("Passageiro:", 20, detailsY);
    doc.setFont(undefined, 'normal');
    doc.text(ticketInfo.passengerName, 55, detailsY);

    doc.setFont(undefined, 'bold');
    doc.text("Nº Bilhete:", 20, detailsY + lineHeight);
    doc.setFont(undefined, 'normal');
    doc.text(ticketInfo.ticketNumber, 55, detailsY + lineHeight);

    doc.setFont(undefined, 'bold');
    doc.text("Rota:", 20, detailsY + lineHeight * 2);
    doc.setFont(undefined, 'normal');
    doc.text(ticketInfo.routeName, 55, detailsY + lineHeight * 2);

    doc.setFont(undefined, 'bold');
    doc.text("Partida:", 20, detailsY + lineHeight * 3);
    doc.setFont(undefined, 'normal');
    doc.text(ticketInfo.departure, 55, detailsY + lineHeight * 3);

    doc.setFont(undefined, 'bold');
    doc.text("Assentos:", 20, detailsY + lineHeight * 4);
    doc.setFont(undefined, 'normal');
    doc.text(ticketInfo.seats.toString(), 55, detailsY + lineHeight * 4);

    doc.setFont(undefined, 'bold');
    doc.text("Valor:", 20, detailsY + lineHeight * 5);
    doc.setFont(undefined, 'normal');
    doc.text(ticketInfo.price, 55, detailsY + lineHeight * 5);

    // QR Code box with border
    doc.setDrawColor(...orange);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(142, 120, 53, 70, 3, 3, 'FD');
    doc.setFontSize(8);
    doc.setTextColor(...orange);
    doc.text("Escaneie aqui", 168.5, 128, { align: 'center' });
    doc.addImage(qrCodeUrl, 'PNG', 147, 132, 43, 43);

    // Instructions Card
    doc.setFillColor(255, 248, 240);
    doc.setDrawColor(...orange);
    doc.roundedRect(15, 200, 180, 30, 3, 3, 'FD');

    doc.setTextColor(...darkOrange);
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text("INSTRUÇÕES", 20, 210);

    doc.setTextColor(60, 60, 60);
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text("• Apresente este bilhete no embarque", 20, 218);
    doc.text("• Guarde este documento até ao final da viagem", 20, 224);

    // Footer with decorative line
    doc.setDrawColor(...lightOrange);
    doc.setLineWidth(1);
    doc.line(15, 240, 195, 240);

    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Data de Emissão: ${ticketInfo.printDate}`, 20, 248);

    doc.setTextColor(...orange);
    doc.setFont(undefined, 'bold');
    doc.text("Obrigado por escolher NawaBus!", 105, 255, { align: 'center' });

    // Decorative footer circles
    doc.setFillColor(...lightOrange);
    doc.circle(5, 257, 5, 'F');
    doc.circle(205, 257, 5, 'F');

    // --- Filename and Save ---
    const now = new Date();
    const formattedDate = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const formattedTime = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const fileName = `nawabus-confirmed-${trimmedTicketNumber.replace(/\s/g, '_')}-${formattedDate}${formattedTime}.pdf`;

    doc.save(fileName);
  };

  const handleManualPdfDownload = async () => {
    if (isDownloadingPdf) return;

    setIsDownloadingPdf(true);
    try {
      await handleDownloadPdf(ticketData, paymentData);
    } catch (err) {
      console.error('Manual ticket PDF error:', err);
      alert('Nao foi possivel gerar o PDF. Tente novamente.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto mb-4"></div>
          <p>A carregar bilhete...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-red-800 mb-2">Erro</h2>
          <p className="text-red-700">{error}</p>
          <button
            onClick={() => window.history.back()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center max-w-md mx-auto p-6 bg-green-50 border border-green-200 rounded-lg">
        <div className="text-green-600 text-6xl mb-4">✅</div>
        <h2 className="text-xl font-bold text-green-800 mb-2">Bilhete Encontrado</h2>
        <button
          type="button"
          onClick={handleManualPdfDownload}
          disabled={isDownloadingPdf}
          className="mb-4 w-full rounded-lg bg-green-700 px-5 py-3 font-semibold text-white transition-colors hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isDownloadingPdf ? 'A gerar PDF...' : 'Baixar bilhete / factura (PDF)'}
        </button>
        <p className="text-green-700 mb-4">O download do seu bilhete começará automaticamente.</p>
        <p className="text-sm text-gray-600">Se o download não iniciar, verifique as permissões do seu navegador.</p>
      </div>
    </div>
  );
}
