"use client";

import { FAMILIA_PUERTAS, FAMILIA_REMOLQUES, type TipoPuerta, type Pedido } from "@/lib/types";
import { parseMedida, formatMedida } from "@/lib/normalize";
import { Button, Field, inputClass } from "./ui";

export interface CamposTecnicosValores {
  largo: string;
  ancho: string;
  alto: string;
  aguas: string;
  radio: string;
  tipo: string;
}

export const camposTecnicosVacios: CamposTecnicosValores = {
  largo: "",
  ancho: "",
  alto: "",
  aguas: "",
  radio: "",
  tipo: "",
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

// Select de medidas con opciones en cascada desde la BD
function MedidaSelect({
  label,
  value,
  onChange,
  disponibles,
  hint,
  freeInput = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disponibles: number[];
  hint?: string;
  freeInput?: boolean;
}) {
  if (freeInput) {
    return (
      <Field label={label} hint={hint}>
        <input
          className={`${inputClass} tabular-nums`}
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ej. 250"
        />
      </Field>
    );
  }
  return (
    <Field label={label} hint={hint}>
      <select
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">—</option>
        {disponibles.map((v) => {
          const fmt = formatMedida(v) || String(v);
          return (
            <option key={v} value={fmt}>
              {fmt}
            </option>
          );
        })}
      </select>
    </Field>
  );
}

export function CamposTecnicosFamilia({
  familiaNombre,
  valores,
  onChange,
  tiposPuerta,
  pedidosFamilia = [],
  inline = false,
  freeInput = false,
  onNuevoTipo,
  tiposRemolqueExtra = [],
}: {
  familiaNombre: string;
  valores: CamposTecnicosValores;
  onChange: (campo: keyof CamposTecnicosValores, valor: string) => void;
  tiposPuerta: TipoPuerta[];
  pedidosFamilia?: Pedido[];
  inline?: boolean;
  freeInput?: boolean;
  onNuevoTipo?: () => void;
  tiposRemolqueExtra?: string[];
}) {
  if (familiaNombre === FAMILIA_REMOLQUES) {
    const largoN = parseMedida(valores.largo);
    const anchoN = parseMedida(valores.ancho);
    const altoN  = parseMedida(valores.alto);

    const TIPOS_REMOLQUE_BASE = ["Baquetón", "Ganado", "Lona alta"];
    const tiposDisp = [...new Set([
      ...TIPOS_REMOLQUE_BASE,
      ...tiposRemolqueExtra,
      ...pedidosFamilia.map((p) => p.tipo).filter((t): t is string => !!t),
    ])].sort();

    const filtTipo   = valores.tipo.trim() ? pedidosFamilia.filter((p) => normStr(p.tipo) === normStr(valores.tipo)) : pedidosFamilia;
    const largosDisp = uniqueNums(filtTipo.map((p) => p.largo));

    const filt1      = largoN !== null ? filtTipo.filter((p) => eq(p.largo, largoN)) : filtTipo;
    const anchosDisp = uniqueNums(filt1.map((p) => p.ancho));

    const filt2     = anchoN !== null ? filt1.filter((p) => eq(p.ancho, anchoN)) : filt1;
    const altosDisp = uniqueNums(filt2.map((p) => p.alto));

    const filt3      = altoN !== null ? filt2.filter((p) => eq(p.alto, altoN)) : filt2;
    const aguasDisp  = uniqueNums(filt3.filter((p) => p.aguas !== null).map((p) => p.aguas));
    const radiosDisp = uniqueNums(filt3.filter((p) => p.radio !== null).map((p) => p.radio));

    const fields = (
      <>
        <div className={inline ? "min-w-[110px] flex-[2]" : ""}>
          <Field label="Tipo">
            {freeInput && onNuevoTipo ? (
              <div className="flex items-center gap-1">
                <select
                  className={`${inputClass} min-w-0 flex-1`}
                  value={valores.tipo}
                  onChange={(e) => onChange("tipo", e.target.value)}
                >
                  <option value="">— Tipo —</option>
                  {tiposDisp.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <Button variant="secondary" onClick={onNuevoTipo}>+</Button>
              </div>
            ) : (
              <select
                className={inputClass}
                value={valores.tipo}
                onChange={(e) => onChange("tipo", e.target.value)}
              >
                <option value="">{freeInput ? "— Tipo —" : "— Todos —"}</option>
                {tiposDisp.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <div className={inline ? "min-w-[80px] flex-1" : ""}>
          <MedidaSelect label="Largo"  value={valores.largo} onChange={(v) => onChange("largo", v)} disponibles={largosDisp} freeInput={freeInput} />
        </div>
        <div className={inline ? "min-w-[80px] flex-1" : ""}>
          <MedidaSelect label="Ancho"  value={valores.ancho} onChange={(v) => onChange("ancho", v)} disponibles={anchosDisp} freeInput={freeInput} />
        </div>
        <div className={inline ? "min-w-[80px] flex-1" : ""}>
          <MedidaSelect label="Altura" value={valores.alto}  onChange={(v) => onChange("alto",  v)} disponibles={altosDisp}  freeInput={freeInput} />
        </div>
        <div className={inline ? "min-w-[72px] flex-1" : ""}>
          <MedidaSelect label="Aguas"  value={valores.aguas} onChange={(v) => onChange("aguas", v)} disponibles={aguasDisp}  hint={inline ? undefined : "Opcional"} freeInput={freeInput} />
        </div>
        <div className={inline ? "min-w-[72px] flex-1" : ""}>
          <MedidaSelect label="Radio"  value={valores.radio} onChange={(v) => onChange("radio", v)} disponibles={radiosDisp} hint={inline ? undefined : "Opcional"} freeInput={freeInput} />
        </div>
      </>
    );

    if (inline) return fields;
    return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{fields}</div>;
  }

  if (familiaNombre === FAMILIA_PUERTAS) {
    const filt1      = valores.tipo ? pedidosFamilia.filter((p) => normStr(p.tipo) === normStr(valores.tipo)) : pedidosFamilia;
    const anchosDisp = uniqueNums(filt1.map((p) => p.ancho));

    const anchoN    = parseMedida(valores.ancho);
    const filt2     = anchoN !== null ? filt1.filter((p) => eq(p.ancho, anchoN)) : filt1;
    const altosDisp = uniqueNums(filt2.map((p) => p.alto));

    const fields = (
      <>
        <div className={inline ? "min-w-[130px] flex-[2]" : ""}>
          <Field label="Tipo">
            {freeInput && onNuevoTipo ? (
              <div className="flex items-center gap-1">
                <select
                  className={`${inputClass} min-w-0 flex-1`}
                  value={valores.tipo}
                  onChange={(e) => onChange("tipo", e.target.value)}
                >
                  <option value="">— Tipo —</option>
                  {tiposPuerta.map((t) => (
                    <option key={t.id} value={t.nombre}>{t.nombre}</option>
                  ))}
                </select>
                <Button variant="secondary" onClick={onNuevoTipo}>+</Button>
              </div>
            ) : (
              <select
                className={inputClass}
                value={valores.tipo}
                onChange={(e) => onChange("tipo", e.target.value)}
              >
                <option value="">— Tipo —</option>
                {tiposPuerta.map((t) => (
                  <option key={t.id} value={t.nombre}>{t.nombre}</option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <div className={inline ? "min-w-[80px] flex-1" : ""}>
          <MedidaSelect label="Ancho" value={valores.ancho} onChange={(v) => onChange("ancho", v)} disponibles={anchosDisp} freeInput={freeInput} />
        </div>
        <div className={inline ? "min-w-[80px] flex-1" : ""}>
          <MedidaSelect label="Alto"  value={valores.alto}  onChange={(v) => onChange("alto",  v)} disponibles={altosDisp}  freeInput={freeInput} />
        </div>
      </>
    );

    if (inline) return fields;
    return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{fields}</div>;
  }

  return null;
}
