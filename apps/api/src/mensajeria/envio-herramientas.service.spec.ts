import type { CatalogService, ProductoDto } from '../catalog/catalog.service';
import type { ConversacionesService } from './conversaciones.service';
import { EnvioHerramientasService } from './envio-herramientas.service';
import type { PasoFunctionCall } from './gemini-cliente.service';
import type { ContextoHerramienta } from './herramientas-bot.tipos';
import type { MetaGraphService } from './meta-graph.service';

const CTX: ContextoHerramienta = {
  canal: 'whatsapp',
  identificadorExterno: '573157861208',
  telefono: '573157861208',
  conversacionId: 'cv-1',
};

const llamada = (
  name: string,
  args: Record<string, unknown> = {},
): PasoFunctionCall => ({
  id: 'call-1',
  type: 'function_call',
  name,
  arguments: args,
});

const producto = (id: string, nombre: string): ProductoDto => ({
  id,
  nombre,
  descripcion: null,
  imagen_url: `https://img/${id}.jpg`,
  destacado: false,
  categoria_id: 'cat-1',
  slug: id,
  ventas_historicas: null,
  variantes: [
    { id: `${id}-v`, nombre: 'Única', precio: 20_000, precio_oferta: null },
  ],
});

interface Opciones {
  catalogo?: 'catalogo' | 'enlace';
  lista?: 'lista' | 'tarjetas';
  productos?: ProductoDto[];
  categorias?: { id: string; nombre: string; orden: number }[];
}

function crearServicio(opciones: Opciones = {}) {
  const registrados: string[] = [];
  const interacciones: string[] = [];
  const catalogosEnviados: unknown[][] = [];
  const tarjetasEnviadas: unknown[][] = [];
  const botonesEnviados: unknown[][] = [];
  const catalog = {
    getProductos: () =>
      Promise.resolve(
        opciones.productos ?? [
          producto('p-1', 'Hawaiana'),
          producto('p-2', 'Margarita'),
        ],
      ),
    getCategorias: () =>
      Promise.resolve(
        opciones.categorias ?? [{ id: 'cat-1', nombre: 'Pizzas', orden: 1 }],
      ),
  };
  const metaGraph = {
    enviarCatalogo: (...args: unknown[]) => {
      catalogosEnviados.push(args);
      return Promise.resolve(opciones.catalogo ?? 'catalogo');
    },
    enviarListaProductos: () => Promise.resolve(opciones.lista ?? 'lista'),
    enviarTarjetasProductos: (...args: unknown[]) => {
      tarjetasEnviadas.push(args);
      return Promise.resolve();
    },
    enviarBotones: (...args: unknown[]) => {
      botonesEnviados.push(args);
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
  const servicio = new EnvioHerramientasService(
    catalog as unknown as CatalogService,
    metaGraph as unknown as MetaGraphService,
    conversaciones as unknown as ConversacionesService,
  );
  return {
    servicio,
    registrados,
    interacciones,
    catalogosEnviados,
    tarjetasEnviadas,
    botonesEnviados,
  };
}

describe('EnvioHerramientasService.mandoElMensaje', () => {
  it('una herramienta que no manda mensaje propio devuelve false y no toca nada', async () => {
    const { servicio, registrados, interacciones } = crearServicio();

    await expect(
      servicio.mandoElMensaje(llamada('obtener_horario'), CTX, 'int-1'),
    ).resolves.toBe(false);
    expect(registrados).toEqual([]);
    expect(interacciones).toEqual([]);
  });

  it('enviar_catalogo manda el catálogo con la portada del primer producto', async () => {
    const { servicio, registrados, interacciones, catalogosEnviados } =
      crearServicio();

    await expect(
      servicio.mandoElMensaje(llamada('enviar_catalogo'), CTX, 'int-1'),
    ).resolves.toBe(true);

    expect(catalogosEnviados[0][3]).toBe('p-1-v');
    expect(registrados).toEqual(['Menú enviado como catálogo de WhatsApp.']);
    expect(interacciones).toEqual(['int-1']);
  });

  it('en Messenger e Instagram el menú va como tarjetas dentro del chat, sin enlace', async () => {
    for (const canal of ['messenger', 'instagram'] as const) {
      const { servicio, registrados, catalogosEnviados, tarjetasEnviadas } =
        crearServicio();

      await expect(
        servicio.mandoElMensaje(
          llamada('enviar_catalogo'),
          { ...CTX, canal, identificadorExterno: 'psid-1', telefono: null },
          'int-1',
        ),
      ).resolves.toBe(true);

      expect(catalogosEnviados).toEqual([]);
      expect(tarjetasEnviadas).toHaveLength(1);
      expect(tarjetasEnviadas[0][0]).toBe(canal);
      expect(registrados[0]).toContain('Menú enviado dentro del chat');
      expect(registrados[0]).not.toContain('http');
    }
  });

  it('en Messenger ofrece las categorías con productos, sin los adicionales', async () => {
    const { servicio, botonesEnviados } = crearServicio({
      productos: [
        producto('p-1', 'Hawaiana'),
        { ...producto('p-2', 'Coca-Cola'), categoria_id: 'cat-2' },
        {
          ...producto('p-3', 'Adicional: Piña'),
          categoria_id: 'cat-3',
        },
      ],
      categorias: [
        { id: 'cat-1', nombre: 'Pizzas', orden: 1 },
        { id: 'cat-2', nombre: 'Bebidas', orden: 2 },
        { id: 'cat-3', nombre: 'Adicionales', orden: 3 },
      ],
    });

    await servicio.mandoElMensaje(
      llamada('enviar_catalogo'),
      { ...CTX, canal: 'messenger', telefono: null },
      'int-1',
    );

    expect(botonesEnviados).toHaveLength(1);
    expect(botonesEnviados[0][3]).toEqual([
      { id: 'cat:cat-1', titulo: 'Pizzas' },
      { id: 'cat:cat-2', titulo: 'Bebidas' },
    ]);
  });

  it('si el catálogo nativo no se pudo, registra el enlace', async () => {
    const { servicio, registrados } = crearServicio({ catalogo: 'enlace' });

    await servicio.mandoElMensaje(llamada('enviar_catalogo'), CTX, 'int-1');

    expect(registrados[0]).toContain('catálogo completo con fotos y precios');
  });

  it('mostrar_productos registra los nombres de lo que se mostró', async () => {
    const { servicio, registrados, interacciones } = crearServicio();

    await expect(
      servicio.mandoElMensaje(
        llamada('mostrar_productos', { consulta: 'pizzas' }),
        CTX,
        'int-2',
      ),
    ).resolves.toBe(true);

    expect(registrados[0]).toMatch(/^Productos mostrados: /);
    expect(registrados[0]).toContain('Hawaiana');
    expect(interacciones).toEqual(['int-2']);
  });

  it('sin productos en el catálogo no registra mensaje pero guarda la interacción', async () => {
    const { servicio, registrados, interacciones } = crearServicio({
      productos: [],
    });

    await servicio.mandoElMensaje(llamada('mostrar_productos'), CTX, 'int-3');

    expect(registrados).toEqual([]);
    expect(interacciones).toEqual(['int-3']);
  });

  it('si la lista nativa falla, registra los nombres de las tarjetas', async () => {
    const { servicio, registrados } = crearServicio({ lista: 'tarjetas' });

    await servicio.mandoElMensaje(llamada('mostrar_productos'), CTX, 'int-4');

    expect(registrados[0]).toContain('Hawaiana');
  });
});
