/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- mocks de jest y fetch */
import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { GeminiClienteService } from './gemini-cliente.service';

function crearCliente(
  valores: Record<string, string> = { GEMINI_API_KEY: 'k' },
) {
  // eslint-disable-next-line security/detect-object-injection -- clave fija del test
  const config = { get: (clave: string) => valores[clave] };
  return new GeminiClienteService(config as unknown as ConfigService);
}

const respuesta = (status: number, cuerpo: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(cuerpo)),
    json: () => Promise.resolve(cuerpo),
  }) as Response;

describe('GeminiClienteService', () => {
  const fetchOriginal = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as never;
  });
  afterEach(() => {
    global.fetch = fetchOriginal;
    jest.restoreAllMocks();
  });

  describe('configuración', () => {
    it('sin GEMINI_API_KEY no está configurado', () => {
      expect(crearCliente({}).configurado).toBe(false);
      expect(crearCliente().configurado).toBe(true);
    });

    it('usa el modelo del entorno o el de por defecto', () => {
      expect(crearCliente({ GEMINI_MODEL: 'otro' }).modelo).toBe('otro');
      expect(crearCliente().modelo).toBe('gemini-flash-lite-latest');
    });
  });

  describe('llamar', () => {
    it('devuelve la interacción cuando Gemini responde bien', async () => {
      fetchMock.mockResolvedValueOnce(
        respuesta(200, { id: 'i-1', status: 'completed' }),
      );
      await expect(crearCliente().llamar({ input: 'hola' })).resolves.toEqual({
        id: 'i-1',
        status: 'completed',
      });
      const [, init] = fetchMock.mock.calls[0];
      expect(init.headers['x-goog-api-key']).toBe('k');
      expect(JSON.parse(init.body as string)).toEqual({ input: 'hola' });
    });

    it.each([
      [429, 'Too many requests'],
      [503, 'Unavailable'],
      [400, 'malformed_tool_call'],
    ])(
      'reintenta una vez ante %i y devuelve la segunda respuesta',
      async (status, detalle) => {
        fetchMock
          .mockResolvedValueOnce(respuesta(status, detalle))
          .mockResolvedValueOnce(
            respuesta(200, { id: 'i-2', status: 'completed' }),
          );
        await expect(crearCliente().llamar({})).resolves.toMatchObject({
          id: 'i-2',
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
      },
    );

    it('se rinde si el reintento también falla', async () => {
      fetchMock.mockResolvedValue(respuesta(503, 'caído'));
      await expect(crearCliente().llamar({})).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('no reintenta un 4xx que no es transitorio', async () => {
      fetchMock.mockResolvedValue(respuesta(400, 'solicitud inválida'));
      await expect(crearCliente().llamar({})).rejects.toThrow(
        'Gemini respondió 400',
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('transcribirAudio', () => {
    const audio = Buffer.from('ogg');

    it('sin API key no llama a Gemini', async () => {
      await expect(
        crearCliente({}).transcribirAudio(audio, 'audio/ogg'),
      ).resolves.toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('devuelve el texto y manda el audio en base64 sin el códec del mime', async () => {
      fetchMock.mockResolvedValueOnce(
        respuesta(200, {
          candidates: [
            { content: { parts: [{ text: ' quiero una pizza ' }] } },
          ],
        }),
      );
      await expect(
        crearCliente().transcribirAudio(audio, 'audio/ogg; codecs=opus'),
      ).resolves.toBe('quiero una pizza');
      const inline = JSON.parse(fetchMock.mock.calls[0][1].body as string)
        .contents[0].parts[1].inline_data;
      expect(inline).toEqual({
        mime_type: 'audio/ogg',
        data: audio.toString('base64'),
      });
    });

    it('"(sin voz)" y los errores devuelven null', async () => {
      fetchMock.mockResolvedValueOnce(
        respuesta(200, {
          candidates: [{ content: { parts: [{ text: '(sin voz)' }] } }],
        }),
      );
      await expect(
        crearCliente().transcribirAudio(audio, 'audio/ogg'),
      ).resolves.toBeNull();

      fetchMock.mockResolvedValueOnce(respuesta(500, 'error'));
      await expect(
        crearCliente().transcribirAudio(audio, 'audio/ogg'),
      ).resolves.toBeNull();
    });
  });
});
