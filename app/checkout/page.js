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
  const [paymentMethod, setPaymentMethod] = useState('referencia');
  const [reference, setReference] = useState(null);
  const [ticketNumber, setTicketNumber] = useState(null);
  const supabase = createClient();

  // Auth-related state
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
  const [authPhoneNumber, setAuthPhoneNumber] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const details = localStorage.getItem('bookingDetails');
    if (details) {
      setBookingDetails(JSON.parse(details));
    } else {
      // Redirect if no booking details are found
      router.push('/');
    }
    // Attempt to fetch current user session
    (async () => {
      const { data } = await supabase.auth.getUser();
      setCurrentUser(data?.user ?? null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const proceedWithPayment = async (user) => {
    if (!bookingDetails) return;

    // Step 1: Insert a single ticket record to get an ID
    const { tripDetails, selectedSeats, totalPrice } = bookingDetails;
    const passengerId = user.id;

    const { data: ticketData, error: ticketError } = await supabase
      .from('tickets')
      .insert({
        trip_id: tripDetails.id,
        passenger_id: passengerId,
        booked_by: passengerId,
        seat_number: selectedSeats.join(','), // Store all seats in one record for now
        price_paid_usd: totalPrice,
        payment_status: 'pending',
        payment_method: 'referencia',
        booking_source: 'online',
        seat_class: tripDetails.seat_class || 'economy',
      })
      .select()
      .single();

    if (ticketError) {
      console.error('Error creating ticket record:', ticketError);
      alert('Ocorreu um erro ao iniciar o processo de pagamento.');
      return;
    }

    // Step 2: Call the payment API to get a reference
    try {
      const response = await fetch('/api/create-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticket_id: ticketData.id,
          amount: totalPrice,
          passenger_name: user.user_metadata.full_name || 'N/A',
          passenger_email: user.email,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Falha ao criar referência de pagamento.');
      }

      setReference(result.reference_number);
      setTicketNumber(ticketData.ticket_number);
      // The UI will now show the reference number
    } catch (error) {
      console.error('Payment API error:', error);
      alert(error.message);
      // Optionally, delete the pending ticket record
      await supabase.from('tickets').delete().eq('id', ticketData.id);
    }
  };

  const handlePayment = async () => {
    setIsLoading(true);
    if (!bookingDetails) {
      setIsLoading(false);
      return;
    }

    // Check auth
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) {
      // Prompt auth dialog
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
          console.error(error);
          alert('Falha no login. Verifique o telefone e senha.');
          return;
        }
      } else {
        // Signup
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
          console.error(error);
          alert('Falha no registo. Verifique os dados e tente novamente.');
          return;
        }

        // If project requires email confirmation, there might be no session yet
        // Try to sign in immediately to continue the flow
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

        // Optionally make sure profile fields are up-to-date (allowed by RLS update policy)
        const { data: u } = await supabase.auth.getUser();
        if (u?.user) {
          await supabase
            .from('profiles')
            .update({
              first_name,
              last_name,
              phone_number: authPhoneNumber,
              // role ideally should be controlled server-side; omit here if unsure.
            })
            .eq('id', u.user.id);
        }
      }

      // Refresh current user and proceed
      const { data: userData } = await supabase.auth.getUser();
      const authedUser = userData?.user;
      setCurrentUser(authedUser || null);

      if (!authedUser) {
        alert('Sessão não encontrada após autenticação. Tente iniciar sessão novamente.');
        return;
      }

      setShowAuthDialog(false);
      // Continue payment
      setIsLoading(true);
      await proceedWithPayment(authedUser);
      setIsLoading(false);
    } finally {
      setAuthSubmitting(false);
    }
  };

  if (!bookingDetails) {
    return <div className="text-center py-10">A carregar detalhes da reserva...</div>;
  }

 const handleDownloadPdf = async () => {
    if (!bookingDetails || !ticketNumber || !currentUser || !reference) {
      alert("Não foi possível gerar o bilhete. Faltam detalhes.");
      return;
    }

    const trimmedTicketNumber = ticketNumber.length > 9 ? ticketNumber.substring(9) : ticketNumber;

    const { tripDetails, selectedSeats, totalPrice } = bookingDetails;
    const doc = new jsPDF();

    // Brand colors
    const orange = [255, 140, 0]; // RGB for orange
    const darkOrange = [230, 120, 0];
    const lightOrange = [255, 160, 50];

    // --- Ticket Information ---
    const ticketInfo = {
      companyName: "NawaBus",
      nif: "5000451738",
      address: "Kilamba bloco R18, Luanda",
      phone: "+244 930 533 405",
      passengerName: currentUser.user_metadata.full_name || `${currentUser.user_metadata.first_name} ${currentUser.user_metadata.last_name}`,
      ticketNumber: trimmedTicketNumber,
      routeName: `${tripDetails.routes.origin_city} → ${tripDetails.routes.destination_city}`,
      departure: new Date(tripDetails.departure_time).toLocaleString('pt-PT'),
      seats: selectedSeats.join(', '),
      busPlate: tripDetails.buses.license_plate,
      price: `${Math.round(totalPrice * 1000)},00 Kz`,
      printDate: new Date().toLocaleString('pt-PT'),
    };

    // --- QR Code ---
    const qrCodeData = JSON.stringify({
      ticketId: ticketNumber,
      ticketNumber: ticketInfo.ticketNumber,
      reference: reference,
      passengerName: ticketInfo.passengerName,
      phone: currentUser.email?.replace('@nawabus.com', ''),
      route: ticketInfo.routeName,
      departureTime: tripDetails.departure_time,
      seatNumber: selectedSeats.join(','),
      price: totalPrice,
      pendingPayment: true,
      bookingTime: new Date().toISOString(),
    });
    const qrCodeUrl = await QRCode.toDataURL(qrCodeData, { width: 300, margin: 1 });

    // --- PDF Content with Modern Design ---
    
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
        setTimeout(reject, 2000); // timeout after 2s
      });
      doc.addImage(logoImg, 'PNG', 15, 10, 30, 30);
    } catch (e) {
      // Logo failed to load, continue without it
      console.warn('Logo could not be loaded');
    }

    // Company name in white
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.setFont(undefined, 'bold');
    doc.text(ticketInfo.companyName, 105, 25, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    doc.text("Reserva de Bilhete", 105, 35, { align: 'center' });

    // Reset text color
    doc.setTextColor(60, 60, 60);

    // Company Info in a subtle box
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(15, 55, 180, 20, 3, 3, 'F');
    doc.setFontSize(9);
    doc.text(`NIF: ${ticketInfo.nif}  |  ${ticketInfo.address}  |  Tel: ${ticketInfo.phone}`, 105, 67, { align: 'center' });

    // Payment Info - Prominent Orange Box
    doc.setFillColor(...orange);
    doc.roundedRect(15, 85, 180, 45, 5, 5, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text("INFORMAÇÕES DE PAGAMENTO", 105, 95, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text("Entidade: 1219", 25, 107);
    
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text(`Referência: ${reference}`, 105, 115, { align: 'center' });
    
    doc.setFontSize(14);
    doc.text(`Valor: ${ticketInfo.price}`, 105, 125, { align: 'center' });

    // Passenger & Trip Details Card
    doc.setDrawColor(...orange);
    doc.setLineWidth(0.5);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(15, 140, 120, 65, 3, 3, 'FD');
    
    doc.setTextColor(...orange);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text("Detalhes da Reserva", 20, 150);
    
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    
    const detailsY = 160;
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
    doc.text(ticketInfo.seats, 55, detailsY + lineHeight * 4);
    
    doc.setFont(undefined, 'bold');
    doc.text("Autocarro:", 20, detailsY + lineHeight * 5);
    doc.setFont(undefined, 'normal');
    doc.text(tripDetails.buses.license_plate, 55, detailsY + lineHeight * 5);

    // QR Code box with border
    doc.setDrawColor(...orange);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(142, 140, 53, 65, 3, 3, 'FD');
    doc.setFontSize(8);
    doc.setTextColor(...orange);
    doc.text("Escaneie aqui", 168.5, 148, { align: 'center' });
    doc.addImage(qrCodeUrl, 'PNG', 147, 152, 43, 43);

    // Payment Instructions Card
    doc.setFillColor(255, 248, 240);
    doc.setDrawColor(...orange);
    doc.roundedRect(15, 215, 180, 35, 3, 3, 'FD');
    
    doc.setTextColor(...darkOrange);
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text("IMPORTANTE", 20, 225);
    
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text("• Sua reserva será confirmada após o recebimento do pagamento", 20, 233);
    doc.text("• Dirija-se a qualquer MULTICAIXA ou use home banking", 20, 239);
    doc.text("• Utilize os dados de pagamento acima (Entidade 1219)", 20, 245);

    // Footer with decorative line
    doc.setDrawColor(...lightOrange);
    doc.setLineWidth(1);
    doc.line(15, 260, 195, 260);
    
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Data de Impressão: ${ticketInfo.printDate}`, 20, 268);
    
    doc.setTextColor(...orange);
    doc.setFont(undefined, 'bold');
    doc.text("Reserva válida por 3 dias", 105, 275, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text("Obrigado por escolher NawaBus!", 105, 285, { align: 'center' });

    // Decorative footer circles
    doc.setFillColor(...lightOrange);
    doc.circle(5, 292, 5, 'F');
    doc.circle(205, 292, 5, 'F');

    // --- Filename and Save ---
    const now = new Date();
    const formattedDate = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const formattedTime = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const fileName = `nawabus-${trimmedTicketNumber.replace(/\s/g, '_')}-${formattedDate}${formattedTime}.pdf`;

    doc.save(fileName);
    router.push('/');
  };

  const { tripDetails, selectedSeats, totalPrice } = bookingDetails;

  return (
    <div className="w-full max-w-4xl mx-auto py-8 px-4">
      <button onClick={() => router.back()} className="flex items-center gap-2 mb-4 text-gray-600 hover:text-gray-800">
        <ArrowLeft />
        <span>Voltar</span>
      </button>
      <h1 className="text-3xl font-bold text-center mb-8 text-gray-800 dark:text-white">Finalizar Compra</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Resumo do Pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-semibold text-gray-800 dark:text-white">{tripDetails.routes.origin_city} → {tripDetails.routes.destination_city}</p>
                <p className="text-sm text-gray-500">{new Date(tripDetails.departure_time).toLocaleString('pt-PT', { dateStyle: 'full', timeStyle: 'short' })}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-800 dark:text-white">Lugares:</p>
                <p className="font-mono text-orange-600">{selectedSeats.join(', ')}</p>
              </div>
              <div className="border-t pt-4">
                <p className="text-xl font-bold flex justify-between text-gray-800 dark:text-white">
                  <span>Total:</span>
                  <span className="text-orange-600">{totalPrice.toFixed(2)} Kz</span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
        <div>
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Pagamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>Método de Pagamento</Label>
                <div className="flex items-center space-x-2 p-2 border rounded-md">
                  <span>Pagamento por Referência</span>
                </div>
              </div>
              {/* <div>
                <Label htmlFor="email">Email para confirmação</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  required
                  value={currentUser?.email ?? ''}
                  onChange={() => {}}
                  disabled={!!currentUser?.email}
                />
              </div> */}
              {reference ? (
                <div className="text-center p-4 border-dashed border-2 border-green-500 rounded-lg">
                  <p className="font-semibold">Pague com esta referência:</p>
                  <p>Entidade: 1219</p>
                  <p className="text-3xl font-bold text-green-600 tracking-widest my-2">{reference}</p>
                  <p className="text-sm text-gray-500">Dirija-se a um multicaixa ou utilize o seu home banking.</p>
                  <Button onClick={handleDownloadPdf} className="w-full mt-4 bg-blue-500 hover:bg-blue-600 text-white">
                    Baixar Bilhete (PDF)
                  </Button>
                </div>
              ) : (
                <Button onClick={handlePayment} className="w-full bg-orange-500 hover:bg-orange-600 text-white" disabled={isLoading}>
                  {isLoading ? 'A processar...' : 'Gerar Referência de Pagamento'}
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
            <DialogTitle>{authMode === 'login' ? 'Entrar' : 'Criar Conta'}</DialogTitle>
            <DialogDescription>
              Para finalizar a compra, por favor {authMode === 'login' ? 'inicie sessão' : 'crie a sua conta'}.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleAuthSubmit}>
            <div className="space-y-2">
              <Label htmlFor="auth-phoneNumber">Telefone</Label>
              <Input
                id="auth-phoneNumber"
                type="tel"
                value={authPhoneNumber}
                onChange={(e) => setAuthPhoneNumber(e.target.value)}
                placeholder="Insira o seu número de telefone"
                required
              />
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
              />
            </div>

            {authMode === 'signup' && (
              <div className="space-y-2">
                <Label htmlFor="auth-name">Nome</Label>
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
              <div className="flex w-full items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                >
                  {authMode === 'login' ? 'Não tem conta? Registar' : 'Já tem conta? Entrar'}
                </Button>
                <Button
                  type="submit"
                  disabled={authSubmitting}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  {authSubmitting ? 'A processar...' : (authMode === 'login' ? 'Entrar' : 'Criar conta')}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
