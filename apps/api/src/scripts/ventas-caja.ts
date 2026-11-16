import type { SupabaseClient } from '@supabase/supabase-js';
import { errorDeBase } from '../common/error-de-base';
import type { OrigenVenta } from '../admin/pedidos-admin.tipos';
import type { VentaCajaParaEvento } from '../mensajeria/conversiones-caja';

interface FilaVentaCaja {
  id: string;
  total: number | string;
  modalidad: string;
  origen_venta: OrigenVenta | null;
  created_at: string;
  clientes: VentaCajaParaEvento['cliente'] | null;
  items_pedido: { variante_id: string | null; cantidad: number }[] | null;
}

// PostgREST devuelve como mucho 1.000 filas por consulta: se pagina.
const TAMANO_PAGINA = 1000;

const COLUMNAS =
  'id, total, modalidad, origen_venta, created_at, clientes(id, nombre, apellido, telefono, correo), items_pedido(variante_id, cantidad)';

async function leerPagina(
  client: SupabaseClient,
  desde: string,
  pagina: number,
): Promise<FilaVentaCaja[]> {
  const { data, error } = await client
    .from('pedidos')
    .select(COLUMNAS)
    .eq('canal', 'pos')
    .eq('estado', 'entregado')
    .gte('created_at', `${desde}T00:00:00-05:00`)
    .order('created_at', { ascending: true })
    .range(pagina * TAMANO_PAGINA, (pagina + 1) * TAMANO_PAGINA - 1)
    .returns<FilaVentaCaja[]>();
  if (error) throw errorDeBase(error);
  return data ?? [];
}

function aVentaCaja(fila: FilaVentaCaja): VentaCajaParaEvento[] {
  if (!fila.clientes) return [];
  return [
    {
      pedidoId: fila.id,
      total: Number(fila.total),
      modalidad: fila.modalidad,
      origen: fila.origen_venta,
      creadoEn: new Date(fila.created_at),
      cliente: fila.clientes,
      items: (fila.items_pedido ?? []).map((i) => ({
        varianteId: i.variante_id,
        cantidad: i.cantidad,
      })),
    },
  ];
}

/** Las ventas entregadas de caja desde un día (hora de Bogotá), de la más vieja a la más nueva. */
export async function leerVentasCaja(
  client: SupabaseClient,
  desde: string,
): Promise<VentaCajaParaEvento[]> {
  const filas: FilaVentaCaja[] = [];
  for (let pagina = 0; ; pagina += 1) {
    const lote = await leerPagina(client, desde, pagina);
    filas.push(...lote);
    if (lote.length < TAMANO_PAGINA) break;
  }
  return filas.flatMap(aVentaCaja);
}
