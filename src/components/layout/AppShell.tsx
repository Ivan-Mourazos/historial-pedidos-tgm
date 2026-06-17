"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Buscador" },
  { href: "/historico", label: "Histórico" },
  { href: "/clientes", label: "Clientes" },
];

function SunIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="4" />
      <line x1="12" y1="20" x2="12" y2="22" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="2" y1="12" x2="4" y2="12" />
      <line x1="20" y1="12" x2="22" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    setMounted(true);
  }, []);

  function toggleDark() {
    setDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("theme", next ? "dark" : "light");
      return next;
    });
  }

  return (
    <div className="flex min-h-screen flex-col bg-app-bg relative">
      {/* Header */}
      <header
        className="sticky top-0 z-30 border-b border-[var(--border)] bg-surface/90 backdrop-blur"
        style={{
          boxShadow: "var(--shadow-sm)",
        }}
      >
        {/* Línea superior naranja — solo en modo oscuro */}
        <div className="hidden dark:block h-px bg-gradient-to-r from-transparent via-[var(--brand)] to-transparent opacity-40" />

        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          {/* Logo/título */}
          <span className="shrink-0 text-sm font-semibold tracking-tight text-app-text">
            TGM{" "}
            <span className="font-normal text-app-muted">Pedidos</span>
          </span>

          {/* Nav */}
          <nav className="flex flex-1 flex-wrap gap-0.5">
            {NAV.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-brand text-white shadow-sm"
                      : "text-app-muted hover:bg-surface-2 hover:text-app-text"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Toggle dark mode */}
          <button
            onClick={toggleDark}
            aria-label={dark ? "Modo claro" : "Modo oscuro"}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-app-muted transition-all hover:bg-surface-2 hover:text-brand"
          >
            {mounted ? (dark ? <SunIcon /> : <MoonIcon />) : <MoonIcon />}
          </button>
        </div>
      </header>

      <main className="relative z-[1] mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
