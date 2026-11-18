import { sha256 } from '../mensajeria/conversiones-web';
import {
  ESQUEMA_AUDIENCIA,
  filaAudiencia,
  filasAudiencia,
  miembrosPorSegmento,
  resumenesDeClientes,
  type ClienteAudiencia,
  type PedidoAudiencia,
} from './audiencias-reglas';

const AHORA = new Date('2026-11-17T12:00:00.000Z');
const MS_DIA = 86_400_000;
const haceDias = (n: number) =>
  new Date(AHORA.getTime() - n * MS_DIA).toISOString();

const cliente = (
  id: string,
  extra: Partial<ClienteAudiencia> = {},
): ClienteAudiencia => ({
  id,
  nombre: 'Ana',
  apellido: 'Pérez',
  telefono: '3157861208',
  correo: null,
  ciudad: 'Riohacha',
  departamento: 'La Guajira',
  ...extra,
});

const pedido = (
  clienteId: string | null,
  dias: number,
  total = 10000,
  estado = 'entregado',
): PedidoAudiencia => ({
  cliente_id: clienteId,
  total,
  estado,
  created_at: haceDias(dias),
});

const CLIENTES = [
  cliente('c1'),
  cliente('c2'),
  cliente('c3'),
  cliente('c4'),
  cliente('c5'),
];
const PEDIDOS = [
  pedido('c1', 60, 50000),
  pedido('c1', 50, 40000),
  pedido('c2', 3, 20000),
  pedido('c3', 100, 5000),
  pedido('c5', 2, 99999, 'cancelado'),
  pedido(null, 1),
];

describe('resumenesDeClientes', () => {
  it('ignora cancelados, pedidos sin cliente y clientes sin pedidos', () => {
    const r = resumenesDeClientes(CLIENTES, PEDIDOS);
    expect(r.map((x) => x.cliente.id).sort()).toEqual(['c1', 'c2', 'c3']);
    const c1 = r.find((x) => x.cliente.id === 'c1');
    expect(c1).toMatchObject({ pedidos: 2, gastado: 90000 });
  });
});

describe('miembrosPorSegmento', () => {
  const m = miembrosPorSegmento(resumenesDeClientes(CLIENTES, PEDIDOS), AHORA);
  const ids = (clave: Parameters<typeof m.get>[0]) =>
    (m.get(clave) ?? []).map((c) => c.id).sort();

  it('recurrentes: 2 o más pedidos', () => {
    expect(ids('recurrentes')).toEqual(['c1']);
  });

  it('inactivos: compraron pero hace más de 45 días', () => {
    expect(ids('inactivos')).toEqual(['c1', 'c3']);
  });

  it('nuevos: su primer pedido fue en los últimos 30 días', () => {
    expect(ids('nuevos')).toEqual(['c2']);
  });

  it('recientes: su último pedido fue esta semana', () => {
    expect(ids('recientes')).toEqual(['c2']);
  });

  it('mejores: el 20% que más gastó, y al menos uno', () => {
    expect(ids('mejores')).toEqual(['c1']);
  });
});

describe('filaAudiencia', () => {
  it('cifra cada dato y sigue el orden del esquema; nada va en claro', () => {
    const fila = filaAudiencia(cliente('c1', { correo: 'Ana@Correo.com' }));
    expect(ESQUEMA_AUDIENCIA).toEqual([
      'PHONE',
      'EMAIL',
      'FN',
      'LN',
      'CT',
      'ST',
      'COUNTRY',
    ]);
    expect(fila).toEqual([
      sha256('573157861208'),
      sha256('ana@correo.com'),
      sha256('ana'),
      sha256('pérez'),
      sha256('riohacha'),
      sha256('laguajira'),
      sha256('co'),
    ]);
    expect(JSON.stringify(fila)).not.toContain('3157861208');
  });

  it('un dato que falta va vacío y la ciudad usa la del cliente', () => {
    const fila = filaAudiencia(
      cliente('c1', { ciudad: 'Maicao', apellido: null }),
    );
    expect(fila?.[1]).toBe('');
    expect(fila?.[3]).toBe('');
    expect(fila?.[4]).toBe(sha256('maicao'));
  });

  it('sin teléfono ni correo no se envía', () => {
    expect(filaAudiencia(cliente('c1', { telefono: null }))).toBeNull();
    expect(
      filasAudiencia([cliente('a'), cliente('b', { telefono: '123' })]),
    ).toHaveLength(1);
  });
});
