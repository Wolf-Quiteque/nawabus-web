// Website logins are "<phone as typed at sign-up>@nawabus.com", and people
// typed the same number as 923…, 244923… or +244923…. Signing in tries each
// form, so a customer gets in whichever way they write their number today.

/** The 9-digit Angolan mobile number (923456789), or null. */
export function angolanNine(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  const nine = digits.replace(/^(00)?244/, "");
  return /^9\d{8}$/.test(nine) ? nine : null;
}

/** Login emails to try for a typed phone number, the typed form first. */
export function loginEmails(phone) {
  const typed = String(phone || "").trim();
  const nine = angolanNine(typed);
  const forms = [typed, ...(nine ? [nine, `244${nine}`, `+244${nine}`] : [])];
  return [...new Set(forms.filter(Boolean))].map((form) => `${form}@nawabus.com`);
}

/**
 * The login email for a new account: the 9-digit number, which
 * signInWithPhone always tries. Sign-up used to glue the phone on exactly as
 * typed, so "923 456 789" (with spaces, as most people write it) became an
 * invalid email and the account could not be created at all.
 */
export function signupEmail(phone) {
  const nine = angolanNine(phone);
  return nine ? `${nine}@nawabus.com` : null;
}

/** Supabase's English sign-up errors, in words a customer can act on. */
export function signupErrorMessage(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "");
  if (code === "user_already_exists" || /already registered/i.test(message)) {
    return "Este número já tem conta. Toque em \"Entrar\" e use o seu telefone e senha, ou recupere a senha.";
  }
  if (code === "weak_password" || /password/i.test(message)) {
    return "A senha deve ter pelo menos 6 caracteres.";
  }
  if (/rate limit/i.test(message) || code.includes("rate_limit")) {
    return "Muitas tentativas seguidas. Aguarde um minuto e tente de novo.";
  }
  return "Não foi possível criar a conta. Verifique os dados e tente de novo.";
}

export const INVALID_PHONE_MESSAGE =
  "Número de telefone inválido. Escreva os 9 dígitos do seu número, ex.: 923 456 789.";

export async function signInWithPhone(supabase, phone, password) {
  let lastError = null;
  for (const email of loginEmails(phone)) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) return { data, error: null };
    lastError = error;
  }
  return { data: null, error: lastError };
}
