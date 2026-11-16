import { Injectable } from '@nestjs/common';
import { errorDeBase } from '../common/error-de-base';
import { SupabaseService } from '../supabase/supabase.service';
import { ventanaToque, type CandidataToque } from './toque-interes';

const MENSAJES_CONTEXTO = 3;

/**
 * El producto por el que preguntó el cliente de Messenger o Instagram: sirve
 * para contestar "¿cuántas porciones trae?" sin que lo repita y para el
 * segundo mensaje a quien llegó por un anuncio y no pidió.
 */
@Injectable()
export class InteresProductoService {
  constructor(private readonly supabase: SupabaseService) {}

  async marcar(conversacionId: string, productoId: string): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('conversaciones_bot')
      .update({
        interes_producto_id: productoId,
        interes_en: new Date().toISOString(),
      })
      .eq('id', conversacionId);
    if (error) throw errorDeBase(error);
  }

  /** Los últimos textos que mandó el bot, del más reciente al más viejo. */
  async ultimosMensajesBot(conversacionId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('mensajes_conversacion')
      .select('texto')
      .eq('conversacion_id', conversacionId)
      .eq('direccion', 'saliente_bot')
      .order('created_at', { ascending: false })
      .limit(MENSAJES_CONTEXTO)
      .returns<{ texto: string }[]>();
    if (error) throw errorDeBase(error);
    return (data ?? []).map((m) => m.texto);
  }

  /** Llegaron por un anuncio, vieron un producto, no empezaron pedido y callan hace 2 h. */
  async candidatasToque(ahora: Date): Promise<CandidataToque[]> {
    const { desde, hasta } = ventanaToque(ahora);
    const { data, error } = await this.supabase
      .getClient()
      .from('conversaciones_bot')
      .select(
        'id, canal, identificador_externo, interes_producto_id, interes_en',
      )
      .in('canal', ['messenger', 'instagram'])
      .eq('estado', 'bot')
      .eq('origen_fuente', 'ADS')
      .not('interes_producto_id', 'is', null)
      .is('toque_interes_enviado_en', null)
      .is('carrito_pendiente', null)
      .is('checkout', null)
      .gte('ultima_interaccion', desde)
      .lte('ultima_interaccion', hasta)
      .returns<CandidataToque[]>();
    if (error) throw errorDeBase(error);
    return data ?? [];
  }

  async pidioDesde(conversacionId: string, desde: string): Promise<boolean> {
    const { count, error } = await this.supabase
      .getClient()
      .from('pedidos')
      .select('id', { count: 'exact', head: true })
      .eq('conversacion_id', conversacionId)
      .gte('created_at', desde);
    if (error) throw errorDeBase(error);
    return (count ?? 0) > 0;
  }

  async marcarToque(conversacionId: string): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('conversaciones_bot')
      .update({ toque_interes_enviado_en: new Date().toISOString() })
      .eq('id', conversacionId);
    if (error) throw errorDeBase(error);
  }
}
