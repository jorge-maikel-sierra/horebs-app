import type { ContextoCheckout } from './checkout-whatsapp';
import { CheckoutEnviosService } from './checkout-envios.service';
import type {
  CheckoutWhatsapp,
  ConversacionesService,
} from './conversaciones.service';
import type { MetaGraphService } from './meta-graph.service';

const CTX: ContextoCheckout = {
  identificadorExterno: '573157861208',
  conversacionId: 'conv-1',
  mensajeId: 'wamid.9',
};
const BOTONES = [
  { id: 'domicilio', titulo: 'Domicilio' },
  { id: 'retiro', titulo: 'Retirar' },
];

function crearServicio() {
  const conversaciones = {
    registrarMensaje: jest.fn().mockResolvedValue(undefined),
    guardarCheckout: jest.fn().mockResolvedValue(undefined),
    guardarCarrito: jest.fn().mockResolvedValue(undefined),
    obtenerCheckout: jest.fn().mockResolvedValue({ paso: 'pago' }),
    guardarTelefono: jest.fn().mockResolvedValue(undefined),
  };
  const metaGraph = {
    enviarMensajeSesion: jest.fn().mockResolvedValue(undefined),
    enviarBotones: jest.fn().mockResolvedValue(undefined),
    enviarLista: jest.fn().mockResolvedValue(undefined),
    enviarCatalogo: jest.fn().mockResolvedValue(undefined),
  };
  const servicio = new CheckoutEnviosService(
    conversaciones as unknown as ConversacionesService,
    metaGraph as unknown as MetaGraphService,
  );
  return { servicio, conversaciones, metaGraph };
}

describe('CheckoutEnviosService', () => {
  it('texto envía el mensaje y lo registra como saliente del bot', async () => {
    const { servicio, metaGraph, conversaciones } = crearServicio();

    await servicio.texto(CTX, 'Hola');

    expect(metaGraph.enviarMensajeSesion).toHaveBeenCalledWith(
      'whatsapp',
      '573157861208',
      'Hola',
    );
    expect(conversaciones.registrarMensaje).toHaveBeenCalledWith(
      'conv-1',
      'saliente_bot',
      'Hola',
    );
  });

  it('botones deja en el historial el cuerpo con los títulos de las opciones', async () => {
    const { servicio, metaGraph, conversaciones } = crearServicio();

    await servicio.botones(CTX, '¿Cómo lo quieres?', BOTONES);

    expect(metaGraph.enviarBotones).toHaveBeenCalledWith(
      'whatsapp',
      '573157861208',
      '¿Cómo lo quieres?',
      BOTONES,
    );
    expect(conversaciones.registrarMensaje).toHaveBeenCalledWith(
      'conv-1',
      'saliente_bot',
      '¿Cómo lo quieres?\n[Domicilio · Retirar]',
    );
  });

  it('lista manda cuerpo, botón y filas, y registra las opciones', async () => {
    const { servicio, metaGraph, conversaciones } = crearServicio();

    await servicio.lista(CTX, 'Elige la hora', 'Ver horas', BOTONES);

    expect(metaGraph.enviarLista).toHaveBeenCalledWith(
      'whatsapp',
      '573157861208',
      {
        cuerpo: 'Elige la hora',
        boton: 'Ver horas',
        filas: BOTONES,
      },
    );
    expect(conversaciones.registrarMensaje).toHaveBeenCalledWith(
      'conv-1',
      'saliente_bot',
      'Elige la hora\n[Domicilio · Retirar]',
    );
  });

  it('catalogo registra que el menú salió como catálogo de WhatsApp', async () => {
    const { servicio, metaGraph, conversaciones } = crearServicio();

    await servicio.catalogo(CTX, 'https://pizzeriahorebs.shop/menu');

    expect(metaGraph.enviarCatalogo).toHaveBeenCalledWith(
      'whatsapp',
      '573157861208',
      'https://pizzeriahorebs.shop/menu',
    );
    expect(conversaciones.registrarMensaje).toHaveBeenCalledWith(
      'conv-1',
      'saliente_bot',
      'Menú enviado como catálogo de WhatsApp.',
    );
  });

  it('guardar persiste el estado del checkout de esa conversación', async () => {
    const { servicio, conversaciones } = crearServicio();
    const checkout: CheckoutWhatsapp = { paso: 'pago' };

    await servicio.guardar(CTX, checkout);

    expect(conversaciones.guardarCheckout).toHaveBeenCalledWith(
      'whatsapp',
      '573157861208',
      checkout,
    );
  });

  it('limpiar borra el paso en curso y el carrito pendiente', async () => {
    const { servicio, conversaciones } = crearServicio();

    await servicio.limpiar(CTX);

    expect(conversaciones.guardarCheckout).toHaveBeenCalledWith(
      'whatsapp',
      '573157861208',
      null,
    );
    expect(conversaciones.guardarCarrito).toHaveBeenCalledWith(
      'whatsapp',
      '573157861208',
      null,
    );
  });

  it('obtener lee el checkout en curso del cliente', async () => {
    const { servicio, conversaciones } = crearServicio();

    await expect(servicio.obtener(CTX)).resolves.toEqual({ paso: 'pago' });
    expect(conversaciones.obtenerCheckout).toHaveBeenCalledWith(
      'whatsapp',
      '573157861208',
    );
  });

  it('guardarCarrito deja los ítems pendientes del cliente', async () => {
    const { servicio, conversaciones } = crearServicio();
    const items = [{ varianteId: 'v-1', cantidad: 2 }];

    await servicio.guardarCarrito(CTX, items);

    expect(conversaciones.guardarCarrito).toHaveBeenCalledWith(
      'whatsapp',
      '573157861208',
      items,
    );
  });

  it('respeta el canal del contexto en texto, botones y catálogo', async () => {
    const { servicio, metaGraph, conversaciones } = crearServicio();
    const ctxInstagram: ContextoCheckout = {
      ...CTX,
      canal: 'instagram',
      identificadorExterno: 'igsid-123',
    };

    await servicio.texto(ctxInstagram, 'Hola Instagram');
    expect(metaGraph.enviarMensajeSesion).toHaveBeenCalledWith(
      'instagram',
      'igsid-123',
      'Hola Instagram',
    );

    await servicio.catalogo(
      ctxInstagram,
      'https://pizzeriahorebs.shop/catalogo',
    );
    expect(metaGraph.enviarCatalogo).toHaveBeenCalledWith(
      'instagram',
      'igsid-123',
      'https://pizzeriahorebs.shop/catalogo',
    );
    expect(conversaciones.registrarMensaje).toHaveBeenCalledWith(
      'conv-1',
      'saliente_bot',
      'Menú enviado.',
    );
  });

  it('guardarTelefono delega en ConversacionesService con el canal del contexto', async () => {
    const { servicio, conversaciones } = crearServicio();
    const ctxMessenger: ContextoCheckout = {
      ...CTX,
      canal: 'messenger',
      identificadorExterno: 'psid-888',
    };

    await servicio.guardarTelefono(ctxMessenger, '3157861208');

    expect(conversaciones.guardarTelefono).toHaveBeenCalledWith(
      'messenger',
      'psid-888',
      '3157861208',
    );
  });
});
