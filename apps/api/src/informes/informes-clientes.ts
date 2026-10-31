import { claveBucket, serializarSerieClientes } from './informes-fechas';
import {
  MAX_LISTA_CLIENTES,
  type Granularidad,
  type InformeClienteListaDto,
  type InformeClientesDto,
  type PedidoUnificado,
} from './informes.tipos';

const MAX_TOP_CLIENTES = 8;

/** Fila de `clientes` o `historico_clientes` con la fecha ya elegida. */
export interface ClienteFila {
  telefono: string;
  nombre: string;
  apellido: string | null;
  /** `created_at` (vivo) o `primera_compra` (histórico). */
  fecha: string;
}

interface PrimeraCompra {
  fecha: string;
  nombre: string;
}

interface Actividad {
  pedidos: number;
  total: number;
}

export interface EntradaInformeClientes {
  /** Pedidos del rango, de las dos tablas. */
  filas: PedidoUnificado[];
  clientesVivos: ClienteFila[];
  clientesHistoricos: ClienteFila[];
  desde: string;
  hasta: string;
  desdeISO: string;
  granularidad: Granularidad;
}

const nombreCompleto = (c: ClienteFila): string =>
  `${c.nombre} ${c.apellido ?? ''}`.trim();

/**
 * La fecha real de primera compra de cada teléfono: la más antigua entre
 * el cliente vivo y el migrado de WooCommerce (un mismo cliente puede
 * tener historial en ambas tablas).
 */
function primeraCompraPorTelefono(
  vivos: ClienteFila[],
  historicos: ClienteFila[],
): Map<string, PrimeraCompra> {
  const mapa = new Map<string, PrimeraCompra>();
  for (const c of historicos) {
    mapa.set(c.telefono, { fecha: c.fecha, nombre: nombreCompleto(c) });
  }
  for (const c of vivos) {
    const existente = mapa.get(c.telefono);
    if (!existente || new Date(c.fecha) < new Date(existente.fecha)) {
      mapa.set(c.telefono, { fecha: c.fecha, nombre: nombreCompleto(c) });
    }
  }
  return mapa;
}

function actividadPorTelefono(
  filas: PedidoUnificado[],
): Map<string, Actividad> {
  const mapa = new Map<string, Actividad>();
  for (const p of filas) {
    if (!p.telefono) continue;
    const actual = mapa.get(p.telefono) ?? { pedidos: 0, total: 0 };
    actual.pedidos += 1;
    actual.total += p.total;
    mapa.set(p.telefono, actual);
  }
  return mapa;
}

const SIN_ACTIVIDAD: Actividad = { pedidos: 0, total: 0 };

/**
 * "Nuevo" vs "recurrente" se define contra la fecha real de primera compra
 * de cada teléfono: es nuevo quien compró por primera vez dentro del rango.
 */
export function armarInformeClientes(
  entrada: EntradaInformeClientes,
): InformeClientesDto {
  const { filas, desde, hasta, desdeISO, granularidad } = entrada;
  const telefonos = [
    ...new Set(filas.map((p) => p.telefono).filter((t): t is string => !!t)),
  ];
  const primeraCompra = primeraCompraPorTelefono(
    entrada.clientesVivos,
    entrada.clientesHistoricos,
  );
  const actividad = actividadPorTelefono(filas);
  const desdeMs = new Date(desdeISO).getTime();

  const altasPorBucket = new Map<string, number>();
  const listaNuevos: InformeClienteListaDto[] = [];
  const listaRecurrentes: InformeClienteListaDto[] = [];
  for (const telefono of telefonos) {
    const info = primeraCompra.get(telefono);
    if (!info) continue;
    const stats = actividad.get(telefono) ?? SIN_ACTIVIDAD;
    const cliente: InformeClienteListaDto = {
      id: telefono,
      nombre: info.nombre || 'Cliente',
      telefono,
      pedidos: stats.pedidos,
      total: stats.total,
      primera_compra: info.fecha,
    };
    if (new Date(info.fecha).getTime() >= desdeMs) {
      listaNuevos.push(cliente);
      const bucket = claveBucket(info.fecha, granularidad);
      altasPorBucket.set(bucket, (altasPorBucket.get(bucket) ?? 0) + 1);
    } else {
      listaRecurrentes.push(cliente);
    }
  }

  listaNuevos.sort(
    (a, b) =>
      new Date(b.primera_compra).getTime() -
      new Date(a.primera_compra).getTime(),
  );
  listaRecurrentes.sort((a, b) => b.total - a.total);

  const ventasActivos = [...actividad.values()].reduce(
    (suma, v) => suma + v.total,
    0,
  );
  const topClientes = telefonos
    .map((telefono) => {
      const stats = actividad.get(telefono) ?? SIN_ACTIVIDAD;
      return {
        id: telefono,
        nombre: primeraCompra.get(telefono)?.nombre || 'Cliente',
        telefono,
        pedidos: stats.pedidos,
        total: stats.total,
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, MAX_TOP_CLIENTES);

  return {
    nuevos: listaNuevos.length,
    recurrentes: listaRecurrentes.length,
    ticket_promedio:
      telefonos.length > 0 ? ventasActivos / telefonos.length : 0,
    serie_diaria_nuevos: serializarSerieClientes(
      altasPorBucket,
      desde,
      hasta,
      granularidad,
    ),
    top_clientes: topClientes,
    lista_nuevos: listaNuevos.slice(0, MAX_LISTA_CLIENTES),
    lista_recurrentes: listaRecurrentes.slice(0, MAX_LISTA_CLIENTES),
  };
}
