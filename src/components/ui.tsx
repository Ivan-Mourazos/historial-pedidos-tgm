"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

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
      className={`rounded-[18px] border border-white/10 bg-surface/80 p-3 shadow-[var(--shadow-sm)] ring-1 ring-black/5 backdrop-blur-xl dark:bg-slate-950/50 dark:ring-white/10 ${className}`}
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
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-app-text">{title}</h1>
        {subtitle && (
          <p className="mt-0.5 text-xs text-app-muted">{subtitle}</p>
        )}
      </div>
      {actions}
    </div>
  );
}

export const inputClass =
  "h-9 w-full rounded-[12px] border border-white/10 bg-[var(--input-bg)] px-2.5 py-1.5 text-sm text-app-text outline-none ring-1 ring-black/5 transition-colors placeholder:text-app-muted focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-glow)] dark:ring-white/10";

export const labelClass =
  "mb-1 block text-xs font-medium text-app-text";

export const modalOverlayClass =
  "fixed inset-0 z-50 overflow-y-auto bg-black/35 p-3 backdrop-blur-xl dark:bg-black/45";

export const modalPanelClass =
  "w-full rounded-[18px] border border-white/10 bg-surface/95 shadow-2xl ring-1 ring-black/5 backdrop-blur-2xl dark:bg-slate-950/90 dark:ring-white/10";

export const modalCompactClass =
  "[&_input]:h-9 [&_input]:rounded-[10px] [&_input]:px-2.5 [&_input]:py-1.5 [&_select]:h-9 [&_select]:rounded-[10px] [&_select]:px-2.5 [&_select]:py-1.5 [&_textarea]:rounded-[10px] [&_textarea]:px-2.5 [&_textarea]:py-2 [&_label>span:first-child]:mb-1 [&_label>span:first-child]:text-xs [&_label>span:first-child]:font-medium";

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

export interface SelectOption {
  value: string;
  label: string;
}

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function useFloatingMenuStyle(
  open: boolean,
  anchorRef: React.RefObject<HTMLElement | null>,
  menuWidth?: number,
  menuHeight = 256,
) {
  const [style, setStyle] = useState<CSSProperties | null>(null);

  const update = useCallback(() => {
    if (!open || typeof window === "undefined") return;
    const anchor = anchorRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const gap = 6;
    const margin = 8;
    const width = menuWidth ?? rect.width;
    const spaceBelow = window.innerHeight - rect.bottom - margin - gap;
    const spaceAbove = rect.top - margin - gap;
    const placeAbove = spaceBelow < Math.min(menuHeight, 220) && spaceAbove > spaceBelow;
    const availableHeight = Math.max(120, placeAbove ? spaceAbove : spaceBelow);
    const maxHeight = Math.min(menuHeight, availableHeight);
    const left = Math.min(
      Math.max(rect.left, margin),
      Math.max(margin, window.innerWidth - width - margin),
    );
    const top = placeAbove
      ? Math.max(margin, rect.top - gap - maxHeight)
      : Math.min(rect.bottom + gap, window.innerHeight - margin - maxHeight);

    setStyle({
      left,
      maxHeight,
      position: "fixed",
      top,
      width,
      zIndex: 2147483647,
    });
  }, [anchorRef, menuHeight, menuWidth, open]);

  useEffect(() => {
    if (!open) {
      setStyle(null);
      return;
    }

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, update]);

  return style;
}

