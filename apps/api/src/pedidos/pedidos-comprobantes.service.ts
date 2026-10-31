import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { errorDeBase } from '../common/error-de-base';
import { haceHoras } from '../common/horario';
import { PedidosConsultasService } from './pedidos-consultas.service';

/** Bucket privado de Supabase Storage (migración 2026-10-28). */
const BUCKET_COMPROBANTES = 'comprobantes';

/** Un pedido con transferencia espera el comprobante hasta este tiempo. */
const HORAS_ESPERA_COMPROBANTE = 48;

/** Comprobantes de transferencia que los clientes mandan por WhatsApp. */
@Injectable()
export class PedidosComprobantesService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly consultas: PedidosConsultasService,
  ) {}

  /**
   * Pedido del bot que espera el comprobante de transferencia: el más
   * reciente del cliente con transferencia, sin comprobante, todavía no
   * entregado ni cancelado y de las últimas 48h.
   */
  async pedidoEsperandoComprobante(
    telefono: string,
  ): Promise<{ id: string; total: number; nombre: string | null } | null> {
    const cliente = await this.consultas.clientePorTelefono(telefono);
    if (!cliente) return null;
    const desde = haceHoras(HORAS_ESPERA_COMPROBANTE);
    const { data, error } = await this.supabase
      .getClient()
      .from('pedidos')
      .select('id, total')
      .eq('cliente_id', cliente.id)
      .eq('canal', 'whatsapp')
      .eq('metodo_pago', 'transferencia')
      .is('comprobante_path', null)
      .in('estado', ['pendiente', 'confirmado', 'en_preparacion', 'en_camino'])
      .gte('created_at', desde)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string; total: number }>();
    if (error) throw errorDeBase(error);
    if (!data) return null;
    const nombre = [cliente.nombre, cliente.apellido].filter(Boolean).join(' ');
    return { id: data.id, total: Number(data.total), nombre: nombre || null };
  }

  /**
   * Sube el comprobante al bucket privado `comprobantes` y lo liga al
   * pedido. Devuelve el path guardado.
   */
  async guardarComprobante(
    pedidoId: string,
    archivo: { datos: Buffer; mime: string; nombre: string },
  ): Promise<string> {
    const path = `pedidos/${pedidoId}/${archivo.nombre}`;
    const client = this.supabase.getClient();
    const { error: subidaError } = await client.storage
      .from(BUCKET_COMPROBANTES)
      .upload(path, archivo.datos, {
        contentType: archivo.mime,
        upsert: true,
      });
    if (subidaError) throw errorDeBase(subidaError);
    const { error } = await client
      .from('pedidos')
      .update({
        comprobante_path: path,
        comprobante_recibido_en: new Date().toISOString(),
      })
      .eq('id', pedidoId);
    if (error) throw errorDeBase(error);
    return path;
  }

  /** URL firmada para ver el comprobante (el bucket es privado). */
  async urlComprobante(
    pedidoId: string,
    segundos: number,
  ): Promise<string | null> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('pedidos')
      .select('comprobante_path')
      .eq('id', pedidoId)
      .maybeSingle<{ comprobante_path: string | null }>();
    if (error) throw errorDeBase(error);
    if (!data?.comprobante_path) return null;
    return this.urlFirmada(data.comprobante_path, segundos);
  }

  async urlFirmada(path: string, segundos: number): Promise<string> {
    const { data, error } = await this.supabase
      .getClient()
      .storage.from(BUCKET_COMPROBANTES)
      .createSignedUrl(path, segundos);
    if (error || !data) {
      throw errorDeBase(error ?? 'Supabase no devolvió la URL firmada.');
    }
    return data.signedUrl;
  }
}
