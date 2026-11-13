import type {
  CatalogService,
  ItemCarritoResuelto,
  ProductoDto,
} from '../catalog/catalog.service';
import type { CheckoutEnviosService } from './checkout-envios.service';
import type { ContextoCheckout } from './checkout-whatsapp';
import type { CheckoutWhatsappService } from './checkout-whatsapp.service';
import type { OrigenConversacionService } from './origen-conversacion.service';
import type { ItemCarritoPendiente } from './conversaciones.tipos';
import type { BotonRespuesta } from './mensajes-interactivos';
import { PedidoSocialService } from './pedido-social.service';

const CTX: ContextoCheckout = {
  canal: 'messenger',
  identificadorExterno: 'psid-1',
  conversacionId: 'cv-1',
  mensajeId: 'mid.1',
  telefono: null,
};

const variante = (id: string, nombre: string, precio: number) => ({
  id,
  nombre,
  precio,
  precio_oferta: null,
});

const producto = (
  id: string,
  nombre: string,
  variantes: ProductoDto['variantes'],
): ProductoDto => ({
  id,
  nombre,
  descripcion: null,
  imagen_url: null,
  destacado: false,
  categoria_id: 'cat-1',
  slug: id,
  ventas_historicas: null,
  variantes,
});

const MENU: ProductoDto[] = [
  producto('p-hw', 'Pizza Hawaiana', [
    variante('v-hw-g', 'Grande', 45000),
    variante('v-hw-p', 'Personal', 20000),
    variante('v-hw-m', 'Mediana', 35000),
  ]),
  producto('p-pz', 'Panzerotti', [variante('v-pz', 'Única', 12000)]),
  producto('p-ad', 'Adicional: Piña', [variante('v-ad', 'Única', 5000)]),
];

function crearServicio(
  carritoInicial: ItemCarritoPendiente[] = [],
  ultimoPedido: ItemCarritoPendiente[] = [],
) {
  let carrito: ItemCarritoPendiente[] | null = carritoInicial;
  const botones: { cuerpo: string; opciones: BotonRespuesta[] }[] = [];
  const conOpciones: { texto: string; opciones: BotonRespuesta[] }[] = [];
  const iniciados: ItemCarritoResuelto[][] = [];
  const catalog = {
    getProductos: () => Promise.resolve(MENU),
    resolverCarrito: (items: ItemCarritoPendiente[]) =>
      Promise.resolve({
        disponibles: items.map((i) => ({
          varianteId: i.varianteId,
          productoNombre: 'Pizza Hawaiana',
          varianteNombre: 'Mediana',
          conTamanos: true,
          cantidad: i.cantidad,
          precio: 35000,
        })),
        noDisponibles: 0,
      }),
  };
  const origenes = {
    itemsDelUltimoPedido: () => Promise.resolve(ultimoPedido),
  };
  const checkout = {
    iniciar: (_ctx: unknown, items: ItemCarritoResuelto[]) => {
      iniciados.push(items);
      return Promise.resolve();
    },
  };
  const envios = {
    obtenerCarrito: () => Promise.resolve(carrito ?? []),
    guardarCarrito: (_ctx: unknown, items: unknown) => {
      carrito = items as ItemCarritoPendiente[] | null;
      return Promise.resolve();
    },
    botones: (_ctx: unknown, cuerpo: string, opciones: BotonRespuesta[]) => {
      botones.push({ cuerpo, opciones });
      return Promise.resolve();
    },
    textoConOpciones: (
      _ctx: unknown,
      texto: string,
      opciones: BotonRespuesta[],
    ) => {
      conOpciones.push({ texto, opciones });
      return Promise.resolve();
    },
  };
  const servicio = new PedidoSocialService(
    catalog as unknown as CatalogService,
    origenes as unknown as OrigenConversacionService,
    checkout as unknown as CheckoutWhatsappService,
    envios as unknown as CheckoutEnviosService,
  );
  return {
    servicio,
    botones,
    conOpciones,
    iniciados,
    carrito: () => carrito,
  };
}

describe('PedidoSocialService: pedir un producto', () => {
  it('pregunta el tamaño con los precios reales, del más barato al más caro', async () => {
    const { servicio, botones } = crearServicio();

    await expect(servicio.iniciarProducto(CTX, 'Pizza Hawaiana')).resolves.toBe(
      true,
    );

    expect(botones[0].cuerpo).toContain('Pizza Hawaiana');
    expect(botones[0].opciones).toEqual([
      { id: 'ped:v:v-hw-p', titulo: 'Personal $20.000' },
      { id: 'ped:v:v-hw-m', titulo: 'Mediana $35.000' },
      { id: 'ped:v:v-hw-g', titulo: 'Grande $45.000' },
    ]);
  });

  it('un producto sin tamaños pregunta la cantidad directamente', async () => {
    const { servicio, botones } = crearServicio();

    await servicio.iniciarProducto(CTX, 'Panzerotti');

    expect(botones[0].cuerpo).toContain('¿Cuántas Panzerotti');
    expect(botones[0].opciones.map((b) => b.id)).toEqual([
      'ped:q:v-pz:1',
      'ped:q:v-pz:2',
      'ped:q:v-pz:3',
      'ped:q:v-pz:4',
    ]);
  });

  it('un adicional o algo que no es del menú no inicia el pedido (responde Gemini)', async () => {
    const { servicio, botones } = crearServicio();

    await expect(
      servicio.iniciarProducto(CTX, 'Adicional: Piña'),
    ).resolves.toBe(false);
    await expect(
      servicio.iniciarProducto(CTX, 'Lasaña de la abuela'),
    ).resolves.toBe(false);
    expect(botones).toEqual([]);
  });

  it('el tamaño elegido pregunta la cantidad con el tamaño en el texto', async () => {
    const { servicio, botones } = crearServicio();

    await expect(servicio.atenderBoton(CTX, 'ped:v:v-hw-m')).resolves.toBe(
      true,
    );

    expect(botones[0].cuerpo).toBe(
      '¿Cuántas Pizza Hawaiana (Mediana) quieres?',
    );
  });
});

