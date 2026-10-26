'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { adminFetch } from '@/lib/admin-fetch';
import { formatPrecio, formatHora } from '@/lib/formato';
import CargandoSkeleton from '@/components/CargandoSkeleton';

type Variante = {
  id: string;
  nombre: string;
  precio: number;
  precio_oferta: number | null;
};

type Producto = {
  id: string;
  nombre: string;
  imagen_url: string | null;
  categoria_id: string;
  variantes: Variante[];
};

type Categoria = { id: string; nombre: string; orden: number };

type ItemVenta = {
  id: string;
  varianteId: string | null;
  nombrePersonalizado: string | null;
  productoNombre: string;
  varianteNombre: string;
  precio: number;
  cantidad: number;
};

type ClienteBusqueda = {
  id: string;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  direccion: string | null;
  correo: string | null;
  cedula: string | null;
};

type SaldoPuntos = {
  nombre: string;
  puntos: number;
  valorPuntoPesos: number;
  puntosMinimoCanje: number;
};

type Modalidad = 'local' | 'retiro' | 'domicilio';

type TurnoDto = {
  id: string;
  monto_inicial: number;
  abierto_en: string;
  estado: 'abierto' | 'cerrado';
};

type ResumenVentas = {
  total_efectivo: number;
  total_transferencia: number;
  total_tarjeta: number;
  total_ventas: number;
  cantidad_ventas: number;
};

type TurnoCerrado = {
  resumen: ResumenVentas;
  monto_esperado_efectivo: number;
  diferencia_caja: number | null;
};

const COSTO_DOMICILIO_DEFAULT = 5000;

function IconMesa() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8h18M5 8v13M19 8v13" />
      <path d="M9 3v3M15 3v3M7 3h10" />
    </svg>
  );
}

function IconLlevar() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8V6a3 3 0 0 1 6 0v2" />
      <path d="M4 8h10l1 12H3L4 8Z" />
    </svg>
  );
}

function IconDomicilio() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8 12 3 3 8l9 5 9-5Z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </svg>
  );
}

function IconEfectivo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M6 9v.01M18 15v.01" />
    </svg>
  );
}

function IconTransferencia() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4v6h6" />
      <path d="M20 20v-6h-6" />
      <path d="M4.5 15a8 8 0 0 0 14.5 3.4M19.5 9A8 8 0 0 0 5 5.6" />
    </svg>
  );
}

function IconTarjeta() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <path d="M6 15h4" />
    </svg>
  );
}

function IconPlato() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
    </svg>
  );
}

const ETIQUETA =
  'text-[10px] font-semibold tracking-[0.14em] text-zinc-400 uppercase dark:text-zinc-500';
const INPUT_BASE =
  'mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/25 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-50 dark:placeholder:text-zinc-500';
const INPUT = `${INPUT_BASE} h-11`;
const PANEL =
  'rounded-3xl border border-zinc-200 bg-white shadow-[0_18px_40px_-28px_rgba(0,0,0,0.45)] dark:border-zinc-800 dark:bg-zinc-900';
const BOTON_PRINCIPAL =
  'btn-gradient btn-press flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[13px] font-bold tracking-[0.1em] text-white uppercase shadow-md shadow-brand-orange/25 outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60 focus-visible:ring-offset-2 disabled:opacity-50 dark:focus-visible:ring-offset-zinc-900';
const BOTON_SECUNDARIO =
  'btn-press inline-flex h-10 items-center rounded-xl border px-4 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-orange/60';

/** Label con su input adentro: la asociación es implícita, sin ids. */
function Campo({
  etiqueta,
  children,
  className = '',
}: {
  etiqueta: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className={ETIQUETA}>{etiqueta}</span>
      {children}
    </label>
  );
}

function OpcionBoton({
  selected,
  onClick,
  icon,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`btn-press flex flex-1 flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-orange/60 ${
        selected
          ? 'border-brand-orange bg-brand-orange/10 text-accent-ink ring-1 ring-brand-orange'
          : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300 dark:hover:border-zinc-700'
      }`}
    >
      {icon}
      <span className="text-xs font-semibold">{label}</span>
    </button>
  );
}

