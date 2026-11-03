import { HttpException } from '@nestjs/common';
import type { BoldService } from '../bold/bold.service';
import { firmaBoldEsperada } from '../bold/bold-firma';
import type { SupabaseService } from '../supabase/supabase.service';
import type { AvisoEquipoService } from './aviso-equipo.service';
import type { MetaGraphService } from './meta-graph.service';
import {
  PagoBoldService,
  textoPagoRechazado,
  textoPagoRecibido,
} from './pago-bold.service';

interface Escritura {
  datos: Record<string, unknown>;
  filtros: [string, unknown][];
}

const PEDIDO = {
  id: 'abc12345-0000-0000-0000-000000000000',
  total: 65000,
  clientes: { nombre: 'Ana', telefono: '3157861208' },
};

function crear(opciones: {
  habilitado?: boolean;
  filas?: unknown[];
  errorUpdate?: boolean;
  errorAlActualizarEstado?: boolean;
  linkFalla?: boolean;
}) {
  const escrituras: Escritura[] = [];
  const from = () => {
    const actual: Escritura = { datos: {}, filtros: [] };
    const b = {
      update: (datos: Record<string, unknown>) => {
        actual.datos = datos;
        escrituras.push(actual);
        return b;
      },
      eq: (campo: string, valor: unknown) => {
        actual.filtros.push([campo, valor]);
        return b;
      },
      in: (campo: string, valor: unknown) => {
        actual.filtros.push([campo, valor]);
        return b;
      },
      select: () => b,
      returns: () =>
        Promise.resolve(
          opciones.errorAlActualizarEstado
            ? { data: null, error: { message: 'caído' } }
            : { data: opciones.filas ?? [], error: null },
        ),
      // `await ...eq()` sin `.select()`: el UPDATE del link.
      then: (resolver: (r: unknown) => unknown) =>
        Promise.resolve({
          error: opciones.errorUpdate ? { message: 'caído' } : null,
        }).then(resolver),
    };
    return b;
  };
  const supabase = { getClient: () => ({ from }) };
  const bold = {
    habilitado: jest.fn().mockReturnValue(opciones.habilitado ?? true),
    secreto: jest.fn().mockReturnValue('secreto'),
    crearLink: opciones.linkFalla
      ? jest.fn().mockRejectedValue(new Error('Bold caído'))
      : jest.fn().mockResolvedValue({
          id: 'LNK_1',
          url: 'https://checkout.bold.co/LNK_1',
        }),
  };
  const metaGraph = {
    enviarMensajeSesion: jest.fn().mockResolvedValue(undefined),
  };
  const avisoEquipo = { notificarPago: jest.fn() };
  const servicio = new PagoBoldService(
    supabase as unknown as SupabaseService,
    bold as unknown as BoldService,
    metaGraph as unknown as MetaGraphService,
    avisoEquipo as unknown as AvisoEquipoService,
  );
  return { servicio, escrituras, bold, metaGraph, avisoEquipo };
}

describe('PagoBoldService · iniciarCobro', () => {
  it('con Bold apagado no genera link ni toca el pedido', async () => {
    const { servicio, bold, escrituras } = crear({ habilitado: false });

    await expect(servicio.iniciarCobro(PEDIDO)).resolves.toBeNull();

    expect(bold.crearLink).not.toHaveBeenCalled();
    expect(escrituras).toEqual([]);
  });

  it('crea el link con el total del pedido y lo deja pendiente de pago', async () => {
    const { servicio, bold, escrituras } = crear({});

    await expect(servicio.iniciarCobro(PEDIDO)).resolves.toBe(
      'https://checkout.bold.co/LNK_1',
    );

    expect(bold.crearLink).toHaveBeenCalledWith({
      referencia: PEDIDO.id,
      total: 65000,
      descripcion: 'Pizzería Horebs, pedido #abc12345',
      canal: undefined,
    });
    expect(escrituras[0]).toEqual({
      datos: { bold_link_id: 'LNK_1', pago_estado: 'pendiente' },
      filtros: [['id', PEDIDO.id]],
    });
  });

  it('iniciarCobro pasa callback_url de Messenger', async () => {
    const { servicio, bold } = crear({});

    await servicio.iniciarCobro(PEDIDO, 'messenger');

    expect(bold.crearLink).toHaveBeenCalledWith({
      referencia: PEDIDO.id,
      total: 65000,
      descripcion: 'Pizzería Horebs, pedido #abc12345',
      canal: 'messenger',
    });
  });

  it('si Bold falla devuelve null para que el bot siga sin enlace', async () => {
    const { servicio } = crear({ linkFalla: true });

    await expect(servicio.iniciarCobro(PEDIDO)).resolves.toBeNull();
  });

  it('si no puede guardar el link en el pedido tampoco entrega el enlace', async () => {
    const { servicio } = crear({ errorUpdate: true });

    await expect(servicio.iniciarCobro(PEDIDO)).resolves.toBeNull();
  });
});

