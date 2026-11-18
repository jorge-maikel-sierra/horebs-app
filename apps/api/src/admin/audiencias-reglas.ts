/**
 * Segmentos de clientes que la plataforma publica en Meta como públicos
 * personalizados. Puro, sin Nest: decide quién entra a cada segmento y arma las
 * filas cifradas (SHA-256) que pide Meta; nada personal sale en claro.
 */
import { MS_POR_DIA } from '../common/tiempo';
import {
  nombreParaMeta,
  sha256,
  telefonoParaMeta,
  ubicacionParaMeta,
} from '../mensajeria/conversiones-web';

export interface ClienteAudiencia {
  id: string;
  nombre: string | null;
  apellido: string | null;
  telefono: string | null;
  correo: string | null;
  ciudad: string | null;
  departamento: string | null;
}

export interface PedidoAudiencia {
  cliente_id: string | null;
  total: number | string;
  estado: string;
  created_at: string;
}

export type ClaveSegmento =
  'recurrentes' | 'inactivos' | 'nuevos' | 'mejores' | 'recientes';

export interface DefinicionSegmento {
  clave: ClaveSegmento;
  /** Nombre del público en Meta; el prefijo "Horebs ·" lo distingue de los que se crean a mano. */
  nombre: string;
  descripcion: string;
}

// Ajustables: decisión de negocio, no de Meta.
export const DIAS_INACTIVO = 45;
export const DIAS_NUEVO = 30;
export const DIAS_RECIENTE = 7;
export const PORCENTAJE_MEJORES = 20;
const PEDIDOS_RECURRENTE = 2;
const CIEN = 100;

export const SEGMENTOS: DefinicionSegmento[] = [
  {
    clave: 'recurrentes',
    nombre: 'Horebs · Clientes recurrentes',
    descripcion: 'Clientes con 2 o más pedidos.',
  },
  {
    clave: 'inactivos',
    nombre: 'Horebs · Clientes inactivos',
    descripcion: `Compraron alguna vez y su último pedido fue hace más de ${DIAS_INACTIVO} días: para campañas de recompra.`,
  },
  {
    clave: 'nuevos',
    nombre: 'Horebs · Clientes nuevos',
    descripcion: `Hicieron su primer pedido en los últimos ${DIAS_NUEVO} días.`,
  },
  {
    clave: 'mejores',
    nombre: 'Horebs · Mejores clientes',
    descripcion: `El ${PORCENTAJE_MEJORES}% que más ha gastado: semilla del público parecido.`,
  },
  {
    clave: 'recientes',
    nombre: 'Horebs · Compraron esta semana',
    descripcion: `Su último pedido fue en los últimos ${DIAS_RECIENTE} días: para excluirlos de los anuncios.`,
  },
];

export const NOMBRE_PARECIDO =
  'Horebs · Parecido a mejores clientes (1% Colombia)';

export interface ResumenCliente {
  cliente: ClienteAudiencia;
  pedidos: number;
  gastado: number;
  primero: number;
  ultimo: number;
}

/** Pedidos vigentes de cada cliente: cuántos, cuánto gastó, el primero y el último. */
export function resumenesDeClientes(
  clientes: ClienteAudiencia[],
  pedidos: PedidoAudiencia[],
): ResumenCliente[] {
  const porCliente = new Map<string, ClienteAudiencia>(
    clientes.map((c) => [c.id, c]),
  );
  const acumulado = new Map<string, ResumenCliente>();
  for (const p of pedidos) {
    const cliente = p.cliente_id ? porCliente.get(p.cliente_id) : undefined;
    if (!cliente || p.estado === 'cancelado') continue;
    const fecha = Date.parse(p.created_at);
    const actual = acumulado.get(cliente.id) ?? {
      cliente,
      pedidos: 0,
      gastado: 0,
      primero: fecha,
      ultimo: fecha,
    };
    actual.pedidos += 1;
    actual.gastado += Number(p.total);
    actual.primero = Math.min(actual.primero, fecha);
    actual.ultimo = Math.max(actual.ultimo, fecha);
    acumulado.set(cliente.id, actual);
  }
  return [...acumulado.values()];
}

function hace(ahora: Date, dias: number): number {
  return ahora.getTime() - dias * MS_POR_DIA;
}

function mejoresClientes(resumenes: ResumenCliente[]): ResumenCliente[] {
  const cantidad = Math.max(
    1,
    Math.ceil((resumenes.length * PORCENTAJE_MEJORES) / CIEN),
  );
  return [...resumenes]
    .sort((a, b) => b.gastado - a.gastado)
    .slice(0, cantidad);
}

/** Quién entra a cada segmento; un cliente puede estar en varios. */
export function miembrosPorSegmento(
  resumenes: ResumenCliente[],
  ahora: Date,
): Map<ClaveSegmento, ClienteAudiencia[]> {
  const solo = (lista: ResumenCliente[]): ClienteAudiencia[] =>
    lista.map((r) => r.cliente);
  return new Map<ClaveSegmento, ClienteAudiencia[]>([
    [
      'recurrentes',
      solo(resumenes.filter((r) => r.pedidos >= PEDIDOS_RECURRENTE)),
    ],
    [
      'inactivos',
      solo(resumenes.filter((r) => r.ultimo < hace(ahora, DIAS_INACTIVO))),
    ],
    [
      'nuevos',
      solo(resumenes.filter((r) => r.primero >= hace(ahora, DIAS_NUEVO))),
    ],
    ['mejores', solo(mejoresClientes(resumenes))],
    [
      'recientes',
      solo(resumenes.filter((r) => r.ultimo >= hace(ahora, DIAS_RECIENTE))),
    ],
  ]);
}

/** Orden de las columnas de cada fila que se envía a Meta. */
export const ESQUEMA_AUDIENCIA = [
  'PHONE',
  'EMAIL',
  'FN',
  'LN',
  'CT',
  'ST',
  'COUNTRY',
];
const PAIS = 'co';

function cifrado(valor: string | null): string {
  return valor ? sha256(valor) : '';
}

/** null si el cliente no tiene teléfono ni correo: sin eso Meta no lo puede emparejar. */
export function filaAudiencia(cliente: ClienteAudiencia): string[] | null {
  const telefono = telefonoParaMeta(cliente.telefono);
  const correo = cliente.correo?.trim().toLowerCase() || null;
  if (!telefono && !correo) return null;
  const ubicacion = ubicacionParaMeta(cliente);
  return [
    cifrado(telefono),
    cifrado(correo),
    cifrado(nombreParaMeta(cliente.nombre)),
    cifrado(nombreParaMeta(cliente.apellido)),
    ubicacion.ct[0],
    ubicacion.st[0],
    sha256(PAIS),
  ];
}

export function filasAudiencia(clientes: ClienteAudiencia[]): string[][] {
  return clientes.map(filaAudiencia).filter((f): f is string[] => f !== null);
}
