import { BadRequestException } from '@nestjs/common';
import {
  costoDeReceta,
  costoDeSubreceta,
  filasComponentesReceta,
  filasComponentesSubreceta,
  mapReceta,
  mapSubreceta,
  payloadReceta,
  payloadSubreceta,
  validarReceta,
  validarSubreceta,
} from './recetas-reglas';
import type {
  CrearRecetaInput,
  CrearSubrecetaInput,
  FilaReceta,
  FilaSubreceta,
} from './recetas.tipos';

function subreceta(
  cambios: Partial<CrearSubrecetaInput> = {},
): CrearSubrecetaInput {
  return {
    nombre: 'Salsa',
    rendimiento_g: 500,
    componentes: [{ insumo_id: 'i-1', cantidad_necesaria_g: 200 }],
    ...cambios,
  };
}

function receta(cambios: Partial<CrearRecetaInput> = {}): CrearRecetaInput {
  return {
    nombre: 'Hawaiana',
    componentes: [
      {
        tipo_componente: 'insumo',
        insumo_id: 'i-1',
        cantidad_necesaria_g: 100,
      },
    ],
    ...cambios,
  };
}

describe('validarSubreceta', () => {
  it('acepta una subreceta completa', () => {
    expect(() => validarSubreceta(subreceta())).not.toThrow();
  });

  it.each([
    ['sin nombre', { nombre: ' ' }, 'Falta el nombre de la subreceta.'],
    ['sin rendimiento', { rendimiento_g: 0 }, 'El rendimiento debe ser mayor'],
    ['sin componentes', { componentes: [] }, 'necesita al menos un insumo'],
    [
      'componente sin insumo',
      { componentes: [{ insumo_id: '', cantidad_necesaria_g: 5 }] },
      'Componente de subreceta inválido.',
    ],
    [
      'componente con cantidad negativa',
      { componentes: [{ insumo_id: 'i-1', cantidad_necesaria_g: -5 }] },
      'Componente de subreceta inválido.',
    ],
  ])('rechaza %s con 400', (_caso, cambios, mensaje) => {
    const intento = () => validarSubreceta(subreceta(cambios));
    expect(intento).toThrow(BadRequestException);
    expect(intento).toThrow(mensaje);
  });
});

describe('validarReceta', () => {
  it('acepta una receta con un insumo y una subreceta', () => {
    const completa = receta({
      componentes: [
        { tipo_componente: 'insumo', insumo_id: 'i', cantidad_necesaria_g: 1 },
        {
          tipo_componente: 'subreceta',
          subreceta_id: 's',
          cantidad_necesaria_g: 1,
        },
      ],
    });
    expect(() => validarReceta(completa)).not.toThrow();
  });

  it.each([
    ['sin nombre', { nombre: '' }, 'Falta el nombre de la receta.'],
    ['sin componentes', { componentes: [] }, 'al menos un componente'],
    [
      'cantidad en cero',
      {
        componentes: [
          {
            tipo_componente: 'insumo' as const,
            insumo_id: 'i',
            cantidad_necesaria_g: 0,
          },
        ],
      },
      'Cantidad inválida',
    ],
    [
      'insumo sin id',
      {
        componentes: [
          { tipo_componente: 'insumo' as const, cantidad_necesaria_g: 5 },
        ],
      },
      'Falta el insumo',
    ],
    [
      'subreceta sin id',
      {
        componentes: [
          { tipo_componente: 'subreceta' as const, cantidad_necesaria_g: 5 },
        ],
      },
      'Falta la subreceta',
    ],
  ])('rechaza %s con 400', (_caso, cambios, mensaje) => {
    const intento = () => validarReceta(receta(cambios));
    expect(intento).toThrow(BadRequestException);
    expect(intento).toThrow(mensaje);
  });
});

