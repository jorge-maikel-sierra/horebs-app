'use client';

import { useId, useMemo, useState, type FormEvent } from 'react';
import ModalBase from '@/components/ModalBase';
import ModalConfirmar from '@/components/ModalConfirmar';
import { FOCO, claseCampo } from '@/components/formulario/estilos';
import { adminFetch } from '@/lib/admin-fetch';
import { formatPrecio } from '@/lib/formato';
import { coincide, plegar } from '@/lib/pedidos-busqueda';
import {
  etiquetaItem,
  nombreDelCliente,
  type Categoria,
  type ItemEdit,
  type PedidoAdmin,
  type Producto,
  type Variante,
} from './tipos';

const METODOS = [
  { valor: 'efectivo', texto: 'Efectivo' },
  { valor: 'transferencia', texto: 'Transferencia' },
  { valor: 'tarjeta', texto: 'Tarjeta' },
] as const;

const FECHA = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Bogota',
});

const PASO =
  'btn-press flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-300 text-base font-semibold text-zinc-700 outline-none transition-colors hover:border-accent-ink focus-visible:ring-2 focus-visible:ring-brand-orange/60 dark:border-zinc-700 dark:text-zinc-200';

function firma(items: ItemEdit[], metodo: string) {
  return JSON.stringify([
    metodo,
    items.map((i) => [
      i.variante_id,
      i.producto_nombre,
      i.cantidad,
      i.precio_unitario,
    ]),
  ]);
}

function Seccion({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-bold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
        {titulo}
      </h3>
      {children}
    </section>
  );
}

