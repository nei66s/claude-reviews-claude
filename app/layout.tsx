import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "./lib/auth";

export const metadata: Metadata = {
  title: "Chocks by Pimpotasma — Seu Agente Pessoal",
  description: "Assistente pessoal inteligente da Pimpotasma com ferramentas, workflows e automação",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
