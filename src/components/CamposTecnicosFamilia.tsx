"use client";

import {
  FAMILIA_PUERTAS,
  FAMILIA_REMOLQUES,
  type Pedido,
  type TipoPuerta,
  type TipoRemolque,
} from "@/lib/types";
import { parseMedida, formatMedida } from "@/lib/normalize";
import { getFamiliaDefinition } from "@/lib/familias";
import { TIPOS_RECOGIDA_REMOLQUE, usaRecogidaRemolque } from "@/lib/recogida-remolque";
import {
  claveTipoRemolque,
  ordenarTiposRemolque,
  tipoRemolqueCanonico,
} from "@/lib/tipos-remolque";
import { Button, Field, SearchableSelect, SelectControl, inputClass } from "./ui";

export interface CamposTecnicosValores {
  largo: string;
  ancho: string;
  alto: string;
  altoDelante: string;
  altoAtras: string;
  aguas: string;
  radio: string;
  tipo: string;
  alturasDistintas: boolean;
  aguasActivas: boolean;
  impresionDigital: boolean;
  recogidaDelante: string;
  recogidaAtras: string;
  extra: Record<string, string | boolean>;
}

export const camposTecnicosVacios: CamposTecnicosValores = {
  largo: "",
  ancho: "",
  alto: "",
  altoDelante: "",
  altoAtras: "",
  aguas: "",
  radio: "",
  tipo: "",
  alturasDistintas: false,
  aguasActivas: false,
  impresionDigital: false,
  recogidaDelante: "",
  recogidaAtras: "",
  extra: {},
};

function r2(n: number | null): number | null {
  if (n === null) return null;
  return Math.round(n * 100) / 100;
}
function eq(a: number | null, b: number | null): boolean {
  return r2(a) === r2(b);
}
function uniqueNums(arr: (number | null)[]): number[] {
  return [...new Set(arr.filter((v): v is number => v !== null))].sort((a, b) => a - b);
}
function normStr(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const unique = new Map<string, string>();
  for (const value of values) {
    const clean = value?.trim();
    if (clean) unique.set(normStr(clean), clean);
  }
  return [...unique.values()].sort((a, b) => a.localeCompare(b, "es"));
}

function esBaqueton(tipo: string): boolean {
  return claveTipoRemolque(tipo) === "baqueton";
}

function pideRadioYAguas(tipo: string): boolean {
  const t = claveTipoRemolque(tipo);
  return t === "ganado" || t === "lona alta";
}

function tiposRemolqueDisponibles(valores: Array<string | null | undefined>): string[] {
  const porClave = new Map<string, string>();
  for (const valor of valores) {
    const limpio = tipoRemolqueCanonico(valor);
    if (!limpio) continue;
    porClave.set(claveTipoRemolque(limpio), limpio);
  }
  return [...porClave.values()].sort(ordenarTiposRemolque);
}

// Select de medidas con opciones en cascada desde la BD
function MedidaSelect({
  label,
  value,
  onChange,
  disponibles,
  hint,
  freeInput = false,
  searchInput = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disponibles: number[];
  hint?: string;
  freeInput?: boolean;
  searchInput?: boolean;
}) {
  if (searchInput) {
    return (
      <Field label={label} hint={hint}>
        <SearchableSelect
          value={value}
          onChange={onChange}
          placeholder="Buscar…"
          inputMode="decimal"
          options={disponibles.map((medida) => {
            const formatted = formatMedida(medida) || String(medida);
            return { value: formatted, label: formatted };
          })}
        />
      </Field>
    );
  }
  if (freeInput) {
    return (
      <Field label={label} hint={hint}>
        <div className="relative">
          <input
            className={`${inputClass} tabular-nums ${value ? "pr-8" : ""}`}
            inputMode="decimal"
            autoComplete="off"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Ej. 250"
          />
          {value && (
            <button
              type="button"
              aria-label={`Borrar ${label.toLocaleLowerCase("es-ES")}`}
              title="Borrar"
              className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-base text-app-muted hover:bg-surface-2 hover:text-app-text"
              onClick={() => onChange("")}
            >
              ×
            </button>
          )}
        </div>
      </Field>
    );
  }
  return (
    <Field label={label} hint={hint}>
      <SelectControl
        value={value}
        onChange={onChange}
        placeholder="—"
        options={[
          { value: "", label: "—" },
          ...disponibles.map((v) => {
            const fmt = formatMedida(v) || String(v);
            return { value: fmt, label: fmt };
          }),
        ]}
      />
    </Field>
  );
}

