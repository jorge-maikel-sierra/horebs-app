import { ConflictException, Injectable } from '@nestjs/common';
import { errorDeBase } from '../common/error-de-base';
import { inicioDiaBogota } from '../common/horario';
import { SupabaseService } from '../supabase/supabase.service';
import { fechaHaceDias } from './anuncios-reglas';
import { resultadosPorCampana } from './campanas-mensajeria-resultados';
import {
  FORMATOS_CREATIVO,
  type CampanaMensajeriaDto,
  type CrearCampanaInput,
  type EditarCampanaInput,
  type FilaCampanaMensajeria,
  type FilaPedidoCampana,
  type ResultadoCampanaDto,
  type SubidaCreativoDto,
  type SubirCreativoInput,
} from './campanas-mensajeria.tipos';

/** Bucket público de Supabase Storage (migración 2026-11-19). */
const BUCKET_CREATIVOS = 'campanas';
const TABLA = 'campanas_mensajeria';
const COLUMNAS =
  'id, nombre, canal, mensaje, creativo_path, creativo_tipo, enviada_en, costo, destinatarios, activa, created_at';
const COLUMNAS_PEDIDO =
  'id, total, estado, cliente_id, campana_mensajeria_id, items_pedido(cantidad, subtotal, variantes_producto(costo))';
const DIAS_RESULTADOS_DEFECTO = 90;
const LOTE = 1000;

export interface ResultadosCampanasDto {
  desde: string;
  campanas: (CampanaMensajeriaDto & { resultado: ResultadoCampanaDto })[];
}

/** Campañas propias (sin Meta Ads) y lo que trajo cada una en la caja. */
@Injectable()
export class CampanasMensajeriaService {
  constructor(private readonly supabase: SupabaseService) {}

  async listar(soloActivas = false): Promise<CampanaMensajeriaDto[]> {
    let consulta = this.supabase
      .getClient()
      .from(TABLA)
      .select(COLUMNAS)
      .order('enviada_en', { ascending: false });
    if (soloActivas) consulta = consulta.eq('activa', true);
    const { data, error } = await consulta.returns<FilaCampanaMensajeria[]>();
    if (error) throw errorDeBase(error);
    return (data ?? []).map((f) => this.aDto(f));
  }

  async obtener(id: string): Promise<CampanaMensajeriaDto> {
    const { data, error } = await this.supabase
      .getClient()
      .from(TABLA)
      .select(COLUMNAS)
      .eq('id', id)
      .single<FilaCampanaMensajeria>();
    if (error) throw errorDeBase(error);
    return this.aDto(data);
  }

  async crear(input: CrearCampanaInput): Promise<CampanaMensajeriaDto> {
    const { data, error } = await this.supabase
      .getClient()
      .from(TABLA)
      .insert(filaDeEntrada(input))
      .select(COLUMNAS)
      .single<FilaCampanaMensajeria>();
    if (error) throw errorDeBase(error);
    return this.aDto(data);
  }

  async editar(
    id: string,
    input: EditarCampanaInput,
  ): Promise<CampanaMensajeriaDto> {
    const { data, error } = await this.supabase
      .getClient()
      .from(TABLA)
      .update(filaDeEntrada(input))
      .eq('id', id)
      .select(COLUMNAS)
      .single<FilaCampanaMensajeria>();
    if (error) throw errorDeBase(error);
    return this.aDto(data);
  }

  /** Una campaña con pedidos no se borra: se desactiva para no perder la medición. */
  async eliminar(id: string): Promise<void> {
    await this.obtener(id);
    const client = this.supabase.getClient();
    const { count, error: errorConteo } = await client
      .from('pedidos')
      .select('id', { count: 'exact', head: true })
      .eq('campana_mensajeria_id', id);
    if (errorConteo) throw errorDeBase(errorConteo);
    if (count) {
      throw new ConflictException(
        'La campaña ya tiene pedidos: desactivala en vez de borrarla.',
      );
    }
    const { error } = await client.from(TABLA).delete().eq('id', id);
    if (error) throw errorDeBase(error);
  }

