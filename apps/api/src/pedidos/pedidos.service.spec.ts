import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { PuntosService } from '../clientes/puntos.service';
import type { InventarioService } from '../inventario/inventario.service';
import type { MailService } from '../mail/mail.service';
import type { SupabaseService } from '../supabase/supabase.service';
import type { ItemCalculado } from './calcular-items';
import { PedidosService } from './pedidos.service';
import type {
  CrearPedidoInput,
  FilaClientePedido,
  FilaPedidoCompleto,
  FilaPedidoCreado,
} from './pedidos.tipos';

const mockCalcularItems = jest.fn();
jest.mock('./calcular-items', () => ({
  calcularItems: (...args: unknown[]): unknown => mockCalcularItems(...args),
}));

const ITEM: ItemCalculado = {
  variante_id: 'v-1',
  cantidad: 2,
  precio_unitario: 30000,
  subtotal: 60000,
  producto_nombre: 'Pizza Hawaiana',
  variante_nombre: 'Mediana',
};

const CLIENTE: FilaClientePedido = {
  id: 'c-1',
  nombre: 'Ana',
  apellido: 'Pérez',
  telefono: '3157861208',
  correo: 'ana@correo.co',
  direccion: null,
};

const PEDIDO: FilaPedidoCreado = {
  id: 'p-1',
  modalidad: 'domicilio',
  direccion_entrega: 'Calle 1',
  costo_domicilio: 5000,
  metodo_pago: 'efectivo',
  estado: 'pendiente',
  total: 65000,
  notas: null,
  created_at: '2026-10-30T10:00:00Z',
};

const ENTRADA: CrearPedidoInput = {
  cliente: {
    nombre: 'Ana',
    apellido: 'Pérez',
    telefono: '3157861208',
    correo: 'ana@correo.co',
  },
  modalidad: 'domicilio',
  direccion_entrega: 'Calle 1',
  metodo_pago: 'efectivo',
  items: [{ variante_id: 'v-1', cantidad: 2 }],
};

interface Escritura {
  tabla: string;
  op: 'insert' | 'upsert';
  datos: unknown;
}

interface Resultado {
  data: unknown;
  error: { message: string; code?: string } | null;
}

interface Consulta {
  select: () => Consulta;
  eq: () => Consulta;
  insert: (datos: unknown) => Consulta;
  upsert: (datos: unknown) => Consulta;
  single: () => Promise<Resultado>;
  maybeSingle: () => Promise<Resultado>;
  then: (resolver: (v: Resultado) => unknown) => unknown;
}

interface Respuestas {
  /** Lo que devuelve `single()` por tabla; una lista se consume en orden. */
  single?: Record<string, Resultado | Resultado[]>;
  maybeSingle?: Resultado;
}

function crearServicio(respuestas: Respuestas = {}) {
  const escrituras: Escritura[] = [];
  const from = (tabla: string): Consulta => {
    const b: Consulta = {
      select: () => b,
      eq: () => b,
      insert: (datos) => {
        escrituras.push({ tabla, op: 'insert', datos });
        return b;
      },
      upsert: (datos) => {
        escrituras.push({ tabla, op: 'upsert', datos });
        return b;
      },
      single: () => {
        const r = new Map(Object.entries(respuestas.single ?? {})).get(tabla);
        const resultado = Array.isArray(r) ? r.shift() : r;
        return Promise.resolve(resultado ?? { data: null, error: null });
      },
      maybeSingle: () =>
        Promise.resolve(respuestas.maybeSingle ?? { data: null, error: null }),
      then: (resolver) => resolver({ data: null, error: null }),
    };
    return b;
  };

  const mail = { enviarNotificacionDomicilio: jest.fn() };
  const inventario = {
    descontarPorVentaSeguro: jest.fn().mockResolvedValue(undefined),
  };
  const puntos = {
    calcularCanjeMaximo: jest
      .fn()
      .mockResolvedValue({ puntos: 0, descuento: 0 }),
    registrarCanje: jest.fn().mockResolvedValue(undefined),
    marcarCanjePendiente: jest.fn().mockResolvedValue(undefined),
    otorgarPuntosPorCompraSeguro: jest.fn().mockResolvedValue(6),
  };
  const servicio = new PedidosService(
    { getClient: () => ({ from }) } as unknown as SupabaseService,
    mail as unknown as MailService,
    inventario as unknown as InventarioService,
    puntos as unknown as PuntosService,
  );
  return { servicio, escrituras, mail, inventario, puntos };
}

