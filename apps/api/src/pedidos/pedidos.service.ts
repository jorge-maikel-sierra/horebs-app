import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { MailService } from '../mail/mail.service';
import { InventarioService } from '../inventario/inventario.service';
import { PuntosService } from '../clientes/puntos.service';
import { calcularItems } from './calcular-items';
import { METODOS_PAGO } from '../common/metodos-pago';
import { COSTO_DOMICILIO_DEFAULT } from '../common/costos';

export interface CrearPedidoItemInput {
  variante_id: string;
  cantidad: number;
}

export interface CrearPedidoInput {
  cliente: {
    nombre: string;
    apellido: string;
    telefono: string;
    correo: string;
    direccion?: string;
  };
  modalidad: 'domicilio' | 'retiro';
  direccion_entrega?: string;
  metodo_pago: 'efectivo' | 'transferencia' | 'tarjeta';
  notas?: string;
  items: CrearPedidoItemInput[];
  usar_puntos?: boolean;
  /**
   * El frontend genera un UUID una sola vez por intento de checkout (no
   * por click) y lo reenvía tal cual en reintentos de red o si el mismo
   * submit dispara dos requests casi simultáneos (doble clic más rápido
   * que el disabled del botón). Con la columna `idempotency_key` (unique)
   * de `pedidos`, el segundo insert choca contra la restricción en vez de
   * crear un pedido duplicado con el stock descontado dos veces.
   */
  idempotency_key?: string;
}

/**
 * Pedido armado por el bot de WhatsApp: el cliente no tiene por qué dar un
 * correo (lo identifica su teléfono) y puede pedir para comer en el local.
 */
export interface CrearPedidoWhatsappInput extends Omit<
  CrearPedidoInput,
  'cliente' | 'modalidad'
> {
  cliente: {
    nombre: string;
    apellido: string;
    telefono: string;
    direccion?: string;
  };
  modalidad: 'domicilio' | 'retiro' | 'local';
}

type CanalPedido = 'web' | 'whatsapp';

/** Lo común a las dos entradas — el correo solo lo exige la web. */
type DatosPedido = Omit<CrearPedidoInput, 'cliente' | 'modalidad'> & {
  cliente: CrearPedidoWhatsappInput['cliente'] & { correo?: string };
  modalidad: CrearPedidoWhatsappInput['modalidad'];
};

export interface ClienteBotDto {
  id: string;
  nombre: string | null;
  apellido: string | null;
  direccion: string | null;
  puntosActuales: number;
}

export interface PedidoParaAvisoDto {
  id: string;
  canal: string;
  estado: string;
  modalidad: string;
  direccionEntrega: string | null;
  /** Teléfono local del cliente (3187592616), sin el 57. */
  telefono: string | null;
  /** Solo en pedidosParaRecompra: puntos de este pedido y saldo actual. */
  puntosGanados?: number;
  puntosActuales?: number;
}

export interface UltimoPedidoDto {
  items: { varianteId: string; cantidad: number }[];
  direccionEntrega: string | null;
}

