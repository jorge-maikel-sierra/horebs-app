import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { errorDeBase } from '../common/error-de-base';
import { haceHoras } from '../common/horario';
import { normalizarTelefonoCO } from './normalizar-telefono';
import type {
  ClienteBotDto,
  PedidoParaAvisoDto,
  PedidoResumenDto,
  UltimoPedidoDto,
} from './pedidos.tipos';

/** Cuántos pedidos recientes ve el bot al preguntar "¿dónde está mi pedido?". */
const PEDIDOS_QUE_VE_EL_BOT = 3;
/** Más atrás la ventana de 24 h de WhatsApp ya está cerrada de todas formas. */
const HORAS_VENTANA_RECOMPRA = 72;

interface FilaPedidoBot {
  id: string;
  estado: string;
  total: number;
  created_at: string;
  items_pedido: {
    cantidad: number;
    variantes_producto: {
      nombre: string;
      productos: { nombre: string } | null;
    } | null;
  }[];
}

/** Lo que el bot y los avisos le preguntan a los pedidos y clientes por teléfono. */
@Injectable()
export class PedidosConsultasService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Últimos pedidos de un cliente por teléfono — usado por el bot de
   * WhatsApp/Messenger/Instagram para responder "¿dónde está mi pedido?".
   * `telefono` puede venir con el prefijo de país que entrega Meta
   * (573157861208) o ya en formato local (3157861208) como se guarda en
   * `clientes.telefono` — se normaliza antes de buscar.
   */
  async buscarPorTelefono(telefono: string): Promise<PedidoResumenDto[]> {
    const local = normalizarTelefonoCO(telefono);
    if (!local) return [];

    const client = this.supabase.getClient();
    const { data: cliente, error: clienteError } = await client
      .from('clientes')
      .select('id')
      .eq('telefono', local)
      .maybeSingle();
    if (clienteError) {
      throw errorDeBase(clienteError);
    }
    if (!cliente) return [];

    const { data, error } = await client
      .from('pedidos')
      .select(
        'id, estado, total, created_at, items_pedido(cantidad, variantes_producto(nombre, productos(nombre)))',
      )
      .eq('cliente_id', cliente.id)
      .order('created_at', { ascending: false })
      .limit(PEDIDOS_QUE_VE_EL_BOT)
      .returns<FilaPedidoBot[]>();
    if (error) {
      throw errorDeBase(error);
    }

    return (data ?? []).map((p) => ({
      id: p.id,
      estado: p.estado,
      total: p.total,
      created_at: p.created_at,
      items: (p.items_pedido ?? []).map((i) => ({
        producto_nombre: i.variantes_producto?.productos?.nombre ?? '',
        variante_nombre: i.variantes_producto?.nombre ?? '',
        cantidad: i.cantidad,
      })),
    }));
  }

  /**
   * Nombre del cliente registrado con este teléfono, o `null` si no existe
   * — usado por el bot para saludar por nombre en el primer mensaje de una
   * conversación nueva. Mismo criterio de normalización que
   * `buscarPorTelefono`.
   */
  async buscarNombrePorTelefono(telefono: string): Promise<string | null> {
    const local = normalizarTelefonoCO(telefono);
    if (!local) return null;

    const { data, error } = await this.supabase
      .getClient()
      .from('clientes')
      .select('nombre')
      .eq('telefono', local)
      .maybeSingle<{ nombre: string | null }>();
    if (error) throw errorDeBase(error);
    return data?.nombre ?? null;
  }

  /**
   * Cliente identificado por teléfono, para que el bot no le vuelva a
   * preguntar nombre ni dirección y le muestre sus puntos. `null` si nunca
   * compró.
   */
  async clientePorTelefono(telefono: string): Promise<ClienteBotDto | null> {
    const local = normalizarTelefonoCO(telefono);
    if (!local) return null;
    const { data, error } = await this.supabase
      .getClient()
      .from('clientes')
      .select('id, nombre, apellido, direccion, puntos_actuales')
      .eq('telefono', local)
      .maybeSingle<{
        id: string;
        nombre: string | null;
        apellido: string | null;
        direccion: string | null;
        puntos_actuales: number | null;
      }>();
    if (error) throw errorDeBase(error);
    if (!data) return null;
    return {
      id: data.id,
      nombre: data.nombre,
      apellido: data.apellido,
      direccion: data.direccion,
      puntosActuales: data.puntos_actuales ?? 0,
    };
  }

  /**
   * Último pedido no cancelado del cliente, de cualquier canal (POS, web o
   * WhatsApp), con las variantes exactas — para "¿lo mismo de la última
   * vez?". Los ítems personalizados del POS (sin variante) se omiten.
   */
  async ultimoPedidoPorTelefono(
    telefono: string,
  ): Promise<UltimoPedidoDto | null> {
    const cliente = await this.clientePorTelefono(telefono);
    if (!cliente) return null;
    const { data, error } = await this.supabase
      .getClient()
      .from('pedidos')
      .select('direccion_entrega, items_pedido(variante_id, cantidad)')
      .eq('cliente_id', cliente.id)
      .neq('estado', 'cancelado')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<{
        direccion_entrega: string | null;
        items_pedido: { variante_id: string | null; cantidad: number }[];
      }>();
    if (error) throw errorDeBase(error);
    if (!data) return null;
    const items = (data.items_pedido ?? []).flatMap((i) =>
      i.variante_id
        ? [{ varianteId: i.variante_id, cantidad: i.cantidad }]
        : [],
    );
    return items.length > 0
      ? { items, direccionEntrega: data.direccion_entrega }
      : null;
  }

  /** Lo justo para avisarle al cliente por WhatsApp un cambio de estado. */
  async datosParaAviso(id: string): Promise<PedidoParaAvisoDto | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('pedidos')
      .select(
        'id, canal, estado, modalidad, direccion_entrega, clientes(telefono)',
      )
      .eq('id', id)
      .maybeSingle<{
        id: string;
        canal: string;
        estado: string;
        modalidad: string;
        direccion_entrega: string | null;
        clientes: { telefono: string | null } | null;
      }>();
    if (error) throw errorDeBase(error);
    if (!data) return null;
    return {
      id: data.id,
      canal: data.canal,
      estado: data.estado,
      modalidad: data.modalidad,
      direccionEntrega: data.direccion_entrega,
      telefono: data.clientes?.telefono ?? null,
    };
  }

  /**
   * Pedidos del bot ya entregados a los que todavía no se les mandó la
   * invitación a repetir. Solo los de los últimos 3 días: más atrás la
   * ventana de 24h de WhatsApp ya está cerrada de todas formas.
   */
  async pedidosParaRecompra(): Promise<PedidoParaAvisoDto[]> {
    const desde = haceHoras(HORAS_VENTANA_RECOMPRA);
    const { data, error } = await this.supabase
      .getClient()
      .from('pedidos')
      .select(
        'id, canal, estado, modalidad, direccion_entrega, puntos_ganados, clientes(telefono, puntos_actuales)',
      )
      .eq('canal', 'whatsapp')
      .eq('estado', 'entregado')
      .is('recompra_enviada_en', null)
      .gte('created_at', desde)
      .returns<
        {
          id: string;
          canal: string;
          estado: string;
          modalidad: string;
          direccion_entrega: string | null;
          puntos_ganados: number | null;
          clientes: {
            telefono: string | null;
            puntos_actuales: number | null;
          } | null;
        }[]
      >();
    if (error) throw errorDeBase(error);
    return (data ?? []).map((p) => ({
      id: p.id,
      canal: p.canal,
      estado: p.estado,
      modalidad: p.modalidad,
      direccionEntrega: p.direccion_entrega,
      telefono: p.clientes?.telefono ?? null,
      puntosGanados: p.puntos_ganados ?? 0,
      puntosActuales: p.clientes?.puntos_actuales ?? 0,
    }));
  }

  /**
   * Marca la invitación a repetir como enviada. Devuelve false si ya estaba
   * marcada: así dos corridas del cron nunca la mandan dos veces.
   */
  async reclamarRecompra(id: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .getClient()
      .from('pedidos')
      .update({ recompra_enviada_en: new Date().toISOString() })
      .eq('id', id)
      .is('recompra_enviada_en', null)
      .select('id');
    if (error) throw errorDeBase(error);
    return (data ?? []).length > 0;
  }

  /**
   * ¿El cliente hizo un pedido (cualquier canal) en las últimas `horas`?
   * El seguimiento de "carrito abandonado" no le escribe a quien ya compró.
   */
  async tienePedidoReciente(telefono: string, horas: number): Promise<boolean> {
    const cliente = await this.clientePorTelefono(telefono);
    if (!cliente) return false;
    const desde = haceHoras(horas);
    const { count, error } = await this.supabase
      .getClient()
      .from('pedidos')
      .select('id', { count: 'exact', head: true })
      .eq('cliente_id', cliente.id)
      .gte('created_at', desde);
    if (error) throw errorDeBase(error);
    return (count ?? 0) > 0;
  }
}
