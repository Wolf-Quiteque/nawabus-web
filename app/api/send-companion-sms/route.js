import { NextResponse } from 'next/server';

const SMS_API_URL = process.env.SMS_API_URL || 'https://mimo-sms-rest-api.vercel.app/send-sms';

export async function POST(request) {
  try {
    const { companions, bookedBy } = await request.json();

    if (!companions || !Array.isArray(companions) || companions.length === 0) {
      return NextResponse.json({ error: 'No companions provided' }, { status: 400 });
    }

    const results = [];

    for (const c of companions) {
      if (!c.phone) continue;

      const phoneClean = c.phone.replace(/\D/g, '');
      if (!phoneClean) continue;

      // Format departure time
      let partidaFmt = '—';
      if (c.departureTime) {
        const d = new Date(c.departureTime);
        partidaFmt = d.toLocaleString('pt-PT', {
          timeZone: 'Africa/Luanda',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).replace(',', ' as');
      }

      const smsText = `NAWABUS — Viajar aqui e facil

Ola ${c.name},
Foi reservado um lugar para si.

Detalhes do bilhete:
• Codigo: ${c.ticketNumber || 'N/A'}
• Rota: ${c.route || 'N/A'}
• Partida: ${partidaFmt}
• Assento: ${c.seatNumber}
• Reservado por: ${bookedBy || 'N/A'}

Apresente esta mensagem no embarque.

Boa viagem com a NAWABUS!`;

      try {
        await fetch(SMS_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: phoneClean, text: smsText }),
        });
        results.push({ phone: phoneClean, sent: true });
      } catch (err) {
        console.error(`Failed to send SMS to ${phoneClean}:`, err.message);
        results.push({ phone: phoneClean, sent: false, error: err.message });
      }
    }

    return NextResponse.json({ success: true, results }, { status: 200 });
  } catch (error) {
    console.error('Error in send-companion-sms:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
