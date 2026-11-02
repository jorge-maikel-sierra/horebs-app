import { BadRequestException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  obtenerVariantesActivas,
  type VarianteActiva,
} from '../pedidos/calcular-items';
import { calcularItemsVenta } from './calcular-items-venta';

jest.mock('../pedidos/calcular-items');

const CLIENT = {} as SupabaseClient;

const HAWAIANA: VarianteActiva = {
  id: 'v-1',
  nombre: 'Grande',
  precio: 42_000,
  precio_oferta: null,
  productos: { nombre: 'Hawaiana' },
};

const EN_OFERTA: VarianteActiva = {
  id: 'v-2',
  nombre: 'Personal',
  precio: 20_000,
  precio_oferta: 15_000,
  productos: null,
};

function catalogo(...variantes: VarianteActiva[]): void {
  jest
    .mocked(obtenerVariantesActivas)
    .mockResolvedValue(new Map(variantes.map((v) => [v.id, v])));
}

describe('calcularItemsVenta', () => {
  beforeEach(() => {
    catalogo(HAWAIANA, EN_OFERTA);
  });

  it('un carrito vacío o que no es lista es 400', async () => {
    await expect(calcularItemsVenta(CLIENT, [])).rejects.toThrow(
      'El carrito está vacío.',
    );
    await expect(
      calcularItemsVenta(CLIENT, 'x' as unknown as never[]),
    ).rejects.toThrow(BadRequestException);
  });

  it('usa el precio de oferta del catálogo y suma el total', async () => {
    const { itemsCalculados, total } = await calcularItemsVenta(CLIENT, [
      { variante_id: 'v-1', cantidad: 2 },
      { variante_id: 'v-2', cantidad: 1 },
    ]);

    expect(itemsCalculados).toEqual([
      {
        variante_id: 'v-1',
        nombre_personalizado: null,
        producto_nombre: 'Hawaiana',
        variante_nombre: 'Grande',
        cantidad: 2,
        precio_unitario: 42_000,
        subtotal: 84_000,
      },
      {
        variante_id: 'v-2',
        nombre_personalizado: null,
        producto_nombre: '',
        variante_nombre: 'Personal',
        cantidad: 1,
        precio_unitario: 15_000,
        subtotal: 15_000,
      },
    ]);
    expect(total).toBe(99_000);
  });

  it('un precio manual pisa el del catálogo', async () => {
    const { itemsCalculados } = await calcularItemsVenta(CLIENT, [
      { variante_id: 'v-1', cantidad: 1, precio_unitario: 40_000 },
    ]);

    expect(itemsCalculados[0].precio_unitario).toBe(40_000);
  });

  it('un producto personalizado lleva nombre y precio', async () => {
    const { itemsCalculados, total } = await calcularItemsVenta(CLIENT, [
      {
        nombre_personalizado: '  Borde de queso ',
        precio_unitario: 3_000,
        cantidad: 2,
      },
    ]);

    expect(itemsCalculados[0]).toEqual({
      variante_id: null,
      nombre_personalizado: 'Borde de queso',
      producto_nombre: 'Borde de queso',
      variante_nombre: '',
      cantidad: 2,
      precio_unitario: 3_000,
      subtotal: 6_000,
    });
    expect(total).toBe(6_000);
  });

  it.each([
    [
      'sin nombre',
      { nombre_personalizado: ' ', precio_unitario: 1, cantidad: 1 },
    ],
    ['sin precio', { nombre_personalizado: 'Extra', cantidad: 1 }],
    ['con cantidad cero', { variante_id: 'v-1', cantidad: 0 }],
    ['con cantidad decimal', { variante_id: 'v-1', cantidad: 1.5 }],
    [
      'con precio negativo',
      { variante_id: 'v-1', cantidad: 1, precio_unitario: -1 },
    ],
    ['con una variante que no está', { variante_id: 'v-9', cantidad: 1 }],
  ])('una línea %s es 400', async (_caso, item) => {
    await expect(calcularItemsVenta(CLIENT, [item])).rejects.toThrow(
      BadRequestException,
    );
  });
});
