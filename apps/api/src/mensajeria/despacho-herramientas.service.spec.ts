import type {
  CalculoPedidoBotService,
  ResultadoCalculo,
} from './calculo-pedido-bot.service';
import { DespachoHerramientasService } from './despacho-herramientas.service';
import type { PasoFunctionCall } from './gemini-cliente.service';
import type { HerramientasBotService } from './herramientas-bot.service';
import type { ContextoHerramienta } from './herramientas-bot.tipos';
import type { ResumenPedidoBotService } from './resumen-pedido-bot.service';

const CTX: ContextoHerramienta = {
  canal: 'whatsapp',
  identificadorExterno: '573157861208',
  telefono: '573157861208',
  conversacionId: 'cv-1',
};

const llamada = (name: string): PasoFunctionCall => ({
  id: 'call-9',
  type: 'function_call',
  name,
  arguments: { a: 1 },
});

function crearServicio(calculo: ResultadoCalculo) {
  const ejecutadas: unknown[][] = [];
  const resumenes: unknown[][] = [];
  const herramientas = {
    ejecutar: (...args: unknown[]) => {
      ejecutadas.push(args);
      return Promise.resolve('resultado');
    },
  };
  const calculos = { calcular: () => Promise.resolve(calculo) };
  const resumen = {
    enviar: (...args: unknown[]) => {
      resumenes.push(args);
      return Promise.resolve();
    },
  };
  const servicio = new DespachoHerramientasService(
    herramientas as unknown as HerramientasBotService,
    calculos as unknown as CalculoPedidoBotService,
    resumen as unknown as ResumenPedidoBotService,
  );
  return { servicio, ejecutadas, resumenes };
}

describe('DespachoHerramientasService.resultado', () => {
  it('una herramienta común se ejecuta y devuelve su texto', async () => {
    const { servicio, ejecutadas } = crearServicio({ ok: false, texto: 'x' });

    await expect(
      servicio.resultado(llamada('obtener_horario'), CTX, 'int-1'),
    ).resolves.toBe('resultado');
    expect(ejecutadas[0]).toEqual(['obtener_horario', { a: 1 }, CTX]);
  });

  it('calcular_pedido con un problema le devuelve el texto al modelo', async () => {
    const { servicio, resumenes } = crearServicio({
      ok: false,
      texto: 'Falta la dirección.',
    });

    await expect(
      servicio.resultado(llamada('calcular_pedido'), CTX, 'int-1'),
    ).resolves.toBe('Falta la dirección.');
    expect(resumenes).toEqual([]);
  });

  it('calcular_pedido listo manda el resumen y no queda nada que contestar', async () => {
    const listo = {
      ok: true,
      items: [],
      lineas: [],
      datos: {},
    } as unknown as ResultadoCalculo;
    const { servicio, resumenes } = crearServicio(listo);

    await expect(
      servicio.resultado(llamada('calcular_pedido'), CTX, 'int-1'),
    ).resolves.toBeNull();
    expect(resumenes[0]).toEqual([CTX, listo, 'int-1', 'call-9']);
  });
});

describe('DespachoHerramientasService.derivar', () => {
  it('ejecuta derivar_a_humano sin argumentos', async () => {
    const { servicio, ejecutadas } = crearServicio({ ok: false, texto: 'x' });

    await servicio.derivar(CTX);

    expect(ejecutadas[0]).toEqual(['derivar_a_humano', {}, CTX]);
  });
});
