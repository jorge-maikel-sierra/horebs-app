/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await -- mocks de jest y fetch */
import {
  MetaGraphService,
  recortarListaProductos,
  type ListaProductos,
} from './meta-graph.service';

function crearServicio(opciones: { conCatalogo?: boolean } = {}) {
  const { conCatalogo = true } = opciones;
  const valores: Record<string, string> = {
    WHATSAPP_ACCESS_TOKEN: 'tok',
    WHATSAPP_PHONE_NUMBER_ID: 'phone-1',
    ...(conCatalogo ? { WHATSAPP_CATALOG_ID: 'cat-1' } : {}),
  };
  const config = { get: (k: string) => valores[k] };
  return new MetaGraphService(config as never);
}

function cuerpoEnviado(fetchMock: jest.Mock, llamada = 0) {
  return JSON.parse(fetchMock.mock.calls[llamada][1].body as string);
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
});
