'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import RequireRol from '@/components/RequireRol';
import { adminFetch } from '@/lib/admin-fetch';
import { formatPrecio } from '@/lib/formato';
import { formatearFechaCorta } from '@/lib/semana';
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

type UsuarioStaff = {
  id: string;
  email: string;
  rol: 'admin' | 'empleado';
};

type SemanaHistorico = {
  id: string;
  semana_inicio: string;
  semana_fin: string;
  estado: 'en_curso' | 'liquidada';
  neto_pagar: number;
};

type FormEmpleado = {
  nombre: string;
  apellido: string;
  cedula: string;
  cargo: string;
  telefono: string;
  correo: string;
  usuario_id: string;
  monto_semanal: string;
  dias_esperados_semana: string;
};

const FORM_VACIO: FormEmpleado = {
  nombre: '',
  apellido: '',
  cedula: '',
  cargo: '',
  telefono: '',
  correo: '',
  usuario_id: '',
  monto_semanal: '',
  dias_esperados_semana: '6',
};

function nombreCompleto(emp: Empleado) {
  return [emp.nombre, emp.apellido].filter(Boolean).join(' ');
}

function CamposPersonalYPago({
  form,
  onChange,
  usuariosVinculables,
}: {
  form: FormEmpleado;
  onChange: (form: FormEmpleado) => void;
  usuariosVinculables: UsuarioStaff[];
}) {
  return (
    <>
      <div className="col-span-full">
        <p className="text-xs font-semibold tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
          Datos personales
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium">Nombre</label>
        <input
          required
          value={form.nombre}
          onChange={(e) => onChange({ ...form, nombre: e.target.value })}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Apellido</label>
        <input
          value={form.apellido}
          onChange={(e) => onChange({ ...form, apellido: e.target.value })}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Cédula</label>
        <input
          value={form.cedula}
          onChange={(e) => onChange({ ...form, cedula: e.target.value })}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Teléfono</label>
        <input
          type="tel"
          value={form.telefono}
          onChange={(e) => onChange({ ...form, telefono: e.target.value })}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Correo electrónico</label>
        <input
          type="email"
          value={form.correo}
          onChange={(e) => onChange({ ...form, correo: e.target.value })}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Cargo</label>
        <input
          value={form.cargo}
          onChange={(e) => onChange({ ...form, cargo: e.target.value })}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="col-span-full mt-2">
        <p className="text-xs font-semibold tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
          Datos de pago
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium">Monto semanal</label>
        <input
          required
          type="number"
          min="1"
          value={form.monto_semanal}
          onChange={(e) => onChange({ ...form, monto_semanal: e.target.value })}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Días esperados por semana</label>
        <input
          required
          type="number"
          min="1"
          max="7"
          value={form.dias_esperados_semana}
          onChange={(e) => onChange({ ...form, dias_esperados_semana: e.target.value })}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Cuenta del sistema</label>
        <select
          value={form.usuario_id}
          onChange={(e) => onChange({ ...form, usuario_id: e.target.value })}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Sin cuenta (no inicia sesión)</option>
          {usuariosVinculables.map((u) => (
            <option key={u.id} value={u.id}>
              {u.email} ({u.rol})
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

function FilaHistorial({ empleadoId }: { empleadoId: string }) {
  const [semanas, setSemanas] = useState<SemanaHistorico[] | null>(null);

  useEffect(() => {
    adminFetch(`/nomina/empleados/${empleadoId}/historico`)
      .then((res) => (res.ok ? res.json() : []))
      .then(setSemanas);
  }, [empleadoId]);

  const liquidadas = semanas?.filter((s) => s.estado === 'liquidada') ?? [];

  return (
    <div className="border-t border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
      {semanas === null ? (
        <p className="text-xs text-zinc-400">Cargando historial…</p>
      ) : liquidadas.length === 0 ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Todavía no hay semanas liquidadas.</p>
      ) : (
        <ul className="space-y-1">
          {liquidadas.map((s) => (
            <li key={s.id} className="flex items-center justify-between text-xs">
              <span className="text-zinc-600 dark:text-zinc-400">
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

function FilaEmpleado({
  emp,
  usuariosVinculables,
  onCambio,
}: {
  emp: Empleado;
  usuariosVinculables: UsuarioStaff[];
  onCambio: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const [form, setForm] = useState<FormEmpleado>(() => empleadoAForm(emp));
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  function abrirEdicion() {
    setForm(empleadoAForm(emp));
    setError(null);
    setEditando(true);
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const res = await adminFetch(`/nomina/empleados/${emp.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          nombre: form.nombre,
          apellido: form.apellido || undefined,
          cedula: form.cedula || undefined,
          cargo: form.cargo || undefined,
          telefono: form.telefono || undefined,
          correo: form.correo || undefined,
          usuario_id: form.usuario_id || null,
          monto_semanal: Number(form.monto_semanal),
          dias_esperados_semana: Number(form.dias_esperados_semana),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? 'No se pudo guardar el trabajador.');
      }
      setEditando(false);
      await onCambio();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el trabajador.');
    } finally {
      setEnviando(false);
    }
  }

  async function desactivar() {
    await adminFetch(`/nomina/empleados/${emp.id}/desactivar`, { method: 'POST' });
    await onCambio();
  }

  async function activar() {
    await adminFetch(`/nomina/empleados/${emp.id}/activar`, { method: 'POST' });
    await onCambio();
  }

  return (
    <li className={`rounded-lg border border-zinc-200 dark:border-zinc-800 ${emp.activo ? '' : 'opacity-60'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="min-w-0">
          <p className="font-medium text-zinc-900 dark:text-zinc-50">
            {nombreCompleto(emp)}
            {!emp.activo && ' (inactivo)'}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {emp.cargo && `${emp.cargo} · `}
            {formatPrecio(emp.monto_semanal)}/semana · {emp.dias_esperados_semana} días esperados
            {emp.usuario_id && ' · con cuenta en el sistema'}
          </p>
          {(emp.telefono || emp.correo) && (
            <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-brand-orange">
              {emp.telefono && (
                <a href={`tel:${emp.telefono}`} className="hover:underline">
                  {emp.telefono}
                </a>
              )}
              {emp.correo && (
                <a href={`mailto:${emp.correo}`} className="hover:underline">
                  {emp.correo}
                </a>
              )}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => setHistorialAbierto((v) => !v)}
            className="text-zinc-500 hover:underline dark:text-zinc-400"
          >
            {historialAbierto ? 'Ocultar historial' : 'Historial'}
          </button>
          <button type="button" onClick={abrirEdicion} className="text-zinc-500 hover:underline dark:text-zinc-400">
            Editar
          </button>
          {emp.activo ? (
            <button type="button" onClick={desactivar} className="text-red-600 hover:underline dark:text-red-400">
              Desactivar
            </button>
          ) : (
            <button type="button" onClick={activar} className="text-brand-orange hover:underline">
              Activar
            </button>
          )}
        </div>
      </div>

      {editando && (
        <form
          onSubmit={guardar}
          className="grid grid-cols-1 gap-3 border-t border-zinc-100 p-4 sm:grid-cols-2 lg:grid-cols-3 dark:border-zinc-800"
        >
          <CamposPersonalYPago form={form} onChange={setForm} usuariosVinculables={usuariosVinculables} />
          <div className="col-span-full flex items-center gap-3">
            <button
              type="submit"
              disabled={enviando}
              className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              Guardar cambios
            </button>
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancelar
            </button>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          </div>
        </form>
      )}

      {historialAbierto && <FilaHistorial empleadoId={emp.id} />}
    </li>
  );
}

function empleadoAForm(emp: Empleado): FormEmpleado {
  return {
    nombre: emp.nombre,
    apellido: emp.apellido ?? '',
    cedula: emp.cedula ?? '',
    cargo: emp.cargo ?? '',
    telefono: emp.telefono ?? '',
    correo: emp.correo ?? '',
    usuario_id: emp.usuario_id ?? '',
    monto_semanal: String(emp.monto_semanal),
    dias_esperados_semana: String(emp.dias_esperados_semana),
  };
}

function EmpleadosInterno() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioStaff[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState<FormEmpleado>(FORM_VACIO);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function cargar() {
    setCargando(true);
    const [resEmpleados, resUsuarios] = await Promise.all([
      adminFetch('/nomina/empleados'),
      adminFetch('/admin/usuarios'),
    ]);
    if (resEmpleados.ok) setEmpleados(await resEmpleados.json());
    if (resUsuarios.ok) setUsuarios(await resUsuarios.json());
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  const usuariosVinculables = usuarios.filter((u) => !empleados.some((e) => e.usuario_id === u.id));

  async function crear(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const res = await adminFetch('/nomina/empleados', {
        method: 'POST',
        body: JSON.stringify({
          nombre: form.nombre,
          apellido: form.apellido || undefined,
          cedula: form.cedula || undefined,
          cargo: form.cargo || undefined,
          telefono: form.telefono || undefined,
          correo: form.correo || undefined,
          usuario_id: form.usuario_id || undefined,
          monto_semanal: Number(form.monto_semanal),
          dias_esperados_semana: Number(form.dias_esperados_semana),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? 'No se pudo crear el trabajador.');
      }
      setForm(FORM_VACIO);
      setMostrarForm(false);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el trabajador.');
    } finally {
      setEnviando(false);
    }
  }

  const activos = empleados.filter((e) => e.activo);
  const inactivos = empleados.filter((e) => !e.activo);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link href="/admin/nomina" className="text-sm text-brand-orange hover:underline">
            ← Volver a nómina
          </Link>
          <h1 className="mt-1 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">Trabajadores</h1>
        </div>
        <button
          type="button"
          onClick={() => setMostrarForm((v) => !v)}
          className="rounded-lg bg-brand-orange px-4 py-2 font-semibold text-white hover:opacity-90"
        >
          {mostrarForm ? 'Cancelar' : '+ Nuevo trabajador'}
        </button>
      </div>

      {mostrarForm && (
        <form
          onSubmit={crear}
          className="mt-6 grid grid-cols-1 gap-3 rounded-lg border border-zinc-200 p-4 sm:grid-cols-2 lg:grid-cols-3 dark:border-zinc-800"
        >
          <CamposPersonalYPago form={form} onChange={setForm} usuariosVinculables={usuariosVinculables} />
          <div className="col-span-full flex items-center gap-3">
            <button
              type="submit"
              disabled={enviando}
              className="rounded-lg bg-brand-orange px-4 py-2 font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              Crear trabajador
            </button>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          </div>
        </form>
      )}

      <div className="mt-8 space-y-6">
        {cargando ? (
          <CargandoSkeleton filas={4} />
        ) : empleados.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Todavía no hay trabajadores registrados.</p>
        ) : (
          <>
            <ul className="space-y-2">
              {activos.map((emp) => (
                <FilaEmpleado key={emp.id} emp={emp} usuariosVinculables={usuariosVinculables} onCambio={cargar} />
              ))}
            </ul>
            {inactivos.length > 0 && (
              <div>
                <p className="text-xs font-semibold tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
                  Inactivos
                </p>
                <ul className="mt-2 space-y-2">
                  {inactivos.map((emp) => (
                    <FilaEmpleado
                      key={emp.id}
                      emp={emp}
                      usuariosVinculables={usuariosVinculables}
                      onCambio={cargar}
                    />
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function EmpleadosPage() {
  return (
    <RequireRol roles={['admin']}>
      <EmpleadosInterno />
    </RequireRol>
  );
}
