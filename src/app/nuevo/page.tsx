"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import { resumenMedidas } from "@/lib/display";
import {
  camposRequeridosCompletos,
  esCoincidenciaExacta,
} from "@/lib/matching";
import {
  camposTecnicosParaGuardar,
  construirCriterios,
} from "@/lib/pedido-helpers";
import {
  AVISO_FORMATO_PEDIDO,
  normalizarNumeroPedido,
  numeroPedidoEncajaFormato,
} from "@/lib/pedido-numero";
import type { Pedido } from "@/lib/types";
import { useCatalogos } from "@/lib/useCatalogos";

export default function NuevoPedidoPage() {
  const router = useRouter();
  const cat = useCatalogos();

  const [numero, setNumero] = useState("");
  const [familiaId, setFamiliaId] = useState("");
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [fecha, setFecha] = useState("");
  const [tecnicoId, setTecnicoId] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [valores, setValores] =
    useState<CamposTecnicosValores>(camposTecnicosVacios);

  const [pedidosCliente, setPedidosCliente] = useState<Pedido[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  // Confirmaciones explícitas: duplicado técnico y número ya existente.
  const [confirmarDuplicado, setConfirmarDuplicado] = useState(false);
  const [confirmarNumero, setConfirmarNumero] = useState(false);
  const [avisoNumero, setAvisoNumero] = useState<string | null>(null);

  const familia = cat.familias.find((f) => f.id === familiaId);
  const familiaNombre = familia?.nombre ?? "";

  useEffect(() => {
    if (!familiaId && cat.familias.length > 0) {
      setFamiliaId(cat.familias[0].id);
    }
  }, [cat.familias, familiaId]);

  useEffect(() => {
    setValores(camposTecnicosVacios);
    setConfirmarDuplicado(false);
    setConfirmarNumero(false);
    setAvisoNumero(null);
  }, [familiaId]);

  // Carga pedidos del cliente+familia para detectar duplicado técnico.
  useEffect(() => {
    if (!clienteId || !familiaId) {
      setPedidosCliente([]);
      return;
    }
    let activo = true;
    dbService
      .getPedidosPorClienteFamilia(clienteId, familiaId)
      .then((res) => activo && setPedidosCliente(res))
      .catch(() => activo && setPedidosCliente([]));
    return () => {
      activo = false;
    };
  }, [clienteId, familiaId]);

  const criterios = useMemo(
    () => construirCriterios(familiaNombre, clienteId, valores),
    [familiaNombre, clienteId, valores],
  );
  const completos = camposRequeridosCompletos(criterios);

  const duplicadoTecnico = useMemo(
    () =>
      completos
        ? pedidosCliente.find((p) => esCoincidenciaExacta(p, criterios)) ?? null
        : null,
    [completos, pedidosCliente, criterios],
  );

  const formatoNumeroOk =
    numero.trim() === "" || numeroPedidoEncajaFormato(numero);

  function setCampo(campo: keyof CamposTecnicosValores, valor: string) {
    setValores((v) => ({ ...v, [campo]: valor }));
    setConfirmarDuplicado(false);
  }

  const puedeGuardar =
    numero.trim() !== "" &&
    !!clienteId &&
    !!familiaId &&
    completos &&
    !guardando &&
    (!duplicadoTecnico || confirmarDuplicado) &&
    (!avisoNumero || confirmarNumero);

  async function guardar() {
    setError(null);
    setOkMsg(null);

    const numeroNorm = normalizarNumeroPedido(numero);

    // 1. Comprobar número de pedido ya existente (aviso, no bloqueo).
    if (!confirmarNumero) {
      try {
        const existeNumero = await dbService.getPedidoByNumero(numeroNorm);
        if (existeNumero) {
          setAvisoNumero(
            `El número ${numeroNorm} ya existe (mismo pedido con otra medida). Pulsa de nuevo para añadirlo igualmente.`,
          );
          setConfirmarNumero(true);
          setGuardando(false);
          return;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error comprobando el número");
        setGuardando(false);
        return;
      }
    }

    // 2. Comprobar duplicado técnico (ya calculado). Requiere confirmación.
    if (duplicadoTecnico && !confirmarDuplicado) {
      setConfirmarDuplicado(true);
      return;
    }

    setGuardando(true);
    try {
      const tecnicos = camposTecnicosParaGuardar(familiaNombre, valores);
      await dbService.createPedido({
        numero_pedido: numeroNorm,
        cliente_id: clienteId!,
        familia_id: familiaId,
        fecha: fecha || null,
        tecnico_id: tecnicoId || null,
        observaciones: observaciones.trim() || null,
        ...tecnicos,
      });
      setOkMsg(`Pedido ${numeroNorm} guardado correctamente.`);
      // Limpia el formulario salvo familia/cliente para encadenar altas.
      setNumero("");
      setValores(camposTecnicosVacios);
      setObservaciones("");
      setConfirmarDuplicado(false);
      setPedidosCliente(
        await dbService.getPedidosPorClienteFamilia(clienteId!, familiaId),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar el pedido");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <PageTitle
        title="Nuevo pedido"
        subtitle="Registra un pedido realizado. Se avisa si ya existe uno igual."
        actions={
          <Button variant="secondary" onClick={() => router.push("/historico")}>
            Ver histórico
          </Button>
        }
      />

      {cat.error && (
        <div className="mb-4">
          <Banner tone="warning">{cat.error}</Banner>
        </div>
      )}
      {error && (
        <div className="mb-4">
          <Banner tone="warning">{error}</Banner>
        </div>
      )}
      {okMsg && (
        <div className="mb-4">
          <Banner tone="success">{okMsg}</Banner>
        </div>
      )}

      <Card className="mb-5">
        <div className="space-y-4">
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-app-muted">
              Pedido y cliente
            </p>
            <div className="grid gap-3 lg:grid-cols-[minmax(190px,1fr)_minmax(170px,0.8fr)_minmax(260px,1.25fr)]">
              <Field
                label="Número de pedido *"
                hint={!formatoNumeroOk ? AVISO_FORMATO_PEDIDO : "Ej. AR2600000"}
              >
                <input
                  className={`${inputClass} font-mono ${
                    !formatoNumeroOk ? "border-amber-400" : ""
                  }`}
                  value={numero}
                  onChange={(e) => {
                    setNumero(e.target.value.toUpperCase());
                    setConfirmarNumero(false);
                    setAvisoNumero(null);
                  }}
                  placeholder="AR2600000"
                />
              </Field>
              <Field label="Familia *">
                <select
                  className={inputClass}
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
          </section>

          {familiaNombre && (
            <section className="border-t border-[var(--border)] pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-app-muted">
                Datos técnicos
              </p>
              <CamposTecnicosFamilia
                familiaNombre={familiaNombre}
                valores={valores}
                onChange={setCampo}
                tiposPuerta={cat.tiposPuerta}
                freeInput
              />
            </section>
          )}

          <section className="border-t border-[var(--border)] pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-app-muted">
              Planificación
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(170px,0.7fr)_minmax(220px,1fr)]">
              <Field label="Fecha">
                <input
                  type="date"
                  className={inputClass}
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </Field>
              <Field label="Técnico">
                <select
                  className={inputClass}
                  value={tecnicoId}
                  onChange={(e) => setTecnicoId(e.target.value)}
                >
                  <option value="">— Sin asignar —</option>
                  {cat.tecnicos.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </section>

          <section className="border-t border-[var(--border)] pt-4">
            <Field label="Observaciones">
              <textarea
                className={`${inputClass} min-h-16 resize-y`}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Notas opcionales"
              />
            </Field>
          </section>
        </div>
      </Card>

      {avisoNumero && (
        <div className="mb-4">
          <Banner tone="warning">{avisoNumero}</Banner>
        </div>
      )}

      {duplicadoTecnico && (
        <div className="mb-4">
          <Banner tone="warning">
            Ya existe un pedido técnicamente igual:{" "}
            <span className="font-mono font-semibold">
              {duplicadoTecnico.numero_pedido}
            </span>{" "}
            ({resumenMedidas(duplicadoTecnico, familiaNombre)}).
            {confirmarDuplicado
              ? " Pulsa de nuevo Guardar para registrarlo igualmente."
              : " Puedes guardarlo igualmente confirmando."}
          </Banner>
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={guardar} disabled={!puedeGuardar}>
          {guardando
            ? "Guardando…"
            : duplicadoTecnico && confirmarDuplicado
              ? "Guardar igualmente"
              : "Guardar pedido"}
        </Button>
      </div>
    </div>
  );
}
