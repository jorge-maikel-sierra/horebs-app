import {
  resumenCostos,
  varianteConCosto,
  variantesParaCostos,
  type FilaVarianteCosto,
} from './costos-reglas';

const fila = (extra: Partial<FilaVarianteCosto> = {}): FilaVarianteCosto => ({
  id: 'v-1',
  nombre: 'Mediana',
  precio: '40000',
  precio_oferta: null,
  costo: null,
  activo: true,
  productos: { nombre: 'Pizza Hawaiana', activo: true },
  ...extra,
});

describe('varianteConCosto', () => {
  it('sin costo no calcula margen', () => {
    expect(varianteConCosto(fila())).toMatchObject({
      producto: 'Pizza Hawaiana',
      variante: 'Mediana',
      precio: 40000,
      costo: null,
      margen: null,
      margen_pct: null,
    });
  });

  it('con costo calcula el margen sobre el precio con oferta si lo hay', () => {
    const v = varianteConCosto(
      fila({ precio_oferta: '30000', costo: '12000' }),
    );
    expect(v).toMatchObject({
      precio: 30000,
      costo: 12000,
      margen: 18000,
      margen_pct: 60,
    });
  });
});

describe('variantesParaCostos', () => {
  it('deja solo lo activo y ordena por producto y precio', () => {
    const lista = variantesParaCostos([
      fila({ id: 'a', nombre: 'Grande', precio: '60000' }),
      fila({ id: 'b', nombre: 'Personal', precio: '25000' }),
      fila({ id: 'c', activo: false }),
      fila({ id: 'd', productos: { nombre: 'Panzerotti', activo: false } }),
      fila({ id: 'e', productos: { nombre: 'Gaseosa', activo: true } }),
    ]);
    expect(lista.map((v) => v.id)).toEqual(['e', 'b', 'a']);
  });
});

describe('resumenCostos', () => {
  it('cuenta las variantes con y sin costo', () => {
    const lista = variantesParaCostos([
      fila({ id: 'a', costo: '5000' }),
      fila({ id: 'b' }),
    ]);
    expect(resumenCostos(lista)).toEqual({
      variantes: 2,
      con_costo: 1,
      sin_costo: 1,
    });
  });
});