export function SelectControl({
  value,
  onChange,
  options,
  placeholder = "—",
  className = "",
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listboxId = useId();
  const selected = options.find((option) => option.value === value);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const menuStyle = useFloatingMenuStyle(open, ref);

  const openMenu = useCallback(() => {
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }, [selectedIndex]);

  const closeMenu = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (open && activeIndex >= 0) {
      optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, open]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        !ref.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    if (disabled || options.length === 0) return;
    const currentIndex = activeIndex >= 0 ? activeIndex : Math.max(selectedIndex, 0);

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) openMenu();
      else setActiveIndex((current) => event.key === "ArrowDown"
        ? Math.min(options.length - 1, Math.max(current, 0) + 1)
        : Math.max(0, current < 0 ? options.length - 1 : current - 1));
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      if (open) {
        event.preventDefault();
        setActiveIndex(event.key === "Home" ? 0 : options.length - 1);
      }
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!open) openMenu();
      else if (options[currentIndex]) {
        onChange(options[currentIndex].value);
        closeMenu();
      }
      return;
    }
    if (event.key === "Escape" && open) {
      event.preventDefault();
      closeMenu();
      return;
    }
    if (open && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const normalizedKey = event.key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-ES");
      const start = (currentIndex + 1) % options.length;
      const orderedOptions = options.slice(start).concat(options.slice(0, start));
      const matchOffset = orderedOptions.findIndex((option) =>
        option.label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-ES").startsWith(normalizedKey),
      );
      if (matchOffset >= 0) {
        event.preventDefault();
        setActiveIndex((start + matchOffset) % options.length);
      }
    }
  }, [activeIndex, closeMenu, disabled, onChange, open, openMenu, options, selectedIndex]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        className={`${inputClass} flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60`}
        onClick={() => !disabled && (open ? closeMenu() : openMenu())}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={open && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
      >
        <span className={`truncate ${selected ? "text-app-text" : "text-app-muted"}`}>
          {selected?.label ?? placeholder}
        </span>
        <span className={`shrink-0 text-app-muted transition-transform ${open ? "rotate-180" : ""}`}>
          <ChevronIcon />
        </span>
      </button>

      {open && menuStyle && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          id={listboxId}
          className="scrollbar-none overflow-y-auto rounded-[14px] border border-white/10 bg-white p-1 shadow-2xl ring-1 ring-black/5 dark:bg-[#080a12] dark:ring-white/10"
          role="listbox"
          aria-label={placeholder}
          onKeyDown={handleKeyDown}
          style={menuStyle}
        >
          {options.map((option, index) => {
            const active = option.value === value;
            const highlighted = index === activeIndex;
            return (
              <button
                key={`${option.value}-${option.label}`}
                id={`${listboxId}-option-${index}`}
                ref={(element) => { optionRefs.current[index] = element; }}
                type="button"
                className={`flex min-h-8 w-full items-center justify-between gap-2 rounded-[10px] px-2.5 py-1.5 text-left text-sm transition-colors ${
                  active
                    ? "bg-brand text-white"
                    : highlighted
                      ? "bg-surface-2/80 text-app-text"
                      : "text-app-text hover:bg-surface-2/80"
                }`}
                onClick={() => {
                  onChange(option.value);
                  closeMenu();
                }}
                role="option"
                aria-selected={active}
              >
                <span className="truncate">{option.label}</span>
                {active && <span className="text-xs">✓</span>}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}

function dateToInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

function formatDisplayDate(value: string): string {
  if (!value) return "dd/mm/aaaa";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

export function todayInputValue(): string {
  return dateToInputValue(new Date());
}

export function DatePicker({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedDate = value ? new Date(`${value}T00:00:00`) : new Date();
  const [visibleMonth, setVisibleMonth] = useState(
    new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
  );
  const menuStyle = useFloatingMenuStyle(open, ref, 286, 420);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        !ref.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const days = useMemo(() => {
    const firstDay = (visibleMonth.getDay() + 6) % 7;
    const start = new Date(visibleMonth);
    start.setDate(start.getDate() - firstDay);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [visibleMonth]);

  function moveMonth(delta: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        className={`${inputClass} flex items-center justify-between gap-2 text-left`}
        onClick={() => {
          if (value) {
            const date = new Date(`${value}T00:00:00`);
            setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
          }
          setOpen((current) => !current);
        }}
      >
        <span className={value ? "text-app-text" : "text-app-muted"}>
          {formatDisplayDate(value)}
        </span>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-app-muted">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </button>

      {open && menuStyle && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          className="scrollbar-none overflow-y-auto rounded-[16px] border border-white/10 bg-white p-2 shadow-2xl ring-1 ring-black/5 dark:bg-[#080a12] dark:ring-white/10"
          style={menuStyle}
        >
          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <button type="button" className="h-7 w-7 rounded-full text-app-muted hover:bg-surface-2" onClick={() => moveMonth(-1)}>‹</button>
            <p className="text-sm font-semibold capitalize text-app-text">{monthLabel(visibleMonth)}</p>
            <button type="button" className="h-7 w-7 rounded-full text-app-muted hover:bg-surface-2" onClick={() => moveMonth(1)}>›</button>
          </div>
          <div className="grid grid-cols-7 gap-1 px-1 pb-1 text-center text-[11px] font-medium text-app-muted">
            {["L", "M", "X", "J", "V", "S", "D"].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((date) => {
              const dayValue = dateToInputValue(date);
              const selected = dayValue === value;
              const today = dayValue === todayInputValue();
              const outside = date.getMonth() !== visibleMonth.getMonth();
              return (
                <button
                  key={dayValue}
                  type="button"
                  className={`h-8 rounded-full text-sm transition-colors ${
                    selected
                      ? "bg-brand text-white shadow-sm"
                      : outside
                        ? "text-app-muted/45 hover:bg-surface-2"
                        : today
                          ? "text-brand hover:bg-surface-2"
                          : "text-app-text hover:bg-surface-2"
                  }`}
                  onClick={() => {
                    onChange(dayValue);
                    setOpen(false);
                  }}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between border-t border-[var(--border)] pt-2">
            <button type="button" className="rounded-full px-2.5 py-1 text-xs text-app-muted hover:bg-surface-2" onClick={() => onChange("")}>Limpiar</button>
            <button type="button" className="rounded-full px-2.5 py-1 text-xs font-semibold text-brand hover:bg-surface-2" onClick={() => { onChange(todayInputValue()); setOpen(false); }}>Hoy</button>
          </div>
        </div>,
        document.body,
      )}
    </div>
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
      "border border-white/10 bg-surface-2/80 text-app-text shadow-sm ring-1 ring-black/5 hover:bg-[var(--border)] active:scale-[0.98] dark:ring-white/10",
    danger:
      "bg-red-600 text-white shadow-sm hover:bg-red-500 active:scale-[0.98]",
  };
  return (
    <button
      type={type}
      className={`inline-flex h-9 items-center justify-center rounded-[12px] px-3 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
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
    <div className={`rounded-[14px] border px-3 py-2 text-sm ${tones[tone]}`}>
      {children}
    </div>
  );
}
