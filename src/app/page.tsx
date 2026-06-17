"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CamposTecnicosFamilia,
  camposTecnicosVacios,
  type CamposTecnicosValores,
} from "@/components/CamposTecnicosFamilia";
import { ClienteSelect } from "@/components/ClienteSelect";
import {
  Banner,
  Button,
  Card,
  Field,
  PageTitle,
  inputClass,
} from "@/components/ui";
import { dbService } from "@/lib/db/db-service";
import { resumenMedidas, formatMedidaCm } from "@/lib/display";
import {
  buscarParecidos,
  camposRequeridosCompletos,
  esCoincidenciaExacta,
} from "@/lib/matching";
import { construirCriterios } from "@/lib/pedido-helpers";
import { FAMILIA_REMOLQUES, type Pedido } from "@/lib/types";
import { useCatalogos } from "@/lib/useCatalogos";

export default function BuscadorPage() {
  const cat = useCatalogos();

  const [familiaId, setFamiliaId] = useState<string>("");
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [valores, setValores] =
    useState<CamposTecnicosValores>(camposTecnicosVacios);

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargandoPedidos, setCargandoPedidos] = useState(false);

  const familia = cat.familias.find((f) => f.id === familiaId);
  const familiaNombre = familia?.nombre ?? "";

  // Selecciona la primera familia por defecto cuando cargan los catálogos.
  useEffect(() => {
    if (!familiaId && cat.familias.length > 0) {
      setFamiliaId(cat.familias[0].id);
    }
  }, [cat.familias, familiaId]);

  // Reinicia los campos técnicos al cambiar de familia.
  useEffect(() => {
    setValores(camposTecnicosVacios);
  }, [familiaId]);

  // Carga los pedidos del cliente + familia para comparar en memoria.
  useEffect(() => {
    if (!clienteId || !familiaId) {
      setPedidos([]);
      return;
    }
    let activo = true;
    setCargandoPedidos(true);
    dbService
      .getPedidosPorClienteFamilia(clienteId, familiaId)
      .then((res) => activo && setPedidos(res))
      .catch(() => activo && setPedidos([]))
      .finally(() => activo && setCargandoPedidos(false));
    return () => {
      activo = false;
    };
  }, [clienteId, familiaId]);

  const criterios = useMemo(
    () => construirCriterios(familiaNombre, clienteId, valores),
    [familiaNombre, clienteId, valores],
  );

  const completos = camposRequeridosCompletos(criterios);

  const exacto = useMemo(
    () =>
      completos
        ? pedidos.find((p) => esCoincidenciaExacta(p, criterios)) ?? null
        : null,
    [completos, pedidos, criterios],
  );

  const parecidos = useMemo(
    () => (exacto ? [] : buscarParecidos(pedidos, criterios)),
    [exacto, pedidos, criterios],
  );

  function setCampo(campo: keyof CamposTecnicosValores, valor: string) {
    setValores((v) => ({ ...v, [campo]: valor }));
  }

  return (
    <div>
      <PageTitle
        title="Buscador de pedidos"
        subtitle="Comprueba si ya existe un pedido exactamente igual antes de fabricar."
        actions={
          <Link href="/nuevo">
            <Button>+ Nuevo pedido</Button>
          </Link>
        }
      />

      {cat.error && (
        <div className="mb-4">
          <Banner tone="warning">{cat.error}</Banner>
        </div>
      )}

      <Card className="mb-5">
        <div className="grid gap-4">
          <div className="flex flex-wrap gap-4">
            <Field label="Familia">
              <select
                className={`${inputClass} max-w-xs`}
                value={familiaId}
                onChange={(e) => setFamiliaId(e.target.value)}
              >
                {cat.familias.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nombre}
                  </option>
                ))}
              </select>
            </Field>
            <ClienteSelect
              clientes={cat.clientes}
              value={clienteId}
              onChange={setClienteId}
              onClienteCreado={() => cat.recargarClientes()}
            />
          </div>

          {familiaNombre && (
            <CamposTecnicosFamilia
              familiaNombre={familiaNombre}
              valores={valores}
              onChange={setCampo}
              tiposPuerta={cat.tiposPuerta}
            />
          )}
        </div>
      </Card>

      {/* Estados del buscador */}
      <ResultadoBusqueda
        familiaNombre={familiaNombre}
        clienteId={clienteId}
        completos={completos}
        cargando={cargandoPedidos}
        exacto={exacto}
        parecidos={parecidos}
      />
    </div>
  );
}

function ResultadoBusqueda({
  familiaNombre,
  clienteId,
  completos,
  cargando,
  exacto,
  parecidos,
}: {
  familiaNombre: string;
  clienteId: string | null;
  completos: boolean;
  cargando: boolean;
  exacto: Pedido | null;
  parecidos: ReturnType<typeof buscarParecidos>;
}) {
  if (!clienteId || !familiaNombre) {
    return (
      <Banner tone="neutral">
        Selecciona familia y cliente, e introduce las medidas para comprobar
        coincidencia exacta.
      </Banner>
    );
  }

  if (!completos) {
    return (
      <Banner tone="neutral">
        Faltan datos para comprobar coincidencia exacta.
      </Banner>
    );
  }

  if (cargando) {
    return <Banner tone="neutral">Comprobando…</Banner>;
  }

  if (exacto) {
    return (
      <Card className="border-green-300 bg-green-50">
        <p className="text-base font-semibold text-green-800">
          Ya existe un pedido igual
        </p>
        <div className="mt-2 grid gap-1 text-sm text-green-900">
          <p>
            <span className="font-medium">Pedido:</span>{" "}
            <span className="font-mono text-base">{exacto.numero_pedido}</span>
          </p>
          <p>
            <span className="font-medium">Medidas:</span>{" "}
            {resumenMedidas(exacto, familiaNombre)}
          </p>
          {familiaNombre === FAMILIA_REMOLQUES ? (
            <p>
              <span className="font-medium">Aguas:</span>{" "}
              {formatMedidaCm(exacto.aguas)} ·{" "}
              <span className="font-medium">Radio:</span>{" "}
              {formatMedidaCm(exacto.radio)}
            </p>
          ) : (
            <p>
              <span className="font-medium">Tipo:</span> {exacto.tipo ?? "—"}
            </p>
          )}
        </div>
        <p className="mt-3 text-xs text-green-700">
          Usa el número de pedido para localizar el archivo DWG/ZWCAD
          ({exacto.numero_pedido}.dwg).
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-3">
      <Banner tone="info">No existe ningún pedido exactamente igual.</Banner>

      {parecidos.length > 0 && (
        <Card>
          <p className="mb-2 text-sm font-medium text-slate-700">
            Pedidos parecidos para revisar:
          </p>
          <ul className="grid gap-1.5 text-sm">
            {parecidos.map(({ pedido, diferencias }) => (
              <li
                key={pedido.id}
                className="flex flex-wrap items-center gap-x-2 border-b border-slate-100 pb-1.5 last:border-0"
              >
                <span className="font-mono text-slate-900">
                  {pedido.numero_pedido}
                </span>
                <span className="text-slate-400">—</span>
                <span>{resumenMedidas(pedido, familiaNombre)}</span>
                <span className="text-amber-700">
                  — {diferencias.join(", ")}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
