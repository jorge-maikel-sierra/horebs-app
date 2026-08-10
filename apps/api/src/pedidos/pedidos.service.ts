import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { MailService } from '../mail/mail.service';
import { calcularItems } from './calcular-items';

export interface CrearPedidoItemInput {
  variante_id: string;
  cantidad: number;
}

export interface CrearPedidoInput {
  cliente: {
    nombre: string;
    apellido: string;
    telefono: string;
    direccion?: string;
  };
  modalidad: 'domicilio' | 'retiro';
  direccion_entrega?: string;
  metodo_pago: 'efectivo' | 'transferencia' | 'tarjeta';
  notas?: string;
  items: CrearPedidoItemInput[];
}

export interface PedidoItemDto {
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
    direccion: string | null;
  };
  modalidad: string;
  direccion_entrega: string | null;
  metodo_pago: string;
  estado: string;
  total: number;
  notas: string | null;
  created_at: string;
  items: PedidoItemDto[];
}

const MODALIDADES = ['domicilio', 'retiro'];
const METODOS_PAGO = ['efectivo', 'transferencia', 'tarjeta'];

@Injectable()
export class PedidosService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly mail: MailService,
  ) {}

  async crear(input: CrearPedidoInput): Promise<PedidoDto> {
    this.validar(input);
    const client = this.supabase.getClient();

    const { itemsCalculados, total } = await calcularItems(client, input.items);

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
    if (input.cliente.direccion) {
      clienteUpsert.direccion = input.cliente.direccion;
    }

    const { data: cliente, error: clienteError } = await client
      .from('clientes')
      .upsert(clienteUpsert, { onConflict: 'telefono' })
      .select('id, nombre, apellido, telefono, direccion')
      .single();

    if (clienteError) throw clienteError;

    const { data: pedido, error: pedidoError } = await client
      .from('pedidos')
      .insert({
        cliente_id: cliente.id,
        modalidad: input.modalidad,
        direccion_entrega:
          input.modalidad === 'domicilio' ? input.direccion_entrega : null,
        metodo_pago: input.metodo_pago,
        total,
        notas: input.notas ?? null,
      })
      .select('id, modalidad, direccion_entrega, metodo_pago, estado, total, notas, created_at')
      .single();

    if (pedidoError) throw pedidoError;

    const { error: itemsError } = await client.from('items_pedido').insert(
      itemsCalculados.map((i) => ({
        pedido_id: pedido.id,
        variante_id: i.variante_id,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
        subtotal: i.subtotal,
      })),
    );
    if (itemsError) throw itemsError;

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
        costoDomicilio: null,
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
        direccion: cliente.direccion,
      },
      modalidad: pedido.modalidad,
      direccion_entrega: pedido.direccion_entrega,
      metodo_pago: pedido.metodo_pago,
      estado: pedido.estado,
      total: pedido.total,
      notas: pedido.notas,
      created_at: pedido.created_at,
      items: itemsCalculados.map((i) => ({
        producto_nombre: i.producto_nombre,
        variante_nombre: i.variante_nombre,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
        subtotal: i.subtotal,
      })),
    };
  }

  async obtener(id: string): Promise<PedidoDto> {
    const client = this.supabase.getClient();
    const { data: pedido, error } = await client
      .from('pedidos')
      .select(
        'id, modalidad, direccion_entrega, metodo_pago, estado, total, notas, created_at, clientes(nombre, apellido, telefono, direccion), items_pedido(cantidad, precio_unitario, subtotal, variantes_producto(nombre, productos(nombre)))',
      )
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!pedido) throw new NotFoundException('Pedido no encontrado.');

    const cliente = (pedido as any).clientes;
    const items = ((pedido as any).items_pedido ?? []) as any[];

    return {
      id: pedido.id,
      cliente: {
        nombre: cliente?.nombre ?? '',
        apellido: cliente?.apellido ?? null,
        telefono: cliente?.telefono ?? '',
        direccion: cliente?.direccion ?? null,
      },
      modalidad: pedido.modalidad,
      direccion_entrega: pedido.direccion_entrega,
      metodo_pago: pedido.metodo_pago,
      estado: pedido.estado,
      total: pedido.total,
      notas: pedido.notas,
      created_at: pedido.created_at,
      items: items.map((i) => ({
        producto_nombre: i.variantes_producto?.productos?.nombre ?? '',
        variante_nombre: i.variantes_producto?.nombre ?? '',
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
        subtotal: i.subtotal,
      })),
    };
  }

  private validar(input: CrearPedidoInput) {
    if (!input.cliente?.nombre?.trim()) {
      throw new BadRequestException('Falta el nombre del cliente.');
    }
    if (!input.cliente?.apellido?.trim()) {
      throw new BadRequestException('Falta el apellido del cliente.');
    }
    if (!input.cliente?.telefono?.trim()) {
      throw new BadRequestException('Falta el teléfono del cliente.');
    }
    if (!MODALIDADES.includes(input.modalidad)) {
      throw new BadRequestException('Modalidad inválida.');
    }
    if (input.modalidad === 'domicilio' && !input.direccion_entrega?.trim()) {
      throw new BadRequestException('Falta la dirección de entrega.');
    }
    if (!METODOS_PAGO.includes(input.metodo_pago)) {
      throw new BadRequestException('Método de pago inválido.');
    }
  }
}