describe('PagoBoldService · firmaValida', () => {
  it('acepta la firma hecha con la llave secreta y rechaza el resto', () => {
    const { servicio } = crear({});
    const cuerpo = Buffer.from('{"type":"SALE_APPROVED"}');

    expect(
      servicio.firmaValida(cuerpo, firmaBoldEsperada(cuerpo, 'secreto')),
    ).toBe(true);
    expect(servicio.firmaValida(cuerpo, 'x')).toBe(false);
    expect(servicio.firmaValida(cuerpo, undefined)).toBe(false);
  });
});

describe('PagoBoldService · procesarEvento', () => {
  const aprobado = {
    id: 'evt-1',
    type: 'SALE_APPROVED',
    data: { metadata: { reference: 'LNK_1' } },
  };

  it('un pago aprobado marca el pedido pagado, avisa al cliente y al equipo', async () => {
    const { servicio, escrituras, metaGraph, avisoEquipo } = crear({
      filas: [PEDIDO],
    });

    await servicio.procesarEvento(aprobado);

    expect(escrituras[0].datos).toMatchObject({ pago_estado: 'pagado' });
    expect(escrituras[0].datos).toHaveProperty('pagado_en');
    expect(escrituras[0].filtros).toEqual([
      ['bold_link_id', 'LNK_1'],
      ['pago_estado', ['pendiente', 'rechazado']],
    ]);
    expect(metaGraph.enviarMensajeSesion).toHaveBeenCalledWith(
      'whatsapp',
      '573157861208',
      textoPagoRecibido('Ana', 65000),
    );
    expect(avisoEquipo.notificarPago).toHaveBeenCalledWith({
      pedidoId: PEDIDO.id,
      total: 65000,
      pagado: true,
    });
  });

  it('un evento repetido (el pedido ya no está pendiente) no avisa de nuevo', async () => {
    const { servicio, metaGraph, avisoEquipo } = crear({ filas: [] });

    await servicio.procesarEvento(aprobado);

    expect(metaGraph.enviarMensajeSesion).not.toHaveBeenCalled();
    expect(avisoEquipo.notificarPago).not.toHaveBeenCalled();
  });

  it('un pago rechazado deja el pedido rechazado y ofrece reintentar con el mismo enlace', async () => {
    const { servicio, escrituras, metaGraph } = crear({ filas: [PEDIDO] });

    await servicio.procesarEvento({
      ...aprobado,
      type: 'SALE_REJECTED',
    });

    expect(escrituras[0].datos).toEqual({ pago_estado: 'rechazado' });
    expect(escrituras[0].filtros[1]).toEqual(['pago_estado', ['pendiente']]);
    expect(metaGraph.enviarMensajeSesion).toHaveBeenCalledWith(
      'whatsapp',
      '573157861208',
      textoPagoRechazado('LNK_1'),
    );
  });

  it.each([
    { type: 'VOID_APPROVED', data: { metadata: { reference: 'LNK_1' } } },
    { type: 'SALE_APPROVED', data: {} },
    {},
  ])('ignora el evento %j', async (evento) => {
    const { servicio, escrituras } = crear({ filas: [PEDIDO] });

    await servicio.procesarEvento(evento);

    expect(escrituras).toEqual([]);
  });

  it('si la base falla al actualizar el estado, el error sube como excepción HTTP', async () => {
    const { servicio, metaGraph } = crear({ errorAlActualizarEstado: true });

    await expect(servicio.procesarEvento(aprobado)).rejects.toBeInstanceOf(
      HttpException,
    );
    expect(metaGraph.enviarMensajeSesion).not.toHaveBeenCalled();
  });

  it('si WhatsApp no deja avisar al cliente, igual queda pagado', async () => {
    const { servicio, metaGraph, avisoEquipo } = crear({ filas: [PEDIDO] });
    metaGraph.enviarMensajeSesion.mockRejectedValue(new Error('fuera de 24h'));

    await expect(servicio.procesarEvento(aprobado)).resolves.toBeUndefined();

    expect(avisoEquipo.notificarPago).toHaveBeenCalled();
  });
});
