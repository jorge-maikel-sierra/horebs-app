import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { GoogleBusinessService } from './google-business.service';

const VARS = new Map([
  ['GOOGLE_BUSINESS_CLIENT_ID', 'cid'],
  ['GOOGLE_BUSINESS_CLIENT_SECRET', 'secreto'],
  ['GOOGLE_BUSINESS_REFRESH_TOKEN', 'refresh'],
  ['GOOGLE_BUSINESS_UBICACION', 'accounts/1/locations/2'],
]);

function crear(vars = VARS): GoogleBusinessService {
  return new GoogleBusinessService({
    get: (k: string) => vars.get(k),
  } as unknown as ConfigService);
}

function respuesta(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status });
}

describe('GoogleBusinessService', () => {
  const fetchOriginal = global.fetch;
  afterEach(() => {
    global.fetch = fetchOriginal;
  });

  it('sin credenciales queda apagado y no llama a Google', async () => {
    const g = crear(new Map());
    expect(g.configurado).toBe(false);
    await expect(g.listarResenas()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('renueva el token una vez y lista las reseñas de la ubicación', async () => {
    const llamadas: string[] = [];
    global.fetch = jest.fn((url: string) => {
      llamadas.push(url);
      return Promise.resolve(
        url.includes('oauth2')
          ? respuesta({ access_token: 'tok', expires_in: 3600 })
          : respuesta({ reviews: [{ name: 'r/1' }] }),
      );
    });
    const g = crear();
    expect(await g.listarResenas()).toEqual([{ name: 'r/1' }]);
    await g.listarResenas();
    expect(llamadas.filter((u) => u.includes('oauth2'))).toHaveLength(1);
    expect(llamadas[1]).toContain(
      '/v4/accounts/1/locations/2/reviews?pageSize=50',
    );
  });

  it('publica la respuesta con PUT al reply de la reseña', async () => {
    const pedidos: { url: string; init?: RequestInit }[] = [];
    global.fetch = jest.fn((url: string, init?: RequestInit) => {
      pedidos.push({ url: url, init });
      return Promise.resolve(
        url.includes('oauth2')
          ? respuesta({ access_token: 'tok', expires_in: 3600 })
          : respuesta({ comment: 'Gracias' }),
      );
    });
    await crear().responder('accounts/1/locations/2/reviews/r1', 'Gracias');
    const reply = pedidos[1];
    expect(reply.url).toBe(
      'https://mybusiness.googleapis.com/v4/accounts/1/locations/2/reviews/r1/reply',
    );
    expect(reply.init?.method).toBe('PUT');
    expect(reply.init?.body).toBe(JSON.stringify({ comment: 'Gracias' }));
  });

  it('un error de Google es 503 con el detalle', async () => {
    global.fetch = jest.fn((url: string) =>
      Promise.resolve(
        url.includes('oauth2')
          ? respuesta({ access_token: 'tok', expires_in: 3600 })
          : respuesta({ error: 'PERMISSION_DENIED' }, 403),
      ),
    );
    await expect(crear().listarResenas()).rejects.toThrow(
      'Google Business respondió 403',
    );
  });
});
