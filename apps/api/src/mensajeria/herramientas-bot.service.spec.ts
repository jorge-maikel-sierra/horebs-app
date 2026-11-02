import type { CatalogService, ProductoDto } from '../catalog/catalog.service';
import type { PedidosConsultasService } from '../pedidos/pedidos-consultas.service';
import type { CalculoPedidoBotService } from './calculo-pedido-bot.service';
import type { DerivacionBotService } from './derivacion-bot.service';
import { HerramientasBotService } from './herramientas-bot.service';
import type { ContextoHerramienta } from './herramientas-bot.tipos';

const HAWAIANA: ProductoDto = {
  id: 'hw',
  nombre: 'Pizza Hawaiana',
  descripcion: 'Jamón y piña',
  imagen_url: null,
  destacado: false,
  categoria_id: 'pizzas',
  slug: null,
  ventas_historicas: null,
  variantes: [
    { id: 'hw-1', nombre: 'Personal', precio: 18000, precio_oferta: null },
  ],
};

const CTX: ContextoHerramienta = {
  canal: 'whatsapp',
  identificadorExterno: '573157861208',
  telefono: '573157861208',
  conversacionId: 'conv-1',
};

function crearServicio() {
  const catalog = {
    getProductos: jest.fn().mockResolvedValue([HAWAIANA]),
    getCategorias: jest.fn().mockResolvedValue([
      { id: 'pizzas', nombre: 'Pizzas' },
      { id: 'bebidas', nombre: 'Bebidas' },
    ]),
  };
  const pedidos = {
    buscarPorTelefono: jest.fn().mockResolvedValue([]),
    buscarNombrePorTelefono: jest.fn().mockResolvedValue(null),
  };
  const derivacion = { derivar: jest.fn().mockResolvedValue('derivada') };
  const calculo = { mitadYMitadDe: jest.fn() };
  const servicio = new HerramientasBotService(
    catalog as unknown as CatalogService,
    pedidos as unknown as PedidosConsultasService,
    derivacion as unknown as DerivacionBotService,
    calculo as unknown as CalculoPedidoBotService,
  );
  return {
    servicio,
    catalog,
    pedidos,
    derivacion,
    calculo,
  };
}

