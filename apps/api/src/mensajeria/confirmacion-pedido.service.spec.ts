import type { CheckoutEnviosService } from './checkout-envios.service';
import type { ContextoCheckout } from './checkout-whatsapp';
import { ConfirmacionPedidoService } from './confirmacion-pedido.service';
import type { ConversionesSocialService } from './conversiones-social.service';
import type { OrigenConversacionService } from './origen-conversacion.service';
import type { PagoBoldService } from './pago-bold.service';

const CTX: ContextoCheckout = {
  identificadorExterno: '573157861208',
  conversacionId: 'conv-1',
  mensajeId: 'wamid.1',
};
const DATOS = {
  nombre: 'Ana',
  pedido: { id: 'abcdef12-3456', total: 33000 },
  programadoPara: null,
};

function crear(enlace: string | null) {
  const envios = {
    limpiar: jest.fn().mockResolvedValue(undefined),
    texto: jest.fn().mockResolvedValue(undefined),
  };
  const pagoBold = { iniciarCobro: jest.fn().mockResolvedValue(enlace) };
  const conversiones = { avisarPedido: jest.fn() };
  const origenes = {
    vincularPedido: jest.fn().mockResolvedValue(undefined),
  };
  const servicio = new ConfirmacionPedidoService(
    envios as unknown as CheckoutEnviosService,
    pagoBold as unknown as PagoBoldService,
    origenes as unknown as OrigenConversacionService,
    conversiones as unknown as ConversionesSocialService,
  );
  return { servicio, envios, pagoBold, origenes, conversiones };
}

describe('ConfirmacionPedidoService', () => {
  it('marca el pedido con el origen de la conversación del canal', async () => {
    const { servicio, origenes } = crear(null);

    await servicio.confirmar(
      { ...CTX, canal: 'instagram' },
      { ...DATOS, metodo: 'efectivo' },
    );

    expect(origenes.vincularPedido).toHaveBeenCalledWith(
      'instagram',
      CTX.identificadorExterno,
      DATOS.pedido.id,
    );
  });

  it('avisa OrderCreated con el total del pedido', async () => {
    const { servicio, conversiones } = crear(null);

    await servicio.confirmar(
      { ...CTX, canal: 'messenger' },
      { ...DATOS, metodo: 'efectivo' },
    );

    expect(conversiones.avisarPedido).toHaveBeenCalledWith('OrderCreated', {
      canal: 'messenger',
      identificadorExterno: CTX.identificadorExterno,
      pedidoId: DATOS.pedido.id,
      total: DATOS.pedido.total,
    });
  });

  it('si no se puede copiar el origen, igual confirma el pedido', async () => {
    const { servicio, envios, origenes } = crear(null);
    origenes.vincularPedido.mockRejectedValue(new Error('base caída'));

    await servicio.confirmar(CTX, { ...DATOS, metodo: 'efectivo' });

    expect(envios.texto).toHaveBeenCalled();
  });

  it('con tarjeta cobra por Bold, manda el enlace y dice que el pago quedó pendiente', async () => {
    const { servicio, envios } = crear('https://checkout.bold.co/LNK_1');

    await expect(
      servicio.confirmar(CTX, { ...DATOS, metodo: 'tarjeta' }),
    ).resolves.toBe(true);

    expect(envios.limpiar).toHaveBeenCalledWith(CTX);
    expect(envios.texto).toHaveBeenCalledWith(
      CTX,
      expect.stringContaining('https://checkout.bold.co/LNK_1'),
    );
  });

  it('si el cobro no se pudo generar confirma sin enlace y no queda pendiente', async () => {
    const { servicio, envios } = crear(null);

    await expect(
      servicio.confirmar(CTX, { ...DATOS, metodo: 'tarjeta' }),
    ).resolves.toBe(false);

    expect(envios.texto).toHaveBeenCalledWith(
      CTX,
      expect.not.stringContaining('http'),
    );
  });

  it.each(['efectivo', 'transferencia'] as const)(
    'con %s no pide cobro a Bold',
    async (metodo) => {
      const { servicio, pagoBold } = crear('https://x');

      await expect(servicio.confirmar(CTX, { ...DATOS, metodo })).resolves.toBe(
        false,
      );

      expect(pagoBold.iniciarCobro).not.toHaveBeenCalled();
    },
  );

  it('avisa al cliente cuando no se pudo registrar el pedido', async () => {
    const { servicio, envios } = crear(null);

    await servicio.noSePudoRegistrar(CTX);

    expect(envios.texto).toHaveBeenCalledWith(
      CTX,
      expect.stringContaining('No pude registrar tu pedido'),
    );
  });
});
