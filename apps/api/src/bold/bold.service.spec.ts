import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { BoldService } from './bold.service';

function crear(env: Record<string, string>): BoldService {
  return new BoldService({
    get: (clave: string) => new Map(Object.entries(env)).get(clave),
  } as unknown as ConfigService);
}

const LLAVES = { BOLD_API_KEY: 'api-key', BOLD_SECRET_KEY: 'secreto' };
const DATOS = {
  referencia: 'pedido-1',
  total: 65000,
  descripcion: 'Pedido #abc12345',
};

describe('BoldService', () => {
  const fetchOriginal = global.fetch;
  afterEach(() => {
    global.fetch = fetchOriginal;
  });

  it('está apagado sin las dos llaves', () => {
    expect(crear({}).habilitado()).toBe(false);
    expect(crear({ BOLD_API_KEY: 'x' }).habilitado()).toBe(false);
    expect(crear(LLAVES).habilitado()).toBe(true);
  });

  it('crea el link con el total en pesos, cobro cerrado y la llave en la cabecera', async () => {
    const mock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          payload: {
            payment_link: 'LNK_ABC',
            url: 'https://checkout.bold.co/LNK_ABC',
          },
        }),
    });
    global.fetch = mock;

    const link = await crear(LLAVES).crearLink(DATOS);

    expect(link).toEqual({
      id: 'LNK_ABC',
      url: 'https://checkout.bold.co/LNK_ABC',
    });
    const [url, init] = mock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://integrations.api.bold.co/online/link/v1');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'x-api-key api-key',
    );
    expect(JSON.parse(init.body as string)).toEqual({
      amount_type: 'CLOSE',
      amount: { currency: 'COP', total_amount: 65000, tip_amount: 0 },
      callback_url: 'https://wa.me/573157861208',
      reference: 'pedido-1',
      description: 'Pedido #abc12345',
    });
  });

  it('recorta referencia y descripción a los máximos de Bold', async () => {
    const mock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({ payload: { payment_link: 'LNK_1', url: 'u' } }),
    });
    global.fetch = mock;

    await crear(LLAVES).crearLink({
      ...DATOS,
      referencia: 'r'.repeat(80),
      descripcion: 'd'.repeat(150),
    });

    const cuerpo = JSON.parse(
      (mock.mock.calls[0] as [string, RequestInit])[1].body as string,
    ) as { reference: string; description: string };
    expect(cuerpo.reference).toHaveLength(60);
    expect(cuerpo.description).toHaveLength(100);
  });

  it('si Bold responde error o sin enlace, falla con 503 y no inventa un link', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ errors: ['monto inválido'] }),
    });

    await expect(crear(LLAVES).crearLink(DATOS)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('sin llave no llama a Bold', async () => {
    const mock = jest.fn();
    global.fetch = mock;

    await expect(crear({}).crearLink(DATOS)).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(mock).not.toHaveBeenCalled();
  });
});
