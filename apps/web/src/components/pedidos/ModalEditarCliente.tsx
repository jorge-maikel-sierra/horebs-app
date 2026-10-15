'use client';

import { useId, useState, type FormEvent } from 'react';
import ModalBase from '@/components/ModalBase';
import ModalConfirmar from '@/components/ModalConfirmar';
import Campo from '@/components/formulario/Campo';
import { FOCO, claseCampo } from '@/components/formulario/estilos';
import { adminFetch } from '@/lib/admin-fetch';
import type { ClientePedido } from './tipos';

type Form = {
  nombre: string;
  apellido: string;
  telefono: string;
  direccion: string;
};
type Errores = Partial<Record<keyof Form, string>>;

const CAMPOS: {
  clave: keyof Form;
  etiqueta: string;
  ayuda?: string;
  tipo?: string;
}[] = [
  { clave: 'nombre', etiqueta: 'Nombre' },
  { clave: 'apellido', etiqueta: 'Apellido' },
  { clave: 'telefono', etiqueta: 'Teléfono', tipo: 'tel' },
  {
    clave: 'direccion',
    etiqueta: 'Dirección guardada del cliente',
    ayuda: 'La dirección de entrega de cada pedido no cambia.',
  },
];

function inicial(c: ClientePedido): Form {
  return {
    nombre: c.nombre,
    apellido: c.apellido ?? '',
    telefono: c.telefono ?? '',
    direccion: c.direccion ?? '',
  };
}

export default function ModalEditarCliente({
  cliente,
  otrosPedidos,
  onCerrar,
  onGuardado,
}: {
  cliente: ClientePedido;
  /** Pedidos en la lista de este mismo cliente: el cambio se refleja en todos. */
  otrosPedidos: number;
  onCerrar: () => void;
  onGuardado: (cliente: ClientePedido) => void;
}) {
  const uid = useId();
  const idForm = `${uid}-form`;
  const base = inicial(cliente);
  const [form, setForm] = useState<Form>(base);
  const [errores, setErrores] = useState<Errores>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [confirmarDescarte, setConfirmarDescarte] = useState(false);

  const sucio = (Object.keys(form) as (keyof Form)[]).some(
    (k) => form[k] !== base[k],
  );

  function cambiar(clave: keyof Form, valor: string) {
    setForm((f) => ({ ...f, [clave]: valor }));
    if (errores[clave]) setErrores((e) => ({ ...e, [clave]: undefined }));
  }

  function cerrar() {
    if (sucio) setConfirmarDescarte(true);
    else onCerrar();
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setErrorGeneral(null);
    if (!form.nombre.trim()) {
      setErrores({ nombre: 'El nombre no puede quedar vacío.' });
      document.getElementById(`${uid}-nombre`)?.focus();
      return;
    }
    setErrores({});
    setGuardando(true);
    try {
      const res = await adminFetch(`/admin/clientes/${cliente.id}`, {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const mensaje =
          typeof body?.message === 'string' && res.status < 500
            ? body.message
            : 'No se pudo guardar el cliente. Inténtalo de nuevo.';
        if (/tel[eé]fono/i.test(mensaje)) {
          setErrores({ telefono: mensaje });
          document.getElementById(`${uid}-telefono`)?.focus();
        } else {
          setErrorGeneral(mensaje);
        }
        return;
      }
      const actualizado = (await res.json()) as ClientePedido;
      onGuardado({ ...cliente, ...actualizado });
    } catch {
      setErrorGeneral('Sin conexión con el servidor. Inténtalo de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <ModalBase
        titulo="Editar cliente"
        subtitulo={
          otrosPedidos > 1
            ? `Se actualiza en sus ${otrosPedidos} pedidos de la lista.`
            : 'Los datos del cliente se guardan en su ficha.'
        }
        ancho="sm"
        cerrarConFondo={false}
        bloqueado={guardando}
        onCerrar={cerrar}
        pie={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={cerrar}
              disabled={guardando}
              className={`btn-press h-11 flex-1 rounded-xl border border-zinc-300 text-sm font-semibold text-zinc-700 disabled:opacity-50 sm:flex-none sm:px-5 dark:border-zinc-700 dark:text-zinc-300 ${FOCO}`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form={idForm}
              disabled={guardando || !sucio}
              className="btn-gradient btn-press h-11 flex-1 rounded-xl px-5 text-sm font-semibold text-white shadow-md shadow-brand-orange/25 outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60 disabled:opacity-50 disabled:shadow-none sm:flex-none"
            >
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        }
      >
        <form id={idForm} onSubmit={guardar} noValidate className="space-y-4">
          {CAMPOS.map((c) => {
            const id = `${uid}-${c.clave}`;
            const ids = [
              c.ayuda ? `${id}-ayuda` : '',
              errores[c.clave] ? `${id}-error` : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <Campo
                key={c.clave}
                id={id}
                etiqueta={c.etiqueta}
                ayuda={c.ayuda}
                error={errores[c.clave]}
              >
                <input
                  id={id}
                  type={c.tipo ?? 'text'}
                  value={form[c.clave]}
                  autoComplete="off"
                  aria-invalid={Boolean(errores[c.clave])}
                  aria-describedby={ids || undefined}
                  onChange={(e) => cambiar(c.clave, e.target.value)}
                  className={claseCampo(Boolean(errores[c.clave]))}
                />
              </Campo>
            );
          })}

          {errorGeneral && (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            >
              {errorGeneral}
            </p>
          )}
        </form>
      </ModalBase>

      {confirmarDescarte && (
        <ModalConfirmar
          titulo="¿Descartar los cambios?"
          descripcion="Modificaste los datos del cliente y todavía no los guardaste."
          textoConfirmar="Descartar"
          textoCancelar="Seguir editando"
          peligro
          onConfirmar={onCerrar}
          onCancelar={() => setConfirmarDescarte(false)}
        />
      )}
    </>
  );
}
