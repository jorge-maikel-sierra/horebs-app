'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { IconPedidos } from '@/components/admin-iconos';
import AvisoFlotante from '@/components/AvisoFlotante';
import ModalConfirmar from '@/components/ModalConfirmar';
import DatosContacto, {
  type ErroresCliente,
  type FormCliente,
} from '@/components/clientes/detalle/DatosContacto';
import EncabezadoCliente from '@/components/clientes/detalle/EncabezadoCliente';
import HistorialPedidos from '@/components/clientes/detalle/HistorialPedidos';
import PuntosCliente from '@/components/clientes/detalle/PuntosCliente';
import { TarjetaKpi } from '@/components/informes/TarjetasResumen';
import { IconMoneda, IconReloj, IconTicket } from '@/components/panel/iconos';
import { adminFetch } from '@/lib/admin-fetch';
import {
  nombreCompleto,
  tiempoRelativo,
  type ClienteDetalle,
  type MovimientoPuntos,
  type PedidoCliente,
} from '@/lib/clientes-directorio';
import { formatFecha, formatPrecio } from '@/lib/formato';
import { hoyBogota } from '@/lib/semana';
import { useAviso } from '@/lib/use-aviso';
import { useRol } from '@/lib/use-rol';
import { leerErrorApi } from '@/lib/error-api';
import CargandoSkeleton from '@/components/CargandoSkeleton';

type Resultado = {
  id: string;
  cliente: ClienteDetalle | null;
  movimientos: MovimientoPuntos[];
  /** null = no se pudo cargar el historial. */
  pedidos: PedidoCliente[] | null;
};

const FORM_VACIO: FormCliente = {
  nombre: '',
  apellido: '',
  telefono: '',
  correo: '',
  cedula: '',
  direccion: '',
};

const leer = <T,>(ruta: string) =>
  adminFetch(ruta)
    .then((res) => (res.ok ? (res.json() as Promise<T>) : null))
    .catch(() => null);