  /**
   * Prepara la subida del creativo: deja la ruta guardada en la campaña y
   * devuelve una URL firmada para que el navegador suba el archivo directo a
   * Storage (los videos no pasan por el API).
   */
  async prepararCreativo(
    id: string,
    input: SubirCreativoInput,
  ): Promise<SubidaCreativoDto> {
    await this.obtener(id);
    const formato = FORMATOS_CREATIVO[input.extension];
    const path = `${id}/creativo-${Date.now()}.${input.extension}`;
    const client = this.supabase.getClient();
    const { data, error } = await client.storage
      .from(BUCKET_CREATIVOS)
      .createSignedUploadUrl(path);
    if (error || !data) {
      throw errorDeBase(error ?? 'Supabase no devolvió la URL de subida.');
    }
    const { error: errorFila } = await client
      .from(TABLA)
      .update({ creativo_path: path, creativo_tipo: formato.tipo })
      .eq('id', id);
    if (errorFila) throw errorDeBase(errorFila);
    return {
      url_subida: data.signedUrl,
      creativo_url: this.urlPublica(path),
      creativo_tipo: formato.tipo,
      mime: formato.mime,
    };
  }

  /** `desde` (AAAA-MM-DD) filtra por día de envío; por defecto, 90 días. */
  async resultados(desde?: string): Promise<ResultadosCampanasDto> {
    const dia = desde ?? fechaHaceDias(DIAS_RESULTADOS_DEFECTO);
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from(TABLA)
      .select(COLUMNAS)
      .gte('enviada_en', inicioDiaBogota(dia))
      .order('enviada_en', { ascending: false })
      .returns<FilaCampanaMensajeria[]>();
    if (error) throw errorDeBase(error);
    const campanas = (data ?? []).map((f) => this.aDto(f));
    const pedidos = await this.pedidosDe(campanas.map((c) => c.id));
    const resultados = resultadosPorCampana(campanas, pedidos);
    return {
      desde: dia,
      campanas: campanas.map((c) => ({
        ...c,
        resultado: resultados.find((r) => r.campana_id === c.id)!,
      })),
    };
  }

  /** Pagina de a LOTE: PostgREST devuelve como mucho 1.000 filas por consulta. */
  private async pedidosDe(ids: string[]): Promise<FilaPedidoCampana[]> {
    const todos: FilaPedidoCampana[] = [];
    if (ids.length === 0) return todos;
    for (let desde = 0; ; desde += LOTE) {
      const { data, error } = await this.supabase
        .getClient()
        .from('pedidos')
        .select(COLUMNAS_PEDIDO)
        .in('campana_mensajeria_id', ids)
        .order('id')
        .range(desde, desde + LOTE - 1)
        .returns<FilaPedidoCampana[]>();
      if (error) throw errorDeBase(error);
      todos.push(...(data ?? []));
      if ((data ?? []).length < LOTE) return todos;
    }
  }

  private urlPublica(path: string): string {
    return this.supabase
      .getClient()
      .storage.from(BUCKET_CREATIVOS)
      .getPublicUrl(path).data.publicUrl;
  }

  private aDto(fila: FilaCampanaMensajeria): CampanaMensajeriaDto {
    return {
      ...fila,
      costo: fila.costo === null ? null : Number(fila.costo),
      creativo_url: fila.creativo_path
        ? this.urlPublica(fila.creativo_path)
        : null,
    };
  }
}

/** El día de envío se guarda como el inicio de ese día en Bogotá. */
function filaDeEntrada(
  input: EditarCampanaInput,
): Record<string, string | number | boolean | null> {
  const fila: Record<string, string | number | boolean | null> = {};
  if (input.nombre !== undefined) fila.nombre = input.nombre.trim();
  if (input.canal !== undefined) fila.canal = input.canal;
  if (input.mensaje !== undefined) fila.mensaje = input.mensaje.trim();
  if (input.enviada_en !== undefined) {
    fila.enviada_en = inicioDiaBogota(input.enviada_en);
  }
  if (input.costo !== undefined) fila.costo = input.costo;
  if (input.destinatarios !== undefined) {
    fila.destinatarios = input.destinatarios;
  }
  if (input.activa !== undefined) fila.activa = input.activa;
  return fila;
}
