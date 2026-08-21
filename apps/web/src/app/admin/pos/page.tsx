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
      className={`btn-press card-interactive flex flex-1 flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-colors ${
        selected
          ? 'btn-gradient border-transparent text-white shadow-sm'
          : 'card-gradient border-zinc-200 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300'
      }`}
    >
      {icon}
      <span className="text-xs font-semibold">{label}</span>
    </button>
  );
}

function ProductoCard({
  producto,
  onAgregar,
}: {
  producto: Producto;
  onAgregar: (variante: Variante) => void;
}) {
  const unaVariante = producto.variantes.length === 1;
  const [imagenRota, setImagenRota] = useState(false);

  return (
    <div className="card-interactive card-gradient flex flex-col overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
      <div className="group relative h-24 w-full shrink-0 overflow-hidden bg-zinc-100 dark:bg-zinc-900">
        {producto.imagen_url && !imagenRota ? (
          <Image
            src={producto.imagen_url}
            alt={producto.nombre}
            fill
            sizes="(min-width: 1024px) 200px, 45vw"
            className="object-cover transition-transform duration-500 group-hover:scale-110"
            onError={() => setImagenRota(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-zinc-300 dark:text-zinc-700">
            <IconPlato />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-2.5">
        <p className="line-clamp-2 text-xs leading-snug font-semibold text-zinc-900 dark:text-zinc-50">
          {producto.nombre}
        </p>
        {unaVariante ? (
          <button
            type="button"
            onClick={() => onAgregar(producto.variantes[0])}
            className="btn-press mt-auto flex items-center justify-between gap-1 rounded-lg bg-brand-orange/10 px-2 py-1.5 text-[11px] font-bold text-brand-orange transition-colors hover:bg-brand-orange hover:text-white"
          >
            <span>Agregar</span>
            <span>
              {formatPrecio(producto.variantes[0].precio_oferta ?? producto.variantes[0].precio)}
            </span>
          </button>
        ) : (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {producto.variantes.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => onAgregar(v)}
                className="btn-press rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-semibold text-zinc-700 transition-colors hover:bg-brand-orange hover:text-white dark:bg-zinc-800 dark:text-zinc-300"
              >
                {v.nombre} · {formatPrecio(v.precio_oferta ?? v.precio)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
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
      setError('Escribí el nombre del producto personalizado.');
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
      setErrorTurno('Ingresá un monto válido.');
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
      setError('Agregá al menos un producto.');
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

  if (cargandoTurno) {
    return (
      <div className="p-8">
        <CargandoSkeleton filas={10} />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
            Punto de venta
          </h1>
          {turno && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Turno abierto desde las {formatHora(turno.abierto_en)} — caja
              inicial {formatPrecio(turno.monto_inicial)}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/pedidos"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-brand-orange dark:border-zinc-700 dark:text-zinc-300"
          >
            Ver pedidos
          </Link>
          {turno && (
            <button
              type="button"
              onClick={abrirModalCierre}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
            >
              Cerrar turno
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2 lg:items-start lg:gap-8">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Productos
          </h2>

          {categorias.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {categorias.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoriaSeleccionada(cat.id)}
                  className={`btn-press shrink-0 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors ${
                    categoriaSeleccionada === cat.id
                      ? 'btn-gradient text-white shadow-sm'
                      : 'card-gradient border border-zinc-200 text-zinc-600 dark:border-zinc-800 dark:text-zinc-300'
                  }`}
                >
                  {cat.nombre}
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {productosDeCategoria.map((producto) => (
              <ProductoCard
                key={producto.id}
                producto={producto}
                onAgregar={(v) => agregarItem(producto, v)}
              />
            ))}
          </div>
          {categoriaSeleccionada && productosDeCategoria.length === 0 && (
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
              No hay productos en esta categoría.
            </p>
          )}

          <div className="mt-4 rounded-2xl border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Producto personalizado
            </p>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Para bordes, adicionales o algo que no esté en el catálogo.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                value={nombrePersonalizado}
                onChange={(e) => setNombrePersonalizado(e.target.value)}
                placeholder="Ej: Borde de queso"
                className="min-w-0 flex-1 rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
              <input
                type="number"
                min={0}
                step={500}
                value={precioPersonalizado}
                onChange={(e) => setPrecioPersonalizado(e.target.value)}
                placeholder="Precio"
                className="w-28 rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
              <button
                type="button"
                onClick={agregarPersonalizado}
                className="shrink-0 rounded-md bg-brand-orange px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
              >
                Agregar
              </button>
            </div>
          </div>
        </div>

        <div className="lg:sticky lg:top-6">
          <div className="card-gradient rounded-2xl border border-zinc-200 p-4 shadow-sm dark:border-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Venta actual
            </h2>

            {items.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                Todavía no agregaste productos.
              </p>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {items.map((i) => (
                  <li
                    key={i.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-zinc-100 px-2.5 py-1.5 text-sm dark:border-zinc-800/70"
                  >
                    <span className="min-w-0 truncate">
                      {i.varianteNombre
                        ? `${i.productoNombre} (${i.varianteNombre})`
                        : i.productoNombre}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => actualizarCantidad(i.id, i.cantidad - 1)}
                        className="btn-press h-6 w-6 rounded-full border border-zinc-300 text-xs dark:border-zinc-700"
                      >
                        −
                      </button>
                      {i.cantidad}
                      <button
                        type="button"
                        onClick={() => actualizarCantidad(i.id, i.cantidad + 1)}
                        className="btn-press h-6 w-6 rounded-full border border-zinc-300 text-xs dark:border-zinc-700"
                      >
                        +
                      </button>
                      {editandoPrecioId === i.id ? (
                        <input
                          type="number"
                          min={0}
                          autoFocus
                          defaultValue={i.precio}
                          onBlur={(e) => {
                            editarPrecio(i.id, Number(e.target.value));
                            setEditandoPrecioId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.currentTarget.blur();
                          }}
                          className="w-20 rounded-md border border-zinc-300 px-1.5 py-0.5 text-right text-sm dark:border-zinc-700 dark:bg-zinc-900"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditandoPrecioId(i.id)}
                          title="Editar precio unitario"
                          className="w-20 text-right font-medium underline decoration-dotted"
                        >
                          {formatPrecio(i.precio * i.cantidad)}
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-800">
              {modalidad === 'domicilio' && (
                <>
                  <div className="flex justify-between text-sm text-zinc-500 dark:text-zinc-400">
                    <span>Subtotal</span>
                    <span>{formatPrecio(totalItems)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-zinc-500 dark:text-zinc-400">
                    <span>Domicilio</span>
                    <span>{formatPrecio(costoDomicilio)}</span>
                  </div>
                </>
              )}
              {descuentoPuntos > 0 && (
                <div className="flex justify-between text-sm text-green-700 dark:text-green-500">
                  <span>Descuento · {canjePuntos} puntos</span>
                  <span>-{formatPrecio(descuentoPuntos)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span className="text-brand-orange">{formatPrecio(totalConDescuento)}</span>
              </div>
            </div>

            <form onSubmit={registrarVenta} className="mt-6 space-y-3">
              <div className="relative">
                <label className="block text-sm font-medium">
                  Buscar cliente existente
                </label>
                <input
                  value={busquedaCliente}
                  onChange={(e) => setBusquedaCliente(e.target.value)}
                  placeholder="Nombre o teléfono…"
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                />
                {resultadosCliente.length > 0 && (
                  <ul className="absolute z-10 mt-1 w-full rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                    {resultadosCliente.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => seleccionarCliente(c)}
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                          <span className="font-medium">
                            {c.nombre} {c.apellido ?? ''}
                          </span>
                          {c.telefono && (
                            <span className="ml-2 text-zinc-500 dark:text-zinc-400">
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
                <div>
                  <label className="block text-sm font-medium">Nombre</label>
                  <input
                    required
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Apellido</label>
                  <input
                    value={apellido}
                    onChange={(e) => setApellido(e.target.value)}
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium">
                    Teléfono (opcional)
                  </label>
                  <input
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    onBlur={() => consultarSaldoPuntos(telefono)}
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">
                    Correo (opcional)
                  </label>
                  <input
                    type="email"
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value)}
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium">
                  Cédula (opcional)
                </label>
                <input
                  value={cedula}
                  onChange={(e) => setCedula(e.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>

              {puedeCanjear && (
                <div className="flex items-center justify-between gap-3 rounded-md border border-brand-orange/25 bg-brand-orange/[0.06] px-3 py-2">
                  <label htmlFor="pos-usar-puntos" className="text-sm text-zinc-700 dark:text-zinc-300">
                    {saldoPuntos?.puntos} puntos disponibles — usar {canjePuntos} (
                    {formatPrecio(canjePuntos * (saldoPuntos?.valorPuntoPesos ?? 0))})
                  </label>
                  <input
                    id="pos-usar-puntos"
                    type="checkbox"
                    checked={usarPuntos}
                    onChange={(e) => setUsarPuntos(e.target.checked)}
                    className="h-5 w-5 shrink-0 accent-brand-orange"
                  />
                </div>
              )}

              <div>
                <span className="block text-sm font-medium">Modalidad</span>
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
              </div>

              {modalidad === 'domicilio' && (
                <>
                  <div>
                    <label className="block text-sm font-medium">
                      Dirección de entrega
                    </label>
                    <input
                      required
                      value={direccionEntrega}
                      onChange={(e) => setDireccionEntrega(e.target.value)}
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">
                      Costo de domicilio
                    </label>
                    <input
                      required
                      type="number"
                      min={0}
                      step={500}
                      value={costoDomicilio}
                      onChange={(e) => setCostoDomicilio(Number(e.target.value))}
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </div>
                </>
              )}

              <div>
                <span className="block text-sm font-medium">Método de pago</span>
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
              </div>

              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              {mensaje && (
                <p className="text-sm text-green-600 dark:text-green-500">{mensaje}</p>
              )}

              <button
                type="submit"
                disabled={enviando}
                className="btn-press w-full rounded-lg btn-gradient py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {enviando ? 'Registrando…' : 'Registrar venta'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {!turno && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="animate-fade-up w-full max-w-md rounded-2xl bg-white p-6 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Abrir turno
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Antes de usar el punto de venta, contá cuánto hay en caja para
              arrancar el turno.
            </p>
            <form onSubmit={abrirTurno} className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium">
                  Monto inicial en caja
                </label>
                <input
                  required
                  type="number"
                  min={0}
                  step={1000}
                  autoFocus
                  value={montoInicial}
                  onChange={(e) => setMontoInicial(e.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
              {errorTurno && (
                <p className="text-sm text-red-600 dark:text-red-400">{errorTurno}</p>
              )}
              <button
                type="submit"
                disabled={abriendoTurno}
                className="btn-press w-full rounded-lg btn-gradient py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {abriendoTurno ? 'Abriendo…' : 'Abrir turno'}
              </button>
            </form>
          </div>
        </div>
      )}

      {mostrarCierre && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="animate-fade-up w-full max-w-md rounded-2xl bg-white p-6 dark:bg-zinc-900">
            {resultadoCierre ? (
              <>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Turno cerrado
                </h2>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt>Ventas en efectivo</dt>
                    <dd>{formatPrecio(resultadoCierre.resumen.total_efectivo)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Ventas por transferencia</dt>
                    <dd>
                      {formatPrecio(resultadoCierre.resumen.total_transferencia)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Ventas con tarjeta</dt>
                    <dd>{formatPrecio(resultadoCierre.resumen.total_tarjeta)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-zinc-200 pt-2 font-semibold dark:border-zinc-800">
                    <dt>Total vendido</dt>
                    <dd>{formatPrecio(resultadoCierre.resumen.total_ventas)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Cantidad de ventas</dt>
                    <dd>{resultadoCierre.resumen.cantidad_ventas}</dd>
                  </div>
                  <div className="flex justify-between">
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
                              ? 'text-green-600 dark:text-green-500'
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
                  className="btn-press mt-6 w-full rounded-lg btn-gradient py-3 font-semibold text-white hover:opacity-90"
                >
                  Listo
                </button>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Cerrar turno
                </h2>
                {turno && resumenTurno && (
                  <dl className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt>Caja inicial</dt>
                      <dd>{formatPrecio(turno.monto_inicial)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Ventas en efectivo</dt>
                      <dd>{formatPrecio(resumenTurno.total_efectivo)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Ventas por transferencia</dt>
                      <dd>{formatPrecio(resumenTurno.total_transferencia)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Ventas con tarjeta</dt>
                      <dd>{formatPrecio(resumenTurno.total_tarjeta)}</dd>
                    </div>
                    <div className="flex justify-between border-t border-zinc-200 pt-2 font-semibold dark:border-zinc-800">
                      <dt>Total vendido</dt>
                      <dd>{formatPrecio(resumenTurno.total_ventas)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Cantidad de ventas</dt>
                      <dd>{resumenTurno.cantidad_ventas}</dd>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <dt>Caja esperada</dt>
                      <dd>
                        {formatPrecio(
                          turno.monto_inicial + resumenTurno.total_efectivo,
                        )}
                      </dd>
                    </div>
                  </dl>
                )}
                <form onSubmit={confirmarCierre} className="mt-4 space-y-3">
                  <div>
                    <label className="block text-sm font-medium">
                      Monto contado en caja (opcional)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={montoContado}
                      onChange={(e) => setMontoContado(e.target.value)}
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">
                      Notas (opcional)
                    </label>
                    <textarea
                      value={notasCierre}
                      onChange={(e) => setNotasCierre(e.target.value)}
                      rows={2}
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </div>
                  {errorTurno && (
                    <p className="text-sm text-red-600 dark:text-red-400">{errorTurno}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={cerrarModalCierre}
                      className="flex-1 rounded-lg border border-zinc-300 py-2 text-sm font-semibold dark:border-zinc-700"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={cerrandoTurno}
                      className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
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
