import {
  BadRequestException,
  ForbiddenException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import type { GoogleAdsIngestaService } from './google-ads-ingesta.service';
import { GoogleAdsWebhookController } from './google-ads-webhook.controller';

const CUERPO = { reporte: 'campanas' };

function peticion(opciones: {
  json?: boolean;
  rawBody?: Buffer;
  firma?: string;
}): RawBodyRequest<Request> {
  return {
    is: () => (opciones.json === false ? false : 'json'),
    rawBody: opciones.rawBody,
    headers: opciones.firma ? { 'x-horebs-firma': opciones.firma } : {},
    body: CUERPO,
  } as unknown as RawBodyRequest<Request>;
}

function crear(firmaValida: boolean) {
  const ingesta = {
    firmaValida: jest.fn().mockReturnValue(firmaValida),
    recibir: jest.fn().mockResolvedValue({ estado: 'guardado' }),
  };
  const controller = new GoogleAdsWebhookController(
    ingesta as unknown as GoogleAdsIngestaService,
  );
  return { controller, ingesta };
}

describe('GoogleAdsWebhookController', () => {
  it('con firma válida guarda el lote y devuelve el resultado', async () => {
    const { controller, ingesta } = crear(true);
    const raw = Buffer.from('{}');

    await expect(
      controller.recibir(peticion({ rawBody: raw, firma: 't=1,v1=a' })),
    ).resolves.toEqual({ estado: 'guardado' });
    expect(ingesta.firmaValida).toHaveBeenCalledWith(raw, 't=1,v1=a');
    expect(ingesta.recibir).toHaveBeenCalledWith(CUERPO);
  });

  it('con firma inválida o ausente responde 403 y no guarda', () => {
    const { controller, ingesta } = crear(false);
    expect(() =>
      controller.recibir(peticion({ rawBody: Buffer.from('{}') })),
    ).toThrow(ForbiddenException);
    expect(ingesta.recibir).not.toHaveBeenCalled();
  });

  it('si no es JSON responde 415 antes de mirar la firma', () => {
    const { controller, ingesta } = crear(true);
    expect(() =>
      controller.recibir(peticion({ json: false, rawBody: Buffer.from('x') })),
    ).toThrow(UnsupportedMediaTypeException);
    expect(ingesta.firmaValida).not.toHaveBeenCalled();
  });

  it('sin body crudo responde 400', () => {
    const { controller } = crear(true);
    expect(() => controller.recibir(peticion({}))).toThrow(BadRequestException);
  });
});