describe('HerramientasBotService.ejecutar', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('una herramienta inventada por el modelo devuelve la lista real', async () => {
    const { servicio } = crearServicio();
    const texto = await servicio.ejecutar('obtener_menu_completo', {}, CTX);
    expect(texto).toContain('no existe');
    expect(texto).toContain('consultar_producto');
  });

  it('consultar_producto responde con los precios del catálogo', async () => {
    const { servicio } = crearServicio();
    const texto = await servicio.ejecutar(
      'consultar_producto',
      { nombre_producto: 'hawaiana' },
      CTX,
    );
    expect(texto).toContain('Pizza Hawaiana — Jamón y piña');
    expect(texto).toContain(`Personal: $${(18000).toLocaleString('es-CO')}`);
  });

  it('consultar_producto con un nombre que no existe sugiere mandar el catálogo', async () => {
    const { servicio } = crearServicio();
    const texto = await servicio.ejecutar(
      'consultar_producto',
      { nombre_producto: 'sushi' },
      CTX,
    );
    expect(texto).toContain('enviar_catalogo');
  });

  it('obtener_categorias lista las del catálogo', async () => {
    const { servicio } = crearServicio();
    await expect(
      servicio.ejecutar('obtener_categorias', {}, CTX),
    ).resolves.toBe('Vendemos: Pizzas, Bebidas.');
  });

  it('obtener_horario incluye dirección y domicilio del negocio', async () => {
    const { servicio } = crearServicio();
    const texto = await servicio.ejecutar('obtener_horario', {}, CTX);
    expect(texto).toContain('Carrera 7 # 17B - 66');
    expect(texto).toContain(`$${(5000).toLocaleString('es-CO')}`);
  });

  it('consultar_pedido y cliente registrado piden el teléfono si el canal no lo da', async () => {
    const { servicio, pedidos } = crearServicio();
    const sinTelefono = { ...CTX, telefono: null };
    const a = await servicio.ejecutar('consultar_pedido', {}, sinTelefono);
    const b = await servicio.ejecutar(
      'obtener_cliente_registrado',
      {},
      sinTelefono,
    );
    expect(a).toContain('No se pudo identificar el número');
    expect(b).toBe(a);
    expect(pedidos.buscarPorTelefono).not.toHaveBeenCalled();
  });

  it('consultar_pedido resume el último pedido', async () => {
    const { servicio, pedidos } = crearServicio();
    pedidos.buscarPorTelefono.mockResolvedValue([
      {
        estado: 'en_preparacion',
        total: 33000,
        items: [
          {
            cantidad: 2,
            producto_nombre: 'Pizza Hawaiana',
            variante_nombre: 'Personal',
          },
        ],
      },
    ]);
    const texto = await servicio.ejecutar('consultar_pedido', {}, CTX);
    expect(texto).toContain('estado: en_preparacion');
    expect(texto).toContain('2x Pizza Hawaiana (Personal)');
  });

  it('derivar_a_humano delega en la derivación con el contexto de la conversación', async () => {
    const { servicio, derivacion } = crearServicio();
    await expect(servicio.ejecutar('derivar_a_humano', {}, CTX)).resolves.toBe(
      'derivada',
    );
    expect(derivacion.derivar).toHaveBeenCalledWith(CTX);
  });

  it('cotizar_pizza_mitad_y_mitad devuelve la cotización o el error sin inventar total', async () => {
    const { servicio, calculo } = crearServicio();
    calculo.mitadYMitadDe.mockResolvedValueOnce({
      ok: true,
      texto: 'Mitad y mitad: $40.000',
    });
    await expect(
      servicio.ejecutar(
        'cotizar_pizza_mitad_y_mitad',
        { sabor1: 'a', sabor2: 'b' },
        CTX,
      ),
    ).resolves.toBe('Mitad y mitad: $40.000');

    calculo.mitadYMitadDe.mockResolvedValueOnce({
      ok: false,
      error: 'No encontré el sabor.',
    });
    const texto = await servicio.ejecutar(
      'cotizar_pizza_mitad_y_mitad',
      { sabor1: 'a', sabor2: 'b' },
      CTX,
    );
    expect(texto).toContain('No encontré el sabor.');
  });

  it('si una herramienta falla devuelve un texto genérico en vez de romper', async () => {
    const { servicio, catalog } = crearServicio();
    catalog.getCategorias.mockRejectedValue(new Error('base caída'));
    await expect(
      servicio.ejecutar('obtener_categorias', {}, CTX),
    ).resolves.toBe('No se pudo obtener esta información en este momento.');
  });

  it('consultar_adicionales devuelve los precios de la base, sin estimar', async () => {
    const { servicio, catalog } = crearServicio();
    catalog.getProductos.mockResolvedValue([
      {
        ...HAWAIANA,
        id: 'ad',
        nombre: 'Adicional: Borde de queso',
        variantes: [
          { id: 'a1', nombre: 'Personal', precio: 5000, precio_oferta: null },
          { id: 'a2', nombre: 'Mediana', precio: 9000, precio_oferta: null },
        ],
      },
    ]);

    const texto = await servicio.ejecutar('consultar_adicionales', {}, CTX);

    expect(texto).toContain('Personal $5.000, Mediana $9.000');
    expect(texto).not.toMatch(/aproximad|suele/i);
  });

  it('consultar_adicionales sin adicionales cargados lo dice', async () => {
    const { servicio } = crearServicio();

    await expect(
      servicio.ejecutar('consultar_adicionales', {}, CTX),
    ).resolves.toContain('no hay adicionales');
  });
});
