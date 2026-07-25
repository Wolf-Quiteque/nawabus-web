import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

const DEFAULT_RECIPIENTS = [
  'patricia.sungue@nawabus.com',
  'ednilson.pedro@nawabus.com',
  'marcio.quiteque@nawabus.com',
  'tecoa@nawabus.com',
];

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(dateKey) {
  if (!dateKey) return '';
  const [year, month, day] = String(dateKey).split('-');
  if (!year || !month || !day) return dateKey;
  return `${day}/${month}/${year}`;
}

function fieldRow(label, value) {
  return `
    <tr>
      <td style="padding:10px 16px;border-bottom:1px solid #f0e9dd;color:#78716c;font-size:13px;white-space:nowrap;">${label}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #f0e9dd;color:#1c1917;font-size:14px;font-weight:600;">${value}</td>
    </tr>`;
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });
  }

  const {
    tipoCliente,
    nome,
    nif,
    telefone,
    email,
    origem,
    destino,
    pessoas,
    dataPartida,
    horaPartida,
    idaEVolta,
    dataRegresso,
    horaRegresso,
    detalhes,
  } = body || {};

  const isEmpresa = tipoCliente === 'empresa';

  if (!nome || !telefone || !origem || !destino || !pessoas || !dataPartida) {
    return NextResponse.json(
      { error: 'Preencha todos os campos obrigatórios.' },
      { status: 400 }
    );
  }
  if (isEmpresa && !nif) {
    return NextResponse.json(
      { error: 'O NIF da empresa é obrigatório.' },
      { status: 400 }
    );
  }
  if (idaEVolta && !dataRegresso) {
    return NextResponse.json(
      { error: 'Indique a data de regresso.' },
      { status: 400 }
    );
  }

  const recipients = (process.env.FRETE_REQUEST_RECIPIENTS || '')
    .split(',')
    .map((addr) => addr.trim())
    .filter(Boolean);
  const to = recipients.length > 0 ? recipients : DEFAULT_RECIPIENTS;

  const subject = `Solicitação de Frete via Website — ${origem} → ${destino}`;

  const partida = `${formatDate(dataPartida)}${horaPartida ? ` às ${horaPartida}` : ''}`;
  const regresso = idaEVolta
    ? `${formatDate(dataRegresso)}${horaRegresso ? ` às ${horaRegresso}` : ''}`
    : 'Só ida';

  const rows = [
    fieldRow('Tipo de cliente', isEmpresa ? 'Empresa' : 'Pessoa individual'),
    fieldRow(isEmpresa ? 'Empresa / Responsável' : 'Nome', escapeHtml(nome)),
    isEmpresa ? fieldRow('NIF', escapeHtml(nif)) : '',
    fieldRow('Telefone', escapeHtml(telefone)),
    email ? fieldRow('Email', escapeHtml(email)) : '',
    fieldRow('Origem', escapeHtml(origem)),
    fieldRow('Destino', escapeHtml(destino)),
    fieldRow('Nº de pessoas', escapeHtml(pessoas)),
    fieldRow('Partida', escapeHtml(partida)),
    fieldRow('Regresso', escapeHtml(regresso)),
    detalhes ? fieldRow('Detalhes', escapeHtml(detalhes)) : '',
  ].join('');

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#faf7f0;padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #f0e9dd;">
      <div style="background:linear-gradient(90deg,#facc15,#f59e0b);padding:20px 24px;">
        <h1 style="margin:0;font-size:18px;color:#1c1917;">Nova Solicitação de Frete — nawabus.com</h1>
      </div>
      <table style="width:100%;border-collapse:collapse;">${rows}</table>
      <div style="padding:16px 24px;color:#78716c;font-size:12px;">
        Pedido enviado através do formulário de Aluguer de Frete no website.
        Compromisso de resposta: máximo 24 horas.
      </div>
    </div>
  </div>`;

  const text = [
    'Nova Solicitação de Frete — nawabus.com',
    '',
    `Tipo de cliente: ${isEmpresa ? 'Empresa' : 'Pessoa individual'}`,
    `Nome: ${nome}`,
    isEmpresa ? `NIF: ${nif}` : null,
    `Telefone: ${telefone}`,
    email ? `Email: ${email}` : null,
    `Origem: ${origem}`,
    `Destino: ${destino}`,
    `Nº de pessoas: ${pessoas}`,
    `Partida: ${partida}`,
    `Regresso: ${regresso}`,
    detalhes ? `Detalhes: ${detalhes}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 465,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      replyTo: email || undefined,
      subject,
      text,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao enviar solicitação de frete:', error);
    return NextResponse.json(
      { error: 'Não foi possível enviar o pedido. Tente novamente ou ligue-nos.' },
      { status: 500 }
    );
  }
}