const OK_CLIENTE: Resultado = { data: CLIENTE, error: null };
const OK_PEDIDO: Resultado = { data: PEDIDO, error: null };

beforeEach(() => {
  mockCalcularItems.mockReset();
  mockCalcularItems.mockResolvedValue({
    itemsCalculados: [ITEM],
    total: 60000,
  });
});

describe('PedidosService.crear', () => {
  it('una entrada inválida se rechaza antes de tocar la base', async () => {
    const { servicio, escrituras } = crearServicio();

    await expect(
      servicio.crear({ ...ENTRADA, metodo_pago: 'cheque' as never }),
    ).rejects.toThrow(BadRequestException);
    expect(escrituras).toEqual([]);
    expect(mockCalcularItems).not.toHaveBeenCalled();
  });

  it('crea cliente, pedido e ítems, descuenta stock y avisa del domicilio', async () => {
    const { servicio, escrituras, mail, inventario, puntos } = crearServicio({
      single: { clientes: OK_CLIENTE, pedidos: OK_PEDIDO },
    });

    const dto = await servicio.crear(ENTRADA);

    expect(escrituras.map((e) => `${e.tabla}:${e.op}`)).toEqual([
      'clientes:upsert',
      'pedidos:insert',
      'items_pedido:insert',
    ]);
    expect(escrituras[1].datos).toMatchObject({
      cliente_id: 'c-1',
      canal: 'web',
      costo_domicilio: 5000,
      total: 65000,
    });
    expect(inventario.descontarPorVentaSeguro).toHaveBeenCalledWith(
      [{ variante_id: 'v-1', cantidad: 2 }],
      'p-1',
      null,
    );
    expect(puntos.otorgarPuntosPorCompraSeguro).toHaveBeenCalledWith(
      'c-1',
      65000,
      'p-1',
    );
    expect(mail.enviarNotificacionDomicilio).toHaveBeenCalledTimes(1);
    expect(dto).toMatchObject({ id: 'p-1', puntos_ganados: 6, total: 65000 });
  });

  it('un retiro no cobra domicilio ni avisa al domiciliario', async () => {
    const { servicio, escrituras, mail } = crearServicio({
      single: {
        clientes: OK_CLIENTE,
        pedidos: {
          data: { ...PEDIDO, modalidad: 'retiro', direccion_entrega: null },
          error: null,
        },
      },
    });

    await servicio.crear({ ...ENTRADA, modalidad: 'retiro' });

    expect(escrituras[1].datos).toMatchObject({
      costo_domicilio: 0,
      total: 60000,
    });
    expect(mail.enviarNotificacionDomicilio).not.toHaveBeenCalled();
  });
});

describe('PedidosService: puntos', () => {
  it('usar puntos descuenta el canje del total y lo registra', async () => {
    const { servicio, escrituras, puntos } = crearServicio({
      single: { clientes: OK_CLIENTE, pedidos: OK_PEDIDO },
    });
    puntos.calcularCanjeMaximo.mockResolvedValue({
      puntos: 40,
      descuento: 2000,
    });

    const dto = await servicio.crear({ ...ENTRADA, usar_puntos: true });

    expect(puntos.calcularCanjeMaximo).toHaveBeenCalledWith('c-1', 65000);
    expect(escrituras[1].datos).toMatchObject({
      total: 63000,
      puntos_canjeados: 40,
      descuento_puntos: 2000,
    });
    expect(puntos.registrarCanje).toHaveBeenCalledWith('c-1', 40, 'p-1');
    expect(dto.puntos_canjeados).toBe(40);
  });

  it('sin usar_puntos no se calcula ningún canje', async () => {
    const { servicio, puntos } = crearServicio({
      single: { clientes: OK_CLIENTE, pedidos: OK_PEDIDO },
    });

    await servicio.crear(ENTRADA);

    expect(puntos.calcularCanjeMaximo).not.toHaveBeenCalled();
    expect(puntos.registrarCanje).not.toHaveBeenCalled();
  });

  it('si el canje falla, el pedido sigue en pie y queda marcado para revisión', async () => {
    const { servicio, puntos } = crearServicio({
      single: { clientes: OK_CLIENTE, pedidos: OK_PEDIDO },
    });
    puntos.calcularCanjeMaximo.mockResolvedValue({
      puntos: 40,
      descuento: 2000,
    });
    puntos.registrarCanje.mockRejectedValue(new Error('saldo cambió'));

    const dto = await servicio.crear({ ...ENTRADA, usar_puntos: true });

    expect(puntos.marcarCanjePendiente).toHaveBeenCalledWith(
      'p-1',
      'saldo cambió',
    );
    expect(dto.id).toBe('p-1');
  });
});

