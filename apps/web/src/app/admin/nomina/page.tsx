'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRol } from '@/lib/use-rol';
import { adminFetch } from '@/lib/admin-fetch';
import { formatPrecio } from '@/lib/formato';
import {
  diasDeLaSemana,
  etiquetaDia,
  fechaBogotaDesdeISO,
  formatearFechaCorta,
  hoyBogota,
  sumarDias,
} from '@/lib/semana';
import CargandoSkeleton from '@/components/CargandoSkeleton';

type Empleado = {
  id: string;
  nombre: string;
  apellido: string | null;
  cedula: string | null;
  cargo: string | null;
  telefono: string | null;
  correo: string | null;
  usuario_id: string | null;
  monto_semanal: number;
  dias_esperados_semana: number;
  activo: boolean;
};

function nombreCompleto(emp: Empleado) {
  return [emp.nombre, emp.apellido].filter(Boolean).join(' ');
}

type AsistenciaDia = { fecha: string; trabajo: boolean; motivo: string | null };
type Adelanto = {
  id: string;
  empleado_id: string;
  nomina_semana_id: string;
  monto: number;
  fecha: string;
  motivo: string | null;
};

type SemanaNomina = {
  id: string;
  empleado_id: string;
  semana_inicio: string;
  semana_fin: string;
  monto_base: number;
  dias_esperados: number;
  dias_trabajados: number;
  total_adelantos: number;
  neto_pagar: number;
  saldo_pendiente: number;
  estado: 'en_curso' | 'liquidada';
  liquidada_en: string | null;
  notas: string | null;
  asistencia: AsistenciaDia[];
  adelantos: Adelanto[];
};

type TableroFila = { empleado: Empleado; semana: SemanaNomina };

function estadoDia(semana: SemanaNomina, fecha: string): 'trabajo' | 'falta' | 'sin_marcar' {
  const fila = semana.asistencia.find((a) => a.fecha === fecha);
  if (!fila) return 'sin_marcar';
  return fila.trabajo ? 'trabajo' : 'falta';
}

