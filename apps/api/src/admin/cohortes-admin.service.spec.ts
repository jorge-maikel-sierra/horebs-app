/* eslint-disable @typescript-eslint/no-unsafe-return -- mocks de supabase encadenados */
import { CohortesAdminService } from './cohortes-admin.service';

function crearServicio(tablas: Map<string, unknown[]>) {
  const supabase = {
    getClient: () => ({
      from: (tabla: string) => {
        const consulta = {
          select: jest.fn(() => consulta),
          order: jest.fn(() => consulta),
          range: jest.fn(() => consulta),
          gte: jest.fn(() => consulta),
          returns: jest.fn(() =>
            Promise.resolve({ data: tablas.get(tabla) ?? [], error: null }),
          ),
        };
        return consulta;
      },
    }),
  };
  return new CohortesAdminService(supabase as never);
}

const pedido = (id: string, cliente: string, fecha: string, extra = {}) => ({
  id,
  cliente_id: cliente,
  total: 30000,
  estado: 'entregado',
  created_at: `${fecha}T15:00:00.000Z`,
  origen_anuncio_id: null,
  origen_campana_id: null,
  atribucion_web: null,
  ...extra,
});

describe('CohortesAdminService', () => {
  it('liga al cliente nuevo con la campaña de su primer pedido y calcula el costo', async () => {
    const hoy = new Date().toISOString().slice(0, 10);
    const servicio = crearServicio(
      new Map<string, unknown[]>([
        ['pedidos', [pedido('p-1', 'k-1', hoy, { origen_campana_id: 'c-1' })]],
        ['clientes', [{ id: 'k-1' }]],
        [
          'anuncios_meta_diario',
          [
            {
              fecha: hoy,
              anuncio_id: 'a-1',
              campana_id: 'c-1',
              campana_nombre: 'Noviembre',
              gasto: '15000',
              impresiones: 100,
              alcance: 80,
              clics: 5,
              frecuencia: 1,
              conversaciones: 2,
              clics_enlace: 3,
            },
          ],
        ],
      ]),
    );

    const r = await servicio.consultar();

    expect(r.clientes_nuevos).toBe(1);
    expect(r.clientes_atribuidos).toBe(1);
    expect(r.por_campana[0]).toMatchObject({
      nombre: 'Noviembre',
      clientes: 1,
      costo_por_cliente_nuevo: 15000,
    });
    expect(r.por_mes).toHaveLength(1);
  });

  it('sin pedidos devuelve todo vacío y sin fecha de primera compra', async () => {
    const r = await crearServicio(new Map()).consultar();
    expect(r).toMatchObject({
      por_mes: [],
      por_campana: [],
      clientes_nuevos: 0,
      primera_compra_desde: null,
    });
  });
});