describe('PedidoSocialService: armar y seguir con el pedido', () => {
  it('la cantidad elegida queda en el carrito y ofrece agregar otro, seguir o vaciar', async () => {
    const { servicio, botones, carrito } = crearServicio();

    await expect(servicio.atenderBoton(CTX, 'ped:q:v-hw-m:2')).resolves.toBe(
      true,
    );

    expect(carrito()).toEqual([{ varianteId: 'v-hw-m', cantidad: 2 }]);
    expect(botones[0].cuerpo).toContain('¡Anotado!');
    expect(botones[0].cuerpo).toContain('2x Pizza Hawaiana (Mediana)');
    expect(botones[0].opciones.map((b) => b.id)).toEqual([
      'ped:mas',
      'ped:fin',
      'ped:vaciar',
    ]);
  });

  it('la misma variante se acumula hasta el tope de 20', async () => {
    const { servicio, carrito } = crearServicio([
      { varianteId: 'v-hw-m', cantidad: 19 },
    ]);

    await servicio.atenderBoton(CTX, 'ped:q:v-hw-m:4');

    expect(carrito()).toEqual([{ varianteId: 'v-hw-m', cantidad: 20 }]);
  });

  it('una cantidad inválida o una variante que no existe no se atiende', async () => {
    const { servicio, carrito } = crearServicio();

    await expect(servicio.atenderBoton(CTX, 'ped:q:v-hw-m:99')).resolves.toBe(
      false,
    );
    await expect(
      servicio.atenderBoton(CTX, 'ped:q:v-fantasma:2'),
    ).resolves.toBe(false);
    await expect(servicio.atenderBoton(CTX, 'ped:v:v-fantasma')).resolves.toBe(
      false,
    );
    expect(carrito()).toEqual([]);
  });

  it('"Seguir con el pedido" arranca el checkout de siempre con lo que hay en el carrito', async () => {
    const { servicio, iniciados } = crearServicio([
      { varianteId: 'v-hw-m', cantidad: 1 },
      { varianteId: 'v-pz', cantidad: 2 },
    ]);

    await servicio.atenderBoton(CTX, 'ped:fin');

    expect(iniciados).toHaveLength(1);
    expect(iniciados[0].map((i) => i.varianteId)).toEqual(['v-hw-m', 'v-pz']);
  });

  it('con el carrito vacío no arranca el checkout y ofrece el inicio', async () => {
    const { servicio, iniciados, conOpciones } = crearServicio();

    await servicio.atenderBoton(CTX, 'ped:fin');

    expect(iniciados).toEqual([]);
    expect(conOpciones[0].texto).toContain('Todavía no tienes nada');
  });

  it('"Vaciar" deja el carrito en blanco', async () => {
    const { servicio, carrito, conOpciones } = crearServicio([
      { varianteId: 'v-hw-m', cantidad: 3 },
    ]);

    await servicio.atenderBoton(CTX, 'ped:vaciar');

    expect(carrito()).toBeNull();
    expect(conOpciones[0].texto).toContain('vacié tu pedido');
  });

  it('un id que no es del pedido por botones no se atiende', async () => {
    const { servicio } = crearServicio();

    await expect(servicio.atenderBoton(CTX, 'ck:pago:efectivo')).resolves.toBe(
      false,
    );
  });
});

describe('PedidoSocialService: botón de un producto', () => {
  it('"Pedir esta" abre el pedido del producto por su id', async () => {
    const { servicio, botones } = crearServicio();

    await expect(servicio.atenderBoton(CTX, 'ped:p:p-hw')).resolves.toBe(true);
    expect(botones[0].opciones).toHaveLength(3);
  });
});

describe('PedidoSocialService: repetir el último pedido', () => {
  it('arma el carrito con lo del último pedido y sigue al checkout', async () => {
    const { servicio, iniciados } = crearServicio(
      [],
      [{ varianteId: 'v-hw-m', cantidad: 2 }],
    );

    await expect(servicio.atenderBoton(CTX, 'ped:repetir')).resolves.toBe(true);

    expect(iniciados).toHaveLength(1);
    expect(iniciados[0]).toEqual([
      expect.objectContaining({ varianteId: 'v-hw-m', cantidad: 2 }),
    ]);
  });

  it('si nunca pidió por este chat, se lo dice y ofrece el menú', async () => {
    const { servicio, iniciados, conOpciones } = crearServicio();

    await servicio.atenderBoton(CTX, 'ped:repetir');

    expect(iniciados).toEqual([]);
    expect(conOpciones[0]?.texto).toContain('Todavía no tienes pedidos');
  });
});
