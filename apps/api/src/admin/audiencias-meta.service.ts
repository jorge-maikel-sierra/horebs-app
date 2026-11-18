import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { errorDeBase } from '../common/error-de-base';
import { traerTodo } from '../common/traer-todo';
import { SupabaseService } from '../supabase/supabase.service';
import {
  cuerpoCrearAudiencia,
  cuerpoCrearParecido,
  cuerposReemplazo,
  MIN_SEMILLA_PARECIDO,
  urlCrearAudiencia,
  urlReemplazarUsuarios,
} from './audiencias-meta';
import {
  filasAudiencia,
  miembrosPorSegmento,
  NOMBRE_PARECIDO,
  resumenesDeClientes,
  SEGMENTOS,
  type ClaveSegmento,
  type ClienteAudiencia,
  type PedidoAudiencia,
} from './audiencias-reglas';

const CLAVE_PARECIDO = 'parecido';

export interface FilaAudienciaMeta {
  clave: string;
  nombre: string;
  audiencia_id: string | null;
  ultimo_envio: number | null;
  sincronizado_en: string | null;
}

export interface SegmentoVistaDto {
  clave: string;
  nombre: string;
  descripcion: string;
  /** Clientes del segmento con teléfono o correo: los que se pueden enviar a Meta. */
  personas: number;
  audiencia_id: string | null;
  enviadas: number | null;
  sincronizado_en: string | null;
}

export interface PanelAudienciasDto {
  /** Los envíos reales a Meta están encendidos (META_AUDIENCIAS_ACTIVAS). */
  encendido: boolean;
  segmentos: SegmentoVistaDto[];
}

export interface ResultadoAudiencias {
  estado: 'sincronizado' | 'apagado';
  enviadas: { clave: string; personas: number }[];
  parecido: 'creado' | 'existente' | 'pendiente' | 'no_aplica';
  errores: string[];
}

interface DatosClientes {
  miembros: Map<ClaveSegmento, ClienteAudiencia[]>;
}

/**
 * Publica los segmentos de clientes como públicos personalizados de Meta
 * ("Horebs · …") y los refresca cada día. Apagado de fábrica: se enciende con
 * `META_AUDIENCIAS_ACTIVAS=true` cuando el aviso de privacidad ya cubre este
 * uso. Solo administra los públicos que él mismo creó; los demás no se tocan.
 */
