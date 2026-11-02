import type { CatalogService } from '../catalog/catalog.service';
import type { PedidosConsultasService } from '../pedidos/pedidos-consultas.service';
import type { CheckoutEnviosService } from './checkout-envios.service';
import { BOTON, type ContextoCheckout } from './checkout-whatsapp';
import {
  CheckoutPreguntasService,
  TEXTO_PEDIR_DIRECCION,
} from './checkout-preguntas.service';
import type {
  CheckoutWhatsapp,
  ConversacionesService,
} from './conversaciones.service';

const CTX: ContextoCheckout = {
  identificadorExterno: '573157861208',
  conversacionId: 'conv-1',
  mensajeId: 'wamid-1',
};

function crearServicio(opciones: {
  ultimaDireccion?: string | null;
  direccionCliente?: string | null;
}) {
  const envios = {
    guardar: jest.fn().mockResolvedValue(undefined),
    texto: jest.fn().mockResolvedValue(undefined),
    botones: jest.fn().mockResolvedValue(undefined),
  };
  const consultas = {
    ultimoPedidoPorTelefono: jest
      .fn()
      .mockResolvedValue(
        opciones.ultimaDireccion
          ? { direccionEntrega: opciones.ultimaDireccion }
          : null,
      ),
    clientePorTelefono: jest
      .fn()
      .mockResolvedValue(
        opciones.direccionCliente
          ? { direccion: opciones.direccionCliente }
          : null,
      ),
  };
  const servicio = new CheckoutPreguntasService(
    {} as ConversacionesService,
    {} as CatalogService,
    consultas as unknown as PedidosConsultasService,
    envios as unknown as CheckoutEnviosService,
  );
  return { servicio, envios };
}

describe('CheckoutPreguntasService · dirección', () => {
  it('sin dirección previa pide que la escriba, sin botón de ubicación', async () => {
    const { servicio, envios } = crearServicio({});
    const checkout: CheckoutWhatsapp = { paso: 'modalidad' };

    await servicio.direccion(CTX, checkout);

    expect(checkout.paso).toBe('direccion');
    expect(envios.guardar).toHaveBeenCalledWith(CTX, checkout);
    expect(envios.texto).toHaveBeenCalledWith(CTX, TEXTO_PEDIR_DIRECCION);
    expect(envios.botones).not.toHaveBeenCalled();
  });

  it('con la dirección del último pedido la ofrece con "Sí, ahí" y "Otra dirección"', async () => {
    const { servicio, envios } = crearServicio({
      ultimaDireccion: 'Calle 15 # 8-20, Los Nogales',
    });
    const checkout: CheckoutWhatsapp = { paso: 'modalidad' };

    await servicio.direccion(CTX, checkout);

    expect(checkout.direccionSugerida).toBe('Calle 15 # 8-20, Los Nogales');
    expect(envios.botones).toHaveBeenCalledWith(
      CTX,
      expect.stringContaining('Calle 15 # 8-20, Los Nogales'),
      [
        { id: BOTON.direccionAnterior, titulo: 'Sí, ahí' },
        { id: BOTON.otraDireccion, titulo: 'Otra dirección' },
      ],
    );
    expect(envios.texto).not.toHaveBeenCalled();
  });

  it('usa la dirección del cliente si no hay pedido previo', async () => {
    const { servicio } = crearServicio({ direccionCliente: 'Carrera 7 # 17B' });
    const checkout: CheckoutWhatsapp = { paso: 'modalidad' };

    await servicio.direccion(CTX, checkout);

    expect(checkout.direccionSugerida).toBe('Carrera 7 # 17B');
  });

  it('pedirDireccion deja el paso en dirección y manda solo texto', async () => {
    const { servicio, envios } = crearServicio({});
    const checkout: CheckoutWhatsapp = { paso: 'pago' };

    await servicio.pedirDireccion(CTX, checkout);

    expect(checkout.paso).toBe('direccion');
    expect(envios.texto).toHaveBeenCalledWith(CTX, TEXTO_PEDIR_DIRECCION);
    expect(TEXTO_PEDIR_DIRECCION).not.toMatch(/Enviar ubicaci/i);
  });
});
