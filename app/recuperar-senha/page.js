"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound, MessageSquareText } from "lucide-react";
import { angolanNine } from "@/lib/phone-login";

// Step 1 of password recovery: the customer types their number and gets an
// SMS with a link to set a new password.

export default function RecoverPasswordPage() {
  const [phone, setPhone] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | sent
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!angolanNine(phone)) {
      setError("Escreve o número de telefone com 9 dígitos (ex.: 923456789).");
      return;
    }
    setState("sending");
    try {
      const response = await fetch("/api/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Não foi possível enviar o SMS.");
      setState("sent");
    } catch (err) {
      setError(err.message);
      setState("idle");
    }
  }

  const nine = angolanNine(phone);

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 py-12 text-white">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 inline-block">
          <img src="/nawabus_logo_white.webp" alt="NawaBus" className="h-8 w-auto" />
        </Link>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FF8C00] text-black">
            {state === "sent" ? <MessageSquareText className="h-5 w-5" /> : <KeyRound className="h-5 w-5" />}
          </div>

          {state === "sent" ? (
            <>
              <h1 className="mt-4 text-2xl font-semibold">Verifica as tuas mensagens</h1>
              <p className="mt-3 text-neutral-300">
                Se o número <span className="font-semibold text-white">{nine}</span> tiver conta na NawaBus, vais
                receber um SMS com um link para criares uma nova senha. O link vale 30 minutos.
              </p>
              <p className="mt-4 text-sm text-neutral-400">
                Não chegou? Espera um minuto e{" "}
                <button type="button" onClick={() => setState("idle")} className="text-orange-300 underline underline-offset-4">
                  pede outro
                </button>
                , ou fala connosco no WhatsApp{" "}
                <a href="https://wa.me/244930533405" className="text-orange-300 underline underline-offset-4">930 533 405</a>.
              </p>
            </>
          ) : (
            <>
              <h1 className="mt-4 text-2xl font-semibold">Esqueceste a senha?</h1>
              <p className="mt-2 text-sm text-neutral-300">
                Escreve o número de telefone da tua conta. Enviamos-te um SMS com um link para criares uma nova.
              </p>

              <form className="mt-6 space-y-4" onSubmit={submit}>
                <label className="block">
                  <span className="text-sm text-neutral-300">Número de telefone</span>
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    required
                    autoFocus
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="923456789"
                    className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-white/[0.08] px-4 text-white outline-none transition placeholder:text-neutral-500 focus:border-orange-300"
                  />
                </label>

                {error && (
                  <div role="alert" className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={state === "sending"}
                  className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#FF8C00] font-semibold text-black transition hover:bg-orange-400 disabled:opacity-60"
                >
                  {state === "sending" ? "A enviar..." : "Enviar SMS"}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-neutral-400">
          Lembraste-te?{" "}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("nawabus:open-ticket-hub", { detail: { tab: "paid" } }))}
            className="text-orange-300 underline underline-offset-4"
          >
            Entrar
          </button>
        </p>
      </div>
    </main>
  );
}
