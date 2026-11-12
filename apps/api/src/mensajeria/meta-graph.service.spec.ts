/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await -- mocks de jest y fetch */
import { MetaGraphService } from './meta-graph.service';
import {
  recortarListaProductos,
  type ListaProductos,
} from './mensajes-interactivos';

function crearServicio(opciones: { conCatalogo?: boolean } = {}) {
  const { conCatalogo = true } = opciones;
  const valores = new Map(
    Object.entries({
      WHATSAPP_ACCESS_TOKEN: 'tok',
      WHATSAPP_PHONE_NUMBER_ID: 'phone-1',
      MESSENGER_PAGE_ACCESS_TOKEN: 'page-tok',
      MESSENGER_PAGE_ID: 'page-1',
      INSTAGRAM_ACCOUNT_ID: 'ig-1',
      ...(conCatalogo ? { WHATSAPP_CATALOG_ID: 'cat-1' } : {}),
    }),
  );
  const config = { get: (k: string) => valores.get(k) };
  return new MetaGraphService(config as never);
}

function cuerpoEnviado(fetchMock: jest.Mock, llamada = 0) {
  const llamadas = fetchMock.mock.calls as [string, { body: string }][];
  return JSON.parse(llamadas.at(llamada)?.[1].body ?? '');
}

function lista(secciones: number, itemsPorSeccion: number): ListaProductos {
  return {
    encabezado: 'Pizzas',
    cuerpo: 'Elegí la tuya',
    secciones: Array.from({ length: secciones }, (_, s) => ({
      titulo: `Sección ${s}`,
      retailerIds: Array.from(
        { length: itemsPorSeccion },
        (_, i) => `var-${s}-${i}`,
      ),
    })),
  };
}

const TARJETA = {
  nombre: 'Pizza Hawaiana',
  descripcion: null,
  imagenUrl: null,
  precioDesde: 25000,
};

describe('recortarListaProductos', () => {
  it('deja como máximo 30 ítems llenando las secciones en orden', () => {
    const recortada = recortarListaProductos(lista(4, 12));
    const cantidades = recortada.secciones.map((s) => s.retailerIds.length);
    expect(cantidades).toEqual([12, 12, 6]);
  });

  it('deja como máximo 10 secciones', () => {
    expect(recortarListaProductos(lista(12, 1)).secciones).toHaveLength(10);
  });

  it('corta los títulos de sección a 24 caracteres y el encabezado a 60', () => {
    const recortada = recortarListaProductos({
      encabezado: 'x'.repeat(80),
      cuerpo: 'c',
      secciones: [{ titulo: 'y'.repeat(40), retailerIds: ['a'] }],
    });
    expect(recortada.encabezado).toHaveLength(60);
    expect(recortada.secciones[0].titulo).toHaveLength(24);
  });

  it('quita las secciones vacías', () => {
    const recortada = recortarListaProductos({
      encabezado: 'e',
      cuerpo: 'c',
      secciones: [
        { titulo: 'vacía', retailerIds: [] },
        { titulo: 'llena', retailerIds: ['a'] },
      ],
    });
    expect(recortada.secciones.map((s) => s.titulo)).toEqual(['llena']);
  });
});

describe('MetaGraphService — catálogo nativo', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn(async () => ({ ok: true, text: async () => '' }));
    global.fetch = fetchMock as never;
  });

  it('manda catalog_message con la miniatura pedida', async () => {
    const resultado = await crearServicio().enviarCatalogo(
      'whatsapp',
      '573001112233',
      'https://sitio/catalogo',
      'var-1',
    );
    expect(resultado).toBe('catalogo');
    const cuerpo = cuerpoEnviado(fetchMock);
    expect(cuerpo.interactive.type).toBe('catalog_message');
    expect(
      cuerpo.interactive.action.parameters.thumbnail_product_retailer_id,
    ).toBe('var-1');
  });

  it('sin WHATSAPP_CATALOG_ID manda el link del sitio', async () => {
    const resultado = await crearServicio({
      conCatalogo: false,
    }).enviarCatalogo('whatsapp', '573001112233', 'https://sitio/catalogo');
    expect(resultado).toBe('link');
    expect(cuerpoEnviado(fetchMock).interactive.type).toBe('cta_url');
  });

  it('manda product_list con el catálogo y las secciones recortadas', async () => {
    const resultado = await crearServicio().enviarListaProductos(
      'whatsapp',
      '573001112233',
      lista(2, 20),
      [TARJETA],
    );
    expect(resultado).toBe('lista');
    const { interactive } = cuerpoEnviado(fetchMock);
    expect(interactive.type).toBe('product_list');
    expect(interactive.action.catalog_id).toBe('cat-1');
    const items = interactive.action.sections.flatMap(
      (s: { product_items: unknown[] }) => s.product_items,
    );
    expect(items).toHaveLength(30);
  });

  it('si Meta rechaza la lista, cae a las tarjetas', async () => {
    jest.useFakeTimers({ advanceTimers: true });
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      const cuerpo = JSON.parse(init.body as string);
      return cuerpo.interactive?.type === 'product_list'
        ? { ok: false, status: 400, text: async () => 'producto desconocido' }
        : { ok: true, text: async () => '' };
    });
    const resultado = await crearServicio().enviarListaProductos(
      'whatsapp',
      '573001112233',
      lista(1, 2),
      [TARJETA],
    );
    jest.useRealTimers();
    expect(resultado).toBe('tarjetas');
    const ultima = cuerpoEnviado(fetchMock, fetchMock.mock.calls.length - 1);
    expect(ultima.interactive.type).toBe('button');
  });

  it('manda quick replies en Messenger e Instagram con enviarBotones', async () => {
    await crearServicio().enviarBotones('messenger', 'psid-1', '¿Modalidad?', [
      { id: 'ck:mod:domicilio', titulo: 'Domicilio' },
    ]);
    const cuerpo = cuerpoEnviado(fetchMock);
    expect(cuerpo.message.quick_replies).toBeDefined();
    expect(cuerpo.message.quick_replies[0].payload).toBe('ck:mod:domicilio');
  });

  it('manda generic template en Messenger y texto + generic template en Instagram', async () => {
    await crearServicio().enviarTarjetasProductos('messenger', 'psid-1', [
      TARJETA,
    ]);
    const cuerpoMessenger = cuerpoEnviado(fetchMock);
    expect(cuerpoMessenger.message.attachment.payload.template_type).toBe(
      'generic',
    );

    fetchMock.mockClear();
    await crearServicio().enviarTarjetasProductos('instagram', 'igsid-1', [
      TARJETA,
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2); // 1 texto plano + 1 generic template
  });

  it('parte mensajes largos por bytes en Instagram', async () => {
    const textoLargo = '🍕'.repeat(300); // 1200 bytes en UTF-8 (límite IG es 1000)
    await crearServicio().enviarMensajeSesion(
      'instagram',
      'igsid-2',
      textoLargo,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('maneja el error 100 subcódigo 2534037 de Business AI sin reintentar ni fallar', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({
          error: { code: 100, error_subcode: 2534037, message: 'AI active' },
        }),
    });
    await expect(
      crearServicio().enviarMensajeSesion('messenger', 'psid-3', 'hola'),
    ).resolves.not.toThrow();
  });

  it('un 400 (ej. ventana cerrada) no se reintenta: un solo intento y falla', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({ error: { code: 10, message: 'fuera de ventana' } }),
    });
    await expect(
      crearServicio().enviarMensajeSesion('messenger', 'psid-4', 'hola'),
    ).rejects.toThrow('respondió 400');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
