import { BadRequestException } from '@nestjs/common';
import {
  clasificarErrorProcesado,
  mapCompra,
  paramsCrearCompra,
  subtotalDeCompra,
  validarCompra,
} from './compras-reglas';
import type {
  CrearCompraInput,
  DetalleCompraInput,
  FilaCompra,
} from './compras.tipos';

function linea(cambios: Partial<DetalleCompraInput> = {}): DetalleCompraInput {
  return {
    producto_comprado: 'Harina',
    cantidad: 2,
    unidad_medida_compra: 'kg',
    valor_unitario: 5000,
    ...cambios,
  };
}

function compra(cambios: Partial<CrearCompraInput> = {}): CrearCompraInput {
  return {
    proveedor: 'Distribuidora',
    fecha: '2026-10-30',
    metodo_pago: 'efectivo',
    detalle: [linea()],
    ...cambios,
  };
}

describe('validarCompra', () => {
  it('acepta una compra completa', () => {
    expect(() => validarCompra(compra())).not.toThrow();
  });

  it.each([
    ['sin proveedor', { proveedor: ' ' }, 'Falta el proveedor.'],
    ['sin fecha', { fecha: '' }, 'Falta la fecha de la compra.'],
    [
      'método de pago desconocido',
      { metodo_pago: 'cheque' as never },
      'Método de pago inválido.',
    ],
    ['sin líneas', { detalle: [] }, 'La factura no tiene líneas.'],
    [
      'línea sin descripción',
      { detalle: [linea({ producto_comprado: ' ' })] },
      'Falta la descripción de una línea.',
    ],
    [
      'cantidad en cero',
      { detalle: [linea({ cantidad: 0 })] },
      'Cantidad inválida en una línea.',
    ],
    [
      'cantidad como texto',
      { detalle: [linea({ cantidad: '2' as never })] },
      'Cantidad inválida en una línea.',
    ],
    [
      'unidad desconocida',
      { detalle: [linea({ unidad_medida_compra: 'lb' as never })] },
      'Unidad de medida inválida en una línea.',
    ],
    [
      'valor negativo',
      { detalle: [linea({ valor_unitario: -1 })] },
      'Valor unitario inválido en una línea.',
    ],
  ])('rechaza %s con 400', (_caso, cambios, mensaje) => {
    const intento = () => validarCompra(compra(cambios));
    expect(intento).toThrow(BadRequestException);
    expect(intento).toThrow(mensaje);
  });

  it('un valor unitario de cero es válido (producto de regalo)', () => {
    expect(() =>
      validarCompra(compra({ detalle: [linea({ valor_unitario: 0 })] })),
    ).not.toThrow();
  });
});

describe('subtotalDeCompra', () => {
  it('suma cantidad por valor unitario de cada línea', () => {
    expect(
      subtotalDeCompra([
        linea({ cantidad: 2, valor_unitario: 5000 }),
        linea({ cantidad: 3, valor_unitario: 1000 }),
      ]),
    ).toBe(13000);
  });
});

describe('paramsCrearCompra', () => {
  it('recorta textos, deja en null lo vacío y usa el subtotal recalculado', () => {
    const params = paramsCrearCompra(
      compra({
        numero_factura: ' ',
        proveedor: ' Distribuidora ',
        categoria: '',
        detalle: [linea({ producto_comprado: ' Harina ' })],
      }),
      10000,
      'u-1',
    );

    expect(params).toMatchObject({
      p_numero_factura: null,
      p_proveedor: 'Distribuidora',
      p_subtotal: 10000,
      p_otros_cargos: 0,
      p_categoria: null,
      p_registrado_por: 'u-1',
    });
  });

  it('una línea sin insumo viaja con insumo_id vacío', () => {
    const params = paramsCrearCompra(compra(), 10000, 'u-1');

    expect(params.p_detalle).toEqual([
      {
        insumo_id: '',
        producto_comprado: 'Harina',
        cantidad: 2,
        unidad_medida_compra: 'kg',
        valor_unitario: 5000,
      },
    ]);
  });
});

describe('clasificarErrorProcesado', () => {
  it.each([
    ['la línea no existe', 'Detalle no existe', 'no_existe'],
    [
      'la línea ya no está pendiente',
      'La línea no está pendiente',
      'conflicto',
    ],
    [
      'la línea no tiene insumo',
      'La línea no tiene insumo asignado',
      'de_negocio',
    ],
    ['un error de Postgres cualquiera', 'duplicate key value', 'otro'],
    ['un error sin mensaje', undefined, 'otro'],
  ])('%s se clasifica como %s', (_caso, mensaje, esperado) => {
    expect(clasificarErrorProcesado(mensaje)).toBe(esperado);
  });
});

describe('mapCompra', () => {
  const fila: FilaCompra = {
    id: 'c-1',
    numero_factura: null,
    proveedor: 'Distribuidora',
    fecha: '2026-10-30',
    subtotal: 10000,
    otros_cargos: 0,
    metodo_pago: 'efectivo',
    categoria: null,
    created_at: '2026-10-30T10:00:00Z',
    detalle_compra: [
      {
        id: 'd-1',
        insumo_id: 'i-1',
        producto_comprado: 'Harina',
        cantidad: 2,
        unidad_medida_compra: 'kg',
        valor_unitario: 5000,
        total_linea: 10000,
        estado_procesado: 'pendiente',
        fecha_procesado: null,
        insumos: { nombre: 'Harina de trigo' },
      },
      {
        id: 'd-2',
        insumo_id: null,
        producto_comprado: 'Bolsas',
        cantidad: 1,
        unidad_medida_compra: 'unidad',
        valor_unitario: 0,
        total_linea: 0,
        estado_procesado: 'excluido',
        fecha_procesado: null,
        insumos: null,
      },
    ],
  };

  it('aplana el nombre del insumo y lo deja en null si no está vinculado', () => {
    expect(mapCompra(fila).detalle.map((d) => d.insumo_nombre)).toEqual([
      'Harina de trigo',
      null,
    ]);
  });

  it('tolera una compra sin detalle', () => {
    expect(mapCompra({ ...fila, detalle_compra: null }).detalle).toEqual([]);
  });
});
