import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { SupabaseService } from '../supabase/supabase.service';
import { RecetasService } from './recetas.service';
import type { CrearRecetaInput, FilaReceta } from './recetas.tipos';

const FILA_RECETA: FilaReceta = {
  id: 'r-1',
  variante_id: null,
  nombre: 'Hawaiana',
  descripcion: null,
  rendimiento_g: null,
  activa: true,
  costo_calculado: 350,
  variantes_producto: null,
  receta_componentes: [],
};

interface Escritura {
  tabla: string;
  op: 'insert' | 'update' | 'delete';
  datos?: unknown;
  filtro?: [string, unknown];
}

interface Consulta {
  select: (columnas: string) => Consulta;
  eq: (columna: string, valor: unknown) => Consulta;
  order: () => Consulta;
  returns: () => Consulta;
  insert: (datos: unknown) => Consulta;
  update: (datos: unknown) => Consulta;
  delete: () => Consulta;
  single: () => Promise<{ data: unknown; error: null }>;
  then: (
    resolver: (v: { data: unknown; error: null; count: number }) => unknown,
  ) => unknown;
}

type Lector = (tabla: string, columnas: string) => unknown;

/** Un cliente de Supabase de mentira: lee con `leer`, anota lo que se escribe. */
function crearCliente(leer: Lector, filasActualizadas = 1) {
  const escrituras: Escritura[] = [];
  const from = (tabla: string): Consulta => {
    let columnas = '';
    const b: Consulta = {
      select: (c) => {
        columnas = c;
        return b;
      },
      eq: (columna, valor) => {
        const ultima = escrituras.at(-1);
        if (ultima && !ultima.filtro) ultima.filtro = [columna, valor];
        return b;
      },
      order: () => b,
      returns: () => b,
      insert: (datos) => {
        escrituras.push({ tabla, op: 'insert', datos });
        return b;
      },
      update: (datos) => {
        escrituras.push({ tabla, op: 'update', datos });
        return b;
      },
      delete: () => {
        escrituras.push({ tabla, op: 'delete' });
        return b;
      },
      single: () =>
        Promise.resolve({ data: leer(tabla, columnas), error: null }),
      then: (resolver) =>
        resolver({
          data: leer(tabla, columnas),
          error: null,
          count: filasActualizadas,
        }),
    };
    return b;
  };
  return { cliente: { from }, escrituras };
}

function crearServicio(leer: Lector, filasActualizadas = 1) {
  const { cliente, escrituras } = crearCliente(leer, filasActualizadas);
  const servicio = new RecetasService({
    getClient: () => cliente,
  } as unknown as SupabaseService);
  return { servicio, escrituras };
}

const RECETA_CON_INSUMO_Y_SUBRECETA: CrearRecetaInput = {
  nombre: ' Hawaiana ',
  componentes: [
    { tipo_componente: 'insumo', insumo_id: 'i-1', cantidad_necesaria_g: 100 },
    {
      tipo_componente: 'subreceta',
      subreceta_id: 's-1',
      cantidad_necesaria_g: 50,
    },
  ],
};

describe('RecetasService.crearReceta', () => {
  it('una receta inválida se rechaza antes de tocar la base', async () => {
    const { servicio, escrituras } = crearServicio(() => null);

    await expect(
      servicio.crearReceta({ nombre: 'Sin nada', componentes: [] }),
    ).rejects.toThrow(BadRequestException);
    expect(escrituras).toEqual([]);
  });

  it('crea la receta, reemplaza sus componentes y guarda el costo calculado', async () => {
    const { servicio, escrituras } = crearServicio((tabla, columnas) => {
      if (columnas === 'id') return { id: 'r-1' };
      if (tabla === 'receta_componentes') {
        return [
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
        ];
      }
      return FILA_RECETA;
    });

    const resultado = await servicio.crearReceta(RECETA_CON_INSUMO_Y_SUBRECETA);

    expect(escrituras.map((e) => `${e.tabla}:${e.op}`)).toEqual([
      'recetas:insert',
      'receta_componentes:delete',
      'receta_componentes:insert',
      'recetas:update',
    ]);
    expect(escrituras[0].datos).toMatchObject({ nombre: 'Hawaiana' });
    expect(escrituras[1].filtro).toEqual(['receta_id', 'r-1']);
    expect(escrituras[3]).toMatchObject({
      datos: { costo_calculado: 350 },
      filtro: ['id', 'r-1'],
    });
    expect(resultado.id).toBe('r-1');
  });
});

describe('RecetasService.editarReceta', () => {
  it('una receta que no existe es un 404 y no toca los componentes', async () => {
    const { servicio, escrituras } = crearServicio(() => null, 0);

    await expect(
      servicio.editarReceta('r-9', RECETA_CON_INSUMO_Y_SUBRECETA),
    ).rejects.toThrow(NotFoundException);
    expect(escrituras.map((e) => `${e.tabla}:${e.op}`)).toEqual([
      'recetas:update',
    ]);
  });
});

describe('RecetasService.editarSubreceta', () => {
  const edicion = {
    nombre: 'Salsa',
    rendimiento_g: 500,
    componentes: [{ insumo_id: 'i-1', cantidad_necesaria_g: 200 }],
  };

  it('una subreceta que no existe es un 404', async () => {
    const { servicio } = crearServicio(() => null, 0);

    await expect(servicio.editarSubreceta('s-9', edicion)).rejects.toThrow(
      'Subreceta no encontrada.',
    );
  });

  it('recalcula una sola vez cada receta que usa la subreceta, aunque aparezca repetida', async () => {
    const { servicio, escrituras } = crearServicio((tabla, columnas) => {
      if (columnas === 'receta_id') {
        return [
          { receta_id: 'r-1' },
          { receta_id: 'r-1' },
          { receta_id: 'r-2' },
        ];
      }
      if (tabla === 'subrecetas') {
        return {
          id: 's-1',
          nombre: 'Salsa',
          descripcion: null,
          rendimiento_g: 500,
          costo_calculado: 0,
          subreceta_componentes: [],
        };
      }
      return [];
    });

    await servicio.editarSubreceta('s-1', edicion);

    const recetasActualizadas = escrituras
      .filter((e) => e.tabla === 'recetas' && e.op === 'update')
      .map((e) => e.filtro);
    expect(recetasActualizadas).toEqual([
      ['id', 'r-1'],
      ['id', 'r-2'],
    ]);
  });
});