export default function ModalEditarPedido({
  pedido,
  categorias,
  productos,
  onCerrar,
  onGuardado,
}: {
  pedido: PedidoAdmin;
  categorias: Categoria[];
  productos: Producto[];
  onCerrar: () => void;
  onGuardado: (pedido: PedidoAdmin) => void;
}) {
  const uid = useId();
  const idForm = `${uid}-form`;

  const [items, setItems] = useState<ItemEdit[]>(() =>
    pedido.items.map((i) => ({
      ...i,
      id: i.variante_id ?? crypto.randomUUID(),
    })),
  );
  const [metodo, setMetodo] = useState(pedido.metodo_pago);
  const [base] = useState(() =>
    firma(
      pedido.items.map((i) => ({ ...i, id: '' })),
      pedido.metodo_pago,
    ),
  );
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [nombrePers, setNombrePers] = useState('');
  const [precioPers, setPrecioPers] = useState('');
  const [errorPers, setErrorPers] = useState<string | null>(null);
  const [editandoPrecioId, setEditandoPrecioId] = useState<string | null>(null);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [confirmarDescarte, setConfirmarDescarte] = useState(false);

  const sucio = firma(items, metodo) !== base;
  const subtotal = items.reduce(
    (s, i) => s + i.precio_unitario * i.cantidad,
    0,
  );
  const total = subtotal + pedido.costo_domicilio;

  const disponibles = useMemo(() => {
    const q = plegar(busqueda.trim());
    if (!q && !categoriaId) return null;
    return productos
      .filter((p) => (categoriaId ? p.categoria_id === categoriaId : true))
      .filter((p) => !q || coincide(plegar(p.nombre), q))
      .filter((p) => p.variantes.length > 0);
  }, [productos, categoriaId, busqueda]);

  function cambiarCantidad(id: string, cantidad: number) {
    setItems((prev) =>
      cantidad <= 0
        ? prev.filter((i) => i.id !== id)
        : prev.map((i) => (i.id === id ? { ...i, cantidad } : i)),
    );
  }

  function agregar(producto: Producto, variante: Variante) {
    setErrorGeneral(null);
    setItems((prev) => {
      const existente = prev.find((i) => i.variante_id === variante.id);
      if (existente) {
        return prev.map((i) =>
          i.variante_id === variante.id
            ? { ...i, cantidad: i.cantidad + 1 }
            : i,
        );
      }
      return [
        ...prev,
        {
          id: variante.id,
          variante_id: variante.id,
          producto_nombre: producto.nombre,
          variante_nombre: variante.nombre,
          cantidad: 1,
          precio_unitario: variante.precio_oferta ?? variante.precio,
        },
      ];
    });
  }

  function agregarPersonalizado() {
    const nombre = nombrePers.trim();
    const precio = Number(precioPers);
    if (!nombre) {
      setErrorPers('Escribe el nombre del producto.');
      return;
    }
    if (!precioPers.trim() || !Number.isFinite(precio) || precio < 0) {
      setErrorPers('El precio no es válido.');
      return;
    }
    setErrorPers(null);
    setErrorGeneral(null);
    setItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        variante_id: null,
        producto_nombre: nombre,
        variante_nombre: '',
        cantidad: 1,
        precio_unitario: precio,
      },
    ]);
    setNombrePers('');
    setPrecioPers('');
  }

  function fijarPrecio(id: string, precio: number) {
    if (!Number.isFinite(precio) || precio < 0) return;
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, precio_unitario: precio } : i)),
    );
  }

  function cerrar() {
    if (sucio) setConfirmarDescarte(true);
    else onCerrar();
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setErrorGeneral(null);
    if (items.length === 0) {
      setErrorGeneral('El pedido no puede quedar sin productos.');
      return;
    }
    setGuardando(true);
    try {
      const res = await adminFetch(`/admin/pedidos/${pedido.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          metodo_pago: metodo,
          items: items.map((i) =>
            i.variante_id
              ? {
                  variante_id: i.variante_id,
                  cantidad: i.cantidad,
                  precio_unitario: i.precio_unitario,
                }
              : {
                  nombre_personalizado: i.producto_nombre,
                  cantidad: i.cantidad,
                  precio_unitario: i.precio_unitario,
                },
          ),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setErrorGeneral(
          typeof body?.message === 'string' && res.status < 500
            ? body.message
            : 'No se pudo guardar el pedido. Inténtalo de nuevo.',
        );
        return;
      }
      onGuardado((await res.json()) as PedidoAdmin);
    } catch {
      setErrorGeneral('Sin conexión con el servidor. Inténtalo de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <ModalBase
        titulo={`Editar pedido #${pedido.id.slice(0, 8)}`}
        subtitulo={`${nombreDelCliente(pedido.cliente)} · ${FECHA.format(new Date(pedido.created_at))}`}
        ancho="lg"
        cerrarConFondo={false}
        enfocarPrimerCampo={false}
        bloqueado={guardando}
        onCerrar={cerrar}
        pie={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-baseline justify-between gap-3 sm:block">
              <span className="text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                Total
              </span>
              <span className="text-xl font-extrabold tabular-nums text-accent-ink sm:ml-3">
                {formatPrecio(total)}
              </span>
            </p>
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
                {guardando ? 'Guardando…' : 'Guardar pedido'}
              </button>
            </div>
          </div>
        }
      >
        <form id={idForm} onSubmit={guardar} noValidate className="space-y-6">
          <Seccion titulo={`Productos del pedido (${items.length})`}>
            {items.length === 0 ? (
              <p className="rounded-xl bg-zinc-100 px-3 py-4 text-sm text-zinc-600 dark:bg-zinc-800/70 dark:text-zinc-300">
                No quedan productos. Agrega al menos uno desde el catálogo.
              </p>
            ) : (
              <ul className="space-y-2">
                {items.map((i) => (
                  <li
                    key={i.id}
                    className="animate-pop-in rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 text-sm font-semibold [overflow-wrap:anywhere] text-zinc-900 dark:text-zinc-50">
                        {etiquetaItem(i)}
                        {!i.variante_id && (
                          <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                            Personalizado
                          </span>
                        )}
                      </p>
                      <button
                        type="button"
                        onClick={() => cambiarCantidad(i.id, 0)}
                        className="btn-press -mt-1 -mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 outline-none hover:bg-red-50 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-red-500/60 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3" />
                        </svg>
                        <span className="sr-only">
                          Quitar {etiquetaItem(i)}
                        </span>
                      </button>
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3">
                      <div
                        role="group"
                        aria-label={`Cantidad de ${etiquetaItem(i)}`}
                        className="flex items-center gap-2"
                      >
                        <button
                          type="button"
                          onClick={() => cambiarCantidad(i.id, i.cantidad - 1)}
                          className={PASO}
                        >
                          −<span className="sr-only">Restar uno</span>
                        </button>
                        <span
                          aria-live="polite"
                          className="w-8 text-center text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-50"
                        >
                          {i.cantidad}
                        </span>
                        <button
                          type="button"
                          onClick={() => cambiarCantidad(i.id, i.cantidad + 1)}
                          className={PASO}
                        >
                          +<span className="sr-only">Sumar uno</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-3">
                        {editandoPrecioId === i.id ? (
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            autoFocus
                            defaultValue={i.precio_unitario}
                            aria-label={`Precio unitario de ${etiquetaItem(i)}`}
                            onBlur={(e) => {
                              fijarPrecio(i.id, Number(e.target.value));
                              setEditandoPrecioId(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                e.currentTarget.blur();
                              }
                              if (e.key === 'Escape') {
                                e.stopPropagation();
                                // Se restaura el valor para que el blur al cerrar no lo confirme.
                                e.currentTarget.value = String(
                                  i.precio_unitario,
                                );
                                setEditandoPrecioId(null);
                              }
                            }}
                            className="h-9 w-28 rounded-xl border border-brand-orange bg-white px-2.5 text-right text-base text-zinc-900 outline-none ring-2 ring-brand-orange/25 sm:text-sm dark:bg-zinc-900 dark:text-zinc-50"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditandoPrecioId(i.id)}
                            className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-xs text-zinc-500 tabular-nums hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 ${FOCO}`}
                          >
                            {formatPrecio(i.precio_unitario)} c/u
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" />
                            </svg>
                            <span className="sr-only">
                              Editar precio unitario
                            </span>
                          </button>
                        )}
                        <span className="min-w-20 text-right text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                          {formatPrecio(i.precio_unitario * i.cantidad)}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Seccion>

          <Seccion titulo="Agregar del catálogo">
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.preventDefault();
              }}
              placeholder="Buscar producto…"
              aria-label="Buscar producto del catálogo"
              autoComplete="off"
              className={`${claseCampo(false)} mt-0!`}
            />
            <div
              role="group"
              aria-label="Categorías"
              className="mt-2.5 flex flex-wrap gap-1.5"
            >
              {categorias.map((cat) => {
                const activa = categoriaId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    aria-pressed={activa}
                    onClick={() => setCategoriaId(activa ? null : cat.id)}
                    className={`btn-press h-9 rounded-full border px-3.5 text-xs font-semibold transition-colors ${FOCO} ${
                      activa
                        ? 'border-brand-orange bg-brand-orange/10 text-accent-ink'
                        : 'border-zinc-300 text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    {cat.nombre}
                  </button>
                );
              })}
            </div>

            {disponibles === null ? (
              <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                Busca un producto o elige una categoría para ver las opciones.
              </p>
            ) : disponibles.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                Ningún producto coincide.
              </p>
            ) : (
              <ul className="mt-3 max-h-64 space-y-3 overflow-y-auto rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
                {disponibles.map((p) => (
                  <li key={p.id}>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      {p.nombre}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {p.variantes.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => agregar(p, v)}
                          className={`btn-press inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-orange/10 px-3 text-xs font-semibold text-zinc-800 transition-colors hover:bg-brand-orange/20 dark:text-zinc-100 ${FOCO}`}
                        >
                          <span
                            aria-hidden="true"
                            className="text-accent-ink"
                          >
                            +
                          </span>
                          {v.nombre}
                          <span className="tabular-nums text-zinc-500 dark:text-zinc-400">
                            {formatPrecio(v.precio_oferta ?? v.precio)}
                          </span>
                          <span className="sr-only">
                            Agregar {p.nombre} {v.nombre}
                          </span>
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <details className="mt-4 rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <summary
                className={`cursor-pointer rounded-2xl px-3.5 py-3 text-sm font-semibold text-zinc-800 select-none dark:text-zinc-200 ${FOCO}`}
              >
                Producto personalizado
                <span className="ml-2 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                  bordes, adicionales o algo fuera del catálogo
                </span>
              </summary>
              <div className="space-y-2 px-3.5 pb-3.5">
                <div className="grid gap-2 sm:grid-cols-[1fr_9rem_auto]">
                  <input
                    value={nombrePers}
                    onChange={(e) => setNombrePers(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        agregarPersonalizado();
                      }
                    }}
                    placeholder="Ej. Borde de queso"
                    aria-label="Nombre del producto personalizado"
                    className={`${claseCampo(false)} mt-0!`}
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={500}
                    value={precioPers}
                    onChange={(e) => setPrecioPers(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        agregarPersonalizado();
                      }
                    }}
                    placeholder="Precio"
                    aria-label="Precio del producto personalizado"
                    className={`${claseCampo(false)} mt-0!`}
                  />
                  <button
                    type="button"
                    onClick={agregarPersonalizado}
                    className="btn-gradient btn-press h-11 rounded-xl px-4 text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
                  >
                    Agregar
                  </button>
                </div>
                {errorPers && (
                  <p
                    role="alert"
                    className="text-xs font-medium text-red-600 dark:text-red-400"
                  >
                    {errorPers}
                  </p>
                )}
              </div>
            </details>
          </Seccion>

          <Seccion titulo="Método de pago">
            <fieldset>
              <legend className="sr-only">Método de pago</legend>
              <div className="grid grid-cols-3 gap-2">
                {METODOS.map((m) => (
                  <label key={m.valor} className="relative block">
                    <input
                      type="radio"
                      name={`${uid}-pago`}
                      value={m.valor}
                      checked={metodo === m.valor}
                      onChange={() => setMetodo(m.valor)}
                      className="peer sr-only"
                    />
                    <span className="flex h-11 cursor-pointer items-center justify-center rounded-xl border border-zinc-300 text-sm font-semibold text-zinc-700 transition peer-checked:border-brand-orange peer-checked:bg-brand-orange/10 peer-checked:text-accent-ink peer-focus-visible:ring-2 peer-focus-visible:ring-brand-orange/60 dark:border-zinc-700 dark:text-zinc-300">
                      {m.texto}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </Seccion>

          <Seccion titulo="Resumen">
            <dl className="space-y-1.5 rounded-2xl bg-zinc-50 p-3.5 text-sm dark:bg-zinc-800/50">
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500 dark:text-zinc-400">Productos</dt>
                <dd className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                  {formatPrecio(subtotal)}
                </dd>
              </div>
              {pedido.costo_domicilio > 0 && (
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500 dark:text-zinc-400">
                    Domicilio
                  </dt>
                  <dd className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                    {formatPrecio(pedido.costo_domicilio)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-3 border-t border-zinc-200 pt-1.5 dark:border-zinc-700">
                <dt className="font-semibold text-zinc-800 dark:text-zinc-200">
                  Total
                </dt>
                <dd className="font-extrabold tabular-nums text-accent-ink">
                  {formatPrecio(total)}
                </dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Al guardar se recalcula el total y el inventario se ajusta a los
              nuevos productos.
            </p>
          </Seccion>

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
          descripcion="Modificaste el pedido y todavía no lo guardaste."
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
