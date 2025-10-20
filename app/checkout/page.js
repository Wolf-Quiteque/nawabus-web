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
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authPhone, setAuthPhone] = useState('');
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
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
        if (error) {
          console.error(error);
          alert('Falha no login. Verifique o email e senha.');
          return;
        }
      } else {
        // Signup
        const { first_name, last_name } = ensureNames(authName);
        const { data, error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: {
            data: {
              role: 'passenger',
              first_name,
              last_name,
              phone_number: authPhone || null,
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
            email: authEmail,
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
              phone_number: authPhone || null,
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
    if (!bookingDetails || !ticketNumber || !currentUser) {
      alert("Não foi possível gerar o bilhete. Faltam detalhes.");
      return;
    }

    const { tripDetails, selectedSeats, totalPrice } = bookingDetails;
    const doc = new jsPDF();

    // --- Ticket Information ---
    const ticketInfo = {
      companyName: "NawaBus",
      nif: "5000451738",
      address: "Kilamba bloco R18, Luanda",
      phone: "+244 930 533 405",
      passengerName: currentUser.user_metadata.full_name || `${currentUser.user_metadata.first_name} ${currentUser.user_metadata.last_name}`,
      ticketNumber: ticketNumber,
      routeName: `${tripDetails.routes.origin_city} -> ${tripDetails.routes.destination_city}`,
      departure: new Date(tripDetails.departure_time).toLocaleString('pt-PT'),
      seats: selectedSeats.join(', '),
      busPlate: tripDetails.buses.license_plate,
      price: `${totalPrice.toFixed(2)} Kz`,
      printDate: new Date().toLocaleString('pt-PT'),
    };

    // --- QR Code ---
    const qrCodeData = JSON.stringify({
      ticketNumber: ticketInfo.ticketNumber,
      passenger: ticketInfo.passengerName,
      route: ticketInfo.routeName,
      departure: ticketInfo.departure,
      seats: ticketInfo.seats,
    });
    const qrCodeUrl = await QRCode.toDataURL(qrCodeData);

    // --- PDF Content ---
    doc.setFontSize(22);
    doc.text(ticketInfo.companyName, 105, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.text("Bilhete de Viagem", 105, 30, { align: 'center' });

    doc.line(20, 35, 190, 35); // separator

    // Company Info
    doc.setFontSize(10);
    doc.text(`NIF: ${ticketInfo.nif}`, 20, 45);
    doc.text(`Endereço: ${ticketInfo.address}`, 20, 50);
    doc.text(`Telefone: ${ticketInfo.phone}`, 20, 55);

    doc.line(20, 65, 190, 65); // separator

    // Passenger & Trip Info
    doc.setFontSize(12);
    doc.text("Detalhes do Bilhete", 20, 75);
    doc.setFontSize(10);
    doc.text(`Passageiro: ${ticketInfo.passengerName}`, 20, 85);
    doc.text(`Nº do Bilhete/Ref: ${ticketInfo.ticketNumber}`, 20, 90);
    doc.text(`Rota: ${ticketInfo.routeName}`, 20, 95);
    doc.text(`Partida: ${ticketInfo.departure}`, 20, 100);
    doc.text(`Assentos: ${ticketInfo.seats}`, 20, 105);
    doc.text(`Matrícula do Autocarro: ${tripDetails.buses.license_plate}`, 20, 110);
    doc.text(`Preço: ${ticketInfo.price}`, 20, 115);

    doc.line(20, 125, 190, 125); // separator

    // QR Code
    doc.addImage(qrCodeUrl, 'PNG', 75, 135, 60, 60);

    // Footer
    doc.setFontSize(8);
    doc.text(`Data de Impressão: ${ticketInfo.printDate}`, 20, 210);
    doc.text("Obrigado por viajar com a NawaBus!", 105, 220, { align: 'center' });


    // --- Filename and Save ---
    const now = new Date();
    const formattedDate = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const formattedTime = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const fileName = `nawabus-${ticketNumber.replace(/\s/g, '_')}-${formattedDate}${formattedTime}.pdf`;

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
              <Label htmlFor="auth-email">Email</Label>
              <Input
                id="auth-email"
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="seu@email.com"
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
              <>
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
                <div className="space-y-2">
                  <Label htmlFor="auth-phone">Telefone</Label>
                  <Input
                    id="auth-phone"
                    type="tel"
                    value={authPhone}
                    onChange={(e) => setAuthPhone(e.target.value)}
                    placeholder="Número de telefone (opcional)"
                  />
                </div>
              </>
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
