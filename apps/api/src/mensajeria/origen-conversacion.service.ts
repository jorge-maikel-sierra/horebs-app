import { Injectable } from '@nestjs/common';
import { errorDeBase } from '../common/error-de-base';
import { SupabaseService } from '../supabase/supabase.service';
import { payloadCtwa } from './conversaciones-reglas';
import type { CanalMensajeria } from './conversaciones.tipos';
import {
  COLUMNAS_ORIGEN,
  payloadOrigenPedido,
  payloadPrimerOrigen,
  payloadUltimoOrigen,
  type FilaOrigenConversacion,
  type OrigenContacto,
} from './origen-conversacion';

/**
 * Guarda de qué anuncio o enlace llegó cada conversación y lo copia al pedido
 * que sale de ella: es la base para medir ventas por anuncio y para la API de
 * conversiones.
 */
@Injectable()
export class OrigenConversacionService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Si la conversación todavía no existe (no hay fila) no hace nada: el
   * referral suelto solo llega en hilos que ya existían.
   */
  async registrar(
    canal: CanalMensajeria,
    identificadorExterno: string,
    origen: OrigenContacto,
  ): Promise<void> {
    const ahora = new Date().toISOString();
    const client = this.supabase.getClient();
    const primero = await client
      .from('conversaciones_bot')
      .update(payloadPrimerOrigen(origen, ahora))
      .eq('canal', canal)
      .eq('identificador_externo', identificadorExterno)
      .is('origen_capturado_en', null);
    if (primero.error) throw errorDeBase(primero.error);

    const ultimo = await client
      .from('conversaciones_bot')
      .update(payloadUltimoOrigen(origen, ahora))
      .eq('canal', canal)
      .eq('identificador_externo', identificadorExterno);
    if (ultimo.error) throw errorDeBase(ultimo.error);
  }

  /** Click-to-WhatsApp: el id del clic que pide la API de conversiones. */
  async guardarCtwaClid(
    canal: CanalMensajeria,
    identificadorExterno: string,
    ctwaClid: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('conversaciones_bot')
      .update(payloadCtwa(ctwaClid))
      .eq('canal', canal)
      .eq('identificador_externo', identificadorExterno);
    if (error) throw errorDeBase(error);
  }

  async obtenerCtwa(
    canal: CanalMensajeria,
    identificadorExterno: string,
  ): Promise<{ id: string; ctwaClid: string } | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('conversaciones_bot')
      .select('id, ctwa_clid')
      .eq('canal', canal)
      .eq('identificador_externo', identificadorExterno)
      .maybeSingle<{ id: string; ctwa_clid: string | null }>();
    if (error) throw errorDeBase(error);
    return data?.ctwa_clid ? { id: data.id, ctwaClid: data.ctwa_clid } : null;
  }

  /**
   * Lo que llevaba el último pedido (no cancelado) que salió de esta
   * conversación, para ofrecer repetirlo. Vacío si nunca pidió por aquí.
   */
  async itemsDelUltimoPedido(
    conversacionId: string,
  ): Promise<{ varianteId: string; cantidad: number }[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('pedidos')
      .select('items_pedido(variante_id, cantidad)')
      .eq('conversacion_id', conversacionId)
      .neq('estado', 'cancelado')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<{
        items_pedido: { variante_id: string; cantidad: number }[] | null;
      }>();
    if (error) throw errorDeBase(error);
    return (data?.items_pedido ?? []).map((i) => ({
      varianteId: i.variante_id,
      cantidad: i.cantidad,
    }));
  }

  async vincularPedido(
    canal: CanalMensajeria,
    identificadorExterno: string,
    pedidoId: string,
  ): Promise<void> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('conversaciones_bot')
      .select(COLUMNAS_ORIGEN)
      .eq('canal', canal)
      .eq('identificador_externo', identificadorExterno)
      .maybeSingle<FilaOrigenConversacion>();
    if (error) throw errorDeBase(error);

    const cambios = payloadOrigenPedido(data);
    if (!cambios) return;
    const res = await client.from('pedidos').update(cambios).eq('id', pedidoId);
    if (res.error) throw errorDeBase(res.error);
  }
}
