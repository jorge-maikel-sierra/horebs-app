import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MS_POR_SEGUNDO } from '../common/tiempo';
import type { ResenaGoogle } from './resenas.tipos';

const URL_TOKEN = 'https://oauth2.googleapis.com/token';
const URL_API = 'https://mybusiness.googleapis.com/v4';
const RESENAS_POR_PAGINA = 50;
const TIMEOUT_MS = 20_000;
// El token dura una hora; se renueva un minuto antes para no usarlo vencido.
const MARGEN_TOKEN_MS = 60_000;
const MAX_DETALLE_LOG = 300;

interface Credenciales {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  /** `accounts/{id}/locations/{id}` del perfil de la pizzería. */
  ubicacion: string;
}

/**
 * Transporte hacia la API de Google Business Profile: renueva el token de
 * OAuth con el refresh token de la cuenta dueña del perfil, lee reseñas y
 * publica respuestas. Sin credenciales queda apagado.
 */
@Injectable()
export class GoogleBusinessService {
  private readonly logger = new Logger(GoogleBusinessService.name);
  private readonly credenciales: Credenciales | null;
  private token: { valor: string; vence: number } | null = null;

  constructor(config: ConfigService) {
    const clientId = config.get<string>('GOOGLE_BUSINESS_CLIENT_ID');
    const clientSecret = config.get<string>('GOOGLE_BUSINESS_CLIENT_SECRET');
    const refreshToken = config.get<string>('GOOGLE_BUSINESS_REFRESH_TOKEN');
    const ubicacion = config.get<string>('GOOGLE_BUSINESS_UBICACION');
    this.credenciales =
      clientId && clientSecret && refreshToken && ubicacion
        ? { clientId, clientSecret, refreshToken, ubicacion }
        : null;
    if (!this.credenciales) {
      this.logger.warn(
        'Credenciales de Google Business sin configurar — las reseñas no se sincronizan.',
      );
    }
  }

  get configurado(): boolean {
    return this.credenciales !== null;
  }

  /** Las reseñas más recientes primero (una página basta: el cron corre cada 15 min). */
  async listarResenas(): Promise<ResenaGoogle[]> {
    const { ubicacion } = this.exigirCredenciales();
    const url = `${URL_API}/${ubicacion}/reviews?pageSize=${RESENAS_POR_PAGINA}&orderBy=${encodeURIComponent('updateTime desc')}`;
    const cuerpo = (await this.pedir(url, { method: 'GET' })) as {
      reviews?: ResenaGoogle[];
    };
    return cuerpo.reviews ?? [];
  }

  /** Crea o reemplaza la respuesta pública de una reseña. */
  async responder(googleId: string, comentario: string): Promise<void> {
    this.exigirCredenciales();
    await this.pedir(`${URL_API}/${googleId}/reply`, {
      method: 'PUT',
      body: JSON.stringify({ comment: comentario }),
    });
  }

  private exigirCredenciales(): Credenciales {
    if (!this.credenciales) {
      throw new ServiceUnavailableException(
        'La conexión con Google Business no está configurada.',
      );
    }
    return this.credenciales;
  }

  private async pedir(url: string, init: RequestInit): Promise<unknown> {
    const res = await this.fetchConTimeout(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${await this.tokenVigente()}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      const detalle = (await res.text()).slice(0, MAX_DETALLE_LOG);
      throw new ServiceUnavailableException(
        `Google Business respondió ${res.status}: ${detalle}`,
      );
    }
    return res.json();
  }

  private async tokenVigente(): Promise<string> {
    if (this.token && this.token.vence > Date.now()) return this.token.valor;
    const c = this.exigirCredenciales();
    const res = await this.fetchConTimeout(URL_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: c.clientId,
        client_secret: c.clientSecret,
        refresh_token: c.refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    });
    if (!res.ok) {
      throw new ServiceUnavailableException(
        `Google no renovó el token (${res.status}); revisar GOOGLE_BUSINESS_REFRESH_TOKEN.`,
      );
    }
    const cuerpo = (await res.json()) as {
      access_token: string;
      expires_in: number;
    };
    this.token = {
      valor: cuerpo.access_token,
      vence: Date.now() + cuerpo.expires_in * MS_POR_SEGUNDO - MARGEN_TOKEN_MS,
    };
    return this.token.valor;
  }

  private async fetchConTimeout(
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (err) {
      throw new ServiceUnavailableException(
        `Google Business no respondió: ${(err as Error).message}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
