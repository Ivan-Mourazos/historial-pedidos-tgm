"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Buscador" },
  { href: "/historico", label: "Histórico" },
  { href: "/clientes", label: "Clientes" },
  { href: "/tecnicos", label: "Técnicos" },
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

function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </svg>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [showBackTop, setShowBackTop] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setShowBackTop(window.scrollY > 360);
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function toggleDark() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  function scrollToTop() {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-app-bg">
      <a href="#contenido-principal" className="sr-only z-[100] rounded bg-surface px-3 py-2 text-app-text focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Saltar al contenido
      </a>
      {/* Header */}
      <header
        className="sticky top-0 z-30 border-b border-white/10 bg-surface/75 backdrop-blur-2xl"
        style={{
          boxShadow: "var(--shadow-sm)",
        }}
      >
        {/* Línea superior naranja — solo en modo oscuro */}
        <div className="hidden dark:block h-px bg-gradient-to-r from-transparent via-[var(--brand)] to-transparent opacity-40" />

        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2.5">
          {/* Logo */}
          <div
            aria-label="TGM Pedidos"
            className="-my-1.5 h-10 w-[140px] shrink-0 bg-[url('/tgm-pedidos-claro.PNG')] bg-contain bg-center bg-no-repeat dark:bg-[url('/rgm-pedidos-oscuro.PNG')]"
            role="img"
          />

          {/* Nav */}
          <nav className="flex flex-1 flex-wrap gap-1">
            {NAV.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-brand text-white shadow-sm"
                      : "text-app-muted hover:bg-surface-2/80 hover:text-app-text"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <Link
            href="/nuevo"
            className={`inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-colors ${
              pathname.startsWith("/nuevo")
                ? "border-orange-500 bg-brand text-white shadow-sm"
                : "border-orange-200/80 bg-orange-50/80 text-orange-700 shadow-sm ring-1 ring-black/5 hover:bg-orange-100 dark:border-orange-400/25 dark:bg-orange-400/10 dark:text-orange-200 dark:ring-white/10 dark:hover:border-orange-400/35 dark:hover:bg-orange-400/15"
            }`}
          >
            <PlusIcon />
            <span className="hidden sm:inline">Nuevo pedido</span>
          </Link>

          {/* Toggle dark mode */}
          <button
            onClick={toggleDark}
            aria-label="Cambiar tema claro u oscuro"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-app-muted transition-colors hover:bg-surface-2/80 hover:text-brand"
          >
            <span className="dark:hidden"><MoonIcon /></span>
            <span className="hidden dark:inline"><SunIcon /></span>
          </button>
        </div>
      </header>

      <main id="contenido-principal" className="relative z-[1] mx-auto w-full max-w-6xl flex-1 px-4 py-4">
        {children}
      </main>

      {showBackTop && (
        <button
          type="button"
          onClick={scrollToTop}
          aria-label="Volver arriba"
          title="Volver arriba"
          className="fixed bottom-5 right-5 z-40 inline-flex h-11 w-11 items-center justify-center rounded-full border border-orange-200 bg-white text-orange-700 shadow-lg shadow-slate-900/10 transition-[background-color,border-color,color,transform] hover:-translate-y-0.5 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-800 focus-visible:ring-2 focus-visible:ring-orange-400/40 dark:border-orange-400/25 dark:bg-slate-900 dark:text-orange-200 dark:shadow-black/40 dark:hover:border-orange-400/40 dark:hover:bg-orange-400/10 dark:hover:text-orange-100"
        >
          <ArrowUpIcon />
        </button>
      )}
    </div>
  );
}
