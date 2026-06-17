import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Histórico de pedidos TGM",
  description: "Registro y búsqueda de pedidos de fabricación",
};

// Script anti-flash: aplica .dark antes de que React hidrate
const darkScript = `
try {
  const t = localStorage.getItem('theme');
  const sys = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (t === 'dark' || (!t && sys)) document.documentElement.classList.add('dark');
} catch(e){}
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full font-sans">
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script dangerouslySetInnerHTML={{ __html: darkScript }} />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
