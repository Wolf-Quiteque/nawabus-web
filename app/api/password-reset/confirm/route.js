import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

// The link from the recovery SMS: sets the new password on every login of
// that phone number. A link works once, for 30 minutes.

const hash = (token) => crypto.createHash("sha256").update(String(token || "")).digest("hex");
const EXPIRED = "Este link já foi usado ou expirou. Pede um novo SMS.";

async function openRequest(admin, token) {
  const { data } = await admin
    .from("password_reset_requests")
    .select("id, phone, user_ids")
    .eq("token_hash", hash(token))
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return data;
}

/** Lets the page say straight away when a link is no longer valid. */
export async function GET(request) {
  const token = new URL(request.url).searchParams.get("token");
  const found = token ? await openRequest(createSupabaseAdmin(), token) : null;
  return NextResponse.json({ valid: Boolean(found) });
}

export async function POST(request) {
  const { token, password } = await request.json().catch(() => ({}));
  if (typeof password !== "string" || password.length < 6) {
    return NextResponse.json({ error: "A senha tem de ter pelo menos 6 caracteres." }, { status: 400 });
  }
  if (!token) return NextResponse.json({ error: EXPIRED }, { status: 400 });

  const admin = createSupabaseAdmin();
  // Claim the link first, so it can only ever be used once.
  const { data: claimed } = await admin
    .from("password_reset_requests")
    .update({ used_at: new Date().toISOString() })
    .eq("token_hash", hash(token))
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("id, phone, user_ids")
    .maybeSingle();
  if (!claimed) return NextResponse.json({ error: EXPIRED }, { status: 400 });

  const emails = [];
  for (const id of claimed.user_ids) {
    const { data, error } = await admin.auth.admin.updateUserById(id, { password });
    if (error) {
      console.error("[password-reset] could not update a login:", error.message);
      // Give the link back so the customer can try again.
      await admin.from("password_reset_requests").update({ used_at: null }).eq("id", claimed.id);
      return NextResponse.json({ error: "Não foi possível guardar a nova senha. Tenta de novo." }, { status: 500 });
    }
    if (data?.user?.email) emails.push(data.user.email);
  }

  // Any other link sent to this number stops working too.
  await admin
    .from("password_reset_requests")
    .update({ used_at: new Date().toISOString() })
    .eq("phone", claimed.phone)
    .is("used_at", null);

  // The page signs the customer in with these (they now share the new password).
  return NextResponse.json({ ok: true, emails });
}
