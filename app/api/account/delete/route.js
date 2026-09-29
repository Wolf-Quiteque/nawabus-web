import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

// POST /api/account/delete — "Eliminar conta" in the app (Apple requires it).
//
// The customer proves who they are with their own access token. Their personal
// details are wiped from the profile and the login can never be used again; the
// tickets and sales records stay (tax law), no longer tied to a name. The login
// is soft-deleted because tickets reference the profile, and its email is freed
// first so the same phone number can sign up again later.

const STAFF_ROLES = new Set(["admin", "agent", "driver", "company_admin", "manager"]);
const fail = (status, error) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request) {
  const admin = createSupabaseAdmin();
  const token = String(request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return fail(401, "Entre na sua conta para a eliminar.");
  const { data, error } = await admin.auth.getUser(token);
  const user = data?.user;
  if (error || !user?.id) return fail(401, "Sessão expirada. Entre novamente.");

  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role && STAFF_ROLES.has(profile.role)) {
    return fail(403, "As contas da equipa são geridas pela administração. Fale com um administrador.");
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      first_name: "Conta",
      last_name: "eliminada",
      phone_number: null,
      date_of_birth: null,
      national_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  if (profileError) {
    console.error("[account-delete] profile:", profileError.message);
    return fail(500, "Não foi possível eliminar a conta. Tente novamente.");
  }

  const { error: renameError } = await admin.auth.admin.updateUserById(user.id, {
    email: `deleted-${user.id}@deleted.nawabus.invalid`,
    email_confirm: true,
    user_metadata: {},
  });
  if (renameError) console.error("[account-delete] rename login:", renameError.message);

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id, true);
  if (deleteError) {
    console.error("[account-delete] delete login:", deleteError.message);
    return fail(500, "Não foi possível eliminar a conta. Tente novamente.");
  }

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