@Injectable()
export class AudienciasMetaService {
  private readonly logger = new Logger(AudienciasMetaService.name);
  private readonly cuenta: string | undefined;
  private readonly token: string | undefined;
  private readonly activo: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
  ) {
    this.cuenta = this.config.get<string>('META_AD_ACCOUNT_ID');
    this.token =
      this.config.get<string>('META_ADS_ACCESS_TOKEN') ??
      this.config.get<string>('META_EVENTS_ACCESS_TOKEN') ??
      this.config.get<string>('META_CAPI_ACCESS_TOKEN');
    this.activo = this.config.get<string>('META_AUDIENCIAS_ACTIVAS') === 'true';
  }

  get encendido(): boolean {
    return this.activo && Boolean(this.cuenta && this.token);
  }

  /** 5:00 a.m. en Bogotá (10:00 UTC), antes de que abra el local. */
  @Cron('0 10 * * *', { name: 'sincronizar-audiencias-meta' })
  async sincronizarCadaDia(): Promise<void> {
    try {
      const r = await this.sincronizar();
      if (r.estado === 'sincronizado') {
        this.logger.log(
          `Públicos de Meta: ${r.enviadas.map((e) => `${e.clave}=${e.personas}`).join(', ')}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `No se pudieron sincronizar los públicos de Meta: ${(err as Error).message}`,
      );
    }
  }

  async panel(): Promise<PanelAudienciasDto> {
    return { encendido: this.encendido, segmentos: await this.previsualizar() };
  }

  /** Cuántos clientes entran a cada segmento y qué público de Meta le corresponde; no envía nada. */
  async previsualizar(ahora: Date = new Date()): Promise<SegmentoVistaDto[]> {
    const { miembros } = await this.cargar(ahora);
    const guardados = new Map(
      (await this.filasGuardadas()).map((f) => [f.clave, f]),
    );
    return SEGMENTOS.map((s) => {
      const fila = guardados.get(s.clave);
      return {
        clave: s.clave,
        nombre: s.nombre,
        descripcion: s.descripcion,
        personas: filasAudiencia(miembros.get(s.clave) ?? []).length,
        audiencia_id: fila?.audiencia_id ?? null,
        enviadas: fila?.ultimo_envio ?? null,
        sincronizado_en: fila?.sincronizado_en ?? null,
      };
    });
  }

  async sincronizar(ahora: Date = new Date()): Promise<ResultadoAudiencias> {
    if (!this.encendido) {
      return {
        estado: 'apagado',
        enviadas: [],
        parecido: 'no_aplica',
        errores: [],
      };
    }
    const { miembros } = await this.cargar(ahora);
    const guardados = new Map(
      (await this.filasGuardadas()).map((f) => [f.clave, f]),
    );
    const enviadas: ResultadoAudiencias['enviadas'] = [];
    const errores: string[] = [];
    for (const s of SEGMENTOS) {
      const filas = filasAudiencia(miembros.get(s.clave) ?? []);
      if (filas.length === 0) continue;
      try {
        const id = await this.asegurar(guardados, s.clave, s.nombre, () =>
          cuerpoCrearAudiencia(s.nombre, s.descripcion),
        );
        await this.reemplazar(id, filas);
        await this.guardarFila(s.clave, s.nombre, id, filas.length);
        enviadas.push({ clave: s.clave, personas: filas.length });
      } catch (err) {
        errores.push(`${s.clave}: ${(err as Error).message}`);
      }
    }
    const parecido = await this.parecido(guardados, enviadas, errores);
    return { estado: 'sincronizado', enviadas, parecido, errores };
  }

  private async cargar(ahora: Date): Promise<DatosClientes> {
    const client = this.supabase.getClient();
    const [clientes, pedidos] = await Promise.all([
      traerTodo<ClienteAudiencia>(
        client,
        'clientes',
        'id, nombre, apellido, telefono, correo, ciudad, departamento',
      ),
      traerTodo<PedidoAudiencia>(
        client,
        'pedidos',
        'id, cliente_id, total, estado, created_at',
      ),
    ]);
    return {
      miembros: miembrosPorSegmento(
        resumenesDeClientes(clientes, pedidos),
        ahora,
      ),
    };
  }

  /** El público de Meta de un segmento: el guardado, o uno nuevo si es la primera vez. */
  private async asegurar(
    guardados: Map<string, FilaAudienciaMeta>,
    clave: string,
    nombre: string,
    cuerpo: () => Record<string, unknown>,
  ): Promise<string> {
    const existente = guardados.get(clave)?.audiencia_id;
    if (existente) return existente;
    const creado = await this.post<{ id?: string }>(
      urlCrearAudiencia(this.cuenta ?? ''),
      cuerpo(),
    );
    if (!creado.id) throw new Error(`Meta no devolvió el id de "${nombre}"`);
    guardados.set(clave, {
      clave,
      nombre,
      audiencia_id: creado.id,
      ultimo_envio: null,
      sincronizado_en: null,
    });
    return creado.id;
  }

  private async reemplazar(id: string, filas: string[][]): Promise<void> {
    for (const cuerpo of cuerposReemplazo(filas, Date.now())) {
      await this.post(urlReemplazarUsuarios(id), cuerpo);
    }
  }

  /** El público parecido se crea una sola vez, cuando la semilla ya tiene gente suficiente. */
  private async parecido(
    guardados: Map<string, FilaAudienciaMeta>,
    enviadas: ResultadoAudiencias['enviadas'],
    errores: string[],
  ): Promise<ResultadoAudiencias['parecido']> {
    if (guardados.get(CLAVE_PARECIDO)?.audiencia_id) return 'existente';
    const semilla = enviadas.find((e) => e.clave === 'mejores');
    const origen = guardados.get('mejores')?.audiencia_id;
    if (!semilla || !origen || semilla.personas < MIN_SEMILLA_PARECIDO) {
      return 'pendiente';
    }
    try {
      const creado = await this.post<{ id?: string }>(
        urlCrearAudiencia(this.cuenta ?? ''),
        cuerpoCrearParecido(NOMBRE_PARECIDO, origen),
      );
      if (!creado.id) throw new Error('Meta no devolvió el id');
      await this.guardarFila(CLAVE_PARECIDO, NOMBRE_PARECIDO, creado.id, null);
      return 'creado';
    } catch (err) {
      errores.push(`${CLAVE_PARECIDO}: ${(err as Error).message}`);
      return 'pendiente';
    }
  }

  private async post<T = unknown>(
    url: string,
    cuerpo: Record<string, unknown>,
  ): Promise<T> {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token ?? ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cuerpo),
    });
    if (!res.ok) {
      throw new Error(`Marketing API ${res.status}: ${await res.text()}`);
    }
    return (await res.json()) as T;
  }

  private async filasGuardadas(): Promise<FilaAudienciaMeta[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('audiencias_meta')
      .select('clave, nombre, audiencia_id, ultimo_envio, sincronizado_en')
      .returns<FilaAudienciaMeta[]>();
    if (error) throw errorDeBase(error);
    return data ?? [];
  }

  private async guardarFila(
    clave: string,
    nombre: string,
    audienciaId: string,
    enviadas: number | null,
  ): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('audiencias_meta')
      .upsert(
        {
          clave,
          nombre,
          audiencia_id: audienciaId,
          ultimo_envio: enviadas,
          sincronizado_en: new Date().toISOString(),
        },
        { onConflict: 'clave' },
      );
    if (error) throw errorDeBase(error);
  }
}
