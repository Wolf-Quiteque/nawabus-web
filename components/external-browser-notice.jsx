"use client";

import { useEffect, useState } from "react";
import { Copy, ExternalLink, X } from "lucide-react";
import {
  copyLinkToClipboard,
  getInAppBrowserName,
  isRestrictedInAppBrowser,
  openExternalBrowser,
} from "@/lib/in-app-browser";

export function ExternalBrowserNotice() {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setVisible(isRestrictedInAppBrowser());
  }, []);

  if (!visible) return null;

  const appName = getInAppBrowserName();

  async function handleCopy() {
    const ok = await copyLinkToClipboard(window.location.href);
    setCopied(ok);
    if (ok) {
      setTimeout(() => setCopied(false), 1800);
    }
  }

  return (
    <div className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-md rounded-2xl border border-orange-300/50 bg-neutral-950 p-4 text-white shadow-2xl shadow-black/40">
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="absolute right-3 top-3 rounded-full bg-white/10 p-1 text-white/80"
        aria-label="Fechar aviso"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="pr-8">
        <p className="text-sm font-semibold text-orange-300">Abra no navegador</p>
        <p className="mt-1 text-sm leading-relaxed text-neutral-200">
          O {appName} pode bloquear o download do PDF. Abra esta pagina no Chrome ou Safari para baixar os bilhetes.
        </p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => openExternalBrowser(window.location.href)}
          className="flex items-center justify-center gap-2 rounded-xl bg-[#FF8C00] px-3 py-2 text-sm font-semibold text-black"
        >
          <ExternalLink className="h-4 w-4" />
          Abrir
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center justify-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-sm font-semibold text-white"
        >
          <Copy className="h-4 w-4" />
          {copied ? "Copiado" : "Copiar link"}
        </button>
      </div>
    </div>
  );
}
