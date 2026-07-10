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
  DatePicker,
  Field,
  PageTitle,
  SelectControl,
  inputClass,
  todayInputValue,
} from "@/components/ui";
import { dbService } from "@/lib/db/db-service";
import { resumenMedidas } from "@/lib/display";
import { ordenarFamilias } from "@/lib/familias";
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
  const [fecha, setFecha] = useState(todayInputValue);
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
  const familiasOrdenadas = useMemo(() => ordenarFamilias(cat.familias), [cat.familias]);
  const [clienteIdsDeFamilia, setClienteIdsDeFamilia] = useState<string[] | null>(null);
  const clientesDeFamilia = useMemo(
    () =>
      clienteIdsDeFamilia === null
        ? []
        : cat.clientes.filter(
            (c) => clienteIdsDeFamilia.includes(c.id) || c.id === clienteId,
          ),
    [cat.clientes, clienteId, clienteIdsDeFamilia],
  );

  function cambiarFamilia(nextFamilyId: string) {
    setFamiliaId(nextFamilyId);
    setValores(camposTecnicosVacios);
    setConfirmarDuplicado(false);
    setConfirmarNumero(false);
    setAvisoNumero(null);
    setClienteId(null);
    setClienteIdsDeFamilia(null);
    setPedidosCliente([]);
  }

  function cambiarCliente(nextClientId: string | null) {
    setClienteId(nextClientId);
    setPedidosCliente([]);
  }

  useEffect(() => {
    if (!familiaId) return;
    let activo = true;
    dbService
      .getClienteIdsDeFamilia(familiaId)
      .then((ids) => activo && setClienteIdsDeFamilia(ids))
      .catch(() => activo && setClienteIdsDeFamilia([]));
    return () => {
      activo = false;
    };
  }, [familiaId]);

  // Carga pedidos del cliente+familia para detectar duplicado técnico.
  useEffect(() => {
    if (!clienteId || !familiaId) return;
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

  function setCampo(
    campo: keyof CamposTecnicosValores,
    valor: string | boolean | Record<string, string | boolean>,
  ) {
    setValores((v) => {
      const siguiente = { ...v, [campo]: valor } as CamposTecnicosValores;
      if (campo === "tipo") {
        siguiente.radio = "";
        siguiente.aguas = "";
        siguiente.aguasActivas = false;
      }
      return siguiente;
    });
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

      <Card className="mb-4">
        <Field label="¿Qué vas a registrar? *">
          <SelectControl
            value={familiaId}
            onChange={cambiarFamilia}
            placeholder="— Selecciona una familia —"
            options={familiasOrdenadas.map((family) => ({ value: family.id, label: family.nombre }))}
          />
        </Field>
      </Card>

      {familiaNombre && <Card className="mb-5">
        <div className="space-y-4">
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-app-muted">
              Pedido y cliente
            </p>
            <div className="grid gap-3 lg:grid-cols-[minmax(190px,0.8fr)_minmax(260px,1.25fr)]">
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
              <ClienteSelect
                clientes={clientesDeFamilia}
                value={clienteId}
                onChange={cambiarCliente}
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
                tiposRemolque={cat.tiposRemolque}
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
                <DatePicker value={fecha} onChange={setFecha} />
              </Field>
              <Field label="Técnico">
                <SelectControl
                  value={tecnicoId}
                  onChange={setTecnicoId}
                  placeholder="— Sin asignar —"
                  options={[
                    { value: "", label: "— Sin asignar —" },
                    ...cat.tecnicos.map((t) => ({ value: t.id, label: t.nombre })),
                  ]}
                />
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
      </Card>}

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

      {familiaNombre && <div className="flex gap-2">
        <Button onClick={guardar} disabled={!puedeGuardar}>
          {guardando
            ? "Guardando…"
            : duplicadoTecnico && confirmarDuplicado
              ? "Guardar igualmente"
              : "Guardar pedido"}
        </Button>
      </div>}
    </div>
  );
}
