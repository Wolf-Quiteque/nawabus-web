"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2, KeyRound, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase-client";

// Step 2 of password recovery: the link from the SMS. The customer sets a
// new password and is signed in straight away.

export default function NewPasswordPage() {
  const { token } = useParams();
  const [state, setState] = useState("checking"); // checking | ready | saving | done | expired
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/password-reset/confirm?token=${encodeURIComponent(token)}`)
      .then((response) => response.json())
      .then(({ valid }) => setState(valid ? "ready" : "expired"))
      .catch(() => setState("ready")); // the save will say if the link is no good
  }, [token]);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (password.length < 6) return setError("A senha tem de ter pelo menos 6 caracteres.");
    if (password !== confirm) return setError("As senhas não coincidem.");

    setState("saving");
    try {
      const response = await fetch("/api/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Não foi possível guardar a nova senha.");

      const supabase = createClient();
      for (const email of body.emails || []) {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (!signInError) break;
      }
      setState("done");
    } catch (err) {
      setError(err.message);
      setState(/expirou|usado/.test(err.message) ? "expired" : "ready");
    }
  }

  const openTickets = () => window.dispatchEvent(new CustomEvent("nawabus:open-ticket-hub", { detail: { tab: "paid" } }));
  const Icon = state === "done" ? CheckCircle2 : state === "expired" ? TriangleAlert : KeyRound;

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 py-12 text-white">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 inline-block">
          <img src="/nawabus_logo_white.webp" alt="NawaBus" className="h-8 w-auto" />
        </Link>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FF8C00] text-black">
            <Icon className="h-5 w-5" />
          </div>

          {state === "checking" && <p className="mt-4 text-neutral-300">A verificar o link...</p>}

          {state === "expired" && (
            <>
              <h1 className="mt-4 text-2xl font-semibold">Este link já não funciona</h1>
              <p className="mt-2 text-neutral-300">Já foi usado ou passaram mais de 30 minutos. Pede um novo SMS.</p>
              <Link
                href="/recuperar-senha"
                className="mt-6 flex h-12 w-full items-center justify-center rounded-2xl bg-[#FF8C00] font-semibold text-black transition hover:bg-orange-400"
              >
                Pedir novo SMS
              </Link>
            </>
          )}

          {state === "done" && (
            <>
              <h1 className="mt-4 text-2xl font-semibold">Senha alterada</h1>
              <p className="mt-2 text-neutral-300">
                A partir de agora entras com o teu número de telefone e a nova senha.
              </p>
              <button
                type="button"
                onClick={openTickets}
                className="mt-6 flex h-12 w-full items-center justify-center rounded-2xl bg-[#FF8C00] font-semibold text-black transition hover:bg-orange-400"
              >
                Ver os meus bilhetes
              </button>
              <Link href="/" className="mt-3 block text-center text-sm text-neutral-400 underline underline-offset-4">
                Ir para o início
              </Link>
            </>
          )}

          {(state === "ready" || state === "saving") && (
            <>
              <h1 className="mt-4 text-2xl font-semibold">Cria uma nova senha</h1>
              <p className="mt-2 text-sm text-neutral-300">Pelo menos 6 caracteres.</p>

              <form className="mt-6 space-y-4" onSubmit={submit}>
                <label className="block">
                  <span className="text-sm text-neutral-300">Nova senha</span>
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={6}
                    autoFocus
                    type="password"
                    autoComplete="new-password"
                    className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-white/[0.08] px-4 text-white outline-none transition focus:border-orange-300"
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-neutral-300">Repetir a nova senha</span>
                  <input
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    required
                    minLength={6}
                    type="password"
                    autoComplete="new-password"
                    className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-white/[0.08] px-4 text-white outline-none transition focus:border-orange-300"
                  />
                </label>

                {error && (
                  <div role="alert" className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={state === "saving"}
                  className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#FF8C00] font-semibold text-black transition hover:bg-orange-400 disabled:opacity-60"
                >
                  {state === "saving" ? "A guardar..." : "Guardar nova senha"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
