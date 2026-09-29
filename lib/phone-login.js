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

export async function signInWithPhone(supabase, phone, password) {
  let lastError = null;
  for (const email of loginEmails(phone)) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) return { data, error: null };
    lastError = error;
  }
  return { data: null, error: lastError };
}
