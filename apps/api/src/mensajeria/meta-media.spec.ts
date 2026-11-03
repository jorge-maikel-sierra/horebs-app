import { ServiceUnavailableException } from '@nestjs/common';
import { descargarMediaWhatsapp } from './meta-media';

describe('descargarMediaWhatsapp', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('descarga el archivo correctamente y devuelve buffer y mime', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            url: 'https://cdn.fb.com/media123',
            mime_type: 'image/jpeg',
            file_size: 1024,
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3]).buffer),
      });
    global.fetch = fetchMock;

    const res = await descargarMediaWhatsapp('v21.0', 'token-123', 'media-1');
    expect(res.mime).toBe('image/jpeg');
    expect(res.datos).toEqual(Buffer.from([1, 2, 3]));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('lanza ServiceUnavailableException si falla la llamada de metadata', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    await expect(
      descargarMediaWhatsapp('v21.0', 'token-123', 'media-1'),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('lanza ServiceUnavailableException si el archivo pesa más de 10MB', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          url: 'https://cdn.fb.com/media123',
          mime_type: 'image/jpeg',
          file_size: 11 * 1024 * 1024,
        }),
    });

    await expect(
      descargarMediaWhatsapp('v21.0', 'token-123', 'media-1'),
    ).rejects.toThrow(ServiceUnavailableException);
  });
});
