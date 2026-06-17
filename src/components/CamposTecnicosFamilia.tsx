"use client";

import { FAMILIA_PUERTAS, FAMILIA_REMOLQUES, type TipoPuerta } from "@/lib/types";
import { esMedidaValida } from "@/lib/normalize";
import { Field, inputClass } from "./ui";

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

function MedidaInput({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  const invalido = value !== "" && !esMedidaValida(value);
  return (
    <Field label={label} hint={hint}>
      <input
        className={`${inputClass} ${invalido ? "!border-red-500 !focus:ring-red-500/20" : ""}`}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
      />
    </Field>
  );
}

export function CamposTecnicosFamilia({
  familiaNombre,
  valores,
  onChange,
  tiposPuerta,
}: {
  familiaNombre: string;
  valores: CamposTecnicosValores;
  onChange: (campo: keyof CamposTecnicosValores, valor: string) => void;
  tiposPuerta: TipoPuerta[];
}) {
  if (familiaNombre === FAMILIA_REMOLQUES) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <MedidaInput label="Largo" value={valores.largo} onChange={(v) => onChange("largo", v)} />
        <MedidaInput label="Ancho" value={valores.ancho} onChange={(v) => onChange("ancho", v)} />
        <MedidaInput label="Altura" value={valores.alto} onChange={(v) => onChange("alto", v)} />
        <MedidaInput
          label="Aguas (cm)"
          value={valores.aguas}
          onChange={(v) => onChange("aguas", v)}
          hint="Opcional — vacío solo coincide con vacío"
        />
        <MedidaInput
          label="Radio"
          value={valores.radio}
          onChange={(v) => onChange("radio", v)}
          hint="Opcional — vacío solo coincide con vacío"
        />
      </div>
    );
  }

  if (familiaNombre === FAMILIA_PUERTAS) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="Tipo">
          <select
            className={inputClass}
            value={valores.tipo}
            onChange={(e) => onChange("tipo", e.target.value)}
          >
            <option value="">— Selecciona tipo —</option>
            {tiposPuerta.map((t) => (
              <option key={t.id} value={t.nombre}>{t.nombre}</option>
            ))}
          </select>
        </Field>
        <MedidaInput label="Ancho" value={valores.ancho} onChange={(v) => onChange("ancho", v)} />
        <MedidaInput label="Alto" value={valores.alto} onChange={(v) => onChange("alto", v)} />
      </div>
    );
  }

  return null;
}
