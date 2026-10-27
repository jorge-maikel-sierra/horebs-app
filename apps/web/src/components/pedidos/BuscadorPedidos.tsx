'use client';

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { FOCO } from '@/components/formulario/estilos';
import Segmentado from '@/components/formulario/Segmentado';
import {
  FILTROS_INICIALES,
  aplicarSugerencia,
  contarFacetas,
  contarFiltrosActivos,
  palabraActual,
  plegar,
  quitarTermino,
  sugerir,
  tokenizar,
  type FiltrosPedidos,
  type Operador,
  type Orden,
  type PedidoBuscable,
  type Sugerencia,
} from '@/lib/pedidos-busqueda';

// ---------------------------------------------------------------------------
// Datos estáticos
// ---------------------------------------------------------------------------

const CLAVE_RECIENTES = 'horebs-pedidos-busquedas';
const MAX_RECIENTES = 6;

const OPERADORES: { clave: string; ejemplo: string; texto: string }[] = [
  {
    clave: 'canal:',
    ejemplo: 'canal:web',
    texto: 'Origen del pedido: web o local',
  },
  {
    clave: 'estado:',
    ejemplo: 'estado:pendiente',
    texto: 'pendiente, confirmado, preparacion, entregado, cancelado o activos',
  },
  {
    clave: 'tipo:',
    ejemplo: 'tipo:domicilio',
    texto: 'domicilio, llevar o local',
  },
  {
    clave: 'pago:',
    ejemplo: 'pago:transferencia',
    texto: 'efectivo, transferencia o tarjeta',
  },
  {
    clave: 'cliente:',
    ejemplo: 'cliente:"Ana Pérez"',
    texto: 'Nombre o apellido',
  },
  {
    clave: 'tel:',
    ejemplo: 'tel:3157861208',
    texto: 'Teléfono, completo o parcial',
  },
  {
    clave: 'producto:',
    ejemplo: 'producto:hawaiana',
    texto: 'Producto o variante',
  },
  {
    clave: 'dir:',
    ejemplo: 'dir:"calle 12"',
    texto: 'Dirección de entrega o del cliente',
  },
  { clave: 'id:', ejemplo: 'id:a1b2c3d4', texto: 'Código del pedido (#…)' },
  {
    clave: 'total:',
    ejemplo: 'total:>50000',
    texto: '>, <, rango 20000-50000 o 45k',
  },
  {
    clave: 'fecha:',
    ejemplo: 'fecha:ayer',
    texto: 'hoy, ayer, 7d, 30d o 2026-10-14',
  },
  { clave: 'correo:', ejemplo: 'correo:gmail', texto: 'Correo del cliente' },
];

const EJEMPLOS: { consulta: string; texto: string }[] = [
  { consulta: 'canal:web', texto: 'Pedidos de la web' },
  { consulta: 'canal:local', texto: 'Pedidos del local' },
  { consulta: 'estado:pendiente', texto: 'Pendientes' },
  { consulta: 'fecha:hoy', texto: 'De hoy' },
  { consulta: 'tipo:domicilio', texto: 'A domicilio' },
  { consulta: 'total:>50000', texto: 'De más de $ 50.000' },
];

const ETIQUETA_OPERADOR: Record<Operador, string> = {
  cliente: 'Cliente',
  tel: 'Teléfono',
  dir: 'Dirección',
  id: 'Pedido',
  producto: 'Producto',
  pago: 'Pago',
  estado: 'Estado',
  tipo: 'Tipo',
  canal: 'Canal',
  total: 'Total',
  fecha: 'Fecha',
  correo: 'Correo',
};

const ORDENES: { valor: Orden; texto: string }[] = [
  { valor: 'auto', texto: 'Mejor coincidencia' },
  { valor: 'recientes', texto: 'Más recientes' },
  { valor: 'antiguos', texto: 'Más antiguos' },
  { valor: 'mayor', texto: 'Mayor total' },
  { valor: 'menor', texto: 'Menor total' },
];

const GRUPOS_AVANZADOS = ['tipo', 'pago', 'fecha'] as const;

// ---------------------------------------------------------------------------
// Iconos
// ---------------------------------------------------------------------------