describe('PedidosService: idempotencia', () => {
  const choque: Resultado = {
    data: null,
    error: { message: 'duplicate', code: '23505' },
  };

  it('un reintento con la misma idempotency_key devuelve el pedido ya creado', async () => {
    const existente: FilaPedidoCompleto = {
      ...PEDIDO,
      puntos_canjeados: 0,
      descuento_puntos: 0,
      puntos_ganados: 6,
      clientes: CLIENTE,
      items_pedido: [],
    };
    const { servicio, escrituras, inventario } = crearServicio({
      single: {
        clientes: OK_CLIENTE,
        pedidos: [choque, { data: { id: 'p-1' }, error: null }],
      },
      maybeSingle: { data: existente, error: null },
    });

    const dto = await servicio.crear({ ...ENTRADA, idempotency_key: 'k-1' });

    expect(dto.id).toBe('p-1');
    expect(escrituras.map((e) => e.tabla)).not.toContain('items_pedido');
    expect(inventario.descontarPorVentaSeguro).not.toHaveBeenCalled();
  });

  it('un duplicado sin idempotency_key no se disfraza: es un conflicto 409', async () => {
    const { servicio } = crearServicio({
      single: { clientes: OK_CLIENTE, pedidos: choque },
    });

    await expect(servicio.crear(ENTRADA)).rejects.toThrow(ConflictException);
  });
});

describe('PedidosService.crearDesdeWhatsapp', () => {
  it('normaliza el teléfono con código de país y registra el canal whatsapp', async () => {
    const { servicio, escrituras } = crearServicio({
      single: { clientes: OK_CLIENTE, pedidos: OK_PEDIDO },
    });

    await servicio.crearDesdeWhatsapp({
      cliente: { nombre: 'Ana', apellido: 'Pérez', telefono: '573157861208' },
      modalidad: 'domicilio',
      direccion_entrega: 'Calle 1',
      metodo_pago: 'efectivo',
      items: [{ variante_id: 'v-1', cantidad: 2 }],
    });

    expect(escrituras[0].datos).toMatchObject({ telefono: '3157861208' });
    expect(escrituras[0].datos).not.toHaveProperty('correo');
    expect(escrituras[1].datos).toMatchObject({ canal: 'whatsapp' });
  });

  it('crearDesdeBot registra el pedido con canal messenger o instagram', async () => {
    const { servicio, escrituras } = crearServicio({
      single: { clientes: OK_CLIENTE, pedidos: OK_PEDIDO },
    });

    await servicio.crearDesdeBot(
      {
        cliente: {
          nombre: 'Carlos',
          apellido: 'Gómez',
          telefono: '3001234567',
        },
        modalidad: 'domicilio',
        direccion_entrega: 'Calle 2',
        metodo_pago: 'efectivo',
        items: [{ variante_id: 'v-1', cantidad: 1 }],
      },
      'instagram',
    );

    expect(escrituras[1].datos).toMatchObject({ canal: 'instagram' });
  });
});

describe('PedidosService.obtener', () => {
  it('un pedido que no existe es 404', async () => {
    const { servicio } = crearServicio();

    await expect(servicio.obtener('p-9')).rejects.toThrow(NotFoundException);
  });
});
