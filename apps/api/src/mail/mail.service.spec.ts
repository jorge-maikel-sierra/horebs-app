import { ServiceUnavailableException } from '@nestjs/common';
import { MailService } from './mail.service';

type Privado = {
  enviarPorResend(correo: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<void>;
};

function servicio(): Privado {
  const svc = Object.create(MailService.prototype) as MailService;
  Object.assign(svc, { apiKey: 're_clave', remitente: 'Horebs <a@b.co>' });
  return svc as unknown as Privado;
}

describe('MailService.enviarPorResend', () => {
  const fetchOriginal = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = fetchOriginal;
  });

  function responder(respuesta: Response) {
    const fetchMock = jest
      .fn<Promise<Response>, [string, RequestInit]>()
      .mockResolvedValue(respuesta);
    globalThis.fetch = fetchMock;
    return fetchMock;
  }

  it('manda el correo con remitente, destino y la clave en el header', async () => {
    const fetchMock = responder(new Response('{}', { status: 200 }));
    await servicio().enviarPorResend({
      to: 'x@y.co',
      subject: 'Hola',
      text: 'Cuerpo',
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer re_clave',
    );
    expect(JSON.parse(init.body as string)).toEqual({
      from: 'Horebs <a@b.co>',
      to: 'x@y.co',
      subject: 'Hola',
      text: 'Cuerpo',
    });
  });

  it('si Resend responde con error lanza 503 con el motivo', async () => {
    responder(new Response('dominio no verificado', { status: 403 }));
    const envio = servicio().enviarPorResend({
      to: 'x@y.co',
      subject: 'Hola',
      text: 'Cuerpo',
    });
    await expect(envio).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(envio).rejects.toThrow(/403.*dominio no verificado/);
  });
});
