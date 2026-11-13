import type { CatalogService, ProductoDto } from '../catalog/catalog.service';
import type { CheckoutEnviosService } from './checkout-envios.service';
import type { ContextoCheckout } from './checkout-whatsapp';
import type { EnvioHerramientasService } from './envio-herramientas.service';
import type { MasPedidasService } from './mas-pedidas.service';
import type { BotonRespuesta } from './mensajes-interactivos';
import { VitrinaSocialService } from './vitrina-social.service';

const CTX: ContextoCheckout = {
  canal: 'messenger',
  identificadorExterno: 'psid-1',
  conversacionId: 'cv-1',
  mensajeId: 'mid.1',
  telefono: null,
};

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

const HAWAIANA = producto('p-hw', 'Pizza Hawaiana', [
  { id: 'v-hw-g', nombre: 'Grande', precio: 45000, precio_oferta: null },
  { id: 'v-hw-p', nombre: 'Personal', precio: 20000, precio_oferta: null },
  { id: 'v-hw-m', nombre: 'Mediana', precio: 35000, precio_oferta: null },
]);
const ESPECIAL = producto('p-he', 'Pizza Horebs Especial', [
  { id: 'v-he-p', nombre: 'Personal', precio: 25000, precio_oferta: null },
]);
const MENU = [
  HAWAIANA,
  ESPECIAL,
  producto('p-pz', 'Panzerotti', [
    { id: 'v-pz', nombre: 'Única', precio: 12000, precio_oferta: null },
  ]),
];

interface Opciones {
  masPedidas?: ProductoDto[];
  menu?: string | null;
}

function crearServicio(opciones: Opciones = {}) {
  const conOpciones: { texto: string; opciones: BotonRespuesta[] }[] = [];
  const textos: string[] = [];
  const registrados: string[] = [];
  const tarjetas: string[][] = [];
  const envios = {
    texto: (_c: unknown, t: string) => {
      textos.push(t);
      return Promise.resolve();
    },
    textoConOpciones: (_c: unknown, texto: string, o: BotonRespuesta[]) => {
      conOpciones.push({ texto, opciones: o });
      return Promise.resolve();
    },
    registrar: (_c: unknown, t: string) => {
      registrados.push(t);
      return Promise.resolve();
    },
  };
  const menu = {
    menuSocial: () =>
      Promise.resolve(
        opciones.menu === undefined ? 'Menú enviado' : opciones.menu,
      ),
    tarjetasSocial: (_c: string, _id: string, ps: ProductoDto[]) => {
      tarjetas.push(ps.map((p) => p.nombre));
      return Promise.resolve(`Productos mostrados: ${ps.length}`);
    },
  };
  const servicio = new VitrinaSocialService(
    { getProductos: () => Promise.resolve(MENU) } as unknown as CatalogService,
    {
      pizzas: () =>
        Promise.resolve(opciones.masPedidas ?? [ESPECIAL, HAWAIANA]),
    } as unknown as MasPedidasService,
    envios as unknown as CheckoutEnviosService,
    menu as unknown as EnvioHerramientasService,
  );
  return { servicio, conOpciones, textos, registrados, tarjetas };
}

describe('VitrinaSocialService: precios', () => {
  it('si nombra un producto, da sus precios y ofrece pedirlo', async () => {
    const { servicio, conOpciones, tarjetas } = crearServicio();

    await servicio.precios(CTX, 'Precio de la hawaiana');

    expect(conOpciones[0].texto).toBe(
      'Pizza Hawaiana: Personal $20.000 · Mediana $35.000 · Grande $45.000',
    );
    expect(conOpciones[0].opciones[0]).toEqual({
      id: 'ped:p:p-hw',
      titulo: '🛒 Pedir esta',
    });
    expect(tarjetas).toEqual([]);
  });

  it('si no nombra ninguno, sugiere las más pedidas en vez de la lista completa', async () => {
    const { servicio, conOpciones, tarjetas, registrados } = crearServicio();

    await servicio.precios(CTX, '¿Cuánto cuesta?');

    expect(tarjetas).toEqual([['Pizza Horebs Especial', 'Pizza Hawaiana']]);
    expect(registrados).toEqual(['Productos mostrados: 2']);
    expect(conOpciones[0].texto).toContain('Nuestras pizzas más pedidas');
    expect(conOpciones[0].texto).not.toContain('Panzerotti');
    expect(conOpciones[0].opciones.map((o) => o.id)).toEqual([
      'ped:p:p-he',
      'ped:p:p-hw',
      'mnu:menu',
      'mnu:humano',
    ]);
  });

  it('si no hay pizzas para sugerir, manda el menú', async () => {
    const { servicio, registrados, conOpciones } = crearServicio({
      masPedidas: [],
    });

    await servicio.precios(CTX, '¿Cuánto cuesta?');

    expect(registrados).toEqual(['Menú enviado']);
    expect(conOpciones).toEqual([]);
  });
});

describe('VitrinaSocialService: menú', () => {
  it('para pedir, manda el menú y dice dónde tocar', async () => {
    const { servicio, registrados, textos } = crearServicio();

    await servicio.enviarMenu(CTX, true);

    expect(registrados).toEqual(['Menú enviado']);
    expect(textos[0]).toContain('Toca «Agregar al pedido»');
  });

  it('si el menú no se puede mostrar, ofrece hablar con una persona', async () => {
    const { servicio, conOpciones } = crearServicio({ menu: null });

    await servicio.enviarMenu(CTX, false);

    expect(conOpciones[0].texto).toContain(
      'Por ahora no puedo mostrarte el menú',
    );
    expect(conOpciones[0].opciones.map((o) => o.id)).toEqual(['mnu:humano']);
  });
});