function FilaTablero({ fila, onCambio }: { fila: TableroFila; onCambio: () => void }) {
  const { empleado, semana } = fila;
  const [formAdelanto, setFormAdelanto] = useState(false);
  const [monto, setMonto] = useState('');
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmandoLiquidar, setConfirmandoLiquidar] = useState(false);
  const [liquidando, setLiquidando] = useState(false);
  const [errorLiquidar, setErrorLiquidar] = useState<string | null>(null);

  const bloqueada = semana.estado === 'liquidada';
  const dias = diasDeLaSemana(semana.semana_inicio);

  async function alternarDia(fecha: string) {
    if (bloqueada) return;
    const trabajo = estadoDia(semana, fecha) !== 'trabajo';
    await adminFetch(`/nomina/semanas/${semana.id}/asistencia/${fecha}`, {
      method: 'PUT',
      body: JSON.stringify({ trabajo }),
    });
    onCambio();
  }

  async function agregarAdelanto(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const res = await adminFetch('/nomina/adelantos', {
        method: 'POST',
        body: JSON.stringify({
          empleado_id: empleado.id,
          monto: Number(monto),
          fecha: hoyBogota(),
          motivo: motivo || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? 'No se pudo registrar el adelanto.');
      }
      setMonto('');
      setMotivo('');
      setFormAdelanto(false);
      onCambio();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el adelanto.');
    } finally {
      setEnviando(false);
    }
  }

  async function eliminarAdelanto(id: string) {
    await adminFetch(`/nomina/adelantos/${id}`, { method: 'DELETE' });
    onCambio();
  }

  async function confirmarLiquidar() {
    setErrorLiquidar(null);
    setLiquidando(true);
    try {
      const res = await adminFetch(`/nomina/semanas/${semana.id}/liquidar`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? 'No se pudo liquidar la semana.');
      }
      setConfirmandoLiquidar(false);
      onCambio();
    } catch (err) {
      setErrorLiquidar(err instanceof Error ? err.message : 'No se pudo liquidar la semana.');
    } finally {
      setLiquidando(false);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium text-zinc-900 dark:text-zinc-50">
            {nombreCompleto(empleado)}
            {empleado.telefono && (
              <a
                href={`tel:${empleado.telefono}`}
                className="ml-2 text-xs font-normal text-brand-orange hover:underline"
              >
                {empleado.telefono}
              </a>
            )}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {empleado.cargo && `${empleado.cargo} · `}
            {formatPrecio(empleado.monto_semanal)}/semana · {semana.dias_esperados} días esperados
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {formatPrecio(semana.neto_pagar)}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {semana.dias_trabajados}/{semana.dias_esperados} días · adelantos {formatPrecio(semana.total_adelantos)}
          </p>
        </div>
      </div>

      {semana.saldo_pendiente > 0 && (
        <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
          Los adelantos superan lo ganado por {formatPrecio(semana.saldo_pendiente)}.
        </p>
      )}

      <div className="mt-3 flex gap-1.5">
        {dias.map((fecha, i) => {
          const estado = estadoDia(semana, fecha);
          return (
            <button
              key={fecha}
              type="button"
              disabled={bloqueada}
              onClick={() => alternarDia(fecha)}
              title={formatearFechaCorta(fecha)}
              className={`flex h-11 w-9 flex-col items-center justify-center rounded-md text-xs font-semibold transition-colors disabled:cursor-not-allowed ${
                estado === 'trabajo'
                  ? 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400'
                  : estado === 'falta'
                    ? 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400'
                    : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-600'
              }`}
            >
              <span>{etiquetaDia(i)}</span>
              <span className="text-[10px] font-normal opacity-70">{Number(fecha.slice(8, 10))}</span>
            </button>
          );
        })}
      </div>
      {!bloqueada && (
        <p className="mt-1.5 text-xs text-zinc-400 dark:text-zinc-500">
          Tocá un día para marcarlo: verde = trabajó, rojo = no trabajó, gris = sin marcar.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {semana.adelantos.map((a) => (
          <span
            key={a.id}
            className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
          >
            {formatPrecio(a.monto)}
            {a.motivo && ` · ${a.motivo}`}
            {!bloqueada && (
              <button
                type="button"
                onClick={() => eliminarAdelanto(a.id)}
                aria-label="Eliminar adelanto"
                className="text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
              >
                ×
              </button>
            )}
          </span>
        ))}
        {!bloqueada && (
          <button
            type="button"
            onClick={() => setFormAdelanto((v) => !v)}
            className="text-xs font-medium text-brand-orange hover:underline"
          >
            {formAdelanto ? 'Cancelar' : '+ Adelanto'}
          </button>
        )}
      </div>

      {formAdelanto && (
        <form onSubmit={agregarAdelanto} className="mt-2 flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-xs font-medium">Monto</label>
            <input
              required
              type="number"
              min="1"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="mt-1 w-32 rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium">Motivo (opcional)</label>
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="mt-1 w-48 rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <button
            type="submit"
            disabled={enviando}
            className="rounded-md bg-brand-orange px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            Registrar
          </button>
          {error && <p className="w-full text-xs text-red-600 dark:text-red-400">{error}</p>}
        </form>
      )}

      <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
        {bloqueada ? (
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Liquidada {semana.liquidada_en && `el ${formatearFechaCorta(fechaBogotaDesdeISO(semana.liquidada_en))}`}
          </p>
        ) : confirmandoLiquidar ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
            <p className="text-sm text-amber-900 dark:text-amber-300">
              ¿Liquidar la semana de <strong>{nombreCompleto(empleado)}</strong> por{' '}
              <strong>{formatPrecio(semana.neto_pagar)}</strong>? Después de liquidar no se puede editar la
              asistencia ni los adelantos de esta semana.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={confirmarLiquidar}
                disabled={liquidando}
                className="rounded-md bg-brand-orange px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {liquidando ? 'Liquidando…' : 'Confirmar liquidación'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmandoLiquidar(false)}
                disabled={liquidando}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
            </div>
            {errorLiquidar && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">{errorLiquidar}</p>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmandoLiquidar(true)}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Liquidar semana
          </button>
        )}
      </div>
    </div>
  );
}

function TableroAdmin() {
  const [semanaAncla, setSemanaAncla] = useState(hoyBogota);
  const [filas, setFilas] = useState<TableroFila[]>([]);
  const [cargando, setCargando] = useState(true);

  async function cargar() {
    setCargando(true);
    const res = await adminFetch(`/nomina/tablero?semana_inicio=${semanaAncla}`);
    if (res.ok) setFilas(await res.json());
    setCargando(false);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semanaAncla]);

  const rango =
    filas.length > 0
      ? `${formatearFechaCorta(filas[0].semana.semana_inicio)} – ${formatearFechaCorta(filas[0].semana.semana_fin)}`
      : '';

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">Nómina</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Liquidación semanal de trabajadores</p>
        </div>
        <Link
          href="/admin/nomina/empleados"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Trabajadores
        </Link>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setSemanaAncla((s) => sumarDias(s, -7))}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
        >
          ← Semana anterior
        </button>
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{rango}</span>
        <button
          type="button"
          onClick={() => setSemanaAncla((s) => sumarDias(s, 7))}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
        >
          Semana siguiente →
        </button>
      </div>

      <div className="mt-6 space-y-3">
        {cargando ? (
          <CargandoSkeleton filas={3} />
        ) : filas.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No hay trabajadores activos.{' '}
            <Link href="/admin/nomina/empleados" className="text-brand-orange hover:underline">
              Registrar uno
            </Link>
            .
          </p>
        ) : (
          filas.map((fila) => <FilaTablero key={fila.empleado.id} fila={fila} onCambio={cargar} />)
        )}
      </div>
    </div>
  );
}

