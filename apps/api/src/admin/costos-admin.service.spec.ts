/* eslint-disable @typescript-eslint/no-unsafe-return -- mocks de supabase encadenados */
import { NotFoundException } from '@nestjs/common';
import { CostosAdminService } from './costos-admin.service';

function crearServicio(resultado: { data: unknown; error: unknown }) {
  const actualizaciones: unknown[] = [];
  const consulta = {
    select: jest.fn(() => consulta),
    eq: jest.fn(() => consulta),
    neq: jest.fn(() => consulta),
    gte: jest.fn(() => consulta),
    lte: jest.fn(() => consulta),
    limit: jest.fn(() => consulta),
    update: jest.fn((cambios: unknown) => {
      actualizaciones.push(cambios);
      return consulta;
    }),
    returns: jest.fn(() => Promise.resolve(resultado)),
    maybeSingle: jest.fn(() => Promise.resolve(resultado)),
  };
  const supabase = { getClient: () => ({ from: () => consulta }) };
  return {
    servicio: new CostosAdminService(supabase as never),
    actualizaciones,
  };
}

describe('CostosAdminService', () => {
  it('lista solo lo que se vende y resume cuántas variantes faltan por costo', async () => {
    const { servicio } = crearServicio({
      data: [
        {
          id: 'v-1',
          nombre: 'Mediana',
          precio: 40000,
          precio_oferta: null,
          costo: 10000,
          activo: true,
          productos: { nombre: 'Hawaiana', activo: true },
        },
        {
          id: 'v-2',
          nombre: 'Grande',
          precio: 60000,
          precio_oferta: null,
          costo: null,
          activo: true,
          productos: { nombre: 'Hawaiana', activo: true },
        },
      ],
      error: null,
    });
    const r = await servicio.listar();
    expect(r.resumen).toEqual({ variantes: 2, con_costo: 1, sin_costo: 1 });
  });

  it('fija el costo de una variante', async () => {
    const { servicio, actualizaciones } = crearServicio({
      data: {
        id: 'v-1',
        nombre: 'Mediana',
        precio: 40000,
        precio_oferta: null,
        costo: 12000,
        activo: true,
        productos: { nombre: 'Hawaiana', activo: true },
      },
      error: null,
    });
    const v = await servicio.fijar('v-1', 12000);
    expect(actualizaciones).toEqual([{ costo: 12000 }]);
    expect(v.margen).toBe(28000);
  });

  it('una variante que no existe es 404', async () => {
    const { servicio } = crearServicio({ data: null, error: null });
    await expect(servicio.fijar('v-9', 1)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('la rentabilidad del período usa los pedidos no cancelados', async () => {
    const { servicio } = crearServicio({
      data: [
        {
          id: 'p-1',
          items_pedido: [
            {
              cantidad: 1,
              subtotal: 40000,
              variantes_producto: { costo: 10000 },
            },
          ],
        },
      ],
      error: null,
    });
    const r = await servicio.rentabilidad('2026-11-01', '2026-11-17');
    expect(r).toMatchObject({
      desde: '2026-11-01',
      pedidos: 1,
      utilidad_bruta: 30000,
      cobertura_costos: 100,
    });
  });
});
