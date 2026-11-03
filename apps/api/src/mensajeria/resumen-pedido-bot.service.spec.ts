import type { ResultadoCalculo } from './calculo-pedido-bot.service';
import type { CheckoutWhatsappService } from './checkout-whatsapp.service';
import type { ConversacionesService } from './conversaciones.service';
import type { GeminiClienteService } from './gemini-cliente.service';
import type { ContextoHerramienta } from './herramientas-bot.tipos';
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
    conversaciones as unknown as ConversacionesService,
    checkout as unknown as CheckoutWhatsappService,
  );
  return { servicio, interacciones, pagos };
}

describe('ResumenPedidoBotService.enviar', () => {
  it('en WhatsApp pasa al paso de pago del checkout con botones', async () => {
    const { servicio, pagos, interacciones } = crearServicio();

    await servicio.enviar(ctx('whatsapp'), CALCULO, 'int-1', 'call-1');

    expect(pagos[0]).toMatchObject({
      identificadorExterno: '573157861208',
      conversacionId: 'cv-1',
      items: CALCULO.items,
      checkout: { paso: 'pago', nombre: 'Ana' },
    });
    expect(pagos[0]).toMatchObject({ canal: 'whatsapp' });
    expect(interacciones).toEqual(['aviso-1']);
  });

  it('en Messenger e Instagram también cierra con el checkout del chat, sin derivar a una persona', async () => {
    for (const canal of ['messenger', 'instagram'] as const) {
      const { servicio, pagos, interacciones } = crearServicio();

      await servicio.enviar(
        { ...ctx(canal), telefono: null },
        CALCULO,
        'int-1',
        'call-1',
      );

      expect(pagos[0]).toMatchObject({
        canal,
        telefono: null,
        identificadorExterno: '573157861208',
        checkout: { paso: 'pago', nombre: 'Ana', apellido: 'Pérez' },
      });
      expect(interacciones).toEqual(['aviso-1']);
    }
  });

  it('si Gemini no responde al aviso, conserva la interacción previa', async () => {
    const { servicio, interacciones } = crearServicio(true);

    await servicio.enviar(ctx('whatsapp'), CALCULO, 'int-1', 'call-1');

    expect(interacciones).toEqual(['int-1']);
  });
});
