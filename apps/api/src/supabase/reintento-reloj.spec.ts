import { conReintentoPorReloj } from './reintento-reloj';

const RELOJ = () =>
  new Response(
    JSON.stringify({ code: 'PGRST303', message: 'JWT issued at future' }),
    { status: 401 },
  );
const OK = () => new Response('[]', { status: 200 });

describe('conReintentoPorReloj', () => {
  it('repite la llamada cuando Supabase la rechaza por el desfase de reloj', async () => {
    const base = jest
      .fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>()
      .mockResolvedValueOnce(RELOJ())
      .mockResolvedValueOnce(OK());
    const aviso = jest.fn();

    const respuesta = await conReintentoPorReloj(
      base,
      aviso,
      0,
    )('https://x/rest', { method: 'POST', body: '{"a":1}' });

    expect(respuesta.ok).toBe(true);
    expect(base).toHaveBeenCalledTimes(2);
    expect(base).toHaveBeenLastCalledWith('https://x/rest', {
      method: 'POST',
      body: '{"a":1}',
    });
    expect(aviso).toHaveBeenCalledTimes(1);
  });

  it('no repite una respuesta buena ni otros errores', async () => {
    const buena = jest.fn().mockResolvedValue(OK());
    await conReintentoPorReloj(buena, undefined, 0)('https://x');
    expect(buena).toHaveBeenCalledTimes(1);

    const otroError = jest
      .fn()
      .mockResolvedValue(
        new Response('{"message":"duplicado"}', { status: 409 }),
      );
    const respuesta = await conReintentoPorReloj(
      otroError,
      undefined,
      0,
    )('https://x');
    expect(otroError).toHaveBeenCalledTimes(1);
    expect(respuesta.status).toBe(409);
  });

  it('se rinde después de los reintentos y devuelve el último error', async () => {
    const base = jest.fn().mockImplementation(() => Promise.resolve(RELOJ()));

    const respuesta = await conReintentoPorReloj(
      base,
      undefined,
      0,
    )('https://x');

    expect(base).toHaveBeenCalledTimes(3);
    expect(respuesta.status).toBe(401);
    await expect(respuesta.text()).resolves.toContain('JWT issued at future');
  });
});
