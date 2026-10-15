'use client';

import { useId, type FormEvent, type ReactNode } from 'react';
import Campo from '@/components/formulario/Campo';
import { FOCO, TARJETA, claseCampo } from '@/components/formulario/estilos';
import type { ClienteDetalle } from '@/lib/clientes-directorio';
import { IconCorreo, IconId, IconPin, IconTelefono } from '../iconos';

export type FormCliente = {
  nombre: string;
  apellido: string;
  telefono: string;
  correo: string;
  cedula: string;
  direccion: string;
};

export type ErroresCliente = Partial<Record<keyof FormCliente, string>>;

const CAMPOS: {
  clave: keyof FormCliente;
  etiqueta: string;
  tipo?: string;
  ancho?: boolean;
}[] = [
  { clave: 'nombre', etiqueta: 'Nombre' },
  { clave: 'apellido', etiqueta: 'Apellido' },
  { clave: 'telefono', etiqueta: 'Teléfono', tipo: 'tel' },
  { clave: 'correo', etiqueta: 'Correo', tipo: 'email' },
  { clave: 'cedula', etiqueta: 'Cédula' },
  { clave: 'direccion', etiqueta: 'Dirección', ancho: true },
];

function Fila({
  icono,
  etiqueta,
  valor,
}: {
  icono: ReactNode;
  etiqueta: string;
  valor: string | null;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
        {icono}
      </span>
      <div className="min-w-0">
        <dt className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
          {etiqueta}
        </dt>
        <dd className="mt-0.5 text-sm font-medium [overflow-wrap:anywhere] text-zinc-900 dark:text-zinc-50">
          {valor ?? (
            <span className="font-normal text-zinc-400 dark:text-zinc-500">
              Sin registrar
            </span>
          )}
        </dd>
      </div>
    </div>
  );
}

export default function DatosContacto({
  cliente,
  editando,
  form,
  errores,
  errorGeneral,
  guardando,
  onCambiar,
  onGuardar,
  onCancelar,
}: {
  cliente: ClienteDetalle;
  editando: boolean;
  form: FormCliente;
  errores: ErroresCliente;
  errorGeneral: string | null;
  guardando: boolean;
  onCambiar: (clave: keyof FormCliente, valor: string) => void;
  onGuardar: (e: FormEvent) => void;
  onCancelar: () => void;
}) {
  const uid = useId();

  if (!editando) {
    return (
      <section className={TARJETA} aria-labelledby={`${uid}-titulo`}>
        <h2
          id={`${uid}-titulo`}
          className="font-semibold text-zinc-900 dark:text-zinc-50"
        >
          Datos de contacto
        </h2>
        <dl className="mt-1 divide-y divide-zinc-100 dark:divide-zinc-800/70">
          <Fila
            icono={<IconTelefono tamano={15} />}
            etiqueta="Teléfono"
            valor={cliente.telefono}
          />
          <Fila
            icono={<IconCorreo tamano={15} />}
            etiqueta="Correo"
            valor={cliente.correo}
          />
          <Fila
            icono={<IconId tamano={15} />}
            etiqueta="Cédula"
            valor={cliente.cedula}
          />
          <Fila
            icono={<IconPin tamano={15} />}
            etiqueta="Dirección"
            valor={cliente.direccion}
          />
        </dl>
      </section>
    );
  }

  return (
    <section className={TARJETA} aria-labelledby={`${uid}-titulo`}>
      <h2
        id={`${uid}-titulo`}
        className="font-semibold text-zinc-900 dark:text-zinc-50"
      >
        Editar datos
      </h2>
      <form
        onSubmit={onGuardar}
        noValidate
        className="animate-desplegar mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-1"
      >
        {CAMPOS.map((c) => {
          const id = `${uid}-${c.clave}`;
          return (
            <div
              key={c.clave}
              className={c.ancho ? 'sm:col-span-2 lg:col-span-1' : ''}
            >
              <Campo id={id} etiqueta={c.etiqueta} error={errores[c.clave]}>
                <input
                  id={id}
                  type={c.tipo ?? 'text'}
                  value={form[c.clave]}
                  autoComplete="off"
                  aria-invalid={Boolean(errores[c.clave])}
                  aria-describedby={
                    errores[c.clave] ? `${id}-error` : undefined
                  }
                  onChange={(e) => onCambiar(c.clave, e.target.value)}
                  className={claseCampo(Boolean(errores[c.clave]))}
                />
              </Campo>
            </div>
          );
        })}

        {errorGeneral && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700 sm:col-span-2 lg:col-span-1 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            {errorGeneral}
          </p>
        )}

        <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
          <button
            type="submit"
            disabled={guardando}
            className="btn-gradient btn-press h-11 flex-1 rounded-xl px-5 text-sm font-semibold text-white shadow-md shadow-brand-orange/25 outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60 disabled:opacity-60"
          >
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
          <button
            type="button"
            onClick={onCancelar}
            className={`btn-press h-11 rounded-xl border border-zinc-300 px-4 text-sm font-semibold text-zinc-700 dark:border-zinc-700 dark:text-zinc-300 ${FOCO}`}
          >
            Cancelar
          </button>
        </div>
      </form>
    </section>
  );
}
