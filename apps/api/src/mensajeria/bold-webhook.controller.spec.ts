import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { BoldWebhookController } from './bold-webhook.controller';
import type { PagoBoldService } from './pago-bold.service';

const EVENTO = {
  type: 'SALE_APPROVED',
  data: { metadata: { reference: 'L' } },
};

function peticion(opciones: {
  rawBody?: Buffer;
  firma?: string;
}): RawBodyRequest<Request> {
  return {
    rawBody: opciones.rawBody,
    headers: opciones.firma ? { 'x-bold-signature': opciones.firma } : {},
    body: EVENTO,
  } as unknown as RawBodyRequest<Request>;
}

function crear(firmaValida: boolean, procesar = jest.fn()) {
  const pagos = {
    firmaValida: jest.fn().mockReturnValue(firmaValida),
    procesarEvento: procesar,
  };
  const controller = new BoldWebhookController(
    pagos as unknown as PagoBoldService,
  );
  return { controller, pagos };
}

describe('BoldWebhookController', () => {
  it('con firma válida responde 200 y procesa el evento', () => {
    const { controller, pagos } = crear(
      true,
      jest.fn().mockResolvedValue(undefined),
    );
    const raw = Buffer.from('{}');

    expect(controller.recibir(peticion({ rawBody: raw, firma: 'f' }))).toEqual({
      ok: true,
    });

    expect(pagos.firmaValida).toHaveBeenCalledWith(raw, 'f');
    expect(pagos.procesarEvento).toHaveBeenCalledWith(EVENTO);
  });

  it('con firma inválida responde 403 y no procesa nada', () => {
    const { controller, pagos } = crear(false);

    expect(() =>
      controller.recibir(peticion({ rawBody: Buffer.from('{}'), firma: 'x' })),
    ).toThrow(ForbiddenException);
    expect(pagos.procesarEvento).not.toHaveBeenCalled();
  });

  it('sin firma también es 403', () => {
    const { controller } = crear(false);

    expect(() =>
      controller.recibir(peticion({ rawBody: Buffer.from('{}') })),
    ).toThrow(ForbiddenException);
  });

  it('sin body crudo es 400', () => {
    const { controller } = crear(true);

    expect(() => controller.recibir(peticion({}))).toThrow(BadRequestException);
  });

  it('si procesar falla igual responde 200 (Bold no debe reintentar en bucle)', async () => {
    const { controller, pagos } = crear(
      true,
      jest.fn().mockRejectedValue(new Error('base caída')),
    );

    expect(
      controller.recibir(peticion({ rawBody: Buffer.from('{}'), firma: 'f' })),
    ).toEqual({ ok: true });
    await Promise.resolve();

    expect(pagos.procesarEvento).toHaveBeenCalled();
  });
});
