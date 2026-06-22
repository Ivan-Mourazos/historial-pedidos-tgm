"use client";

import { useState } from "react";

type Estado = "idle" | "opening" | "ok" | "error";

function CadIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 4h16v16H4z" />
      <path d="M8 8h8v8H8z" />
      <path d="M4 9h4" />
      <path d="M16 15h4" />
      <path d="M9 4v4" />
      <path d="M15 16v4" />
    </svg>
  );
}

export function AbrirZwcadButton({
  numeroPedido,
  label,
  className = "",
}: {
  numeroPedido: string;
  label?: string;
  className?: string;
}) {
  const [estado, setEstado] = useState<Estado>("idle");

  async function abrir() {
    if (estado === "opening") return;
    setEstado("opening");

    try {
      const res = await fetch("/api/zwcad/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numeroPedido }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "No se pudo abrir el DWG.");
      setEstado("ok");
      window.setTimeout(() => setEstado("idle"), 1400);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo abrir el DWG.";
      setEstado("error");
      window.alert(message);
      window.setTimeout(() => setEstado("idle"), 1800);
    }
  }

  const text = estado === "opening" ? "Abriendo..." : estado === "ok" ? "Abierto" : label;
  const title = `Abrir ${numeroPedido}.dwg en ZWCAD`;
  const baseClass = label
    ? "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-900 transition-colors hover:bg-blue-100 disabled:cursor-wait disabled:opacity-70 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200 dark:hover:border-sky-400/30 dark:hover:bg-sky-400/15"
    : "inline-flex h-7 w-7 items-center justify-center rounded-md text-app-muted transition-colors hover:bg-surface-2 hover:text-brand disabled:cursor-wait disabled:opacity-70";

  return (
    <button
      type="button"
      onClick={abrir}
      disabled={estado === "opening"}
      className={`${baseClass} ${className}`}
      title={title}
      aria-label={title}
    >
      <CadIcon />
      {label && <span>{text}</span>}
    </button>
  );
}
