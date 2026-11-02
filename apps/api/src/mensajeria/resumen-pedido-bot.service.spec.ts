import type { ResultadoCalculo } from './calculo-pedido-bot.service';
import type { CheckoutWhatsappService } from './checkout-whatsapp.service';
import type { ConversacionesService } from './conversaciones.service';
import type { GeminiClienteService } from './gemini-cliente.service';
import type { ContextoHerramienta } from './herramientas-bot.tipos';
import type { MetaGraphService } from './meta-graph.service';
import { ResumenPedidoBotService } from './resumen-pedido-bot.service';

const ctx = (canal: ContextoHerramienta['canal']): ContextoHerramienta => ({
  canal,
  identificadorExterno: '573157861208',
  telefono: '573157861208',
  conversacionId: 'cv-1',
});

const CALCULO = {
  ok: true,
  items: [{ varianteId: 'v-1', cantidad: 1 }],
  lineas: [
    {
      productoNombre: 'Hawaiana',
      varianteNombre: 'Grande',
      conTamanos: true,
      cantidad: 1,
      precio: 42_000,
    },
  ],
  datos: {
    nombre: 'Ana',
    apellido: 'Pérez',
    modalidad: 'retiro',
    direccion: null,
  },
} as unknown as Extract<ResultadoCalculo, { ok: true }>;

function crearServicio(falloGemini = false) {
  const enviados: string[] = [];
  const registrados: string[] = [];
  const interacciones: string[] = [];
  const pagos: unknown[] = [];
  const cliente = {
    modelo: 'modelo-1',
    llamar: () => {
      if (falloGemini) return Promise.reject(new Error('timeout'));
      return Promise.resolve({ id: 'aviso-1' });
    },
  };
  const metaGraph = {
    enviarMensajeSesion: (_c: string, _id: string, texto: string) => {
      enviados.push(texto);
      return Promise.resolve();
    },
  };
  const conversaciones = {
    registrarMensaje: (_id: string, _dir: string, texto: string) => {
      registrados.push(texto);
      return Promise.resolve();
    },
    guardarInteraccionGemini: (
      _c: string,
      _id: string,
      interaccion: string,
    ) => {
      interacciones.push(interaccion);
      return Promise.resolve();
    },
  };
  const checkout = {
    ofrecerPagoDesdeCalculo: (datos: unknown) => {
      pagos.push(datos);
      return Promise.resolve('resumen del checkout');
    },
  };
  const servicio = new ResumenPedidoBotService(
    cliente as unknown as GeminiClienteService,
    metaGraph as unknown as MetaGraphService,
    conversaciones as unknown as ConversacionesService,
    checkout as unknown as CheckoutWhatsappService,
  );
  return { servicio, enviados, registrados, interacciones, pagos };
}

describe('ResumenPedidoBotService.enviar', () => {
  it('en WhatsApp pasa al paso de pago del checkout con botones', async () => {
    const { servicio, enviados, pagos, interacciones } = crearServicio();

    await servicio.enviar(ctx('whatsapp'), CALCULO, 'int-1', 'call-1');

    expect(pagos[0]).toMatchObject({
      identificadorExterno: '573157861208',
      conversacionId: 'cv-1',
      items: CALCULO.items,
      checkout: { paso: 'pago', nombre: 'Ana' },
    });
    expect(enviados).toEqual([]);
    expect(interacciones).toEqual(['aviso-1']);
  });

  it('en Messenger manda el resumen por texto y pregunta el método de pago', async () => {
    const { servicio, enviados, registrados, pagos } = crearServicio();

    await servicio.enviar(ctx('messenger'), CALCULO, 'int-1', 'call-1');

    expect(pagos).toEqual([]);
    expect(enviados[0]).toContain('Ana Pérez');
    expect(enviados[0]).toContain('¿Cuál va a ser tu método de pago');
    expect(registrados).toEqual(enviados);
  });

  it('si Gemini no responde al aviso, conserva la interacción previa', async () => {
    const { servicio, interacciones } = crearServicio(true);

    await servicio.enviar(ctx('whatsapp'), CALCULO, 'int-1', 'call-1');

    expect(interacciones).toEqual(['int-1']);
  });
});
