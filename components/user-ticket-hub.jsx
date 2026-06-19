"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  Lock,
  LogOut,
  QrCode,
  RefreshCw,
  Ticket,
  User,
  X,
} from "lucide-react";
import jsPDF from "jspdf";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase-client";
import { isRestrictedInAppBrowser, openExternalBrowser } from "@/lib/in-app-browser";

const BRAND_ORANGE = "#FF8C00";
const ENTITY = "1219";

function normalizePhoneNumber(phone) {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  if (!cleaned) return "";
  if (!cleaned.startsWith("244") && cleaned.length === 9 && cleaned.startsWith("9")) {
    return `244${cleaned}`;
  }
  return cleaned;
}

function ensureNames(fullName) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: "Cliente", last_name: "" };
  if (parts.length === 1) return { first_name: parts[0], last_name: "" };
  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(" "),
  };
}

function formatDate(value) {
  if (!value) return "Data nao definida";
  return new Date(value).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(value) {
  return `${Math.round(Number(value) || 0).toLocaleString("pt-PT")},00 Kz`;
}

function getRoute(ticket) {
  const route = ticket?.trips?.routes;
  if (!route) return "Rota nao definida";
  return `${route.origin_city || "Origem"} -> ${route.destination_city || "Destino"}`;
}

function getPassengerName(ticket, user, payment) {
  const companionName = ticket?.ticket_companions?.[0]?.name?.trim();
  if (companionName) return companionName;

  const bookingDetails = payment?.gateway_response?.booking_details;
  const bookingTrip = [bookingDetails?.outbound_trip, bookingDetails?.return_trip]
    .filter(Boolean)
    .find((trip) => trip.trip_id === ticket?.trip_id);
  const bookingCompanion = bookingTrip?.companions?.[String(ticket?.seat_number)] ||
    bookingTrip?.companions?.[Number(ticket?.seat_number)];
  const bookingCompanionName = bookingCompanion?.name?.trim();
  if (bookingCompanionName) return bookingCompanionName;

  const userName = (
    user?.user_metadata?.full_name ||
    `${user?.user_metadata?.first_name || ""} ${user?.user_metadata?.last_name || ""}`.trim() ||
    ""
  );

  return userName.trim() || "Cliente";
}

function getPendingBooking(transaction) {
  return transaction?.gateway_response?.booking_details || null;
}

function getPendingDeadline(transaction) {
  const booking = getPendingBooking(transaction);
  return booking?.hold_expires_at || null;
}

function formatPendingDeadline(transaction) {
  const deadline = getPendingDeadline(transaction);
  if (!deadline) return "1 hora apos gerar";
  return formatDate(deadline);
}

function isPendingExpired(transaction) {
  const deadline = getPendingDeadline(transaction);
  return Boolean(deadline && new Date(deadline).getTime() <= Date.now());
}

function countPendingSeats(booking) {
  if (!booking) return 0;
  const outbound = booking.outbound_trip?.selected_seats?.length || 0;
  const inbound = booking.return_trip?.selected_seats?.length || 0;
  return outbound + inbound;
}

function getPendingSeatText(booking) {
  if (!booking) return "Lugares por confirmar";
  const parts = [];
  if (booking.outbound_trip?.selected_seats?.length) {
    parts.push(`Ida: ${booking.outbound_trip.selected_seats.join(", ")}`);
  }
  if (booking.return_trip?.selected_seats?.length) {
    parts.push(`Volta: ${booking.return_trip.selected_seats.join(", ")}`);
  }
  return parts.join(" | ") || "Lugares por confirmar";
}

function groupPaidTickets(tickets) {
  const groups = new Map();
  tickets.forEach((ticket) => {
    const key = ticket.payment_reference || ticket.trip_id || ticket.id;
    const existing = groups.get(key) || {
      reference: ticket.payment_reference,
      firstTicket: ticket,
      tickets: [],
      total: 0,
    };
    existing.tickets.push(ticket);
    existing.total += Number(ticket.price_paid_usd) || 0;
    groups.set(key, existing);
  });
  return Array.from(groups.values());
}

function groupTicketsByTrip(tickets) {
  const groups = new Map();
  tickets.forEach((ticket) => {
    const key = ticket.trip_id || `${ticket.trips?.departure_time || ""}-${getRoute(ticket)}`;
    const existing = groups.get(key) || {
      tripId: ticket.trip_id,
      firstTicket: ticket,
      tickets: [],
      total: 0,
    };
    existing.tickets.push(ticket);
    existing.total += Number(ticket.price_paid_usd) || 0;
    groups.set(key, existing);
  });

  return Array.from(groups.values()).sort((a, b) => {
    const aTime = new Date(a.firstTicket.trips?.departure_time || 0).getTime();
    const bTime = new Date(b.firstTicket.trips?.departure_time || 0).getTime();
    return aTime - bTime;
  });
}

function getGroupRouteSummary(group) {
  const tripGroups = groupTicketsByTrip(group.tickets);
  if (tripGroups.length <= 1) {
    return getRoute(group.firstTicket);
  }
  return tripGroups.map((tripGroup, index) => `Viagem ${index + 1}: ${getRoute(tripGroup.firstTicket)}`).join(" | ");
}

function getTripQrLabel(index, total) {
  if (total === 2) return index === 0 ? "Ida" : "Volta";
  return total > 1 ? `Viagem ${index + 1}` : "Viagem";
}

function buildQrTripPayload(tripGroup, index = 0, total = 1) {
  return {
    label: getTripQrLabel(index, total),
    firstTicket: tripGroup.firstTicket,
    tickets: tripGroup.tickets,
  };
}

function getUpcomingRideCount(tickets) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingRideKeys = new Set();
  tickets.forEach((ticket) => {
    const departureTime = ticket?.trips?.departure_time;
    if (!departureTime) return;

    const departureDate = new Date(departureTime);
    if (Number.isNaN(departureDate.getTime())) return;

    const departureDay = new Date(departureDate);
    departureDay.setHours(0, 0, 0, 0);
    if (departureDay < today) return;

    upcomingRideKeys.add(ticket.trip_id || `${departureTime}-${getRoute(ticket)}`);
  });

  return upcomingRideKeys.size;
}

