import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./legacy-fallback.css";
import { UserTicketHub } from "@/components/user-ticket-hub";
import { ExternalBrowserNotice } from "@/components/external-browser-notice";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "NawaBus — Bilhetes de Autocarro Online | Luanda · Benguela · Angola",
  description: "Compra o teu bilhete de autocarro online para Benguela, Luanda e toda Angola. Escolhe o lugar, paga por referência Multicaixa e recebe o bilhete no telemóvel. Aluguer de frete para grupos e empresas.",
  keywords: ["bilhetes de autocarro", "Luanda", "Benguela", "Angola", "NawaBus", "aluguer de frete", "viagens interprovinciais"],
  icons: {
    icon: "/fav.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <UserTicketHub />
        <ExternalBrowserNotice />
      </body>
    </html>
  );
}
