import { armarInformeClientes, type ClienteFila } from './informes-clientes';
import type { PedidoUnificado } from './informes.tipos';

const pedido = (telefono: string | null, total: number): PedidoUnificado => ({
  id: `p-${telefono}-${total}`,
  total,
  costo_domicilio: 0,
  metodo_pago: 'efectivo',
  modalidad: 'domicilio',
  canal: 'web',
  creado_en: '2026-10-20T15:00:00.000Z',
  telefono,
  nombre_cliente: null,
});

const cliente = (
  telefono: string,
  fecha: string,
  nombre = 'Ana',
): ClienteFila => ({
  telefono,
  nombre,
  apellido: 'Pérez',
  fecha,
});

const RANGO = {
  desde: '2026-10-01',
  hasta: '2026-10-31',
  desdeISO: '2026-10-01T05:00:00.000Z',
  granularidad: 'dia' as const,
};

describe('armarInformeClientes', () => {
  it('sin teléfonos devuelve todo en cero', () => {
    const informe = armarInformeClientes({
      ...RANGO,
      filas: [pedido(null, 20000)],
      clientesVivos: [],
      clientesHistoricos: [],
    });
    expect(informe).toMatchObject({
      nuevos: 0,
      recurrentes: 0,
      ticket_promedio: 0,
      top_clientes: [],
      lista_nuevos: [],
      lista_recurrentes: [],
    });
  });

  it('es nuevo quien compró por primera vez dentro del rango', () => {
    const informe = armarInformeClientes({
      ...RANGO,
      filas: [pedido('300', 30000), pedido('311', 50000), pedido('311', 10000)],
      clientesVivos: [cliente('300', '2026-10-15T12:00:00.000Z', 'Nuevo')],
      clientesHistoricos: [cliente('311', '2025-03-01T12:00:00.000Z', 'Fiel')],
    });
    expect(informe.nuevos).toBe(1);
    expect(informe.recurrentes).toBe(1);
    expect(informe.lista_nuevos[0]).toMatchObject({
      telefono: '300',
      nombre: 'Nuevo Pérez',
      pedidos: 1,
      total: 30000,
    });
    expect(informe.lista_recurrentes[0]).toMatchObject({
      telefono: '311',
      pedidos: 2,
      total: 60000,
    });
    expect(informe.ticket_promedio).toBe(45000);
  });

  it('toma la primera compra más antigua entre el cliente vivo y el migrado', () => {
    const informe = armarInformeClientes({
      ...RANGO,
      filas: [pedido('300', 10000)],
      clientesVivos: [cliente('300', '2026-10-15T12:00:00.000Z')],
      clientesHistoricos: [cliente('300', '2024-01-10T12:00:00.000Z')],
    });
    expect(informe.nuevos).toBe(0);
    expect(informe.recurrentes).toBe(1);
  });

  it('el top ordena por gasto y se queda con 8', () => {
    const filas = Array.from({ length: 10 }, (_, i) =>
      pedido(`3${i}`, (i + 1) * 1000),
    );
    const informe = armarInformeClientes({
      ...RANGO,
      filas,
      clientesVivos: filas.map((f) =>
        cliente(f.telefono!, '2026-10-02T12:00:00.000Z'),
      ),
      clientesHistoricos: [],
    });
    expect(informe.top_clientes).toHaveLength(8);
    expect(informe.top_clientes[0].total).toBe(10000);
  });

  it('un teléfono sin ficha de cliente no cuenta como nuevo ni recurrente', () => {
    const informe = armarInformeClientes({
      ...RANGO,
      filas: [pedido('999', 5000)],
      clientesVivos: [],
      clientesHistoricos: [],
    });
    expect(informe.nuevos + informe.recurrentes).toBe(0);
    expect(informe.top_clientes[0]).toMatchObject({
      nombre: 'Cliente',
      total: 5000,
    });
  });
});