async function downloadPaidTicketGroup(group, user, payment) {
  const doc = new jsPDF();
  const orange = [255, 140, 0];
  const dark = [24, 24, 27];
  const muted = [82, 82, 91];
  const green = [22, 101, 52];
  const hasManifest = group.tickets.length > 1;
  const tripGroups = groupTicketsByTrip(group.tickets);

  if (hasManifest) {
    const firstTicket = group.firstTicket;

    doc.setFillColor(...dark);
    doc.rect(0, 0, 210, 46, "F");
    doc.setFillColor(...orange);
    doc.rect(0, 41, 210, 5, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, "bold");
    doc.setFontSize(24);
    doc.text("NAWABUS", 18, 20);
    doc.setFontSize(11);
    doc.text("Manifesto de passageiros", 18, 31);

    doc.setTextColor(...dark);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(229, 231, 235);
    doc.roundedRect(16, 58, 178, 58, 5, 5, "FD");
    doc.setFont(undefined, "bold");
    doc.setFontSize(14);
    doc.text(tripGroups.length > 1 ? "Compra ida e volta / multi-viagem" : getRoute(firstTicket), 24, 75, { maxWidth: 150 });
    doc.setFont(undefined, "normal");
    doc.setFontSize(10);
    doc.setTextColor(...muted);
    if (tripGroups.length === 1) {
      doc.text(`Partida: ${formatDate(firstTicket.trips?.departure_time)}`, 24, 90);
      doc.text(`Empresa: ${firstTicket.trips?.buses?.companies?.name || "NawaBus"}`, 24, 101);
    } else {
      doc.text(`${tripGroups.length} viagens nesta compra`, 24, 90);
      doc.text(`Empresa: ${firstTicket.trips?.buses?.companies?.name || "NawaBus"}`, 24, 101);
    }
    doc.text(`Total de bilhetes: ${group.tickets.length}`, 24, 111);

    doc.setFillColor(255, 249, 235);
    doc.setDrawColor(...orange);
    doc.roundedRect(16, 128, 178, 106, 5, 5, "FD");
    doc.setTextColor(...dark);
    doc.setFont(undefined, "bold");
    doc.setFontSize(11);
    doc.text("Passageiros neste bilhete", 24, 142);

    let y = 154;
    tripGroups.forEach((tripGroup, tripIndex) => {
      if (y > 218) {
        doc.addPage();
        doc.setFillColor(...dark);
        doc.rect(0, 0, 210, 32, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont(undefined, "bold");
        doc.setFontSize(16);
        doc.text("NAWABUS - Manifesto", 18, 20);
        y = 48;
      }

      doc.setTextColor(...dark);
      doc.setFont(undefined, "bold");
      doc.setFontSize(10);
      doc.text(`Viagem ${tripIndex + 1}: ${getRoute(tripGroup.firstTicket)}`, 24, y, { maxWidth: 160 });
      y += 6;
      doc.setTextColor(...muted);
      doc.setFont(undefined, "normal");
      doc.setFontSize(9);
      doc.text(`Partida: ${formatDate(tripGroup.firstTicket.trips?.departure_time)}`, 24, y);
      y += 8;

      tripGroup.tickets.forEach((ticket, ticketIndex) => {
        if (y > 224) {
          doc.addPage();
          doc.setFillColor(...dark);
          doc.rect(0, 0, 210, 32, "F");
          doc.setTextColor(255, 255, 255);
          doc.setFont(undefined, "bold");
          doc.setFontSize(16);
          doc.text("NAWABUS - Manifesto", 18, 20);
          y = 48;
        }

        const ticketCode = ticket.ticket_number?.length > 9
          ? ticket.ticket_number.substring(9)
          : ticket.ticket_number || ticket.id.substring(0, 8);

        doc.setTextColor(...orange);
        doc.setFont(undefined, "bold");
        doc.setFontSize(9);
        doc.text(`${ticketIndex + 1}. Lugar ${ticket.seat_number || "N/A"}`, 28, y);
        doc.setTextColor(...dark);
        doc.setFont(undefined, "normal");
        doc.text(getPassengerName(ticket, user, payment), 72, y, { maxWidth: 70 });
        doc.setTextColor(...muted);
        doc.text(ticketCode, 150, y, { maxWidth: 36 });
        y += 8;
      });

      y += 3;
    });

    doc.setFillColor(220, 252, 231);
    doc.setDrawColor(...green);
    doc.roundedRect(16, 248, 178, 22, 4, 4, "FD");
    doc.setTextColor(...green);
    doc.setFont(undefined, "bold");
    doc.setFontSize(10);
    doc.text("Pagamento confirmado. Este manifesto e valido junto com os QR codes das paginas seguintes.", 24, 262, { maxWidth: 160 });

    if (tripGroups.length > 1) {
      doc.addPage();
      doc.setFillColor(...dark);
      doc.rect(0, 0, 210, 46, "F");
      doc.setFillColor(...orange);
      doc.rect(0, 41, 210, 5, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, "bold");
      doc.setFontSize(22);
      doc.text("QR por viagem", 18, 20);
      doc.setFontSize(10);
      doc.text("Use cada QR apenas para a viagem indicada", 18, 31);

      for (let tripIndex = 0; tripIndex < tripGroups.length; tripIndex += 1) {
        const tripGroup = tripGroups[tripIndex];
        const qrDataUrl = await QRCode.toDataURL(tripGroup.firstTicket.id, { width: 220, margin: 1 });
        const top = 62 + tripIndex * 92;

        if (top > 210) {
          doc.addPage();
        }

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(229, 231, 235);
        doc.roundedRect(16, top, 178, 76, 5, 5, "FD");
        doc.setTextColor(...orange);
        doc.setFont(undefined, "bold");
        doc.setFontSize(15);
        doc.text(`QR ${getTripQrLabel(tripIndex, tripGroups.length)}`, 26, top + 16);
        doc.setTextColor(...dark);
        doc.setFontSize(10);
        doc.text(getRoute(tripGroup.firstTicket), 26, top + 30, { maxWidth: 100 });
        doc.setFont(undefined, "normal");
        doc.setTextColor(...muted);
        doc.text(`Partida: ${formatDate(tripGroup.firstTicket.trips?.departure_time)}`, 26, top + 42, { maxWidth: 100 });
        doc.text(`Lugares: ${tripGroup.tickets.map((ticket) => ticket.seat_number).join(", ")}`, 26, top + 54, { maxWidth: 100 });
        doc.addImage(qrDataUrl, "PNG", 146, top + 16, 38, 38);
        doc.setFontSize(8);
        doc.text("Scan isolado desta viagem", 165, top + 62, { align: "center" });
      }
    }
  }

  for (let index = 0; index < group.tickets.length; index += 1) {
    const ticket = group.tickets[index];
    if (index > 0 || hasManifest) doc.addPage();

    const qrDataUrl = await QRCode.toDataURL(ticket.id, { width: 220, margin: 1 });
    const passengerName = getPassengerName(ticket, user, payment);
    const ticketCode = ticket.ticket_number?.length > 9
      ? ticket.ticket_number.substring(9)
      : ticket.ticket_number || ticket.id.substring(0, 8);

    doc.setFillColor(...dark);
    doc.rect(0, 0, 210, 46, "F");
    doc.setFillColor(...orange);
    doc.rect(0, 41, 210, 5, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, "bold");
    doc.setFontSize(24);
    doc.text("NAWABUS", 18, 20);
    doc.setFontSize(11);
    doc.text("Bilhete / Boarding pass", 18, 31);

    doc.setFillColor(220, 252, 231);
    doc.setDrawColor(...green);
    doc.roundedRect(142, 12, 48, 18, 4, 4, "FD");
    doc.setTextColor(...green);
    doc.setFont(undefined, "bold");
    doc.setFontSize(9);
    doc.text("PAGO", 166, 23, { align: "center" });

    doc.setTextColor(...dark);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(229, 231, 235);
    doc.roundedRect(16, 58, 178, 52, 5, 5, "FD");
    doc.setFont(undefined, "bold");
    doc.setFontSize(16);
    doc.text(getRoute(ticket), 24, 74, { maxWidth: 142 });
    doc.setFont(undefined, "normal");
    doc.setFontSize(10);
    doc.setTextColor(...muted);
    doc.text(`Partida: ${formatDate(ticket.trips?.departure_time)}`, 24, 88);
    doc.text(`Empresa: ${ticket.trips?.buses?.companies?.name || "NawaBus"}`, 24, 99);

    doc.setFillColor(255, 249, 235);
    doc.setDrawColor(...orange);
    doc.roundedRect(16, 122, 112, 74, 5, 5, "FD");
    doc.setTextColor(...dark);
    doc.setFont(undefined, "bold");
    doc.setFontSize(11);
    doc.text(`Bilhete ${index + 1} de ${group.tickets.length}`, 24, 136);

    const rows = [
      ["Passageiro", passengerName],
      ["Codigo", ticketCode],
      ["Lugar", String(ticket.seat_number || "N/A")],
      ["Classe", ticket.seat_class || "economy"],
      ["Valor", formatMoney(ticket.price_paid_usd)],
    ];

    rows.forEach(([label, value], rowIndex) => {
      const y = 150 + rowIndex * 7;
      doc.setTextColor(...muted);
      doc.setFont(undefined, "bold");
      doc.text(`${label}:`, 24, y);
      doc.setTextColor(...dark);
      doc.setFont(undefined, "normal");
      doc.text(String(value), 62, y, { maxWidth: 58 });
    });

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...orange);
    doc.roundedRect(139, 122, 55, 74, 5, 5, "FD");
    doc.addImage(qrDataUrl, "PNG", 146, 135, 42, 42);
    doc.setTextColor(...muted);
    doc.setFontSize(8);
    doc.text("Mostrar no embarque", 166.5, 187, { align: "center" });

    doc.setFillColor(250, 250, 250);
    doc.setDrawColor(229, 231, 235);
    doc.roundedRect(16, 212, 178, 34, 4, 4, "FD");
    doc.setTextColor(...dark);
    doc.setFont(undefined, "bold");
    doc.setFontSize(10);
    doc.text("Instrucoes", 24, 224);
    doc.setFont(undefined, "normal");
    doc.setTextColor(...muted);
    doc.setFontSize(9);
    doc.text("- Apresente este PDF ou o QR no embarque.", 24, 234);
    doc.text("- Este bilhete e valido porque o pagamento esta confirmado.", 24, 241);
  }

  const fileKey = group.reference || group.firstTicket.ticket_number || group.firstTicket.id.substring(0, 8);
  doc.save(`nawabus-bilhetes-${String(fileKey).replace(/\s/g, "_")}.pdf`);
}

