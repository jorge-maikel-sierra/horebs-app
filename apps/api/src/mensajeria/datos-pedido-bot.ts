import type { ModalidadPedido } from './conversaciones.tipos';
import { SIN_TOTAL_INVENTADO } from './gemini-prompt';

const MODALIDADES: ModalidadPedido[] = ['domicilio', 'retiro', 'local'];
// Mismo tope que el carrito del catálogo en parseo-webhook.ts.
const MAX_CANTIDAD_ITEM = 20;

export interface DatosClientePedido {
  modalidad: ModalidadPedido;
  direccion?: string;
  nombre: string;
  apellido: string;
}

export type ValidacionDatos =
  { ok: true; datos: DatosClientePedido } | { ok: false; texto: string };

/** Un argumento del modelo como texto; lo que no sea texto ni número cuenta como vacío. */
export function textoDe(valor: unknown): string {
  return typeof valor === 'string' || typeof valor === 'number'
    ? String(valor)
    : '';
}

/** Los productos pedidos por escrito en los argumentos de `calcular_pedido`. */
export function itemsEscritosDe(
  argumentos: Record<string, unknown>,
): Record<string, unknown>[] {
  return Array.isArray(argumentos.items)
    ? (argumentos.items as Record<string, unknown>[])
    : [];
}

/** Cantidad entera acotada a 1–20; lo que no se entiende cuenta como 1. */
export function cantidadDe(item: Record<string, unknown>): number {
  const cruda = Math.round(Number(item.cantidad ?? 1)) || 1;
  return Math.min(Math.max(cruda, 1), MAX_CANTIDAD_ITEM);
}

/**
 * Guardrail real, no solo la instrucción del prompt — si Gemini intenta
 * calcular sin nombre completo, sin modalidad válida o sin dirección en un
 * domicilio, `calcular_pedido` se niega y lo manda a preguntar, en vez de
 * confiar en que el modelo siempre respete el "required" del schema.
 */
export function validarDatosCliente(
  argumentos: Record<string, unknown>,
): ValidacionDatos {
  const nombre = textoDe(argumentos.nombre).trim();
  const apellido = textoDe(argumentos.apellido).trim();
  const modalidad = textoDe(argumentos.modalidad).toLowerCase();
  const direccion = textoDe(argumentos.direccion).trim();

  const falta = datoFaltante({ nombre, apellido, modalidad, direccion });
  if (falta) return { ok: false, texto: falta };
  return {
    ok: true,
    datos: {
      modalidad: modalidad as ModalidadPedido,
      direccion: direccion || undefined,
      nombre,
      apellido,
    },
  };
}

/** El mensaje para el modelo si falta algún dato del cliente, en el orden en que se pregunta. */
function datoFaltante(d: {
  nombre: string;
  apellido: string;
  modalidad: string;
  direccion: string;
}): string | null {
  if (!d.nombre || !d.apellido) {
    return 'Todavía falta el nombre completo (nombre y apellido) de quien hace el pedido — preguntáselo al cliente antes de calcular el total.';
  }
  if (!MODALIDADES.includes(d.modalidad as ModalidadPedido)) {
    return `Falta la modalidad: preguntale al cliente si es para domicilio, para retirar o para comer en el local. ${SIN_TOTAL_INVENTADO}`;
  }
  if (d.modalidad === 'domicilio' && !d.direccion) {
    return `Falta la dirección de entrega: preguntásela al cliente. ${SIN_TOTAL_INVENTADO}`;
  }
  return null;
}