function MiNomina() {
  const [semanaActual, setSemanaActual] = useState<SemanaNomina | null | undefined>(undefined);
  const [historico, setHistorico] = useState<SemanaNomina[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargar() {
      const [resActual, resHistorico] = await Promise.all([
        adminFetch('/nomina/mi-semana'),
        adminFetch('/nomina/mi-historico'),
      ]);
      if (resActual.ok) {
        const body = await resActual.json();
        setSemanaActual(body.semana);
      }
      if (resHistorico.ok) setHistorico(await resHistorico.json());
      setCargando(false);
    }
    cargar();
  }, []);

  if (cargando) {
    return (
      <div className="p-8">
        <CargandoSkeleton filas={3} />
      </div>
    );
  }

  if (semanaActual === null) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">Mi nómina</h1>
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          Todavía no tenés una nómina registrada. Hablá con administración.
        </p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">Mi nómina</h1>

      {semanaActual && (
        <div className="mt-6 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
          <p className="text-xs font-semibold tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
            Semana actual · {formatearFechaCorta(semanaActual.semana_inicio)} –{' '}
            {formatearFechaCorta(semanaActual.semana_fin)}
          </p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
            {formatPrecio(semanaActual.neto_pagar)}
          </p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {semanaActual.estado === 'en_curso'
              ? 'Estimado — se confirma el domingo.'
              : 'Liquidada'}{' '}
            · {semanaActual.dias_trabajados}/{semanaActual.dias_esperados} días · adelantos{' '}
            {formatPrecio(semanaActual.total_adelantos)}
          </p>
        </div>
      )}

      <h2 className="mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Historial</h2>
      {historico.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Todavía no hay semanas liquidadas.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {historico
            .filter((s) => s.estado === 'liquidada')
            .map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
              >
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  {formatearFechaCorta(s.semana_inicio)} – {formatearFechaCorta(s.semana_fin)}
                </span>
                <span className="font-medium text-zinc-900 dark:text-zinc-50">{formatPrecio(s.neto_pagar)}</span>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

export default function NominaPage() {
  const { rol } = useRol();
  if (rol === 'admin') return <TableroAdmin />;
  return <MiNomina />;
}