export function UserTicketHub() {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [activeTab, setActiveTab] = useState("paid");
  const [tickets, setTickets] = useState([]);
  const [paymentsByReference, setPaymentsByReference] = useState({});
  const [pendingTransactions, setPendingTransactions] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [selectedQrTrip, setSelectedQrTrip] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [showHubHelper, setShowHubHelper] = useState(false);

  const paidGroups = useMemo(() => groupPaidTickets(tickets), [tickets]);
  const upcomingRideCount = useMemo(() => getUpcomingRideCount(tickets), [tickets]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setUser(data?.user || null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (!session?.user) {
        setTickets([]);
        setPaymentsByReference({});
        setPendingTransactions([]);
        setSelectedQrTrip(null);
      }
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (isOpen && user) {
      fetchUserData(user.id);
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (user) {
      fetchUserData(user.id);
    }
  }, [user]);

  useEffect(() => {
    let helperTimeout;

    const normalizeTab = (tab) => (tab === "pending" ? "pending" : "paid");

    const handleOpenHub = (event) => {
      setActiveTab(normalizeTab(event.detail?.tab));
      setIsOpen(true);
      setShowHubHelper(false);
      setAuthError("");
    };

    const handleShowHint = (event) => {
      setActiveTab(normalizeTab(event.detail?.tab));
      setShowHubHelper(true);
      window.clearTimeout(helperTimeout);
      helperTimeout = window.setTimeout(() => {
        setShowHubHelper(false);
      }, 18000);
    };

    window.addEventListener("nawabus:open-ticket-hub", handleOpenHub);
    window.addEventListener("nawabus:show-ticket-hub-hint", handleShowHint);

    return () => {
      window.clearTimeout(helperTimeout);
      window.removeEventListener("nawabus:open-ticket-hub", handleOpenHub);
      window.removeEventListener("nawabus:show-ticket-hub-hint", handleShowHint);
    };
  }, []);

  useEffect(() => {
    if (!selectedQrTrip?.firstTicket) {
      setQrDataUrl("");
      return;
    }

    QRCode.toDataURL(selectedQrTrip.firstTicket.id, { width: 220, margin: 1 })
      .then(setQrDataUrl)
      .catch((err) => {
        console.error("QR generation failed:", err);
        setQrDataUrl("");
      });
  }, [selectedQrTrip]);

  async function fetchUserData(userId) {
    setDataLoading(true);
    try {
      const { data: paidTickets, error: ticketsError } = await supabase
        .from("tickets")
        .select(`
          id,
          trip_id,
          ticket_number,
          seat_number,
          seat_class,
          price_paid_usd,
          status,
          payment_status,
          payment_method,
          payment_reference,
          created_at,
          passenger_id,
          booked_by,
          ticket_companions (
            name,
            phone
          ),
          trips:trip_id (
            departure_time,
            arrival_time,
            routes:route_id (
              origin_city,
              destination_city,
              origin_province,
              destination_province
            ),
            buses:bus_id (
              make,
              model,
              companies:company_id (name)
            )
          )
        `)
        .or(`passenger_id.eq.${userId},booked_by.eq.${userId}`)
        .eq("payment_status", "paid")
        .in("status", ["active", "used"])
        .order("created_at", { ascending: false });

      if (ticketsError) throw ticketsError;
      setTickets(paidTickets || []);

      const paidReferences = [
        ...new Set((paidTickets || []).map((ticket) => ticket.payment_reference).filter(Boolean)),
      ];
      if (paidReferences.length > 0) {
        const { data: completedPayments, error: completedPaymentsError } = await supabase
          .from("payment_transactions")
          .select("transaction_id, gateway_response")
          .in("transaction_id", paidReferences);

        if (completedPaymentsError) {
          console.warn("Completed payment lookup failed:", completedPaymentsError.message);
          setPaymentsByReference({});
        } else {
          setPaymentsByReference(
            Object.fromEntries((completedPayments || []).map((payment) => [payment.transaction_id, payment]))
          );
        }
      } else {
        setPaymentsByReference({});
      }

      const { data: pending, error: pendingError } = await supabase
        .from("payment_transactions")
        .select("id, transaction_id, amount_usd, status, created_at, gateway_response")
        .eq("status", "pending")
        .contains("gateway_response", { booking_details: { passenger_id: userId } })
        .order("created_at", { ascending: false });

      if (pendingError) {
        console.warn("Pending reference filtered query failed:", pendingError.message);
        setPendingTransactions([]);
      } else {
        setPendingTransactions(pending || []);
      }
    } catch (err) {
      console.error("User hub data error:", err);
    } finally {
      setDataLoading(false);
    }
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError("");

    try {
      const normalizedPhone = normalizePhoneNumber(phone);
      const email = `${phone.trim()}@nawabus.com`;

      if (authMode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw new Error("Telefone ou senha incorretos.");
      } else {
        const { first_name, last_name } = ensureNames(fullName);
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              role: "passenger",
              first_name,
              last_name,
              phone_number: normalizedPhone,
            },
          },
        });
        if (error) throw error;

        if (!data?.session) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (signInError) {
            throw new Error("Conta criada. Inicie sessao com o seu telefone e senha.");
          }
        }
      }

      const { data: userData } = await supabase.auth.getUser();
      setUser(userData?.user || null);
      setPhone("");
      setPassword("");
      setFullName("");
      setActiveTab("paid");
    } catch (err) {
      setAuthError(err.message || "Nao foi possivel autenticar.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUser(null);
    setIsOpen(false);
  }

  async function copyReference(reference) {
    try {
      await navigator.clipboard.writeText(reference);
    } catch {
      window.prompt("Copie a referencia:", reference);
    }
  }

  async function downloadPendingReference(transaction) {
    const booking = getPendingBooking(transaction);
    const doc = new jsPDF();
    const qrDataUrl = await QRCode.toDataURL(JSON.stringify({
      type: "nawabus_payment_reference",
      entidade: ENTITY,
      referencia: transaction.transaction_id,
      valor: Math.round(Number(transaction.amount_usd) || 0),
    }), { width: 180, margin: 1 });

    doc.setFillColor(26, 26, 26);
    doc.rect(0, 0, 210, 44, "F");
    doc.setFillColor(255, 140, 0);
    doc.rect(0, 39, 210, 5, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, "bold");
    doc.setFontSize(24);
    doc.text("NAWABUS", 18, 20);
    doc.setFontSize(11);
    doc.text("Referencia de pagamento", 18, 31);

    doc.setTextColor(185, 28, 28);
    doc.setFontSize(13);
    doc.text("ESTE DOCUMENTO NAO E BILHETE", 105, 60, { align: "center" });

    doc.setDrawColor(255, 140, 0);
    doc.setFillColor(255, 249, 235);
    doc.roundedRect(16, 78, 178, 58, 5, 5, "FD");
    doc.setTextColor(38, 38, 38);
    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.text("Pagamento MULTICAIXA", 24, 92);
    doc.setFont(undefined, "normal");
    doc.text(`Entidade: ${ENTITY}`, 24, 106);
    doc.setFont(undefined, "bold");
    doc.setFontSize(18);
    doc.text(`Referencia: ${transaction.transaction_id}`, 24, 120);
    doc.setFontSize(13);
    doc.text(`Valor: ${formatMoney(transaction.amount_usd)}`, 24, 131);
    doc.addImage(qrDataUrl, "PNG", 150, 92, 30, 30);

    doc.setFontSize(10);
    doc.setTextColor(75, 85, 99);
    doc.text(`Emitido em: ${new Date(transaction.created_at).toLocaleString("pt-PT")}`, 18, 154);
    doc.text(`Expira em: ${formatPendingDeadline(transaction)}`, 18, 166);
    doc.text(`Lugares: ${getPendingSeatText(booking)}`, 18, 178, { maxWidth: 174 });

    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(185, 28, 28);
    doc.roundedRect(16, 194, 178, 34, 4, 4, "FD");
    doc.setTextColor(185, 28, 28);
    doc.setFont(undefined, "bold");
    doc.text("Importante", 24, 206);
    doc.setFont(undefined, "normal");
    doc.setFontSize(9);
    doc.text("Pague dentro de 1 hora. Depois disso, a referencia expira e os lugares voltam a ficar disponiveis.", 24, 216, { maxWidth: 160 });
    doc.text("O bilhete so sera emitido e valido depois da confirmacao do pagamento.", 24, 224, { maxWidth: 160 });

    doc.save(`nawabus-referencia-${transaction.transaction_id}.pdf`);
  }

  function openPanel() {
    setIsOpen(true);
    setShowHubHelper(false);
    setAuthError("");
  }

  return (
    <>
      <div className="fixed bottom-5 right-5 z-40 md:bottom-7 md:right-7">
        {showHubHelper && !isOpen && (
          <div className="pointer-events-none absolute bottom-16 right-0 w-48 rounded-2xl border border-orange-200 bg-neutral-950 px-4 py-3 text-right text-white shadow-2xl shadow-black/30 md:bottom-20 md:w-56">
            <p className="text-sm font-bold text-orange-300">Meus bilhetes</p>
            <p className="mt-1 text-xs leading-snug text-neutral-200">
              Toque no botao laranja para ver Pagos e Pendentes.
            </p>
          </div>
        )}
        {user && upcomingRideCount > 0 && (
          <div className="absolute -right-1 -top-2 z-10 flex h-6 min-w-6 items-center justify-center rounded-full border border-black/10 bg-white px-1.5 text-xs font-bold text-black shadow-lg md:h-7 md:min-w-7 md:text-sm">
            {upcomingRideCount > 99 ? "99+" : upcomingRideCount}
          </div>
        )}
        <button
          type="button"
          onClick={openPanel}
          aria-label="Abrir area do cliente"
          className={`flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-[#FF8C00] text-white shadow-[0_18px_45px_rgba(0,0,0,0.28)] transition hover:scale-105 focus:outline-none focus:ring-4 focus:ring-orange-300 md:h-16 md:w-16 ${
            showHubHelper && !isOpen ? "animate-pulse ring-4 ring-orange-200 ring-offset-2 ring-offset-white" : ""
          }`}
        >
          <User className="h-7 w-7" strokeWidth={2.6} />
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Fechar area do cliente"
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          <section className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-hidden rounded-t-[28px] border border-white/15 bg-neutral-950 text-white shadow-2xl md:inset-y-6 md:left-auto md:right-6 md:w-[440px] md:rounded-[28px]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,140,0,0.22),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.08),transparent_28%)]" />
            <div className="relative flex max-h-[92vh] flex-col">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-orange-300">NawaBus ID</p>
                  <h2 className="mt-1 text-xl font-semibold">Area do cliente</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-full border border-white/10 bg-white/10 p-2 text-white transition hover:bg-white/20"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {!user ? (
                <div className="overflow-y-auto px-5 pb-6 pt-5">
                  <div className="rounded-2xl border border-orange-300/25 bg-orange-400/10 p-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FF8C00] text-black">
                      <Lock className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-2xl font-semibold">
                      {authMode === "login" ? "Entre para ver seus bilhetes" : "Crie sua conta NawaBus"}
                    </h3>
                    <p className="mt-2 text-sm text-neutral-300">
                      Use o mesmo telefone e senha usados no checkout.
                    </p>
                  </div>

                  <form className="mt-5 space-y-4" onSubmit={handleAuthSubmit}>
                    {authMode === "signup" && (
                      <label className="block">
                        <span className="text-sm text-neutral-300">Nome completo</span>
                        <input
                          value={fullName}
                          onChange={(event) => setFullName(event.target.value)}
                          required
                          className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-white/8 px-4 text-white outline-none transition placeholder:text-neutral-500 focus:border-orange-300"
                          placeholder="O seu nome"
                        />
                      </label>
                    )}

                    <label className="block">
                      <span className="text-sm text-neutral-300">Numero de telefone</span>
                      <input
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        required
                        inputMode="tel"
                        className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-white/8 px-4 text-white outline-none transition placeholder:text-neutral-500 focus:border-orange-300"
                        placeholder="923456789"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm text-neutral-300">Senha</span>
                      <input
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                        minLength={6}
                        type="password"
                        className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-white/8 px-4 text-white outline-none transition placeholder:text-neutral-500 focus:border-orange-300"
                        placeholder="******"
                      />
                    </label>

                    {authError && (
                      <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                        {authError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={authLoading}
                      className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#FF8C00] font-semibold text-black transition hover:bg-orange-400 disabled:opacity-60"
                    >
                      {authLoading ? "A processar..." : authMode === "login" ? "Entrar" : "Criar conta"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode(authMode === "login" ? "signup" : "login");
                        setAuthError("");
                      }}
                      className="w-full rounded-2xl border border-white/10 px-4 py-3 text-sm text-neutral-200 transition hover:bg-white/10"
                    >
                      {authMode === "login" ? "Nao tem conta? Criar agora" : "Ja tem conta? Entrar"}
                    </button>
                  </form>
                </div>
              ) : (
                <>
                  <div className="border-b border-white/10 px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-neutral-400">Sessao iniciada</p>
                        <p className="truncate text-lg font-semibold">
                          {user.user_metadata?.full_name ||
                            `${user.user_metadata?.first_name || ""} ${user.user_metadata?.last_name || ""}`.trim() ||
                            user.email}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="rounded-full border border-white/10 bg-white/10 p-2 text-neutral-200 transition hover:bg-white/20"
                        aria-label="Sair"
                      >
                        <LogOut className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-white/10 bg-white/8 p-3">
                        <p className="text-xs text-neutral-400">Bilhetes pagos</p>
                        <p className="mt-1 text-2xl font-semibold text-orange-300">{tickets.length}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/8 p-3">
                        <p className="text-xs text-neutral-400">Refs pendentes</p>
                        <p className="mt-1 text-2xl font-semibold text-orange-300">{pendingTransactions.length}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 px-5 pt-4">
                    <button
                      type="button"
                      onClick={() => setActiveTab("paid")}
                      className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                        activeTab === "paid" ? "bg-[#FF8C00] text-black" : "bg-white/8 text-neutral-300"
                      }`}
                    >
                      Pagos
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("pending")}
                      className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                        activeTab === "pending" ? "bg-[#FF8C00] text-black" : "bg-white/8 text-neutral-300"
                      }`}
                    >
                      Pendentes
                    </button>
                    <button
                      type="button"
                      onClick={() => fetchUserData(user.id)}
                      className="rounded-2xl bg-white/8 px-3 text-neutral-300 transition hover:bg-white/15"
                      aria-label="Atualizar"
                    >
                      <RefreshCw className={`h-5 w-5 ${dataLoading ? "animate-spin" : ""}`} />
                    </button>
                  </div>

                  <div className="overflow-y-auto px-5 pb-6 pt-4">
                    {activeTab === "paid" ? (
                      <div className="space-y-3">
                        {dataLoading && <SkeletonRows />}
                        {!dataLoading && paidGroups.length === 0 && (
                          <EmptyState title="Nenhum bilhete pago" text="Quando pagar uma referencia, o bilhete aparece aqui." />
                        )}
                        {paidGroups.map((group) => (
                          <PaidGroupCard
                            key={group.reference || group.firstTicket.trip_id || group.firstTicket.id}
                            group={group}
                            user={user}
                            payment={paymentsByReference[group.reference]}
                            onShowQr={setSelectedQrTrip}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {dataLoading && <SkeletonRows />}
                        {!dataLoading && pendingTransactions.length === 0 && (
                          <EmptyState title="Sem pagamentos pendentes" text="As referencias geradas e ainda nao pagas aparecem aqui." />
                        )}
                        {pendingTransactions.map((transaction) => (
                          <PendingReferenceCard
                            key={transaction.id}
                            transaction={transaction}
                            onCopy={() => copyReference(transaction.transaction_id)}
                            onDownload={() => downloadPendingReference(transaction)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      )}

      {selectedQrTrip && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/65 p-4 backdrop-blur-sm md:items-center">
          <div className="w-full max-w-sm rounded-[28px] border border-white/15 bg-neutral-950 p-5 text-white shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-orange-300">QR de embarque</p>
                <h3 className="mt-1 text-lg font-semibold">QR {selectedQrTrip.label}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedQrTrip(null)}
                className="rounded-full bg-white/10 p-2"
                aria-label="Fechar QR"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-5 rounded-3xl bg-white p-5">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR do bilhete" className="mx-auto h-56 w-56" />
              ) : (
                <div className="flex h-56 items-center justify-center text-sm text-neutral-500">A gerar QR...</div>
              )}
            </div>
            <p className="mt-4 text-sm text-neutral-300">{getRoute(selectedQrTrip.firstTicket)}</p>
            <p className="mt-1 text-xs text-neutral-400">
              Lugares: {selectedQrTrip.tickets.map((ticket) => ticket.seat_number).join(", ")}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Este QR valida apenas esta viagem. A ida e a volta sao controladas separadamente.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function PaidGroupCard({ group, user, payment, onShowQr }) {
  const ticket = group.firstTicket;
  const tripGroups = groupTicketsByTrip(group.tickets);
  const routeSummary = getGroupRouteSummary(group);
  const firstTripQr = buildQrTripPayload(tripGroups[0], 0, tripGroups.length);
  const seats = tripGroups
    .map((tripGroup, index) => `V${index + 1}: ${tripGroup.tickets.map((item) => item.seat_number).join(", ")}`)
    .join(" | ");
  const [isDownloading, setIsDownloading] = useState(false);

  async function handleDownload() {
    if (isDownloading) return;

    if (isRestrictedInAppBrowser()) {
      const publicTicketUrl = group.reference
        ? `${window.location.origin}/bilhetes/${encodeURIComponent(group.reference)}`
        : window.location.href;
      openExternalBrowser(publicTicketUrl);
      return;
    }

    setIsDownloading(true);
    try {
      await downloadPaidTicketGroup(group, user, payment);
    } catch (err) {
      console.error("Paid ticket PDF failed:", err);
      alert("Nao foi possivel gerar o PDF dos bilhetes. Tente novamente.");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.07]">
      <div className="border-b border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              Pago
            </div>
            <h3 className="mt-2 line-clamp-2 text-lg font-semibold">{routeSummary}</h3>
            <p className="mt-1 text-sm text-neutral-400">
              {tripGroups.length > 1
                ? `${tripGroups.length} viagens nesta compra`
                : formatDate(ticket.trips?.departure_time)}
            </p>
          </div>
          <div className="rounded-2xl bg-[#FF8C00] px-3 py-2 text-center text-black">
            <p className="text-[10px] font-semibold uppercase">Lugares</p>
            <p className="max-w-24 text-xs font-bold leading-tight">{seats}</p>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <InfoPill label="Passageiros" value={String(group.tickets.length)} />
          <InfoPill label="Total" value={formatMoney(group.total)} />
        </div>

        <div className="space-y-2">
          {tripGroups.map((tripGroup, index) => (
            <button
              type="button"
              key={tripGroup.tripId || tripGroup.firstTicket.id}
              onClick={() => onShowQr(buildQrTripPayload(tripGroup, index, tripGroups.length))}
              className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-left transition hover:bg-white/10"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">QR {getTripQrLabel(index, tripGroups.length)}</span>
                <span className="block truncate text-xs text-neutral-400">{getRoute(tripGroup.firstTicket)}</span>
                <span className="text-xs text-neutral-500">
                  {formatDate(tripGroup.firstTicket.trips?.departure_time)} | Lugares {tripGroup.tickets.map((item) => item.seat_number).join(", ")}
                </span>
              </span>
              <QrCode className="h-5 w-5 text-orange-300" />
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#FF8C00] px-4 py-3 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            {isDownloading ? "A gerar..." : group.tickets.length > 1 ? "Baixar todos" : "Baixar bilhete"}
          </button>
          <button
            type="button"
            onClick={() => onShowQr(firstTripQr)}
            className="flex items-center justify-center rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            aria-label="Mostrar QR"
          >
            <Eye className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

function PendingReferenceCard({ transaction, onCopy, onDownload }) {
  const booking = getPendingBooking(transaction);
  const seatCount = countPendingSeats(booking);
  const expired = isPendingExpired(transaction);

  return (
    <article className={`rounded-3xl border p-4 ${expired ? "border-red-300/20 bg-red-500/10" : "border-orange-300/20 bg-orange-400/10"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={`text-xs font-semibold uppercase tracking-[0.18em] ${expired ? "text-red-300" : "text-orange-300"}`}>
            {expired ? "Expirada" : "Por pagar"}
          </div>
          <h3 className="mt-2 text-2xl font-bold tracking-[0.12em] text-white">{transaction.transaction_id}</h3>
          <p className="mt-1 text-sm text-neutral-300">Entidade {ENTITY} | {formatMoney(transaction.amount_usd)}</p>
        </div>
        <Ticket className={`h-7 w-7 ${expired ? "text-red-300" : "text-orange-300"}`} />
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-neutral-300">
        <p>{seatCount > 0 ? `${seatCount} lugar(es) selecionado(s)` : "Pagamento aguardando confirmacao"}</p>
        <p className="mt-1 text-xs text-neutral-500">{getPendingSeatText(booking)}</p>
        <p className={`mt-2 text-xs font-semibold ${expired ? "text-red-200" : "text-orange-200"}`}>
          {expired ? "Expirou em" : "Expira em"}: {formatPendingDeadline(transaction)}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onCopy}
          disabled={expired}
          className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-3 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Copy className="h-4 w-4" />
          Copiar ref.
        </button>
        <button
          type="button"
          onClick={onDownload}
          disabled={expired}
          className="flex items-center justify-center gap-2 rounded-2xl bg-[#FF8C00] px-3 py-3 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download className="h-4 w-4" />
          PDF
        </button>
      </div>

      <p className="mt-3 flex items-center gap-2 text-xs text-neutral-400">
        <ArrowRight className={`h-3.5 w-3.5 ${expired ? "text-red-300" : "text-orange-300"}`} />
        {expired
          ? "Esta referencia ja expirou. Reserve novamente ou peca uma nova referencia no admin."
          : "Pague em ate 1 hora. O bilhete aparece em Pagos depois da confirmacao."}
      </p>
    </article>
  );
}

function InfoPill({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 font-semibold text-white">{value}</p>
    </div>
  );
}

function EmptyState({ title, text }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-orange-300">
        <Ticket className="h-6 w-6" />
      </div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-neutral-400">{text}</p>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-36 animate-pulse rounded-3xl bg-white/10" />
      ))}
    </div>
  );
}