function Svg({
  children,
  tamano = 16,
}: {
  children: ReactNode;
  tamano?: number;
}) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {children}
    </svg>
  );
}

const IconLupa = () => (
  <Svg>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Svg>
);
const IconX = () => (
  <Svg tamano={14}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);
const IconFiltros = () => (
  <Svg>
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="8" cy="17" r="2" />
  </Svg>
);
const IconAyuda = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5M12 17h.01" />
  </Svg>
);
const IconReloj = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
);
const IconPersona = () => (
  <Svg>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" />
  </Svg>
);
const IconTelefono = () => (
  <Svg>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z" />
  </Svg>
);
const IconCaja = () => (
  <Svg>
    <path d="M3 7l9-4 9 4-9 4-9-4Z" />
    <path d="M3 7v10l9 4 9-4V7M12 11v10" />
  </Svg>
);
const IconNumeral = () => (
  <Svg>
    <path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16" />
  </Svg>
);
const IconOperador = () => (
  <Svg>
    <path d="M4 7h16M4 12h10M4 17h6" />
  </Svg>
);

const ICONO_SUGERENCIA: Record<Sugerencia['tipo'], () => ReactNode> = {
  cliente: IconPersona,
  telefono: IconTelefono,
  producto: IconCaja,
  pedido: IconNumeral,
};
const ETIQUETA_GRUPO: Record<Sugerencia['tipo'], string> = {
  cliente: 'Clientes',
  telefono: 'Teléfonos',
  producto: 'Productos',
  pedido: 'Pedidos',
};

// ---------------------------------------------------------------------------
// Recientes (localStorage, tolerante a fallos)
// ---------------------------------------------------------------------------

function leerRecientes(): string[] {
  try {
    const crudo = localStorage.getItem(CLAVE_RECIENTES);
    const lista: unknown = crudo ? JSON.parse(crudo) : [];
    return Array.isArray(lista)
      ? lista
          .filter((x): x is string => typeof x === 'string')
          .slice(0, MAX_RECIENTES)
      : [];
  } catch {
    return [];
  }
}