function ProductoCard({
  producto,
  enVenta,
  onAgregar,
}: {
  producto: Producto;
  enVenta: number;
  onAgregar: (variante: Variante) => void;
}) {
  const unaVariante = producto.variantes.length === 1;
  const [imagenRota, setImagenRota] = useState(false);

  return (
    <article className="group flex flex-col rounded-3xl border border-zinc-200 bg-white p-2 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.45)] dark:border-zinc-800 dark:bg-zinc-900">
      <div className="relative h-28 shrink-0 overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-800">
        {producto.imagen_url && !imagenRota ? (
          <Image
            src={producto.imagen_url}
            alt=""
            fill
            sizes="(min-width: 1024px) 220px, 45vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            onError={() => setImagenRota(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-zinc-300 dark:text-zinc-600">
            <IconPlato />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/0 to-black/0" />
        {enVenta > 0 && (
          <span
            key={enVenta}
            className="animate-pop-in absolute top-2 right-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-brand-orange-700 px-2 text-xs font-bold text-white tabular-nums shadow-md"
          >
            {enVenta}
            <span className="sr-only"> en la venta</span>
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col px-1 pt-2.5 pb-0.5">
        <h3 className="line-clamp-2 text-sm leading-snug font-bold text-zinc-900 dark:text-zinc-50">
          {producto.nombre}
        </h3>
        <ul className="mt-auto space-y-1.5 pt-2.5">
          {producto.variantes.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => onAgregar(v)}
                aria-label={`Agregar ${producto.nombre}${unaVariante ? '' : ` ${v.nombre}`}`}
                className="btn-press group/v flex w-full items-center justify-between gap-2 rounded-xl border border-zinc-200 py-1.5 pr-1.5 pl-2.5 text-left outline-none transition-colors hover:border-brand-orange hover:bg-brand-orange/10 focus-visible:ring-2 focus-visible:ring-brand-orange/60 dark:border-zinc-800"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[10px] font-semibold tracking-[0.12em] text-zinc-500 uppercase dark:text-zinc-400">
                    {unaVariante ? 'Agregar' : v.nombre}
                  </span>
                  <span className="block text-sm font-extrabold text-zinc-900 tabular-nums dark:text-zinc-50">
                    {formatPrecio(v.precio_oferta ?? v.precio)}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-orange/15 text-lg leading-none font-bold text-accent-ink transition-colors group-hover/v:bg-brand-orange-700 group-hover/v:text-white"
                >
                  +
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

function PosInterno() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<
    string | null
  >(null);
  const [items, setItems] = useState<ItemVenta[]>([]);
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [cedula, setCedula] = useState('');
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [resultadosCliente, setResultadosCliente] = useState<
    ClienteBusqueda[]
  >([]);
  const [nombrePersonalizado, setNombrePersonalizado] = useState('');
  const [precioPersonalizado, setPrecioPersonalizado] = useState('');
  const [editandoPrecioId, setEditandoPrecioId] = useState<string | null>(
    null,
  );
  const [modalidad, setModalidad] = useState<Modalidad>('local');
  const [direccionEntrega, setDireccionEntrega] = useState('');
  const [costoDomicilio, setCostoDomicilio] = useState(COSTO_DOMICILIO_DEFAULT);
  const [metodoPago, setMetodoPago] = useState<
    'efectivo' | 'transferencia' | 'tarjeta'
  >('efectivo');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [saldoPuntos, setSaldoPuntos] = useState<SaldoPuntos | null>(null);
  const [usarPuntos, setUsarPuntos] = useState(false);

  const [turno, setTurno] = useState<TurnoDto | null>(null);
  const [resumenTurno, setResumenTurno] = useState<ResumenVentas | null>(null);
  const [cargandoTurno, setCargandoTurno] = useState(true);
  const [errorTurno, setErrorTurno] = useState<string | null>(null);
  const [montoInicial, setMontoInicial] = useState('');
  const [abriendoTurno, setAbriendoTurno] = useState(false);
  const [mostrarCierre, setMostrarCierre] = useState(false);
  const [montoContado, setMontoContado] = useState('');
  const [notasCierre, setNotasCierre] = useState('');
  const [cerrandoTurno, setCerrandoTurno] = useState(false);
  const [resultadoCierre, setResultadoCierre] = useState<TurnoCerrado | null>(
    null,
  );

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
    Promise.all([
      fetch(`${apiUrl}/catalogo/categorias`).then((r) => r.json()),
      fetch(`${apiUrl}/catalogo/productos`).then((r) => r.json()),
    ])
      .then(([cats, prods]) => {
        setCategorias(cats);
        setProductos(prods);
        if (cats.length > 0) setCategoriaSeleccionada((prev) => prev ?? cats[0].id);
      })
      .catch(() => setError('No se pudo cargar el catálogo.'));
  }, []);

  async function cargarTurno() {
    const res = await adminFetch('/turnos/actual');
    if (res.ok) {
      const data = await res.json();
      setTurno(data.turno);
      setResumenTurno(data.resumen);
    }
    setCargandoTurno(false);
  }

  useEffect(() => {
    cargarTurno();
  }, []);

  useEffect(() => {
    if (!busquedaCliente.trim()) {
      setResultadosCliente([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const res = await adminFetch(
        `/admin/clientes?q=${encodeURIComponent(busquedaCliente)}`,
      );
      if (res.ok) setResultadosCliente(await res.json());
    }, 300);
    return () => clearTimeout(timeout);
  }, [busquedaCliente]);

  function seleccionarCliente(c: ClienteBusqueda) {
    setNombre(c.nombre);
    setApellido(c.apellido ?? '');
    setTelefono(c.telefono ?? '');
    setCorreo(c.correo ?? '');
    setCedula(c.cedula ?? '');
    setBusquedaCliente('');
    setResultadosCliente([]);
    if (c.telefono) void consultarSaldoPuntos(c.telefono);
  }

  async function consultarSaldoPuntos(tel: string) {
    if (!tel.trim()) {
      setSaldoPuntos(null);
      setUsarPuntos(false);
      return;
    }
    const res = await adminFetch(`/puntos/saldo?telefono=${encodeURIComponent(tel.trim())}`);
    if (!res.ok) return;
    const saldo: SaldoPuntos | null = await res.json();
    setSaldoPuntos(saldo);
    if (!saldo || saldo.puntos < saldo.puntosMinimoCanje) setUsarPuntos(false);
  }

  function agregarItem(producto: Producto, variante: Variante) {
    const precio = variante.precio_oferta ?? variante.precio;
    setItems((prev) => {
      const existente = prev.find((i) => i.varianteId === variante.id);
      if (existente) {
        return prev.map((i) =>
          i.varianteId === variante.id
            ? { ...i, cantidad: i.cantidad + 1 }
            : i,
        );
      }
      return [
        ...prev,
        {
          id: variante.id,
          varianteId: variante.id,
          nombrePersonalizado: null,
          productoNombre: producto.nombre,
          varianteNombre: variante.nombre,
          precio,
          cantidad: 1,
        },
      ];
    });
  }

  function agregarPersonalizado() {
    const nombre = nombrePersonalizado.trim();
    const precio = Number(precioPersonalizado);
    if (!nombre) {
      setError('Escribe el nombre del producto personalizado.');
      return;
    }
    if (!Number.isFinite(precio) || precio < 0) {
      setError('El precio del producto personalizado no es válido.');
      return;
    }
    setError(null);
    setItems((prev) => [
      ...prev,
      {
        id: `personalizado-${crypto.randomUUID()}`,
        varianteId: null,
        nombrePersonalizado: nombre,
        productoNombre: nombre,
        varianteNombre: '',
        precio,
        cantidad: 1,
      },
    ]);
    setNombrePersonalizado('');
    setPrecioPersonalizado('');
  }

  function actualizarCantidad(id: string, cantidad: number) {
    if (cantidad <= 0) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, cantidad } : i)),
    );
  }

  function editarPrecio(id: string, precio: number) {
    if (!Number.isFinite(precio) || precio < 0) return;
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, precio } : i)),
    );
  }

  const totalItems = items.reduce((acc, i) => acc + i.precio * i.cantidad, 0);
  const total = totalItems + (modalidad === 'domicilio' ? costoDomicilio : 0);
  const puedeCanjear = saldoPuntos !== null && saldoPuntos.puntos >= saldoPuntos.puntosMinimoCanje;
  const canjePuntos =
    puedeCanjear && saldoPuntos
      ? Math.min(saldoPuntos.puntos, Math.floor(total / saldoPuntos.valorPuntoPesos))
      : 0;
  const descuentoPuntos = usarPuntos ? canjePuntos * (saldoPuntos?.valorPuntoPesos ?? 0) : 0;
  const totalConDescuento = total - descuentoPuntos;

  const productosDeCategoria = categoriaSeleccionada
    ? productos.filter((p) => p.categoria_id === categoriaSeleccionada)
    : [];

  async function abrirTurno(e: FormEvent) {
    e.preventDefault();
    setErrorTurno(null);
    const monto = Number(montoInicial);
    if (!Number.isFinite(monto) || monto < 0) {
      setErrorTurno('Ingresa un monto válido.');
      return;
    }
    setAbriendoTurno(true);
    try {
      const res = await adminFetch('/turnos/abrir', {
        method: 'POST',
        body: JSON.stringify({ monto_inicial: monto }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? 'No se pudo abrir el turno.');
      }
      const data = await res.json();
      setTurno(data);
      setResumenTurno({
        total_efectivo: 0,
        total_transferencia: 0,
        total_tarjeta: 0,
        total_ventas: 0,
        cantidad_ventas: 0,
      });
      setMontoInicial('');
    } catch (err) {
      setErrorTurno(
        err instanceof Error ? err.message : 'No se pudo abrir el turno.',
      );
    } finally {
      setAbriendoTurno(false);
    }
  }

  async function abrirModalCierre() {
    setMostrarCierre(true);
    setResultadoCierre(null);
    setErrorTurno(null);
    await cargarTurno();
  }

  function cerrarModalCierre() {
    setMostrarCierre(false);
    setResultadoCierre(null);
    setMontoContado('');
    setNotasCierre('');
    setErrorTurno(null);
  }

  async function confirmarCierre(e: FormEvent) {
    e.preventDefault();
    setErrorTurno(null);
    const montoContadoNum = montoContado.trim()
      ? Number(montoContado)
      : undefined;
    if (
      montoContadoNum !== undefined &&
      (!Number.isFinite(montoContadoNum) || montoContadoNum < 0)
    ) {
      setErrorTurno('El monto contado no es válido.');
      return;
    }
    setCerrandoTurno(true);
    try {
      const res = await adminFetch('/turnos/cerrar', {
        method: 'POST',
        body: JSON.stringify({
          monto_final_contado: montoContadoNum,
          notas_cierre: notasCierre.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? 'No se pudo cerrar el turno.');
      }
      const data = await res.json();
      setResultadoCierre(data);
      setTurno(null);
      setResumenTurno(null);
    } catch (err) {
      setErrorTurno(
        err instanceof Error ? err.message : 'No se pudo cerrar el turno.',
      );
    } finally {
      setCerrandoTurno(false);
    }
  }

  async function registrarVenta(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMensaje(null);

    if (items.length === 0) {
      setError('Agrega al menos un producto.');
      return;
    }
    if (modalidad === 'domicilio' && !direccionEntrega.trim()) {
      setError('Falta la dirección de entrega.');
      return;
    }

    setEnviando(true);
    try {
      const res = await adminFetch('/admin/ventas', {
        method: 'POST',
        body: JSON.stringify({
          cliente: {
            nombre,
            apellido: apellido || undefined,
            telefono: telefono || undefined,
            correo: correo || undefined,
            cedula: cedula || undefined,
          },
          modalidad,
          direccion_entrega:
            modalidad === 'domicilio' ? direccionEntrega : undefined,
          costo_domicilio: modalidad === 'domicilio' ? costoDomicilio : undefined,
          metodo_pago: metodoPago,
          items: items.map((i) =>
            i.varianteId
              ? {
                  variante_id: i.varianteId,
                  cantidad: i.cantidad,
                  precio_unitario: i.precio,
                }
              : {
                  nombre_personalizado: i.nombrePersonalizado,
                  cantidad: i.cantidad,
                  precio_unitario: i.precio,
                },
          ),
          usar_puntos: usarPuntos,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? 'No se pudo registrar la venta.');
      }

      const venta = await res.json();
      setMensaje(
        `Venta registrada — total ${formatPrecio(venta.total)}.` +
          (venta.puntos_ganados > 0 ? ` Ganó ${venta.puntos_ganados} puntos.` : ''),
      );
      setItems([]);
      setNombre('');
      setApellido('');
      setTelefono('');
      setCorreo('');
      setCedula('');
      setNombrePersonalizado('');
      setPrecioPersonalizado('');
      setEditandoPrecioId(null);
      setModalidad('local');
      setDireccionEntrega('');
      setCostoDomicilio(COSTO_DOMICILIO_DEFAULT);
      setMetodoPago('efectivo');
      setSaldoPuntos(null);
      setUsarPuntos(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo registrar la venta.',
      );
    } finally {
      setEnviando(false);
    }
  }

  const unidades = items.reduce((acc, i) => acc + i.cantidad, 0);
  const cantidadPorProducto = new Map<string, number>();
  for (const i of items) {
    cantidadPorProducto.set(
      i.productoNombre,
      (cantidadPorProducto.get(i.productoNombre) ?? 0) + i.cantidad,
    );
  }

  // En móvil la venta queda debajo de todo el catálogo: la barra flotante
  // lleva hasta ella y se esconde cuando ya está en pantalla.
  const [ventaVisible, setVentaVisible] = useState(false);
  useEffect(() => {
    const el = document.getElementById('venta-actual');
    if (!el) return;
    const observador = new IntersectionObserver(
      ([entrada]) => setVentaVisible(entrada.isIntersecting),
      { threshold: 0.1 },
    );
    observador.observe(el);
    return () => observador.disconnect();
  }, [cargandoTurno]);

  if (cargandoTurno) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <CargandoSkeleton filas={10} />
      </div>
    );
  }

  return (
    <div className="p-4 pb-28 sm:p-6 sm:pb-28 lg:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Punto de venta
          </h1>
          {turno && (
            <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 motion-safe:animate-ping" />
                <span className="relative h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Turno abierto · {formatHora(turno.abierto_en)} · caja inicial{' '}
              {formatPrecio(turno.monto_inicial)}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/pedidos"
            className={`${BOTON_SECUNDARIO} border-zinc-300 text-zinc-700 hover:border-accent-ink hover:text-accent-ink dark:border-zinc-700 dark:text-zinc-200`}
          >
            Ver pedidos
          </Link>
          {turno && (
            <button
              type="button"
              onClick={abrirModalCierre}
              className={`${BOTON_SECUNDARIO} border-red-300 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40`}
            >
              Cerrar turno
            </button>
          )}
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start lg:gap-8">
        <section aria-labelledby="pos-productos">
          <div className="flex items-baseline justify-between gap-2">
            <h2
              id="pos-productos"
              className="text-lg font-bold text-zinc-900 dark:text-zinc-50"
            >
              Productos
            </h2>
            <p className={ETIQUETA}>Toca un tamaño para agregarlo</p>
          </div>

          {categorias.length > 0 && (
            <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
              {categorias.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoriaSeleccionada(cat.id)}
                  aria-pressed={categoriaSeleccionada === cat.id}
                  className={`btn-press shrink-0 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-orange/60 ${
                    categoriaSeleccionada === cat.id
                      ? 'btn-gradient text-white shadow-md shadow-brand-orange/25'
                      : 'border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300'
                  }`}
                >
                  {cat.nombre}
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
            {productosDeCategoria.map((producto) => (
              <ProductoCard
                key={producto.id}
                producto={producto}
                enVenta={cantidadPorProducto.get(producto.nombre) ?? 0}
                onAgregar={(v) => agregarItem(producto, v)}
              />
            ))}
          </div>
          {categoriaSeleccionada && productosDeCategoria.length === 0 && (
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
              No hay productos en esta categoría.
            </p>
          )}

          <div className="mt-4 rounded-3xl border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
              Producto personalizado
            </p>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Para bordes, adicionales o algo que no esté en el catálogo.
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <Campo etiqueta="Nombre" className="min-w-40 flex-1">
                <input
                  value={nombrePersonalizado}
                  onChange={(e) => setNombrePersonalizado(e.target.value)}
                  placeholder="Ej: Borde de queso"
                  className={INPUT}
                />
              </Campo>
              <Campo etiqueta="Precio" className="w-32">
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={precioPersonalizado}
                  onChange={(e) => setPrecioPersonalizado(e.target.value)}
                  placeholder="0"
                  className={INPUT}
                />
              </Campo>
              <button
                type="button"
                onClick={agregarPersonalizado}
                className="btn-gradient btn-press h-11 shrink-0 rounded-xl px-4 text-sm font-bold text-white shadow-md shadow-brand-orange/25 outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
              >
                Agregar
              </button>
            </div>
          </div>
        </section>

        <section
          id="venta-actual"
          aria-labelledby="pos-venta"
          className={`${PANEL} scroll-mt-24 p-4 sm:p-5 lg:sticky lg:top-6`}
        >
          <div className="flex items-center justify-between gap-2">
            <h2
              id="pos-venta"
              className="text-lg font-bold text-zinc-900 dark:text-zinc-50"
            >
              Venta actual
            </h2>
            {unidades > 0 && (
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-600 tabular-nums dark:bg-zinc-800 dark:text-zinc-300">
                {unidades} {unidades === 1 ? 'producto' : 'productos'}
              </span>
            )}
          </div>

          {items.length === 0 ? (
            <div className="mt-3 flex flex-col items-center rounded-2xl border border-dashed border-zinc-200 px-4 py-8 text-center dark:border-zinc-800">
              <span className="text-zinc-300 dark:text-zinc-600">
                <IconPlato />
              </span>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                Todavía no agregaste productos.
              </p>
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {items.map((i) => (
                <li
                  key={i.id}
                  className="rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-800/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        {i.productoNombre}
                      </p>
                      {i.varianteNombre && (
                        <p className="truncate text-[10px] font-semibold tracking-[0.12em] text-zinc-500 uppercase dark:text-zinc-400">
                          {i.varianteNombre}
                        </p>
                      )}
                    </div>
                    {editandoPrecioId === i.id ? (
                      <input
                        type="number"
                        min={0}
                        autoFocus
                        aria-label={`Precio unitario de ${i.productoNombre}`}
                        defaultValue={i.precio}
                        onBlur={(e) => {
                          editarPrecio(i.id, Number(e.target.value));
                          setEditandoPrecioId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                        }}
                        className="h-8 w-24 rounded-lg border border-brand-orange bg-white px-2 text-right text-sm font-bold tabular-nums outline-none focus:ring-2 focus:ring-brand-orange/25 dark:bg-zinc-900"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditandoPrecioId(i.id)}
                        title="Editar precio unitario"
                        className="shrink-0 rounded-md text-sm font-bold text-zinc-900 tabular-nums underline decoration-zinc-400 decoration-dotted underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60 dark:text-zinc-50"
                      >
                        {formatPrecio(i.precio * i.cantidad)}
                      </button>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-zinc-500 tabular-nums dark:text-zinc-400">
                      {formatPrecio(i.precio)} c/u
                    </span>
                    <div className="flex items-center rounded-full border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
                      <button
                        type="button"
                        onClick={() => actualizarCantidad(i.id, i.cantidad - 1)}
                        aria-label={`Quitar uno de ${i.productoNombre}`}
                        className="btn-press flex h-8 w-8 items-center justify-center rounded-full text-base text-zinc-600 outline-none hover:text-accent-ink focus-visible:ring-2 focus-visible:ring-brand-orange/60 dark:text-zinc-300"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm font-bold tabular-nums">
                        {i.cantidad}
                      </span>
                      <button
                        type="button"
                        onClick={() => actualizarCantidad(i.id, i.cantidad + 1)}
                        aria-label={`Agregar uno de ${i.productoNombre}`}
                        className="btn-press flex h-8 w-8 items-center justify-center rounded-full text-base text-zinc-600 outline-none hover:text-accent-ink focus-visible:ring-2 focus-visible:ring-brand-orange/60 dark:text-zinc-300"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 space-y-1 border-t border-zinc-100 pt-3 dark:border-zinc-800">
            {modalidad === 'domicilio' && (
              <>
                <div className="flex justify-between text-sm text-zinc-500 tabular-nums dark:text-zinc-400">
                  <span>Subtotal</span>
                  <span>{formatPrecio(totalItems)}</span>
                </div>
                <div className="flex justify-between text-sm text-zinc-500 tabular-nums dark:text-zinc-400">
                  <span>Domicilio</span>
                  <span>{formatPrecio(costoDomicilio)}</span>
                </div>
              </>
            )}
            {descuentoPuntos > 0 && (
              <div className="flex justify-between text-sm text-emerald-700 tabular-nums dark:text-emerald-400">
                <span>Descuento · {canjePuntos} puntos</span>
                <span>-{formatPrecio(descuentoPuntos)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between gap-3 pt-1">
              <span className={ETIQUETA}>Total</span>
              <span className="text-3xl font-extrabold tracking-tight text-zinc-900 tabular-nums dark:text-zinc-50">
                {formatPrecio(totalConDescuento)}
              </span>
            </div>
          </div>

          <form onSubmit={registrarVenta} className="mt-5 space-y-4">
            <fieldset className="space-y-3">
              <legend className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                Cliente
              </legend>
              <div className="relative">
                <Campo etiqueta="Buscar cliente existente">
                  <input
                    value={busquedaCliente}
                    onChange={(e) => setBusquedaCliente(e.target.value)}
                    placeholder="Nombre o teléfono…"
                    className={INPUT}
                  />
                </Campo>
                {resultadosCliente.length > 0 && (
                  <ul className="animate-desplegar absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-xl shadow-black/10 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/40">
                    {resultadosCliente.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => seleccionarCliente(c)}
                          className="flex w-full items-baseline justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm outline-none hover:bg-zinc-100 focus-visible:bg-zinc-100 dark:hover:bg-zinc-800 dark:focus-visible:bg-zinc-800"
                        >
                          <span className="truncate font-semibold text-zinc-900 dark:text-zinc-50">
                            {c.nombre} {c.apellido ?? ''}
                          </span>
                          {c.telefono && (
                            <span className="shrink-0 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
                              {c.telefono}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo etiqueta="Nombre">
                  <input
                    required
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className={INPUT}
                  />
                </Campo>
                <Campo etiqueta="Apellido">
                  <input
                    value={apellido}
                    onChange={(e) => setApellido(e.target.value)}
                    className={INPUT}
                  />
                </Campo>
                <Campo etiqueta="Teléfono (opcional)">
                  <input
                    type="tel"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    onBlur={() => consultarSaldoPuntos(telefono)}
                    className={INPUT}
                  />
                </Campo>
                <Campo etiqueta="Correo (opcional)">
                  <input
                    type="email"
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value)}
                    className={INPUT}
                  />
                </Campo>
                <Campo etiqueta="Cédula (opcional)" className="sm:col-span-2">
                  <input
                    value={cedula}
                    onChange={(e) => setCedula(e.target.value)}
                    className={INPUT}
                  />
                </Campo>
              </div>

              {puedeCanjear && (
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-brand-orange/30 bg-brand-orange/[0.06] px-3 py-2.5">
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">
                    <span className="font-semibold">
                      {saldoPuntos?.puntos} puntos disponibles
                    </span>{' '}
                    · usar {canjePuntos} (
                    {formatPrecio(
                      canjePuntos * (saldoPuntos?.valorPuntoPesos ?? 0),
                    )}
                    )
                  </span>
                  <input
                    type="checkbox"
                    checked={usarPuntos}
                    onChange={(e) => setUsarPuntos(e.target.checked)}
                    className="h-5 w-5 shrink-0 accent-brand-orange"
                  />
                </label>
              )}
            </fieldset>

            <fieldset>
              <legend className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                Modalidad
              </legend>
              <div className="mt-2 flex gap-2">
                <OpcionBoton
                  selected={modalidad === 'local'}
                  onClick={() => setModalidad('local')}
                  icon={<IconMesa />}
                  label="Comer en el local"
                />
                <OpcionBoton
                  selected={modalidad === 'retiro'}
                  onClick={() => setModalidad('retiro')}
                  icon={<IconLlevar />}
                  label="Para llevar"
                />
                <OpcionBoton
                  selected={modalidad === 'domicilio'}
                  onClick={() => setModalidad('domicilio')}
                  icon={<IconDomicilio />}
                  label="A domicilio"
                />
              </div>

              {modalidad === 'domicilio' && (
                <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
                  <Campo etiqueta="Dirección de entrega">
                    <input
                      required
                      value={direccionEntrega}
                      onChange={(e) => setDireccionEntrega(e.target.value)}
                      className={INPUT}
                    />
                  </Campo>
                  <Campo etiqueta="Costo domicilio">
                    <input
                      required
                      type="number"
                      min={0}
                      step={500}
                      value={costoDomicilio}
                      onChange={(e) => setCostoDomicilio(Number(e.target.value))}
                      className={INPUT}
                    />
                  </Campo>
                </div>
              )}
            </fieldset>

            <fieldset>
              <legend className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                Método de pago
              </legend>
              <div className="mt-2 flex gap-2">
                <OpcionBoton
                  selected={metodoPago === 'efectivo'}
                  onClick={() => setMetodoPago('efectivo')}
                  icon={<IconEfectivo />}
                  label="Efectivo"
                />
                <OpcionBoton
                  selected={metodoPago === 'transferencia'}
                  onClick={() => setMetodoPago('transferencia')}
                  icon={<IconTransferencia />}
                  label="Transferencia"
                />
                <OpcionBoton
                  selected={metodoPago === 'tarjeta'}
                  onClick={() => setMetodoPago('tarjeta')}
                  icon={<IconTarjeta />}
                  label="Tarjeta"
                />
              </div>
            </fieldset>

            {error && (
              <p
                role="alert"
                className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300"
              >
                {error}
              </p>
            )}
            {mensaje && (
              <p
                role="status"
                className="rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300"
              >
                {mensaje}
              </p>
            )}

            <button type="submit" disabled={enviando} className={BOTON_PRINCIPAL}>
              {enviando ? 'Registrando…' : 'Registrar venta'}
            </button>
          </form>
        </section>
      </div>

      {items.length > 0 && !ventaVisible && (
        <a
          href="#venta-actual"
          className="btn-gradient animate-fade-up fixed inset-x-4 bottom-4 z-30 flex h-14 items-center justify-between rounded-2xl px-4 text-white shadow-xl shadow-brand-orange/30 outline-none focus-visible:ring-2 focus-visible:ring-white lg:hidden"
        >
          <span className="flex items-center gap-2 text-sm font-bold">
            <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-white/20 px-2 tabular-nums">
              {unidades}
            </span>
            Ver venta
          </span>
          <span className="text-lg font-extrabold tabular-nums">
            {formatPrecio(totalConDescuento)}
          </span>
        </a>
      )}

      {!turno && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className={`${PANEL} animate-fade-up w-full max-w-md p-6`}>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
              Abrir turno
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Antes de usar el punto de venta, cuenta cuánto hay en caja para
              arrancar el turno.
            </p>
            <form onSubmit={abrirTurno} className="mt-5 space-y-4">
              <Campo etiqueta="Monto inicial en caja">
                <input
                  required
                  type="number"
                  min={0}
                  step={1000}
                  autoFocus
                  value={montoInicial}
                  onChange={(e) => setMontoInicial(e.target.value)}
                  className={INPUT}
                />
              </Campo>
              {errorTurno && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                  {errorTurno}
                </p>
              )}
              <button type="submit" disabled={abriendoTurno} className={BOTON_PRINCIPAL}>
                {abriendoTurno ? 'Abriendo…' : 'Abrir turno'}
              </button>
            </form>
          </div>
        </div>
      )}

      {mostrarCierre && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className={`${PANEL} animate-fade-up w-full max-w-md p-6`}>
            {resultadoCierre ? (
              <>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                  Turno cerrado
                </h2>
                <p className={`${ETIQUETA} mt-4`}>Total vendido</p>
                <p className="text-3xl font-extrabold tracking-tight text-zinc-900 tabular-nums dark:text-zinc-50">
                  {formatPrecio(resultadoCierre.resumen.total_ventas)}
                </p>
                <dl className="mt-4 space-y-2 rounded-2xl bg-zinc-50 p-3 text-sm tabular-nums dark:bg-zinc-800/50">
                  <div className="flex justify-between">
                    <dt className="text-zinc-500 dark:text-zinc-400">Ventas en efectivo</dt>
                    <dd>{formatPrecio(resultadoCierre.resumen.total_efectivo)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500 dark:text-zinc-400">Ventas por transferencia</dt>
                    <dd>
                      {formatPrecio(resultadoCierre.resumen.total_transferencia)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500 dark:text-zinc-400">Ventas con tarjeta</dt>
                    <dd>{formatPrecio(resultadoCierre.resumen.total_tarjeta)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500 dark:text-zinc-400">Cantidad de ventas</dt>
                    <dd>{resultadoCierre.resumen.cantidad_ventas}</dd>
                  </div>
                  <div className="flex justify-between border-t border-zinc-200 pt-2 font-semibold dark:border-zinc-700">
                    <dt>Caja esperada</dt>
                    <dd>{formatPrecio(resultadoCierre.monto_esperado_efectivo)}</dd>
                  </div>
                  {resultadoCierre.diferencia_caja !== null && (
                    <div className="flex justify-between font-semibold">
                      <dt>Diferencia en caja</dt>
                      <dd
                        className={
                          resultadoCierre.diferencia_caja === 0
                            ? ''
                            : resultadoCierre.diferencia_caja > 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-red-600 dark:text-red-400'
                        }
                      >
                        {formatPrecio(resultadoCierre.diferencia_caja)}
                      </dd>
                    </div>
                  )}
                </dl>
                <button
                  type="button"
                  onClick={cerrarModalCierre}
                  className={`${BOTON_PRINCIPAL} mt-6`}
                >
                  Listo
                </button>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                  Cerrar turno
                </h2>
                {turno && resumenTurno && (
                  <>
                    <p className={`${ETIQUETA} mt-4`}>Caja esperada</p>
                    <p className="text-3xl font-extrabold tracking-tight text-zinc-900 tabular-nums dark:text-zinc-50">
                      {formatPrecio(
                        turno.monto_inicial + resumenTurno.total_efectivo,
                      )}
                    </p>
                    <dl className="mt-4 space-y-2 rounded-2xl bg-zinc-50 p-3 text-sm tabular-nums dark:bg-zinc-800/50">
                      <div className="flex justify-between">
                        <dt className="text-zinc-500 dark:text-zinc-400">Caja inicial</dt>
                        <dd>{formatPrecio(turno.monto_inicial)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-zinc-500 dark:text-zinc-400">Ventas en efectivo</dt>
                        <dd>{formatPrecio(resumenTurno.total_efectivo)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-zinc-500 dark:text-zinc-400">Ventas por transferencia</dt>
                        <dd>{formatPrecio(resumenTurno.total_transferencia)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-zinc-500 dark:text-zinc-400">Ventas con tarjeta</dt>
                        <dd>{formatPrecio(resumenTurno.total_tarjeta)}</dd>
                      </div>
                      <div className="flex justify-between border-t border-zinc-200 pt-2 font-semibold dark:border-zinc-700">
                        <dt>Total vendido</dt>
                        <dd>{formatPrecio(resumenTurno.total_ventas)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-zinc-500 dark:text-zinc-400">Cantidad de ventas</dt>
                        <dd>{resumenTurno.cantidad_ventas}</dd>
                      </div>
                    </dl>
                  </>
                )}
                <form onSubmit={confirmarCierre} className="mt-5 space-y-4">
                  <Campo etiqueta="Monto contado en caja (opcional)">
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={montoContado}
                      onChange={(e) => setMontoContado(e.target.value)}
                      className={INPUT}
                    />
                  </Campo>
                  <Campo etiqueta="Notas (opcional)">
                    <textarea
                      value={notasCierre}
                      onChange={(e) => setNotasCierre(e.target.value)}
                      rows={2}
                      className={`${INPUT_BASE} py-2.5`}
                    />
                  </Campo>
                  {errorTurno && (
                    <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                      {errorTurno}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={cerrarModalCierre}
                      className="btn-press h-12 flex-1 rounded-xl border border-zinc-300 text-sm font-semibold text-zinc-700 outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60 dark:border-zinc-700 dark:text-zinc-200"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={cerrandoTurno}
                      className="btn-press h-12 flex-1 rounded-xl bg-red-600 text-sm font-bold text-white outline-none hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-500/60 disabled:opacity-50"
                    >
                      {cerrandoTurno ? 'Cerrando…' : 'Confirmar cierre'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PosPage() {
  return <PosInterno />;
}
