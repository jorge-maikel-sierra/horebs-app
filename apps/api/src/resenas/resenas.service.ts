import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { errorDeBase } from '../common/error-de-base';
import { AvisoEquipoService } from '../mensajeria/aviso-equipo.service';
import { SupabaseService } from '../supabase/supabase.service';
import { GoogleBusinessService } from './google-business.service';
import { clasificarResena, type ResenaClasificada } from './respuestas-resena';
import type {
  ActualizarResenaInput,
  EstadoResena,
  ResenaDto,
} from './resenas.tipos';

const TABLA = 'resenas_google';
const COLUMNAS =
  'id, google_id, autor, estrellas, comentario, creada_en, estado, respuesta, respondida_en, error';
const LIMITE_LISTA = 100;
const URL_PANEL_RESENAS = 'https://pizzeriahorebs.shop/admin/resenas';

function mensajeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Reseñas de Google Business Profile: cada 15 minutos trae las nuevas, publica
 * sola la respuesta de las de 4–5★ y deja las de 1–3★ como borrador para que
 * el equipo las apruebe desde /admin/resenas.
 */
@Injectable()
export class ResenasService {
  private readonly logger = new Logger(ResenasService.name);
  private readonly publicarAutomatico: boolean;
  private ejecutando = false;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly google: GoogleBusinessService,
    private readonly avisoEquipo: AvisoEquipoService,
    config: ConfigService,
  ) {
    // Apagado por defecto: primero se revisa el tono con borradores.
    this.publicarAutomatico =
      config.get<string>('RESENAS_PUBLICAR_AUTOMATICO') === 'true';
  }

  @Cron('*/15 * * * *', { name: 'sincronizar-resenas' })
  async sincronizar(ahora: Date = new Date()): Promise<void> {
    if (!this.google.configurado || this.ejecutando) return;
    this.ejecutando = true;
    try {
      const resenas = await this.google.listarResenas();
      const conocidas = await this.idsConocidos(resenas.map((r) => r.name));
      for (const resena of resenas) {
        if (conocidas.has(resena.name)) continue;
        const clasificada = clasificarResena(
          resena,
          ahora,
          this.publicarAutomatico,
        );
        if (clasificada) await this.registrar(clasificada);
      }
    } catch (err) {
      this.logger.error(
        `No se pudieron sincronizar las reseñas: ${mensajeError(err)}`,
      );
    } finally {
      this.ejecutando = false;
    }
  }

  async listar(estado?: EstadoResena): Promise<ResenaDto[]> {
    let consulta = this.supabase.getClient().from(TABLA).select(COLUMNAS);
    if (estado) consulta = consulta.eq('estado', estado);
    const { data, error } = await consulta
      .order('creada_en', { ascending: false })
      .limit(LIMITE_LISTA)
      .returns<ResenaDto[]>();
    if (error) throw errorDeBase(error);
    return data ?? [];
  }

  /** Publica en Google la respuesta (aprobada o editada) o descarta la reseña. */
  async actualizar(
    id: string,
    input: ActualizarResenaInput,
  ): Promise<ResenaDto> {
    const actual = await this.obtener(id);
    if (input.estado === 'descartada') {
      if (actual.estado === 'respondida') {
        throw new ConflictException(
          'Esa reseña ya tiene respuesta publicada en Google.',
        );
      }
      return this.guardar(id, { estado: 'descartada' });
    }
    const respuesta = input.respuesta?.trim();
    if (!respuesta) {
      throw new BadRequestException(
        'Escribe la respuesta antes de publicarla.',
      );
    }
    await this.google.responder(actual.google_id, respuesta);
    return this.guardar(id, {
      estado: 'respondida',
      respuesta,
      respondida_en: new Date().toISOString(),
      error: null,
    });
  }

  private async registrar(c: ResenaClasificada): Promise<void> {
    const { data, error } = await this.supabase
      .getClient()
      .from(TABLA)
      .upsert(c.fila, { onConflict: 'google_id', ignoreDuplicates: true })
      .select('id')
      .returns<{ id: string }[]>();
    if (error) throw errorDeBase(error);
    const id = data?.[0]?.id;
    // Sin fila devuelta: otra corrida ya la había guardado.
    if (!id) return;
    if (c.avisar) this.avisarParaRevisar(c);
    if (c.publicar && c.fila.respuesta) {
      await this.publicarAutomatica(id, c.fila.google_id, c.fila.respuesta);
    }
  }

  private async publicarAutomatica(
    id: string,
    googleId: string,
    respuesta: string,
  ): Promise<void> {
    try {
      await this.google.responder(googleId, respuesta);
      await this.guardar(id, {
        estado: 'respondida',
        respondida_en: new Date().toISOString(),
      });
    } catch (err) {
      this.logger.error(
        `No se pudo publicar la respuesta de ${googleId}: ${mensajeError(err)}`,
      );
      await this.guardar(id, { estado: 'error', error: mensajeError(err) });
    }
  }

  private avisarParaRevisar(c: ResenaClasificada): void {
    const { estrellas, autor, comentario } = c.fila;
    const quien = autor ?? 'Un cliente';
    const texto = `Reseña de ${estrellas}★ en Google de ${quien}: "${comentario ?? '(sin comentario)'}". Revisa y aprueba la respuesta en ${URL_PANEL_RESENAS}`;
    this.avisoEquipo.notificarTexto({
      asunto: `Reseña de ${estrellas}★ en Google para aprobar`,
      texto,
      html: `<p>${escaparHtml(texto)}</p><p><a href="${URL_PANEL_RESENAS}">Ver reseñas</a></p>`,
    });
  }

  private async idsConocidos(ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const { data, error } = await this.supabase
      .getClient()
      .from(TABLA)
      .select('google_id')
      .in('google_id', ids)
      .returns<{ google_id: string }[]>();
    if (error) throw errorDeBase(error);
    return new Set((data ?? []).map((f) => f.google_id));
  }

  private async obtener(id: string): Promise<ResenaDto> {
    const { data, error } = await this.supabase
      .getClient()
      .from(TABLA)
      .select(COLUMNAS)
      .eq('id', id)
      .maybeSingle<ResenaDto>();
    if (error) throw errorDeBase(error);
    if (!data) throw new NotFoundException('No existe esa reseña.');
    return data;
  }

  private async guardar(
    id: string,
    cambios: Partial<ResenaDto>,
  ): Promise<ResenaDto> {
    const { data, error } = await this.supabase
      .getClient()
      .from(TABLA)
      .update({ ...cambios, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(COLUMNAS)
      .single<ResenaDto>();
    if (error) throw errorDeBase(error);
    return data;
  }
}
