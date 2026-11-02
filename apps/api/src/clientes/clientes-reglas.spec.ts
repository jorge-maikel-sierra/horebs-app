import { BadRequestException } from '@nestjs/common';
import {
  cambiosDeCliente,
  detalleConPedidos,
  filtroDeBusqueda,
  mapPedidoCliente,
  nombreDeItem,
  textoDeBusqueda,
  validarEdicionCliente,
} from './clientes-reglas';
import type { FilaClienteDetalle, FilaPedidoCliente } from './clientes.tipos';

describe('búsqueda', () => {
  it('quita los caracteres que rompen el filtro or() de PostgREST', () => {
    expect(textoDeBusqueda('  An,a (50%)  ')).toBe('Ana 50');
  });

  it('un texto vacío o solo de caracteres prohibidos queda vacío', () => {
    expect(textoDeBusqueda(' (,%) ')).toBe('');
  });

  it('el filtro busca por nombre, apellido y teléfono', () => {
    expect(filtroDeBusqueda('ana')).toBe(
      'nombre.ilike.%ana%,apellido.ilike.%ana%,telefono.ilike.%ana%',
    );
  });
});

describe('edición de cliente', () => {
  it('el nombre no puede quedar vacío', () => {
    expect(() => validarEdicionCliente({ nombre: '  ' })).toThrow(
      BadRequestException,
    );
    expect(() => validarEdicionCliente({})).not.toThrow();
  });

  it('solo incluye lo que el cambio trae', () => {
    expect(cambiosDeCliente({ correo: 'a@b.co' })).toEqual({
      correo: 'a@b.co',
    });
    expect(cambiosDeCliente({})).toEqual({});
  });

  it('recorta el nombre y vuelve null el texto en blanco de los demás campos', () => {
    expect(
      cambiosDeCliente({
        nombre: ' Ana ',
        apellido: '  ',
        telefono: ' 3157861208 ',
        direccion: '',
        correo: '',
        cedula: ' ',
      }),
    ).toEqual({
      nombre: 'Ana',
      apellido: null,
      telefono: '3157861208',
      direccion: null,
      correo: null,
      cedula: null,
    });
  });
});

describe('detalleConPedidos', () => {
  const cliente = { id: 'c-1', nombre: 'Ana' } as FilaClienteDetalle;

  it('cuenta, suma y toma el pedido más reciente (el primero)', () => {
    expect(
      detalleConPedidos(cliente, [
        { total: 30000, created_at: '2026-10-30T10:00:00Z' },
        { total: 20000, created_at: '2026-10-01T10:00:00Z' },
      ]),
    ).toMatchObject({
      id: 'c-1',
      total_pedidos: 2,
      total_gastado: 50000,
      ultimo_pedido: '2026-10-30T10:00:00Z',
    });
  });

  it('sin pedidos queda en cero y sin último pedido', () => {
    expect(detalleConPedidos(cliente, [])).toMatchObject({
      total_pedidos: 0,
      total_gastado: 0,
      ultimo_pedido: null,
    });
  });
});

describe('nombreDeItem', () => {
  it('producto con variante', () => {
    expect(
      nombreDeItem({
        nombre_personalizado: null,
        cantidad: 1,
        variantes_producto: {
          nombre: 'Grande',
          productos: { nombre: 'Pizza Hawaiana' },
        },
      }),
    ).toBe('Pizza Hawaiana (Grande)');
  });

  it('producto sin nombre de variante', () => {
    expect(
      nombreDeItem({
        nombre_personalizado: null,
        cantidad: 1,
        variantes_producto: { nombre: '', productos: { nombre: 'Gaseosa' } },
      }),
    ).toBe('Gaseosa');
  });

  it.each([
    ['con nombre personalizado', 'Pizza especial', 'Pizza especial'],
    ['sin nada', null, 'Producto'],
  ])('sin producto, %s', (_caso, personalizado, esperado) => {
    expect(
      nombreDeItem({
        nombre_personalizado: personalizado,
        cantidad: 1,
        variantes_producto: null,
      }),
    ).toBe(esperado);
  });
});

describe('mapPedidoCliente', () => {
  const fila: FilaPedidoCliente = {
    id: 'p-1',
    canal: 'web',
    modalidad: 'domicilio',
    metodo_pago: 'efectivo',
    estado: 'entregado',
    total: 65000,
    costo_domicilio: 5000,
    created_at: '2026-10-30T10:00:00Z',
    items_pedido: [
      {
        nombre_personalizado: null,
        cantidad: 2,
        variantes_producto: {
          nombre: 'Mediana',
          productos: { nombre: 'Pizza Hawaiana' },
        },
      },
    ],
  };

  it('aplana los ítems a nombre y cantidad', () => {
    expect(mapPedidoCliente(fila)).toMatchObject({
      id: 'p-1',
      total: 65000,
      items: [{ nombre: 'Pizza Hawaiana (Mediana)', cantidad: 2 }],
    });
  });

  it('un pedido sin ítems queda con lista vacía', () => {
    expect(mapPedidoCliente({ ...fila, items_pedido: null }).items).toEqual([]);
  });
});