describe('payloads y filas de componentes', () => {
  it('payloadSubreceta recorta los textos y deja la descripción vacía en null', () => {
    expect(
      payloadSubreceta(subreceta({ nombre: ' Salsa ', descripcion: ' ' })),
    ).toEqual({ nombre: 'Salsa', descripcion: null, rendimiento_g: 500 });
  });

  it('payloadReceta aplica los defaults: sin variante, sin rendimiento y activa', () => {
    expect(payloadReceta(receta({ variante_id: '' }))).toEqual({
      variante_id: null,
      nombre: 'Hawaiana',
      descripcion: null,
      rendimiento_g: null,
      activa: true,
    });
  });

  it('payloadReceta respeta activa=false', () => {
    expect(payloadReceta(receta({ activa: false })).activa).toBe(false);
  });

  it('cada componente de receta guarda solo el id de su tipo', () => {
    const filas = filasComponentesReceta('r-1', [
      {
        tipo_componente: 'insumo',
        insumo_id: 'i-1',
        subreceta_id: 'sobra',
        cantidad_necesaria_g: 100,
      },
      {
        tipo_componente: 'subreceta',
        insumo_id: 'sobra',
        subreceta_id: 's-1',
        cantidad_necesaria_g: 50,
      },
    ]);

    expect(filas).toEqual([
      {
        receta_id: 'r-1',
        tipo_componente: 'insumo',
        insumo_id: 'i-1',
        subreceta_id: null,
        cantidad_necesaria_g: 100,
      },
      {
        receta_id: 'r-1',
        tipo_componente: 'subreceta',
        insumo_id: null,
        subreceta_id: 's-1',
        cantidad_necesaria_g: 50,
      },
    ]);
  });

  it('los componentes de subreceta apuntan a su subreceta', () => {
    expect(
      filasComponentesSubreceta('s-1', [
        { insumo_id: 'i-1', cantidad_necesaria_g: 200 },
      ]),
    ).toEqual([
      { subreceta_id: 's-1', insumo_id: 'i-1', cantidad_necesaria_g: 200 },
    ]);
  });
});

describe('costos', () => {
  it('costoDeSubreceta suma gramos por costo del insumo y un insumo sin costo vale cero', () => {
    expect(
      costoDeSubreceta([
        { cantidad_necesaria_g: 200, insumos: { costo_unitario_g: 2.5 } },
        { cantidad_necesaria_g: 100, insumos: { costo_unitario_g: null } },
        { cantidad_necesaria_g: 100, insumos: null },
      ]),
    ).toBe(500);
  });

  it('costoDeReceta suma insumos y reparte el costo de la subreceta entre su rendimiento', () => {
    expect(
      costoDeReceta([
        {
          tipo_componente: 'insumo',
          cantidad_necesaria_g: 100,
          insumos: { costo_unitario_g: 2.5 },
          subrecetas: null,
        },
        {
          tipo_componente: 'subreceta',
          cantidad_necesaria_g: 50,
          insumos: null,
          subrecetas: { costo_calculado: 1000, rendimiento_g: 500 },
        },
      ]),
    ).toBe(350);
  });

  it('una subreceta sin rendimiento no suma (no se puede repartir)', () => {
    expect(
      costoDeReceta([
        {
          tipo_componente: 'subreceta',
          cantidad_necesaria_g: 50,
          insumos: null,
          subrecetas: { costo_calculado: 1000, rendimiento_g: 0 },
        },
      ]),
    ).toBe(0);
  });
});

describe('mappers', () => {
  it('mapSubreceta deja el nombre del insumo vacío si el join viene null', () => {
    const fila: FilaSubreceta = {
      id: 's-1',
      nombre: 'Salsa',
      descripcion: null,
      rendimiento_g: 500,
      costo_calculado: 1000,
      subreceta_componentes: [
        { insumo_id: 'i-1', cantidad_necesaria_g: 200, insumos: null },
      ],
    };

    expect(mapSubreceta(fila).componentes).toEqual([
      { insumo_id: 'i-1', insumo_nombre: '', cantidad_necesaria_g: 200 },
    ]);
  });

  it('mapReceta aplana variante y producto, y tolera componentes null', () => {
    const fila: FilaReceta = {
      id: 'r-1',
      variante_id: 'v-1',
      nombre: 'Hawaiana',
      descripcion: null,
      rendimiento_g: null,
      activa: true,
      costo_calculado: 350,
      variantes_producto: {
        nombre: 'Personal',
        productos: { nombre: 'Pizza Hawaiana' },
      },
      receta_componentes: null,
    };

    expect(mapReceta(fila)).toMatchObject({
      id: 'r-1',
      variante_nombre: 'Personal',
      producto_nombre: 'Pizza Hawaiana',
      componentes: [],
    });
  });

  it('mapReceta sin variante deja nombres en null', () => {
    const fila = {
      id: 'r-2',
      variante_id: null,
      variantes_producto: null,
      receta_componentes: [],
    } as unknown as FilaReceta;

    expect(mapReceta(fila)).toMatchObject({
      variante_nombre: null,
      producto_nombre: null,
    });
  });
});
