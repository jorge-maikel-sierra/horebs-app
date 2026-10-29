import type { ProductoDto } from '../catalog/catalog.service';
import {
  armarMitadYMitad,
  esPizzaPorCategoria,
  pedidoMitadDeHerramienta,
  pedidoMitadDeItem,
} from './pizza-mitad';

function pizza(
  nombre: string,
  precios: Record<string, number>,
  ofertas: Record<string, number> = {},
): ProductoDto {
  return {
    id: `p-${nombre}`,
    nombre,
    descripcion: null,
    imagen_url: null,
    destacado: false,
    categoria_id: 'cat-pizza',
    slug: null,
    ventas_historicas: null,
    variantes: Object.entries(precios).map(([tamano, precio]) => ({
      id: `${nombre}-${tamano}`,
      nombre: tamano,
      precio,
      precio_oferta: new Map(Object.entries(ofertas)).get(tamano) ?? null,
    })),
  };
}

const especial = pizza('Pizza Horebs Especial', {
  Personal: 20000,
  Mediana: 40000,
  Grande: 60000,
});
const jamon = pizza('Pizza de Jamón y Queso', {
  Personal: 15000,
  Mediana: 30000,
  Grande: 45000,
});
const bebidas: ProductoDto = {
  ...pizza('Bebidas', { 'Coca-Cola 400ml': 4000 }),
  categoria_id: 'cat-bebidas',
};
const productos = [especial, jamon, bebidas];
const esPizza = (p: ProductoDto) => p.categoria_id === 'cat-pizza';

const armar = (a: string, b: string, tamano: string | null) =>
  armarMitadYMitad({ sabor1: a, sabor2: b, tamano }, productos, esPizza);

describe('armarMitadYMitad', () => {
  it('cobra el sabor de mayor valor, venga primero o segundo', () => {
    const a = armar('especial', 'jamón queso', 'mediana');
    const b = armar('jamón queso', 'especial', 'mediana');
    for (const r of [a, b]) {
      expect(r).toMatchObject({ ok: true, precio: 40000 });
      expect(r.ok && r.variante.id).toBe('Pizza Horebs Especial-Mediana');
    }
  });

  it('cotiza en cualquier tamaño', () => {
    const personal = armar('especial', 'jamón queso', 'personal');
    const grande = armar('especial', 'jamón queso', 'grande');
    expect(personal).toMatchObject({ ok: true, precio: 20000 });
    expect(grande).toMatchObject({ ok: true, precio: 60000 });
  });

  it('usa el precio de oferta cuando existe', () => {
    const conOferta = [
      pizza('Pizza Alfa', { Mediana: 40000 }, { Mediana: 28000 }),
      pizza('Pizza Beta', { Mediana: 30000 }),
    ];
    const r = armarMitadYMitad(
      { sabor1: 'alfa', sabor2: 'beta', tamano: 'mediana' },
      conOferta,
      esPizza,
    );
    expect(r).toMatchObject({ ok: true, precio: 30000 });
  });

  it('con el mismo precio queda el primer sabor', () => {
    const iguales = [
      pizza('Pizza Uno', { Mediana: 30000 }),
      pizza('Pizza Dos', { Mediana: 30000 }),
    ];
    const r = armarMitadYMitad(
      { sabor1: 'uno', sabor2: 'dos', tamano: 'mediana' },
      iguales,
      esPizza,
    );
    expect(r.ok && r.variante.id).toBe('Pizza Uno-Mediana');
  });

  it('el texto para el cliente explica el cobro y trae ambos precios', () => {
    const r = armar('especial', 'jamón queso', 'mediana');
    expect(r.ok && r.texto).toContain('Mediana');
    expect(r.ok && r.texto).toContain('$40.000');
    expect(r.ok && r.texto).toContain('mayor valor');
    expect(r.ok && r.texto).toContain('$30.000');
  });

  it('la nota del pedido nombra los dos sabores, el tamaño y el cobro', () => {
    const r = armar('especial', 'jamón queso', 'mediana');
    expect(r.ok && r.nota).toBe(
      'Pizza Mediana mitad Pizza Horebs Especial y mitad Pizza de Jamón y Queso. Se cobra el sabor de mayor valor: Pizza Horebs Especial, $40.000.',
    );
  });

  it('dos veces el mismo sabor no es mitad y mitad', () => {
    const r = armar('especial', 'pizza especial', 'mediana');
    expect(r).toMatchObject({ ok: false });
    expect(!r.ok && r.error).toContain('distintos');
  });

  it('sin tamaño pide el tamaño', () => {
    const r = armar('especial', 'jamón queso', null);
    expect(!r.ok && r.error).toContain('tamaño');
  });

  it('rechaza lo que no es pizza', () => {
    const r = armar('especial', 'coca-cola', 'mediana');
    expect(r).toMatchObject({ ok: false });
  });

  it('avisa si un sabor no existe', () => {
    const r = armar('especial', 'hawaiana', 'mediana');
    expect(!r.ok && r.error).toContain('hawaiana');
  });

  it('avisa si un sabor no viene en ese tamaño', () => {
    const solo = [especial, pizza('Pizza Chica', { Personal: 12000 })];
    const r = armarMitadYMitad(
      { sabor1: 'especial', sabor2: 'chica', tamano: 'mediana' },
      solo,
      esPizza,
    );
    expect(!r.ok && r.error).toContain('Pizza Chica');
  });
});

describe('esPizzaPorCategoria', () => {
  it('reconoce los productos de las categorías de pizza', () => {
    const esPizzaCat = esPizzaPorCategoria([
      { id: 'cat-pizza', nombre: 'Pizzas', orden: 1 },
      { id: 'cat-bebidas', nombre: 'Bebidas', orden: 2 },
    ]);
    expect(esPizzaCat(especial)).toBe(true);
    expect(esPizzaCat(bebidas)).toBe(false);
  });
});

describe('lectura de los argumentos del modelo', () => {
  it('de la herramienta: recorta y deja el tamaño en null si falta', () => {
    expect(
      pedidoMitadDeHerramienta({ sabor_1: ' Especial ', sabor_2: 'Jamón' }),
    ).toEqual({ sabor1: 'Especial', sabor2: 'Jamón', tamano: null });
  });

  it('del ítem: producto es el primer sabor', () => {
    expect(
      pedidoMitadDeItem({
        producto: 'Especial',
        segundo_sabor: 'Jamón',
        tamano: 'mediana',
      }),
    ).toEqual({ sabor1: 'Especial', sabor2: 'Jamón', tamano: 'mediana' });
  });

  it('un valor que no es texto no se convierte en "[object Object]"', () => {
    expect(pedidoMitadDeItem({ producto: { x: 1 }, segundo_sabor: 5 })).toEqual(
      { sabor1: '', sabor2: '', tamano: null },
    );
  });
});