export interface PedidoItemDto {
  variante_id: string | null;
  producto_nombre: string;
  variante_nombre: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export interface PedidoDto {
  id: string;
  cliente: {
    nombre: string;
    apellido: string | null;
    telefono: string;
    correo: string | null;
    direccion: string | null;
  };
  modalidad: string;
  direccion_entrega: string | null;
  costo_domicilio: number;
  metodo_pago: string;
  estado: string;
  total: number;
  notas: string | null;
  created_at: string;
  items: PedidoItemDto[];
  puntos_canjeados: number;
  descuento_puntos: number;
  puntos_ganados: number;
}

export interface PedidoResumenDto {
  id: string;
  estado: string;
  total: number;
  created_at: string;
  items: {
    producto_nombre: string;
    variante_nombre: string;
    cantidad: number;
  }[];
}

const MODALIDADES: Record<CanalPedido, string[]> = {
  web: ['domicilio', 'retiro'],
  whatsapp: ['domicilio', 'retiro', 'local'],
};

/**
 * Meta entrega el teléfono con código de país (573157861208); en
 * `clientes.telefono` se guarda solo el número local (3157861208).
 */
function normalizarTelefonoCO(telefono: string): string {
  const digitos = telefono.replace(/\D/g, '');
  if (digitos.length === 12 && digitos.startsWith('57')) {
    return digitos.slice(2);
  }
  return digitos;
}

@Injectable()
export class PedidosService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly mail: MailService,
    private readonly inventario: InventarioService,
    private readonly puntos: PuntosService,
  ) {}

  async crear(input: CrearPedidoInput): Promise<PedidoDto> {
    this.validar(input, 'web');
    return this.registrar(input, 'web');
  }

  /**
   * Mismo núcleo que el checkout web (precios desde la base, stock, puntos,
   * aviso de domicilio, idempotencia) — el pedido entra `pendiente` y el
   * equipo lo avanza desde /admin/pedidos.
   */
  async crearDesdeWhatsapp(
    input: CrearPedidoWhatsappInput,
  ): Promise<PedidoDto> {
    const datos = {
      ...input,
      cliente: {
        ...input.cliente,
        telefono: normalizarTelefonoCO(input.cliente.telefono),
      },
    };
    this.validar(datos, 'whatsapp');
    return this.registrar(datos, 'whatsapp');
  }

  private async registrar(
    input: DatosPedido,
    canal: CanalPedido,
  ): Promise<PedidoDto> {
    const client = this.supabase.getClient();

    const { itemsCalculados, total: subtotalItems } = await calcularItems(
      client,
      input.items,
    );
    // Costo de domicilio fijo, no editable por el cliente — a diferencia
    // del POS, acá nunca se confía en un valor que mande el frontend.
    const costoDomicilio =
      input.modalidad === 'domicilio' ? COSTO_DOMICILIO_DEFAULT : 0;
    const subtotal = subtotalItems + costoDomicilio;

    // Upsert atómico por teléfono: evita la condición de carrera de un
    // select-then-insert cuando dos pedidos del mismo cliente llegan a la
    // vez (ej. doble click en "Confirmar pedido"). No se incluye
    // `direccion` cuando este pedido no la trae, para no pisar una
    // dirección ya guardada de un pedido anterior.
    const clienteUpsert: Record<string, string> = {
      nombre: input.cliente.nombre,
      apellido: input.cliente.apellido,
      telefono: input.cliente.telefono,
    };
    // Mismo criterio que la dirección: sin correo (pedido por WhatsApp) no
    // se pisa el que ya tenga guardado el cliente.
    if (input.cliente.correo) {
      clienteUpsert.correo = input.cliente.correo;
    }
    if (input.cliente.direccion) {
      clienteUpsert.direccion = input.cliente.direccion;
    }

    const { data: cliente, error: clienteError } = await client
      .from('clientes')
      .upsert(clienteUpsert, { onConflict: 'telefono' })
      .select('id, nombre, apellido, telefono, correo, direccion')
      .single();

    if (clienteError) {
      throw new BadRequestException('No se pudo registrar el cliente.');
    }

    const canje = input.usar_puntos
      ? await this.puntos.calcularCanjeMaximo(cliente.id, subtotal)
      : { puntos: 0, descuento: 0 };
    const total = subtotal - canje.descuento;

    const { data: pedido, error: pedidoError } = await client
      .from('pedidos')
      .insert({
        cliente_id: cliente.id,
        modalidad: input.modalidad,
        direccion_entrega:
          input.modalidad === 'domicilio' ? input.direccion_entrega : null,
        costo_domicilio: costoDomicilio,
        metodo_pago: input.metodo_pago,
        canal,
        total,
        notas: input.notas ?? null,
        idempotency_key: input.idempotency_key ?? null,
        puntos_canjeados: canje.puntos,
        descuento_puntos: canje.descuento,
      })
      .select(
        'id, modalidad, direccion_entrega, costo_domicilio, metodo_pago, estado, total, notas, created_at',
      )
      .single();

    if (pedidoError) {
      // El insert chocó contra la restricción unique de idempotency_key:
      // ya existe un pedido de este mismo intento de checkout (reintento
      // de red o doble clic más rápido que el disabled del botón) — se
      // devuelve el pedido ya creado en vez de duplicarlo.
      if (pedidoError.code === '23505' && input.idempotency_key) {
        return this.obtenerPorIdempotencyKey(input.idempotency_key);
      }
      throw new BadRequestException('No se pudo crear el pedido.');
    }

    const { error: itemsError } = await client.from('items_pedido').insert(
      itemsCalculados.map((i) => ({
        pedido_id: pedido.id,
        variante_id: i.variante_id,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
        subtotal: i.subtotal,
      })),
    );
    if (itemsError) {
      throw new BadRequestException('No se pudieron registrar los productos del pedido.');
    }

    await this.inventario.descontarPorVentaSeguro(
      itemsCalculados.map((i) => ({
        variante_id: i.variante_id,
        cantidad: i.cantidad,
      })),
      pedido.id,
      null,
    );

    if (canje.puntos > 0) {
      try {
        await this.puntos.registrarCanje(cliente.id, canje.puntos, pedido.id);
      } catch (err) {
        await this.puntos.marcarCanjePendiente(
          pedido.id,
          (err as Error).message,
        );
      }
    }
    const puntosGanados = await this.puntos.otorgarPuntosPorCompraSeguro(
      cliente.id,
      total,
      pedido.id,
    );

    if (pedido.modalidad === 'domicilio' && pedido.direccion_entrega) {
      this.mail.enviarNotificacionDomicilio({
        pedidoId: pedido.id,
        clienteNombre: cliente.nombre,
        clienteTelefono: cliente.telefono,
        direccionEntrega: pedido.direccion_entrega,
        items: itemsCalculados.map((i) => ({
          cantidad: i.cantidad,
          nombre: `${i.producto_nombre} (${i.variante_nombre})`,
          precioUnitario: i.precio_unitario,
        })),
        costoDomicilio: pedido.costo_domicilio || null,
        metodoPago: pedido.metodo_pago,
        total: pedido.total,
        notas: pedido.notas,
      });
    }

    return {
      id: pedido.id,
      cliente: {
        nombre: cliente.nombre,
        apellido: cliente.apellido,
        telefono: cliente.telefono,
        correo: cliente.correo,
        direccion: cliente.direccion,
      },
      modalidad: pedido.modalidad,
      direccion_entrega: pedido.direccion_entrega,
      costo_domicilio: pedido.costo_domicilio,
      metodo_pago: pedido.metodo_pago,
      estado: pedido.estado,
      total: pedido.total,
      notas: pedido.notas,
      created_at: pedido.created_at,
      items: itemsCalculados.map((i) => ({
        variante_id: i.variante_id,
        producto_nombre: i.producto_nombre,
        variante_nombre: i.variante_nombre,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
        subtotal: i.subtotal,
      })),
      puntos_canjeados: canje.puntos,
      descuento_puntos: canje.descuento,
      puntos_ganados: puntosGanados,
    };
  }

  private async obtenerPorIdempotencyKey(
    idempotencyKey: string,
  ): Promise<PedidoDto> {
    const { data, error } = await this.supabase
      .getClient()
      .from('pedidos')
      .select('id')
      .eq('idempotency_key', idempotencyKey)
      .single();
    if (error) {
      throw new BadRequestException('No se pudo recuperar el pedido.');
    }
    return this.obtener(data.id);
  }

  async obtener(id: string): Promise<PedidoDto> {
    const client = this.supabase.getClient();
    const { data: pedido, error } = await client
      .from('pedidos')
      .select(
        'id, modalidad, direccion_entrega, costo_domicilio, metodo_pago, estado, total, notas, created_at, puntos_canjeados, descuento_puntos, puntos_ganados, clientes(nombre, apellido, telefono, correo, direccion), items_pedido(variante_id, cantidad, precio_unitario, subtotal, variantes_producto(nombre, productos(nombre)))',
      )
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new BadRequestException('No se pudo obtener el pedido.');
    }
    if (!pedido) throw new NotFoundException('Pedido no encontrado.');

    const cliente = (pedido as any).clientes;
    const items = ((pedido as any).items_pedido ?? []) as any[];

    return {
      id: pedido.id,
      cliente: {
        nombre: cliente?.nombre ?? '',
        apellido: cliente?.apellido ?? null,
        telefono: cliente?.telefono ?? '',
        correo: cliente?.correo ?? null,
        direccion: cliente?.direccion ?? null,
      },
      modalidad: pedido.modalidad,
      direccion_entrega: pedido.direccion_entrega,
      costo_domicilio: pedido.costo_domicilio,
      metodo_pago: pedido.metodo_pago,
      estado: pedido.estado,
      total: pedido.total,
      notas: pedido.notas,
      created_at: pedido.created_at,
      items: items.map((i) => ({
        variante_id: i.variante_id,
        producto_nombre: i.variantes_producto?.productos?.nombre ?? '',
        variante_nombre: i.variantes_producto?.nombre ?? '',
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
        subtotal: i.subtotal,
      })),
      puntos_canjeados: pedido.puntos_canjeados,
      descuento_puntos: pedido.descuento_puntos,
      puntos_ganados: pedido.puntos_ganados,
    };
  }

  /**
   * Últimos pedidos de un cliente por teléfono — usado por el bot de
   * WhatsApp/Messenger/Instagram para responder "¿dónde está mi pedido?".
   * `telefono` puede venir con el prefijo de país que entrega Meta
   * (573157861208) o ya en formato local (3157861208) como se guarda en
   * `clientes.telefono` — se normaliza antes de buscar.
   */
  async buscarPorTelefono(telefono: string): Promise<PedidoResumenDto[]> {
    const local = normalizarTelefonoCO(telefono);
    if (!local) return [];

    const client = this.supabase.getClient();
    const { data: cliente, error: clienteError } = await client
      .from('clientes')
      .select('id')
      .eq('telefono', local)
      .maybeSingle();
    if (clienteError) {
      throw new BadRequestException('No se pudo buscar el cliente.');
    }
    if (!cliente) return [];

    const { data, error } = await client
      .from('pedidos')
      .select(
        'id, estado, total, created_at, items_pedido(cantidad, variantes_producto(nombre, productos(nombre)))',
      )
      .eq('cliente_id', cliente.id)
      .order('created_at', { ascending: false })
      .limit(3);
    if (error) {
      throw new BadRequestException('No se pudieron obtener los pedidos.');
    }

    return (data ?? []).map((p: any) => ({
      id: p.id,
      estado: p.estado,
      total: p.total,
      created_at: p.created_at,
      items: (p.items_pedido ?? []).map((i: any) => ({
        producto_nombre: i.variantes_producto?.productos?.nombre ?? '',
        variante_nombre: i.variantes_producto?.nombre ?? '',
        cantidad: i.cantidad,
      })),
    }));
  }

  /**
   * Nombre del cliente registrado con este teléfono, o `null` si no existe
   * — usado por el bot para saludar por nombre en el primer mensaje de una
   * conversación nueva. Mismo criterio de normalización que
   * `buscarPorTelefono`.
   */
  async buscarNombrePorTelefono(telefono: string): Promise<string | null> {
    const local = normalizarTelefonoCO(telefono);
    if (!local) return null;

    const { data, error } = await this.supabase
      .getClient()
      .from('clientes')
      .select('nombre')
      .eq('telefono', local)
      .maybeSingle();
    if (error) {
      throw new ServiceUnavailableException(
        `No se pudo consultar la base: ${error.message}`,
      );
    }
    return data?.nombre ?? null;
  }

  /**
   * Cliente identificado por teléfono, para que el bot no le vuelva a
   * preguntar nombre ni dirección y le muestre sus puntos. `null` si nunca
   * compró.
   */
  async clientePorTelefono(telefono: string): Promise<ClienteBotDto | null> {
    const local = normalizarTelefonoCO(telefono);
    if (!local) return null;
    const { data, error } = await this.supabase
      .getClient()
      .from('clientes')
      .select('id, nombre, apellido, direccion, puntos_actuales')
      .eq('telefono', local)
      .maybeSingle<{
        id: string;
        nombre: string | null;
        apellido: string | null;
        direccion: string | null;
        puntos_actuales: number | null;
      }>();
    if (error) {
      throw new ServiceUnavailableException(
        `No se pudo consultar la base: ${error.message}`,
      );
    }
    if (!data) return null;
    return {
      id: data.id,
      nombre: data.nombre,
      apellido: data.apellido,
      direccion: data.direccion,
      puntosActuales: data.puntos_actuales ?? 0,
    };
  }

  /**
   * Último pedido no cancelado del cliente, de cualquier canal (POS, web o
   * WhatsApp), con las variantes exactas — para "¿lo mismo de la última
   * vez?". Los ítems personalizados del POS (sin variante) se omiten.
   */
  async ultimoPedidoPorTelefono(
    telefono: string,
  ): Promise<UltimoPedidoDto | null> {
    const cliente = await this.clientePorTelefono(telefono);
    if (!cliente) return null;
    const { data, error } = await this.supabase
      .getClient()
      .from('pedidos')
      .select('direccion_entrega, items_pedido(variante_id, cantidad)')
      .eq('cliente_id', cliente.id)
      .neq('estado', 'cancelado')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<{
        direccion_entrega: string | null;
        items_pedido: { variante_id: string | null; cantidad: number }[];
      }>();
    if (error) {
      throw new ServiceUnavailableException(
        `No se pudo consultar la base: ${error.message}`,
      );
    }
    if (!data) return null;
    const items = (data.items_pedido ?? []).flatMap((i) =>
      i.variante_id
        ? [{ varianteId: i.variante_id, cantidad: i.cantidad }]
        : [],
    );
    return items.length > 0
      ? { items, direccionEntrega: data.direccion_entrega }
      : null;
  }

  /** Lo justo para avisarle al cliente por WhatsApp un cambio de estado. */
  async datosParaAviso(id: string): Promise<PedidoParaAvisoDto | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('pedidos')
      .select(
        'id, canal, estado, modalidad, direccion_entrega, clientes(telefono)',
      )
      .eq('id', id)
      .maybeSingle<{
        id: string;
        canal: string;
        estado: string;
        modalidad: string;
        direccion_entrega: string | null;
        clientes: { telefono: string | null } | null;
      }>();
    if (error) {
      throw new ServiceUnavailableException(
        `No se pudo consultar la base: ${error.message}`,
      );
    }
    if (!data) return null;
    return {
      id: data.id,
      canal: data.canal,
      estado: data.estado,
      modalidad: data.modalidad,
      direccionEntrega: data.direccion_entrega,
      telefono: data.clientes?.telefono ?? null,
    };
  }

  /**
   * Pedidos del bot ya entregados a los que todavía no se les mandó la
   * invitación a repetir. Solo los de los últimos 3 días: más atrás la
   * ventana de 24h de WhatsApp ya está cerrada de todas formas.
   */
  async pedidosParaRecompra(): Promise<PedidoParaAvisoDto[]> {
    const desde = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await this.supabase
      .getClient()
      .from('pedidos')
      .select(
        'id, canal, estado, modalidad, direccion_entrega, puntos_ganados, clientes(telefono, puntos_actuales)',
      )
      .eq('canal', 'whatsapp')
      .eq('estado', 'entregado')
      .is('recompra_enviada_en', null)
      .gte('created_at', desde)
      .returns<
        {
          id: string;
          canal: string;
          estado: string;
          modalidad: string;
          direccion_entrega: string | null;
          puntos_ganados: number | null;
          clientes: {
            telefono: string | null;
            puntos_actuales: number | null;
          } | null;
        }[]
      >();
    if (error) {
      throw new ServiceUnavailableException(
        `No se pudo consultar la base: ${error.message}`,
      );
    }
    return (data ?? []).map((p) => ({
      id: p.id,
      canal: p.canal,
      estado: p.estado,
      modalidad: p.modalidad,
      direccionEntrega: p.direccion_entrega,
      telefono: p.clientes?.telefono ?? null,
      puntosGanados: p.puntos_ganados ?? 0,
      puntosActuales: p.clientes?.puntos_actuales ?? 0,
    }));
  }

  /**
   * Marca la invitación a repetir como enviada. Devuelve false si ya estaba
   * marcada: así dos corridas del cron nunca la mandan dos veces.
   */
  async reclamarRecompra(id: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .getClient()
      .from('pedidos')
      .update({ recompra_enviada_en: new Date().toISOString() })
      .eq('id', id)
      .is('recompra_enviada_en', null)
      .select('id');
    if (error) {
      throw new ServiceUnavailableException(
        `No se pudo consultar la base: ${error.message}`,
      );
    }
    return (data ?? []).length > 0;
  }

  /**
   * ¿El cliente hizo un pedido (cualquier canal) en las últimas `horas`?
   * El seguimiento de "carrito abandonado" no le escribe a quien ya compró.
   */
  async tienePedidoReciente(telefono: string, horas: number): Promise<boolean> {
    const cliente = await this.clientePorTelefono(telefono);
    if (!cliente) return false;
    const desde = new Date(Date.now() - horas * 60 * 60 * 1000).toISOString();
    const { count, error } = await this.supabase
      .getClient()
      .from('pedidos')
      .select('id', { count: 'exact', head: true })
      .eq('cliente_id', cliente.id)
      .gte('created_at', desde);
    if (error) {
      throw new ServiceUnavailableException(
        `No se pudo consultar la base: ${error.message}`,
      );
    }
    return (count ?? 0) > 0;
  }

  private validar(input: DatosPedido, canal: CanalPedido) {
    if (!input.cliente?.nombre?.trim()) {
      throw new BadRequestException('Falta el nombre del cliente.');
    }
    if (input.cliente.nombre.trim().length > 100) {
      throw new BadRequestException('El nombre es demasiado largo.');
    }
    if (!input.cliente?.apellido?.trim()) {
      throw new BadRequestException('Falta el apellido del cliente.');
    }
    if (input.cliente.apellido.trim().length > 100) {
      throw new BadRequestException('El apellido es demasiado largo.');
    }
    if (!input.cliente?.telefono?.trim()) {
      throw new BadRequestException('Falta el teléfono del cliente.');
    }
    if (!/^\+?[0-9 ()-]{7,20}$/.test(input.cliente.telefono.trim())) {
      throw new BadRequestException('El teléfono no tiene un formato válido.');
    }
    if (canal === 'web' && !input.cliente?.correo?.trim()) {
      throw new BadRequestException('Falta el correo del cliente.');
    }
    if (
      input.cliente.correo &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.cliente.correo.trim())
    ) {
      throw new BadRequestException('El correo no tiene un formato válido.');
    }
    // canal es 'web' | 'whatsapp' fijo desde el código, nunca input externo.
    // eslint-disable-next-line security/detect-object-injection
    if (!MODALIDADES[canal].includes(input.modalidad)) {
      throw new BadRequestException('Modalidad inválida.');
    }
    if (input.modalidad === 'domicilio' && !input.direccion_entrega?.trim()) {
      throw new BadRequestException('Falta la dirección de entrega.');
    }
    if (
      input.direccion_entrega &&
      input.direccion_entrega.trim().length > 300
    ) {
      throw new BadRequestException('La dirección es demasiado larga.');
    }
    if (input.notas && input.notas.trim().length > 500) {
      throw new BadRequestException('Las notas son demasiado largas.');
    }
    if (!METODOS_PAGO.includes(input.metodo_pago)) {
      throw new BadRequestException('Método de pago inválido.');
    }
  }
}
