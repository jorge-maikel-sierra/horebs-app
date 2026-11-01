import { BadRequestException } from '@nestjs/common';
import type { CrearVentaInput } from './pedidos-admin.tipos';
import {
  armarVentaDto,
  costoDomicilioDeVenta,
  datosClienteDeVenta,
  validarVenta,
} from './venta-reglas';

function ventaBase(cambios: Partial<CrearVentaInput> = {}): CrearVentaInput {
  return {
    cliente: { nombre: 'Ana' },
    modalidad: 'local',
    metodo_pago: 'efectivo',
    items: [{ variante_id: 'v-1', cantidad: 1 }],
    ...cambios,
  };
}

describe('validarVenta', () => {
  it('acepta una venta de local con lo mínimo', () => {
    expect(() => validarVenta(ventaBase())).not.toThrow();
  });

  it.each([
    ['sin nombre', { cliente: { nombre: '  ' } }, 'Falta el nombre'],
    [
      'método de pago inventado',
      { metodo_pago: 'cripto' as 'efectivo' },
      'Método de pago inválido',
    ],
    [
      'modalidad inventada',
      { modalidad: 'volando' as 'local' },
      'Modalidad inválida',
    ],
    [
      'domicilio sin dirección',
      { modalidad: 'domicilio' as const, direccion_entrega: ' ' },
      'Falta la dirección',
    ],
  ])('rechaza %s con 400', (_caso, cambios, mensaje) => {
    const venta = ventaBase(cambios);
    expect(() => validarVenta(venta)).toThrow(BadRequestException);
    expect(() => validarVenta(venta)).toThrow(mensaje);
  });
});

describe('costoDomicilioDeVenta', () => {
  it('en local o retiro no se cobra domicilio, aunque lo manden', () => {
    expect(costoDomicilioDeVenta(ventaBase({ costo_domicilio: 9000 }))).toBe(0);
  });

  it('en domicilio sin costo manual usa el default de $5.000', () => {
    expect(costoDomicilioDeVenta(ventaBase({ modalidad: 'domicilio' }))).toBe(
      5000,
    );
  });

  it('en domicilio respeta el costo manual, incluso $0', () => {
    const venta = ventaBase({ modalidad: 'domicilio', costo_domicilio: 0 });
    expect(costoDomicilioDeVenta(venta)).toBe(0);
  });

  it('rechaza un costo negativo', () => {
    const venta = ventaBase({ modalidad: 'domicilio', costo_domicilio: -1 });
    expect(() => costoDomicilioDeVenta(venta)).toThrow(BadRequestException);
  });
});

describe('datosClienteDeVenta', () => {
  it('recorta los textos y deja en null lo vacío', () => {
    expect(
      datosClienteDeVenta({
        nombre: 'Ana',
        apellido: '  ',
        telefono: ' 573157861208 ',
        correo: '',
      }),
    ).toEqual({
      nombre: 'Ana',
      apellido: null,
      telefono: '573157861208',
      correo: null,
      cedula: null,
    });
  });

  it('sin teléfono queda undefined (no se puede reconocer al cliente)', () => {
    expect(datosClienteDeVenta({ nombre: 'Ana' }).telefono).toBeUndefined();
  });
});

describe('armarVentaDto', () => {
  it('junta pedido, cliente, líneas y puntos sin filtrar campos internos', () => {
    const dto = armarVentaDto({
      pedido: {
        id: 'ped-1',
        modalidad: 'local',
        direccion_entrega: null,
        costo_domicilio: 0,
        metodo_pago: 'efectivo',
        total: 36000,
        created_at: '2026-11-01T20:00:00Z',
      },
      cliente: {
        id: 'c-1',
        nombre: 'Ana',
        apellido: null,
        telefono: '573157861208',
        correo: null,
        cedula: null,
      },
      items: [
        {
          variante_id: 'v-1',
          nombre_personalizado: null,
          producto_nombre: 'Pizza Hawaiana',
          variante_nombre: 'Personal',
          cantidad: 2,
          precio_unitario: 18000,
          subtotal: 36000,
        },
      ],
      canje: { puntos: 10, descuento: 500 },
      puntosGanados: 36,
    });

    expect(dto.id).toBe('ped-1');
    expect(dto.cliente).toEqual({
      nombre: 'Ana',
      apellido: null,
      telefono: '573157861208',
      correo: null,
      cedula: null,
    });
    expect(dto.items).toEqual([
      {
        producto_nombre: 'Pizza Hawaiana',
        variante_nombre: 'Personal',
        cantidad: 2,
        precio_unitario: 18000,
        subtotal: 36000,
      },
    ]);
    expect(dto).toMatchObject({
      puntos_canjeados: 10,
      descuento_puntos: 500,
      puntos_ganados: 36,
    });
  });
});