export function CamposTecnicosFamilia({
  familiaNombre,
  valores,
  onChange,
  tiposPuerta,
  tiposRemolque,
  pedidosFamilia = [],
  inline = false,
  freeInput = false,
  searchInput = false,
  onNuevoTipo,
  tiposRemolqueExtra = [],
}: {
  familiaNombre: string;
  valores: CamposTecnicosValores;
  onChange: (
    campo: keyof CamposTecnicosValores,
    valor: string | boolean | Record<string, string | boolean>,
  ) => void;
  tiposPuerta: TipoPuerta[];
  tiposRemolque?: TipoRemolque[];
  pedidosFamilia?: Pedido[];
  inline?: boolean;
  freeInput?: boolean;
  searchInput?: boolean;
  onNuevoTipo?: () => void;
  tiposRemolqueExtra?: string[];
}) {
  const editableInput = freeInput || searchInput;
  if (familiaNombre === FAMILIA_REMOLQUES) {
    const largoN = parseMedida(valores.largo);
    const anchoN = parseMedida(valores.ancho);
    const altoN  = parseMedida(valores.alto);
    const altoDelanteN = parseMedida(valores.altoDelante);
    const altoAtrasN = parseMedida(valores.altoAtras);
    const usarRadioYAguas = pideRadioYAguas(valores.tipo);
    const usarBaqueton = esBaqueton(valores.tipo);
    const usarRecogida = usaRecogidaRemolque(valores.tipo);

    const tiposDisp = tiposRemolqueDisponibles(editableInput
      ? [
          ...(tiposRemolque ?? []).map((t) => t.nombre),
          ...tiposRemolqueExtra,
          ...pedidosFamilia.map((p) => p.tipo),
        ]
      : pedidosFamilia.map((p) => p.tipo));

    const aguasN = valores.aguasActivas ? parseMedida(valores.aguas) : null;
    const radioN = parseMedida(valores.radio);
    type CampoRemolque = "tipo" | "largo" | "ancho" | "alto" | "alto_delante" | "alto_atras" | "aguas" | "radio";
    const compatiblesExcepto = (excepto: CampoRemolque) => pedidosFamilia.filter((p) => {
      if (excepto !== "tipo" && valores.tipo.trim() && claveTipoRemolque(p.tipo) !== claveTipoRemolque(valores.tipo)) return false;
      if (excepto !== "largo" && largoN !== null && !eq(p.largo, largoN)) return false;
      if (excepto !== "ancho" && anchoN !== null && !eq(p.ancho, anchoN)) return false;
      if (valores.alturasDistintas) {
        if (p.alto_delante === null || p.alto_atras === null) return false;
        if (excepto !== "alto_delante" && altoDelanteN !== null && !eq(p.alto_delante, altoDelanteN)) return false;
        if (excepto !== "alto_atras" && altoAtrasN !== null && !eq(p.alto_atras, altoAtrasN)) return false;
      } else {
        if (p.alto === null) return false;
        if (excepto !== "alto" && altoN !== null && !eq(p.alto, altoN)) return false;
      }
      if (usarRadioYAguas) {
        if (valores.aguasActivas && p.aguas === null) return false;
        if (!valores.aguasActivas && p.aguas !== null) return false;
      }
      if (excepto !== "aguas" && aguasN !== null && !eq(p.aguas, aguasN)) return false;
      if (excepto !== "radio" && radioN !== null && !eq(p.radio, radioN)) return false;
      return true;
    });

    const largosDisp = uniqueNums(compatiblesExcepto("largo").map((p) => p.largo));
    const anchosDisp = uniqueNums(compatiblesExcepto("ancho").map((p) => p.ancho));
    const altosDisp = uniqueNums(compatiblesExcepto("alto").map((p) => p.alto));
    const altosDelanteDisp = uniqueNums(compatiblesExcepto("alto_delante").map((p) => p.alto_delante));
    const altosAtrasDisp = uniqueNums(compatiblesExcepto("alto_atras").map((p) => p.alto_atras));
    const aguasDisp = uniqueNums(compatiblesExcepto("aguas").map((p) => p.aguas));
    const radiosDisp = uniqueNums(compatiblesExcepto("radio").map((p) => p.radio));
    const hayMedidaSeleccionada = largoN !== null || anchoN !== null || altoN !== null
      || altoDelanteN !== null || altoAtrasN !== null || aguasN !== null || radioN !== null;
    const tiposParaMostrar = !editableInput && hayMedidaSeleccionada
      ? tiposRemolqueDisponibles([
          ...compatiblesExcepto("tipo").map((p) => p.tipo),
        ])
      : tiposDisp;

    const fields = (
      <>
        <div className={inline ? "min-w-[110px] flex-[2]" : ""}>
          <Field label={freeInput ? "Tipo *" : "Tipo"}>
            {searchInput ? (
              <SearchableSelect
                value={valores.tipo}
                onChange={(value) => onChange("tipo", value)}
                placeholder="Buscar tipo…"
                options={tiposParaMostrar.map((tipo) => ({ value: tipo, label: tipo }))}
              />
            ) : freeInput && onNuevoTipo ? (
              <div className="flex items-center gap-1">
                <SelectControl
                  className="min-w-0 flex-1"
                  value={valores.tipo}
                  onChange={(value) => onChange("tipo", value)}
                  placeholder="— Tipo —"
                  options={[
                    { value: "", label: "— Tipo —" },
                    ...tiposParaMostrar.map((t) => ({ value: t, label: t })),
                  ]}
                />
                <Button variant="secondary" onClick={onNuevoTipo}>+</Button>
              </div>
            ) : (
              <SelectControl
                value={valores.tipo}
                onChange={(value) => onChange("tipo", value)}
                placeholder={freeInput ? "— Tipo —" : "— Todos —"}
                options={[
                  { value: "", label: freeInput ? "— Tipo —" : "— Todos —" },
                  ...tiposParaMostrar.map((t) => ({ value: t, label: t })),
                ]}
              />
            )}
          </Field>
        </div>
        <div className={inline ? "min-w-[80px] flex-1" : ""}>
          <MedidaSelect label={freeInput ? "Largo *" : "Largo"} value={valores.largo} onChange={(v) => onChange("largo", v)} disponibles={largosDisp} freeInput={freeInput} searchInput={searchInput} />
        </div>
        <div className={inline ? "min-w-[80px] flex-1" : ""}>
          <MedidaSelect label={freeInput ? "Ancho *" : "Ancho"} value={valores.ancho} onChange={(v) => onChange("ancho", v)} disponibles={anchosDisp} freeInput={freeInput} searchInput={searchInput} />
        </div>
        {!usarBaqueton && (
          <div className={inline ? "min-w-[130px] flex-[1.3]" : ""}>
            <Field label="Formato de altura">
              <SelectControl
                value={valores.alturasDistintas ? "dos" : "una"}
                onChange={(value) => {
                  const distintas = value === "dos";
                  onChange("alturasDistintas", distintas);
                  onChange("alto", "");
                  onChange("altoDelante", "");
                  onChange("altoAtras", "");
                }}
                options={[
                  { value: "una", label: "Altura única" },
                  { value: "dos", label: "Delante / detrás" },
                ]}
              />
            </Field>
          </div>
        )}
        {valores.alturasDistintas && !usarBaqueton ? (
          <>
            <div className={inline ? "min-w-[95px] flex-1" : ""}>
              <MedidaSelect label={`Alto delante${freeInput ? " *" : ""}`} value={valores.altoDelante} onChange={(v) => onChange("altoDelante", v)} disponibles={altosDelanteDisp} freeInput={freeInput} searchInput={searchInput} />
            </div>
            <div className={inline ? "min-w-[95px] flex-1" : ""}>
              <MedidaSelect label={`Alto detrás${freeInput ? " *" : ""}`} value={valores.altoAtras} onChange={(v) => onChange("altoAtras", v)} disponibles={altosAtrasDisp} freeInput={freeInput} searchInput={searchInput} />
            </div>
          </>
        ) : (
          <div className={inline ? "min-w-[80px] flex-1" : ""}>
            <MedidaSelect label={`${usarBaqueton ? "Baquetón (alto)" : "Altura"}${freeInput ? " *" : ""}`} value={valores.alto} onChange={(v) => onChange("alto", v)} disponibles={altosDisp} freeInput={freeInput} searchInput={searchInput} />
          </div>
        )}
        {usarRadioYAguas && (
          <>
            <div className={inline ? "min-w-[72px] flex-1" : ""}>
              <MedidaSelect label="Radio (opcional)" value={valores.radio} onChange={(v) => onChange("radio", v)} disponibles={radiosDisp} freeInput={freeInput} searchInput={searchInput} />
            </div>
            <div className={inline ? "min-w-[92px] flex-1" : ""}>
              <Field label="Aguas">
                <SelectControl
                  value={valores.aguasActivas ? "si" : "no"}
                  onChange={(value) => {
                    const activo = value === "si";
                    onChange("aguasActivas", activo);
                    if (!activo) onChange("aguas", "");
                  }}
                  options={[
                    { value: "no", label: "No" },
                    { value: "si", label: "Sí" },
                  ]}
                />
              </Field>
            </div>
            {valores.aguasActivas && (
              <div className={inline ? "min-w-[72px] flex-1" : ""}>
                <MedidaSelect label={freeInput ? "Nº aguas *" : "Nº aguas"} value={valores.aguas} onChange={(v) => onChange("aguas", v)} disponibles={aguasDisp} freeInput={freeInput} searchInput={searchInput} />
              </div>
            )}
          </>
        )}
        {usarRecogida && freeInput && (
          <>
            <div className={inline ? "min-w-[150px] flex-[2]" : ""}>
              <Field label="Recoge delante (opcional)">
                <SelectControl
                  value={valores.recogidaDelante}
                  onChange={(value) => onChange("recogidaDelante", value)}
                  placeholder="— Selecciona —"
                  options={TIPOS_RECOGIDA_REMOLQUE.map((value) => ({ value, label: value }))}
                />
              </Field>
            </div>
            <div className={inline ? "min-w-[150px] flex-[2]" : ""}>
              <Field label="Recoge atrás (opcional)">
                <SelectControl
                  value={valores.recogidaAtras}
                  onChange={(value) => onChange("recogidaAtras", value)}
                  placeholder="— Selecciona —"
                  options={TIPOS_RECOGIDA_REMOLQUE.map((value) => ({ value, label: value }))}
                />
              </Field>
            </div>
          </>
        )}
      </>
    );

    if (inline) return fields;
    return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{fields}</div>;
  }

  if (familiaNombre === FAMILIA_PUERTAS) {
    const anchoN    = parseMedida(valores.ancho);
    const altoN = parseMedida(valores.alto);
    const pedidosCompatiblesId = editableInput
      ? pedidosFamilia
      : pedidosFamilia.filter((p) => p.impresion_digital === valores.impresionDigital);
    const coincideTipo = (p: Pedido) => !valores.tipo || normStr(p.tipo) === normStr(valores.tipo);
    const anchosDisp = uniqueNums(pedidosCompatiblesId
      .filter((p) => coincideTipo(p) && (altoN === null || eq(p.alto, altoN)))
      .map((p) => p.ancho));
    const altosDisp = uniqueNums(pedidosCompatiblesId
      .filter((p) => coincideTipo(p) && (anchoN === null || eq(p.ancho, anchoN)))
      .map((p) => p.alto));
    const tiposPuertaBase = editableInput
      ? uniqueStrings(tiposPuerta.map((tipo) => tipo.nombre))
      : uniqueStrings(pedidosCompatiblesId.map((pedido) => pedido.tipo));
    const tiposPuertaFiltrados = !editableInput && (anchoN !== null || altoN !== null)
      ? tiposPuertaBase.filter((tipo) => pedidosCompatiblesId.some((p) =>
          normStr(p.tipo) === normStr(tipo)
          && (anchoN === null || eq(p.ancho, anchoN))
          && (altoN === null || eq(p.alto, altoN))))
      : tiposPuertaBase;

    const fields = (
      <>
        <div className={inline ? "min-w-[130px] flex-[2]" : ""}>
          <Field label={freeInput ? "Tipo *" : "Tipo"}>
            {searchInput ? (
              <SearchableSelect
                value={valores.tipo}
                onChange={(value) => onChange("tipo", value)}
                placeholder="Buscar tipo…"
                options={tiposPuertaFiltrados.map((tipo) => ({ value: tipo, label: tipo }))}
              />
            ) : freeInput && onNuevoTipo ? (
              <div className="flex items-center gap-1">
                <SelectControl
                  className="min-w-0 flex-1"
                  value={valores.tipo}
                  onChange={(value) => onChange("tipo", value)}
                  placeholder="— Tipo —"
                  options={[
                    { value: "", label: "— Tipo —" },
                    ...tiposPuertaFiltrados.map((tipo) => ({ value: tipo, label: tipo })),
                  ]}
                />
                <Button variant="secondary" onClick={onNuevoTipo}>+</Button>
              </div>
            ) : (
              <SelectControl
                value={valores.tipo}
                onChange={(value) => onChange("tipo", value)}
                placeholder="— Tipo —"
                options={[
                  { value: "", label: "— Tipo —" },
                  ...tiposPuertaFiltrados.map((tipo) => ({ value: tipo, label: tipo })),
                ]}
              />
            )}
          </Field>
        </div>
        <div className={inline ? "min-w-[80px] flex-1" : ""}>
          <MedidaSelect label={freeInput ? "Ancho *" : "Ancho"} value={valores.ancho} onChange={(v) => onChange("ancho", v)} disponibles={anchosDisp} freeInput={freeInput} searchInput={searchInput} />
        </div>
        <div className={inline ? "min-w-[80px] flex-1" : ""}>
          <MedidaSelect label={freeInput ? "Alto *" : "Alto"} value={valores.alto} onChange={(v) => onChange("alto", v)} disponibles={altosDisp} freeInput={freeInput} searchInput={searchInput} />
        </div>
        <div className={inline ? "min-w-[92px] flex-1" : ""}>
          <Field label="I.D.">
            <label className="flex h-9 items-center gap-2 rounded-[12px] border border-white/10 bg-[var(--input-bg)] px-2.5 text-sm text-app-text ring-1 ring-black/5 dark:ring-white/10">
              <input
                type="checkbox"
                checked={valores.impresionDigital}
                onChange={(e) => onChange("impresionDigital", e.target.checked)}
                className="h-4 w-4 accent-[var(--brand)]"
              />
              <span>ID</span>
            </label>
          </Field>
        </div>
      </>
    );

    if (inline) return fields;
    return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{fields}</div>;
  }

  const definition = getFamiliaDefinition(familiaNombre);
  if (definition.variante === "generic" && definition.campos.length > 0) {
    const fields = definition.campos.map((field) => {
      const value = valores.extra[field.key];
      const setValue = (next: string | boolean) => onChange("extra", {
        ...valores.extra,
        [field.key]: next,
      });
      return (
        <div key={field.key} className={inline ? "min-w-[120px] flex-1" : ""}>
          <Field label={`${field.label}${field.required ? " *" : ""}`} hint={field.unit}>
            {field.type === "boolean" ? (
              <label className="flex h-9 items-center gap-2 rounded-[12px] border border-white/10 bg-[var(--input-bg)] px-2.5 text-sm text-app-text ring-1 ring-black/5 dark:ring-white/10">
                <input
                  type="checkbox"
                  checked={value === true}
                  onChange={(event) => setValue(event.target.checked)}
                  className="h-4 w-4 accent-[var(--brand)]"
                />
                <span>{field.label}</span>
              </label>
            ) : (
              <input
                className={`${inputClass} ${field.type === "number" ? "tabular-nums" : ""}`}
                inputMode={field.type === "number" ? "decimal" : undefined}
                autoComplete="off"
                value={typeof value === "string" ? value : ""}
                onChange={(event) => setValue(event.target.value)}
                placeholder={field.type === "number" ? "Ej. 250" : `${field.label}…`}
              />
            )}
          </Field>
        </div>
      );
    });
    if (inline) return <>{fields}</>;
    return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{fields}</div>;
  }

  return null;
}