export default function DetalleClientePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { rol } = useRol();
  const esAdmin = rol === 'admin';
  const { aviso, mostrar } = useAviso();
  const [hoy] = useState(hoyBogota);

  const [version, setVersion] = useState(0);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState<FormCliente>(FORM_VACIO);
  const [errores, setErrores] = useState<ErroresCliente>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const datosRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let vigente = true;
    Promise.all([
      leer<ClienteDetalle>(`/admin/clientes/${id}`),
      leer<MovimientoPuntos[]>(`/admin/clientes/${id}/movimientos-puntos`),
      leer<PedidoCliente[]>(`/admin/clientes/${id}/pedidos`),
    ]).then(([cliente, movimientos, pedidos]) => {
      if (vigente)
        setResultado({ id, cliente, movimientos: movimientos ?? [], pedidos });
    });
    return () => {
      vigente = false;
    };
  }, [id, version]);

  // Mientras llega otro cliente (cambio de ruta) no se muestra el anterior.
  const listo = resultado !== null && resultado.id === id;
  const cliente = listo ? resultado.cliente : null;

  function alternarEdicion() {
    if (editando) {
      setEditando(false);
      return;
    }
    if (!cliente) return;
    setForm({
      nombre: cliente.nombre,
      apellido: cliente.apellido ?? '',
      telefono: cliente.telefono ?? '',
      correo: cliente.correo ?? '',
      cedula: cliente.cedula ?? '',
      direccion: cliente.direccion ?? '',
    });
    setErrores({});
    setErrorGeneral(null);
    setEditando(true);
    // En móvil el formulario queda debajo del historial: se lleva a la vista.
    requestAnimationFrame(() =>
      datosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  }

  function cambiarCampo(clave: keyof FormCliente, valor: string) {
    setForm((f) => ({ ...f, [clave]: valor }));
    if (errores[clave]) setErrores((e) => ({ ...e, [clave]: undefined }));
  }

  async function guardarEdicion(e: FormEvent) {
    e.preventDefault();
    setErrorGeneral(null);
    if (!form.nombre.trim()) {
      setErrores({ nombre: 'El nombre no puede quedar vacío.' });
      return;
    }
    setErrores({});
    setGuardando(true);
    try {
      // Cadena vacía (no null) para borrar un dato: el API la convierte en null.
      const res = await adminFetch(`/admin/clientes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          nombre: form.nombre,
          apellido: form.apellido,
          telefono: form.telefono,
          direccion: form.direccion,
          correo: form.correo,
          cedula: form.cedula,
        }),
      });
      if (!res.ok) {
        const mensaje =
          await leerErrorApi(res, 'No se pudo guardar. Inténtalo de nuevo.');
        if (/tel[eé]fono/i.test(mensaje)) setErrores({ telefono: mensaje });
        else setErrorGeneral(mensaje);
        return;
      }
      setEditando(false);
      setVersion((v) => v + 1);
      mostrar('Datos guardados');
    } catch {
      setErrorGeneral('Sin conexión con el servidor. Inténtalo de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  async function ajustarPuntos(
    puntos: number,
    motivo: string,
  ): Promise<string | null> {
    try {
      const res = await adminFetch(`/admin/clientes/${id}/ajuste-puntos`, {
        method: 'POST',
        body: JSON.stringify({ puntos, motivo }),
      });
      if (!res.ok) {
        return await leerErrorApi(res, 'No se pudo registrar el ajuste.');
      }
      setVersion((v) => v + 1);
      mostrar('Ajuste de puntos registrado');
      return null;
    } catch {
      return 'Sin conexión con el servidor. Inténtalo de nuevo.';
    }
  }

  async function eliminar() {
    setEliminando(true);
    try {
      const res = await adminFetch(`/admin/clientes/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error(
          await leerErrorApi(res, 'No se pudo eliminar el cliente.'),
        );
      }
      router.push('/admin/clientes');
    } catch (err) {
      mostrar(
        err instanceof Error ? err.message : 'No se pudo eliminar el cliente.',
        true,
      );
      setEliminando(false);
      setConfirmarEliminar(false);
    }
  }

  if (!listo) {
    return (
      <div className="p-4 sm:p-6 lg:p-8" aria-busy="true">
        <CargandoSkeleton filas={5} />
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="card-gradient mx-auto mt-6 flex max-w-lg flex-col items-center rounded-3xl border border-dashed border-zinc-300 px-6 py-12 text-center dark:border-zinc-700">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            No encontramos este cliente
          </h1>
          <p className="mt-1.5 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
            Puede que lo hayan eliminado o que el enlace esté incompleto.
          </p>
          <Link
            href="/admin/clientes"
            className="btn-gradient btn-press mt-5 inline-flex h-11 items-center rounded-xl px-5 text-sm font-semibold text-white shadow-md shadow-brand-orange/25 outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
          >
            Volver a clientes
          </Link>
        </div>
      </div>
    );
  }

  const ticketPromedio =
    cliente.total_pedidos > 0
      ? Math.round(cliente.total_gastado / cliente.total_pedidos)
      : null;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <EncabezadoCliente
        cliente={cliente}
        hoy={hoy}
        esAdmin={esAdmin}
        editando={editando}
        onEditar={alternarEdicion}
        onEliminar={() => setConfirmarEliminar(true)}
      />

      <div className="animate-fade-up delay-1 mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <TarjetaKpi
          icono={<IconPedidos tamano={20} />}
          label="Pedidos"
          valor={String(cliente.total_pedidos)}
          detalle={
            cliente.total_pedidos === 0
              ? 'Todavía no compra'
              : 'Desde que es cliente'
          }
          tono="azul"
        />
        <TarjetaKpi
          icono={<IconMoneda />}
          label="Total gastado"
          valor={formatPrecio(cliente.total_gastado)}
          tono="naranja"
        />
        <TarjetaKpi
          icono={<IconTicket />}
          label="Ticket promedio"
          valor={ticketPromedio === null ? '—' : formatPrecio(ticketPromedio)}
          detalle="Gasto por pedido"
          tono="amarillo"
        />
        <TarjetaKpi
          icono={<IconReloj />}
          label="Último pedido"
          valor={
            cliente.ultimo_pedido
              ? tiempoRelativo(cliente.ultimo_pedido, hoy)
              : '—'
          }
          detalle={
            cliente.ultimo_pedido
              ? formatFecha(cliente.ultimo_pedido)
              : 'Sin pedidos'
          }
          tono="verde"
        />
      </div>

      <div className="animate-fade-up delay-2 mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <HistorialPedidos
          pedidos={resultado.pedidos}
          totalPedidos={cliente.total_pedidos}
        />

        <div className="min-w-0 space-y-4">
          <div ref={datosRef} className="scroll-mt-20">
            <DatosContacto
              cliente={cliente}
              editando={editando}
              form={form}
              errores={errores}
              errorGeneral={errorGeneral}
              guardando={guardando}
              onCambiar={cambiarCampo}
              onGuardar={guardarEdicion}
              onCancelar={() => setEditando(false)}
            />
          </div>
          <PuntosCliente
            cliente={cliente}
            movimientos={resultado.movimientos}
            esAdmin={esAdmin}
            onAjustar={ajustarPuntos}
          />
        </div>
      </div>

      {confirmarEliminar && (
        <ModalConfirmar
          titulo="¿Eliminar este cliente?"
          descripcion={
            <>
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {nombreCompleto(cliente)}
              </span>{' '}
              saldrá de la lista de clientes.
              {cliente.total_pedidos > 0 &&
                (cliente.total_pedidos === 1
                  ? ' Su pedido se conserva en los informes, pero sin vínculo al cliente.'
                  : ` Sus ${cliente.total_pedidos} pedidos se conservan en los informes, pero sin vínculo al cliente.`)}
              {cliente.puntos_actuales > 0 &&
                ` Perderá sus ${cliente.puntos_actuales} puntos.`}{' '}
              Esta acción no se puede deshacer.
            </>
          }
          textoConfirmar="Eliminar"
          peligro
          cargando={eliminando}
          onConfirmar={eliminar}
          onCancelar={() => setConfirmarEliminar(false)}
        />
      )}

      <AvisoFlotante aviso={aviso} />
    </div>
  );
}