function escribirRecientes(lista: string[]) {
  try {
    localStorage.setItem(CLAVE_RECIENTES, JSON.stringify(lista));
  } catch {
    // Almacenamiento no disponible: la búsqueda sigue funcionando sin historial.
  }
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

type Opcion = {
  clave: string;
  grupo: string;
  icono: ReactNode;
  etiqueta: string;
  detalle?: string;
  accion: () => void;
};

export default function BuscadorPedidos({
  pedidos,
  filtros,
  hoy,
  mostrados,
  onCambiar,
  onLimpiar,
}: {
  pedidos: PedidoBuscable[];
  filtros: FiltrosPedidos;
  hoy: string;
  mostrados: number;
  onCambiar: (parcial: Partial<FiltrosPedidos>) => void;
  onLimpiar: () => void;
}) {
  const uid = useId();
  const idLista = `${uid}-lista`;
  const idAyuda = `${uid}-ayuda`;
  const idPanel = `${uid}-panel`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [activa, setActiva] = useState(-1);
  const [masFiltros, setMasFiltros] = useState(false);
  const [verAyuda, setVerAyuda] = useState(false);
  const [recientes, setRecientes] = useState<string[]>(leerRecientes);

  const conteo = useMemo(
    () => contarFacetas(pedidos, filtros, hoy),
    [pedidos, filtros, hoy],
  );
  const terminos = useMemo(() => tokenizar(filtros.texto), [filtros.texto]);
  const chips = terminos.filter((t) => t.operador);
  const avanzadosActivos = contarFiltrosActivos(filtros, [...GRUPOS_AVANZADOS]);
  const hayFiltros =
    filtros.texto.trim() !== '' ||
    filtros.orden !== FILTROS_INICIALES.orden ||
    contarFiltrosActivos(filtros, [
      'canal',
      'estado',
      'tipo',
      'pago',
      'fecha',
    ]) > 0;

  // Atajo "/" para enfocar el buscador (como en GitHub o Linear).
  useEffect(() => {
    function onTecla(e: globalThis.KeyboardEvent) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const editable =
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.tagName === 'SELECT' ||
          el.isContentEditable);
      if (
        editable ||
        document.querySelector('[role="dialog"], [role="alertdialog"]')
      )
        return;
      e.preventDefault();
      inputRef.current?.focus();
    }
    window.addEventListener('keydown', onTecla);
    return () => window.removeEventListener('keydown', onTecla);
  }, []);

  function guardarReciente(texto: string) {
    const limpio = texto.trim();
    if (!limpio) return;
    const lista = [limpio, ...recientes.filter((r) => r !== limpio)].slice(
      0,
      MAX_RECIENTES,
    );
    setRecientes(lista);
    escribirRecientes(lista);
  }

  function olvidarRecientes() {
    setRecientes([]);
    escribirRecientes([]);
  }

  function escribir(texto: string, conservarFoco = true) {
    onCambiar({ texto });
    setActiva(-1);
    if (conservarFoco) inputRef.current?.focus();
  }

  // ---- Opciones del menú desplegable ----
  const opciones = construirOpciones();

  function construirOpciones(): Opcion[] {
    const texto = filtros.texto;
    if (texto.trim() === '') {
      const delHistorial: Opcion[] = recientes.map((r) => ({
        clave: `reciente-${r}`,
        grupo: 'Búsquedas recientes',
        icono: <IconReloj />,
        etiqueta: r,
        accion: () => escribir(r),
      }));
      const ejemplos: Opcion[] = EJEMPLOS.map((e) => ({
        clave: `ejemplo-${e.consulta}`,
        grupo: 'Prueba con',
        icono: <IconOperador />,
        etiqueta: e.consulta,
        detalle: e.texto,
        accion: () => escribir(`${e.consulta} `),
      }));
      return [...delHistorial, ...ejemplos];
    }

    const palabra = palabraActual(texto);
    if (!palabra) return [];
    const deOperador: Opcion[] =
      plegar(palabra).length >= 2
        ? OPERADORES.filter((o) => o.clave.startsWith(plegar(palabra))).map(
            (o) => ({
              clave: `op-${o.clave}`,
              grupo: 'Filtrar por',
              icono: <IconOperador />,
              etiqueta: o.clave,
              detalle: o.texto,
              accion: () => escribir(texto.replace(/\S*$/, '') + o.clave),
            }),
          )
        : [];
    const deDatos: Opcion[] = sugerir(pedidos, palabra).map((s) => ({
      clave: `${s.tipo}-${s.consulta}`,
      grupo: ETIQUETA_GRUPO[s.tipo],
      icono: ICONO_SUGERENCIA[s.tipo](),
      etiqueta: s.etiqueta,
      detalle: s.detalle,
      accion: () => escribir(aplicarSugerencia(texto, s.consulta)),
    }));
    return [...deDatos, ...deOperador];
  }

  const grupos = (() => {
    const mapa = new Map<string, { opcion: Opcion; indice: number }[]>();
    opciones.forEach((opcion, indice) => {
      const lista = mapa.get(opcion.grupo) ?? [];
      lista.push({ opcion, indice });
      mapa.set(opcion.grupo, lista);
    });
    return [...mapa.entries()];
  })();

  const desplegado = abierto && opciones.length > 0;

  function onTeclaInput(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (opciones.length === 0) return;
      e.preventDefault();
      setAbierto(true);
      const n = opciones.length;
      setActiva((a) =>
        e.key === 'ArrowDown' ? (a + 1) % n : a <= 0 ? n - 1 : a - 1,
      );
    } else if (e.key === 'Enter') {
      if (desplegado && activa >= 0 && opciones[activa]) {
        e.preventDefault();
        opciones[activa].accion();
      } else {
        guardarReciente(filtros.texto);
        setAbierto(false);
      }
    } else if (e.key === 'Escape') {
      if (abierto) {
        setAbierto(false);
        setActiva(-1);
      } else if (filtros.texto) {
        escribir('');
      }
    } else if (e.key === 'Tab') {
      setAbierto(false);
    }
  }

  return (
    <div className="mt-5 space-y-3">
      {/* ---- Buscador ---- */}
      <div className="flex items-start gap-2">
        <div
          className="relative min-w-0 flex-1"
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
              setAbierto(false);
              setActiva(-1);
              guardarReciente(filtros.texto);
            }
          }}
        >
          <div className="flex items-center gap-2 rounded-2xl border border-zinc-300 bg-white px-3.5 text-zinc-500 shadow-sm transition focus-within:border-brand-orange focus-within:ring-2 focus-within:ring-brand-orange/25 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
            <IconLupa />
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded={desplegado}
              aria-controls={idLista}
              aria-autocomplete="list"
              aria-activedescendant={
                desplegado && activa >= 0 ? `${uid}-op-${activa}` : undefined
              }
              aria-label="Buscar pedidos"
              aria-describedby={idAyuda}
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="search"
              value={filtros.texto}
              placeholder="Buscar cliente, teléfono, producto, dirección, pedido…"
              onChange={(e) => {
                onCambiar({ texto: e.target.value });
                setAbierto(true);
                setActiva(-1);
              }}
              onFocus={() => setAbierto(true)}
              onKeyDown={onTeclaInput}
              className="h-12 min-w-0 flex-1 bg-transparent text-base text-zinc-900 outline-none placeholder:text-zinc-400 sm:text-sm dark:text-zinc-50 dark:placeholder:text-zinc-500"
            />
            {filtros.texto ? (
              <button
                type="button"
                onClick={() => escribir('')}
                aria-label="Borrar búsqueda"
                className={`btn-press flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 ${FOCO}`}
              >
                <IconX />
              </button>
            ) : (
              <kbd
                aria-hidden="true"
                className="hidden h-6 min-w-6 items-center justify-center rounded-md border border-zinc-300 px-1.5 font-mono text-xs text-zinc-500 sm:flex dark:border-zinc-700 dark:text-zinc-400"
              >
                /
              </kbd>
            )}
          </div>

          <p id={idAyuda} className="sr-only">
            Escribe palabras para buscar en todos los datos del pedido. Usa
            campo:valor para filtrar, por ejemplo canal:web. Flechas arriba y
            abajo para elegir una sugerencia.
          </p>

          {desplegado && (
            <div
              id={idLista}
              role="listbox"
              aria-label="Sugerencias de búsqueda"
              className="animate-desplegar absolute inset-x-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            >
              {grupos.map(([nombre, items]) => (
                <div
                  key={nombre}
                  role="group"
                  aria-label={nombre}
                  className="py-1"
                >
                  <div className="flex items-center justify-between px-2.5 pb-1">
                    <p className="text-[11px] font-bold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                      {nombre}
                    </p>
                    {nombre === 'Búsquedas recientes' && (
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={olvidarRecientes}
                        className={`rounded text-[11px] font-semibold text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 ${FOCO}`}
                      >
                        Borrar historial
                      </button>
                    )}
                  </div>
                  {items.map(({ opcion, indice }) => (
                    <div
                      key={opcion.clave}
                      id={`${uid}-op-${indice}`}
                      role="option"
                      aria-selected={indice === activa}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={opcion.accion}
                      onMouseEnter={() => setActiva(indice)}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm ${
                        indice === activa
                          ? 'bg-brand-orange/10 text-zinc-900 dark:text-zinc-50'
                          : 'text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      <span className="text-zinc-500 dark:text-zinc-400">
                        {opcion.icono}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {opcion.etiqueta}
                      </span>
                      {opcion.detalle && (
                        <span className="max-w-[45%] shrink-0 truncate text-xs text-zinc-500 dark:text-zinc-400">
                          {opcion.detalle}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          aria-expanded={verAyuda}
          aria-controls={`${uid}-ayuda-panel`}
          onClick={() => setVerAyuda((v) => !v)}
          title="Cómo buscar"
          className={`btn-press flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-zinc-300 bg-white text-zinc-600 shadow-sm transition-colors hover:text-accent-ink dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 ${FOCO} ${
            verAyuda
              ? 'border-brand-orange text-accent-ink'
              : ''
          }`}
        >
          <IconAyuda />
          <span className="sr-only">Cómo buscar</span>
        </button>
      </div>

      {verAyuda && (
        <section
          id={`${uid}-ayuda-panel`}
          aria-label="Cómo buscar pedidos"
          className="animate-desplegar card-gradient rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800"
        >
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Escribe varias palabras y deben coincidir <strong>todas</strong> (en
            cualquier dato del pedido). Usa{' '}
            <code className="font-mono text-xs">-</code> para excluir y comillas
            para frases exactas:{' '}
            <code className="font-mono text-xs">-estado:cancelado</code>,{' '}
            <code className="font-mono text-xs">&quot;pizza horebs&quot;</code>.
          </p>
          <ul className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {OPERADORES.map((o) => (
              <li key={o.clave} className="flex items-baseline gap-2 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    escribir(
                      `${filtros.texto.trim()} ${o.ejemplo} `.trimStart(),
                    )
                  }
                  className={`shrink-0 rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono font-medium text-zinc-700 hover:bg-brand-orange/15 dark:bg-zinc-800 dark:text-zinc-200 ${FOCO}`}
                >
                  {o.ejemplo}
                </button>
                <span className="text-zinc-500 dark:text-zinc-400">
                  {o.texto}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            Atajos:{' '}
            <kbd className="rounded border border-zinc-300 px-1 font-mono dark:border-zinc-700">
              /
            </kbd>{' '}
            enfoca el buscador ·{' '}
            <kbd className="rounded border border-zinc-300 px-1 font-mono dark:border-zinc-700">
              Esc
            </kbd>{' '}
            cierra o borra · flechas y{' '}
            <kbd className="rounded border border-zinc-300 px-1 font-mono dark:border-zinc-700">
              Enter
            </kbd>{' '}
            eligen una sugerencia.
          </p>
        </section>
      )}

      {/* ---- Filtros rápidos ---- */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <Segmentado
          etiqueta="Origen del pedido"
          valor={filtros.canal}
          onCambiar={(canal) => onCambiar({ canal })}
          opciones={[
            { valor: 'todos', texto: 'Todos', conteo: conteo.canal.todos },
            { valor: 'web', texto: 'Web', conteo: conteo.canal.web },
            { valor: 'pos', texto: 'Local', conteo: conteo.canal.pos },
            {
              valor: 'whatsapp',
              texto: 'WhatsApp',
              conteo: conteo.canal.whatsapp,
            },
          ]}
        />
        <Segmentado
          etiqueta="Estado del pedido"
          valor={filtros.estado}
          onCambiar={(estado) => onCambiar({ estado })}
          opciones={[
            { valor: 'todos', texto: 'Todos', conteo: conteo.estado.todos },
            {
              valor: 'activos',
              texto: 'Activos',
              conteo: conteo.estado.activos,
            },
            {
              valor: 'entregado',
              texto: 'Entregados',
              conteo: conteo.estado.entregado,
            },
            {
              valor: 'cancelado',
              texto: 'Cancelados',
              conteo: conteo.estado.cancelado,
            },
          ]}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-expanded={masFiltros}
          aria-controls={idPanel}
          onClick={() => setMasFiltros((v) => !v)}
          className={`btn-press inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold transition-colors ${FOCO} ${
            masFiltros || avanzadosActivos > 0
              ? 'border-brand-orange bg-brand-orange/10 text-accent-ink'
              : 'border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
          }`}
        >
          <IconFiltros />
          Más filtros
          {avanzadosActivos > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-orange px-1 text-xs font-bold text-white">
              {avanzadosActivos}
            </span>
          )}
        </button>

        <label className="inline-flex h-10 items-center gap-2 rounded-xl border border-zinc-300 bg-white pr-1 pl-3.5 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          <span className="whitespace-nowrap">Ordenar</span>
          <select
            value={filtros.orden}
            onChange={(e) => onCambiar({ orden: e.target.value as Orden })}
            className={`h-8 cursor-pointer rounded-lg bg-transparent pr-1 pl-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50 ${FOCO}`}
          >
            {ORDENES.map((o) => (
              <option key={o.valor} value={o.valor} className="text-zinc-900">
                {o.texto}
              </option>
            ))}
          </select>
        </label>

        <p
          role="status"
          aria-live="polite"
          className="ml-auto text-sm text-zinc-500 tabular-nums dark:text-zinc-400"
        >
          <span className="font-bold text-zinc-900 dark:text-zinc-50">
            {mostrados}
          </span>{' '}
          de {pedidos.length} pedido{pedidos.length === 1 ? '' : 's'}
        </p>
        {hayFiltros && (
          <button
            type="button"
            onClick={() => {
              onLimpiar();
              inputRef.current?.focus();
            }}
            className={`inline-flex h-10 items-center rounded-lg px-2 text-sm font-semibold text-accent-ink hover:underline ${FOCO}`}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {masFiltros && (
        <div
          id={idPanel}
          className="animate-desplegar card-gradient grid grid-cols-1 gap-4 rounded-2xl border border-zinc-200 p-3 sm:p-4 md:grid-cols-2 2xl:grid-cols-3 dark:border-zinc-800"
        >
          <div className="min-w-0">
            <p className="mb-1.5 text-[11px] font-bold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
              Tipo de pedido
            </p>
            <Segmentado
              etiqueta="Tipo de pedido"
              valor={filtros.tipo}
              onCambiar={(tipo) => onCambiar({ tipo })}
              opciones={[
                { valor: 'todos', texto: 'Todos', conteo: conteo.tipo.todos },
                {
                  valor: 'domicilio',
                  texto: 'Domicilio',
                  conteo: conteo.tipo.domicilio,
                },
                {
                  valor: 'retiro',
                  texto: 'Llevar',
                  conteo: conteo.tipo.retiro,
                },
                { valor: 'local', texto: 'Local', conteo: conteo.tipo.local },
              ]}
            />
          </div>
          <div className="min-w-0">
            <p className="mb-1.5 text-[11px] font-bold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
              Método de pago
            </p>
            <Segmentado
              etiqueta="Método de pago"
              valor={filtros.pago}
              onCambiar={(pago) => onCambiar({ pago })}
              opciones={[
                { valor: 'todos', texto: 'Todos', conteo: conteo.pago.todos },
                {
                  valor: 'efectivo',
                  texto: 'Efectivo',
                  conteo: conteo.pago.efectivo,
                },
                {
                  valor: 'transferencia',
                  texto: 'Transf.',
                  conteo: conteo.pago.transferencia,
                },
                {
                  valor: 'tarjeta',
                  texto: 'Tarjeta',
                  conteo: conteo.pago.tarjeta,
                },
              ]}
            />
          </div>
          <div className="min-w-0">
            <p className="mb-1.5 text-[11px] font-bold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
              Fecha
            </p>
            <Segmentado
              etiqueta="Fecha del pedido"
              valor={filtros.fecha}
              onCambiar={(fecha) => onCambiar({ fecha })}
              opciones={[
                { valor: 'todos', texto: 'Todas', conteo: conteo.fecha.todos },
                { valor: 'hoy', texto: 'Hoy', conteo: conteo.fecha.hoy },
                { valor: 'ayer', texto: 'Ayer', conteo: conteo.fecha.ayer },
                { valor: '7d', texto: '7 días', conteo: conteo.fecha['7d'] },
                { valor: '30d', texto: '30 días', conteo: conteo.fecha['30d'] },
              ]}
            />
          </div>
        </div>
      )}

      {chips.length > 0 && (
        <ul
          className="flex flex-wrap gap-1.5"
          aria-label="Filtros de la búsqueda"
        >
          {chips.map((t) => {
            const etiqueta = `${t.negado ? 'No ' : ''}${ETIQUETA_OPERADOR[t.operador as Operador]}: ${t.valor}`;
            return (
              <li key={t.bruto}>
                <span className="animate-pop-in inline-flex items-center gap-1 rounded-full border border-brand-orange/40 bg-brand-orange/10 py-0.5 pr-0.5 pl-3 text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                  {etiqueta}
                  <button
                    type="button"
                    onClick={() =>
                      escribir(quitarTermino(filtros.texto, t), false)
                    }
                    aria-label={`Quitar filtro ${etiqueta}`}
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-zinc-600 hover:bg-brand-orange/20 dark:text-zinc-300 ${FOCO}`}
                  >
                    <IconX />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
