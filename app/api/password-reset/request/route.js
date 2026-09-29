import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { angolanNine } from "@/lib/phone-login";

// "Esqueci-me da senha": texts a one-time link (valid 30 min) to the phone
// number, through Mimo. The answer is the same whether or not the number has
// an account, so the page can't be used to find out who is a customer.

const SMS_API_URL = process.env.SMS_API_URL || "https://mimo-sms-rest-api.vercel.app/send-sms";
// Fixed, never taken from the request: a forged Host header must not be able
// to send someone a working link to another site.
const SITE_URL = (process.env.SITE_URL || "https://www.nawabus.ao").replace(/\/$/, "");

const PER_PHONE_PER_HOUR = 3;
const PER_IP_PER_HOUR = 10;
const MIN_GAP_MS = 60_000;

const hash = (token) => crypto.createHash("sha256").update(token).digest("hex");
const tooMany = (message) => NextResponse.json({ error: message }, { status: 429 });

export async function POST(request) {
  const { phone } = await request.json().catch(() => ({}));
  const nine = angolanNine(phone);
  if (!nine) {
    return NextResponse.json({ error: "Escreve o número de telefone com 9 dígitos (ex.: 923456789)." }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || null;
  const admin = createSupabaseAdmin();
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();

  const { data: recent, error: recentError } = await admin
    .from("password_reset_requests")
    .select("created_at")
    .eq("phone", nine)
    .gte("created_at", hourAgo)
    .order("created_at", { ascending: false });
  if (recentError) {
    console.error("[password-reset] limit check failed:", recentError.message);
    return NextResponse.json({ error: "Não foi possível continuar agora. Tenta de novo daqui a pouco." }, { status: 500 });
  }
  if (recent.length && Date.now() - new Date(recent[0].created_at).getTime() < MIN_GAP_MS) {
    return tooMany("Já enviámos um SMS há instantes. Espera um minuto antes de pedir outro.");
  }
  if (recent.length >= PER_PHONE_PER_HOUR) {
    return tooMany("Já pediste vários SMS na última hora. Tenta mais tarde ou fala connosco no WhatsApp 930 533 405.");
  }
  if (ip) {
    const { count } = await admin
      .from("password_reset_requests")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("created_at", hourAgo);
    if (count >= PER_IP_PER_HOUR) return tooMany("Demasiados pedidos. Tenta mais tarde.");
  }

  const { data: logins, error: loginsError } = await admin.rpc("login_users_for_phone", { p_phone: nine });
  if (loginsError) {
    console.error("[password-reset] login lookup failed:", loginsError.message);
    return NextResponse.json({ error: "Não foi possível continuar agora. Tenta de novo daqui a pouco." }, { status: 500 });
  }

  const token = logins.length ? crypto.randomBytes(18).toString("base64url") : null;
  const { error: insertError } = await admin.from("password_reset_requests").insert({
    phone: nine,
    token_hash: token ? hash(token) : null,
    user_ids: logins.map((login) => login.id),
    ip,
  });
  if (insertError) {
    console.error("[password-reset] could not record the request:", insertError.message);
    return NextResponse.json({ error: "Não foi possível continuar agora. Tenta de novo daqui a pouco." }, { status: 500 });
  }

  if (token) {
    // Plain ASCII and under 160 characters: one SMS.
    const text = `NAWABUS: crie a sua nova senha em ${SITE_URL}/recuperar-senha/${token} (valido 30 min). Se nao pediu, ignore esta mensagem.`;
    try {
      const response = await fetch(SMS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: `244${nine}`, text }),
      });
      if (!response.ok) throw new Error(`SMS API ${response.status}: ${(await response.text()).slice(0, 200)}`);
    } catch (error) {
      console.error("[password-reset] SMS failed:", error.message);
      return NextResponse.json({ error: "Não conseguimos enviar o SMS agora. Tenta de novo daqui a pouco." }, { status: 502 });
    }
  }

  return NextResponse.json({ ok: true });
}
