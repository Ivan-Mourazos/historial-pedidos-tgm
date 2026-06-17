import type { ReactNode } from "react";

// Usando tokens CSS de globals.css (--surface, --border, etc.) para sincronía con RPS

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border bg-surface p-4 border-[var(--border)] shadow-[var(--shadow-sm)] ${className}`}
    >
      {children}
    </div>
  );
}

export function PageTitle({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-app-text">{title}</h1>
        {subtitle && (
          <p className="mt-0.5 text-sm text-app-muted">{subtitle}</p>
        )}
      </div>
      {actions}
    </div>
  );
}

export const inputClass =
  "w-full rounded-lg border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-app-text outline-none transition-colors placeholder:text-app-muted focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-glow)]";

export const labelClass =
  "mb-1.5 block text-sm font-medium text-app-text";

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
      {hint && (
        <span className="mt-1 block text-xs text-app-muted">{hint}</span>
      )}
    </label>
  );
}

type ButtonVariant = "primary" | "secondary" | "danger";

export function Button({
  children,
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: {
  children: ReactNode;
  variant?: ButtonVariant;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const variants: Record<ButtonVariant, string> = {
    primary:
      "bg-brand text-white shadow-sm hover:bg-[var(--brand-hover)] active:scale-[0.98]",
    secondary:
      "border border-[var(--border-strong)] bg-surface-2 text-app-text shadow-sm hover:bg-[var(--border)] active:scale-[0.98]",
    danger:
      "bg-red-600 text-white shadow-sm hover:bg-red-500 active:scale-[0.98]",
  };
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

type BannerTone = "info" | "success" | "warning" | "neutral";

export function Banner({
  tone = "info",
  children,
}: {
  tone?: BannerTone;
  children: ReactNode;
}) {
  const tones: Record<BannerTone, string> = {
    info:    "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
    warning: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
    neutral: "border-[var(--border-strong)] bg-surface-2 text-app-muted",
  };
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${tones[tone]}`}>
      {children}
    </div>
  );
}
