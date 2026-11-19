import { validarObjeto } from '../common/validacion';
import { resultadosPorCampana } from './campanas-mensajeria-resultados';
import type { FilaPedidoCampana } from './campanas-mensajeria.tipos';
import {
  ESQUEMA_CREAR_CAMPANA_MENSAJERIA,
  ESQUEMA_EDITAR_CAMPANA_MENSAJERIA,
  ESQUEMA_SUBIR_CREATIVO,
} from './esquemas';

describe('ESQUEMA_CREAR_CAMPANA_MENSAJERIA', () => {
  const campos = (cuerpo: object) =>
    validarObjeto(ESQUEMA_CREAR_CAMPANA_MENSAJERIA, cuerpo).map((e) => e.campo);
  const CAMPANA = {
    nombre: 'Sábado de Jamón y Queso',
    canal: 'whatsapp_business',
    mensaje: 'Hoy tu Jamón y Queso grande trae Postobón de regalo',
    enviada_en: '2026-11-21',
  };

  it('acepta una campaña con y sin costo ni destinatarios', () => {
    expect(campos(CAMPANA)).toEqual([]);
    expect(campos({ ...CAMPANA, costo: 45000, destinatarios: 1200 })).toEqual(
      [],
    );
  });

  it('rechaza canal desconocido, fecha inválida y mensaje vacío', () => {
    expect(
      campos({
        ...CAMPANA,
        canal: 'sms',
        enviada_en: '2026-02-31',
        mensaje: ' ',
      }),
    ).toEqual(['canal', 'mensaje', 'enviada_en']);
  });

  it('rechaza costo negativo y destinatarios con decimales', () => {
    expect(campos({ ...CAMPANA, costo: -1, destinatarios: 1.5 })).toEqual([
      'costo',
      'destinatarios',
    ]);
  });

  it('un campo desconocido es error', () => {
    expect(campos({ ...CAMPANA, publico: 'todos' })).toEqual(['publico']);
  });
});

describe('ESQUEMA_EDITAR_CAMPANA_MENSAJERIA', () => {
  const campos = (cuerpo: object) =>
    validarObjeto(ESQUEMA_EDITAR_CAMPANA_MENSAJERIA, cuerpo).map(
      (e) => e.campo,
    );

  it('acepta cambiar un solo campo o desactivarla', () => {
    expect(campos({ activa: false })).toEqual([]);
    expect(campos({ costo: 30000 })).toEqual([]);
    expect(campos({})).toEqual([]);
  });

  it('valida lo que viene y rechaza lo desconocido', () => {
    expect(campos({ canal: 'telegram', id: 'x' })).toEqual(['canal', 'id']);
  });
});

describe('ESQUEMA_SUBIR_CREATIVO', () => {
  const campos = (cuerpo: object) =>
    validarObjeto(ESQUEMA_SUBIR_CREATIVO, cuerpo).map((e) => e.campo);

  it('acepta las extensiones de imagen y video conocidas', () => {
    expect(campos({ extension: 'jpg' })).toEqual([]);
    expect(campos({ extension: 'mp4' })).toEqual([]);
  });

  it('rechaza otros archivos y campos desconocidos', () => {
    expect(campos({ extension: 'exe' })).toEqual(['extension']);
    expect(campos({ extension: 'png', nombre: 'a' })).toEqual(['nombre']);
  });
});

describe('resultadosPorCampana', () => {
  const pedido = (
    campana: string,
    total: number,
    extra: Partial<FilaPedidoCampana> = {},
  ): FilaPedidoCampana => ({
    id: `${campana}-${total}`,
    total,
    estado: 'entregado',
    cliente_id: 'c1',
    campana_mensajeria_id: campana,
    items_pedido: [
      { cantidad: 1, subtotal: total, variantes_producto: { costo: 15000 } },
    ],
    ...extra,
  });

  it('suma pedidos, ventas, clientes y retorno frente al costo', () => {
    const [r] = resultadosPorCampana(
      [{ id: 'a', costo: 20000 }],
      [
        pedido('a', 40000),
        pedido('a', 40000, { cliente_id: 'c2' }),
        pedido('a', 40000, { estado: 'cancelado' }),
      ],
    );
    expect(r).toEqual({
      campana_id: 'a',
      pedidos: 2,
      ventas: 80000,
      clientes: 2,
      utilidad_bruta: 50000,
      cobertura_costos: 100,
      costo_por_pedido: 10000,
      roas: 4,
      retorno_utilidad: 2.5,
    });
  });

  it('sin costo ni pedidos no inventa razones', () => {
    const resultados = resultadosPorCampana(
      [
        { id: 'gratis', costo: null },
        { id: 'sin-pedidos', costo: 10000 },
      ],
      [pedido('gratis', 40000)],
    );
    expect(resultados[0]).toMatchObject({
      pedidos: 1,
      roas: null,
      costo_por_pedido: null,
      retorno_utilidad: null,
    });
    expect(resultados[1]).toMatchObject({
      pedidos: 0,
      ventas: 0,
      roas: 0,
      costo_por_pedido: null,
    });
  });
});
