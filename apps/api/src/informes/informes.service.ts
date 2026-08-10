import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface InformeDiaDto {
  fecha: string;
  total: number;
  pedidos: number;
}

export interface InformeDesgloseDto {
  clave: string;
  total: number;
  pedidos: number;
}

export interface InformeProductoDto {
  nombre: string;
  cantidad: number;
  total: number;
}

export interface InformeCategoriaDto {
  nombre: string;
  cantidad: number;
  total: number;
}

export interface InformeClienteDiaDto {
  fecha: string;
  nuevos: number;
}

export interface InformeClienteTopDto {
  id: string;
  nombre: string;
  telefono: string | null;
  pedidos: number;
  total: number;
}

export interface InformeClientesDto {
  nuevos: number;
  recurrentes: number;
  ticket_promedio: number;
  serie_diaria_nuevos: InformeClienteDiaDto[];
  top_clientes: InformeClienteTopDto[];
}

export interface InformeDto {
  desde: string;
  hasta: string;
  resumen: {
    ventas_brutas: number;
    promedio_diario: number;
    pedidos: number;
    articulos_vendidos: number;
    ticket_promedio: number;
    costo_domicilio_total: number;
  };
  serie_diaria: InformeDiaDto[];
  por_metodo_pago: InformeDesgloseDto[];
  por_modalidad: InformeDesgloseDto[];
  por_canal: InformeDesgloseDto[];
  top_productos: InformeProductoDto[];
  por_categoria: InformeCategoriaDto[];
  clientes: InformeClientesDto;
}

const PEDIDOS_INFORME_SELECT =
  'id, cliente_id, total, costo_domicilio, metodo_pago, modalidad, canal, created_at';

type Acumulador = { total: number; pedidos: number };

@Injectable()
export class InformesService {
  constructor(private readonly supabase: SupabaseService) {}

  async generar(desdeInput?: string, hastaInput?: string): Promise<InformeDto> {
    const { desde, hasta, desdeISO, hastaISO } = this.resolverRango(
      desdeInput,
      hastaInput,
    );
    const client = this.supabase.getClient();

    const { data: pedidos, error } = await client
      .from('pedidos')
      .select(PEDIDOS_INFORME_SELECT)
      .neq('estado', 'cancelado')
      .gte('created_at', desdeISO)
      .lte('created_at', hastaISO);
    if (error) throw error;

    const filas = pedidos ?? [];

    const porDia = new Map<string, Acumulador>();
    const porMetodo = new Map<string, Acumulador>();
    const porModalidad = new Map<string, Acumulador>();
    const porCanal = new Map<string, Acumulador>();

    let ventasBrutas = 0;
    let costoDomicilioTotal = 0;

    for (const p of filas) {
      ventasBrutas += p.total;
      costoDomicilioTotal += p.costo_domicilio ?? 0;
      this.acumular(porDia, p.created_at.slice(0, 10), p.total);
      this.acumular(porMetodo, p.metodo_pago, p.total);
      this.acumular(porModalidad, p.modalidad, p.total);
      this.acumular(porCanal, p.canal, p.total);
    }

    const diasEnRango = this.contarDias(desde, hasta);

    const { topProductos, porCategoria, articulosVendidos } =
      await this.calcularItems(
        client,
        filas.map((p) => p.id),
      );

    const clientes = await this.calcularClientes(
      client,
      filas,
      desde,
      hasta,
      desdeISO,
    );

    return {
      desde,
      hasta,
      resumen: {
        ventas_brutas: ventasBrutas,
        promedio_diario: diasEnRango > 0 ? ventasBrutas / diasEnRango : 0,
        pedidos: filas.length,
        articulos_vendidos: articulosVendidos,
        ticket_promedio: filas.length > 0 ? ventasBrutas / filas.length : 0,
        costo_domicilio_total: costoDomicilioTotal,
      },
      serie_diaria: this.serializarSerieDiaria(porDia, desde, hasta),
      por_metodo_pago: this.serializarMapa(porMetodo),
      por_modalidad: this.serializarMapa(porModalidad),
      por_canal: this.serializarMapa(porCanal),
      top_productos: topProductos,
      por_categoria: porCategoria,
      clientes,
    };
  }

  /**
   * "Nuevo" vs "recurrente" se define contra clientes.created_at, que en
   * este modelo se fija en el momento de su primer pedido (no hay cuenta
   * de usuario obligatoria para comprar) — así que created_at dentro del
   * rango equivale a "primera compra en este período".
   */
  private async calcularClientes(
    client: SupabaseClient,
    filas: { cliente_id: string; total: number }[],
    desde: string,
    hasta: string,
    desdeISO: string,
  ): Promise<InformeClientesDto> {
    const clienteIds = [...new Set(filas.map((p) => p.cliente_id))];
    if (clienteIds.length === 0) {
      return {
        nuevos: 0,
        recurrentes: 0,
        ticket_promedio: 0,
        serie_diaria_nuevos: this.serializarSerieDiariaClientes(
          new Map(),
          desde,
          hasta,
        ),
        top_clientes: [],
      };
    }

    const { data: clientesData, error } = await client
      .from('clientes')
      .select('id, nombre, apellido, telefono, created_at')
      .in('id', clienteIds);
    if (error) throw error;

    const clienteMap = new Map((clientesData ?? []).map((c) => [c.id, c]));
    const desdeMs = new Date(desdeISO).getTime();

    const porClienteActivo = new Map<string, { pedidos: number; total: number }>();
    for (const p of filas) {
      const actual = porClienteActivo.get(p.cliente_id) ?? {
        pedidos: 0,
        total: 0,
      };
      actual.pedidos += 1;
      actual.total += p.total;
      porClienteActivo.set(p.cliente_id, actual);
    }

    let nuevos = 0;
    let recurrentes = 0;
    const porDiaAltas = new Map<string, number>();

    for (const id of clienteIds) {
      const c = clienteMap.get(id);
      const esNuevo = c ? new Date(c.created_at).getTime() >= desdeMs : false;
      if (esNuevo) {
        nuevos += 1;
        const dia = c!.created_at.slice(0, 10);
        porDiaAltas.set(dia, (porDiaAltas.get(dia) ?? 0) + 1);
      } else {
        recurrentes += 1;
      }
    }

    const ventasActivos = [...porClienteActivo.values()].reduce(
      (s, v) => s + v.total,
      0,
    );

    const topClientes = clienteIds
      .map((id) => {
        const c = clienteMap.get(id);
        const stats = porClienteActivo.get(id)!;
        return {
          id,
          nombre: c ? `${c.nombre} ${c.apellido ?? ''}`.trim() : 'Cliente',
          telefono: c?.telefono ?? null,
          pedidos: stats.pedidos,
          total: stats.total,
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    return {
      nuevos,
      recurrentes,
      ticket_promedio:
        clienteIds.length > 0 ? ventasActivos / clienteIds.length : 0,
      serie_diaria_nuevos: this.serializarSerieDiariaClientes(
        porDiaAltas,
        desde,
        hasta,
      ),
      top_clientes: topClientes,
    };
  }

  private serializarSerieDiariaClientes(
    porDia: Map<string, number>,
    desde: string,
    hasta: string,
  ): InformeClienteDiaDto[] {
    const resultado: InformeClienteDiaDto[] = [];
    let cursor = new Date(`${desde}T00:00:00`);
    const fin = new Date(`${hasta}T00:00:00`);
    while (cursor <= fin) {
      const fecha = this.formatearFecha(cursor);
      resultado.push({ fecha, nuevos: porDia.get(fecha) ?? 0 });
      cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    }
    return resultado;
  }

  private async calcularItems(client: SupabaseClient, pedidoIds: string[]) {
    if (pedidoIds.length === 0) {
      return { topProductos: [], porCategoria: [], articulosVendidos: 0 };
    }

    const { data: items, error } = await client
      .from('items_pedido')
      .select(
        'cantidad, subtotal, nombre_personalizado, variantes_producto(nombre, productos(nombre, categorias(nombre)))',
      )
      .in('pedido_id', pedidoIds);
    if (error) throw error;

    const porProducto = new Map<string, { cantidad: number; total: number }>();
    const porCategoria = new Map<string, { cantidad: number; total: number }>();
    let articulosVendidos = 0;

    for (const item of (items ?? []) as any[]) {
      articulosVendidos += item.cantidad;
      const producto = item.variantes_producto?.productos;
      const nombreProducto =
        producto?.nombre ?? item.nombre_personalizado ?? 'Personalizado';
      const nombreCategoria = producto?.categorias?.nombre ?? 'Personalizado';

      const acumProducto = porProducto.get(nombreProducto) ?? {
        cantidad: 0,
        total: 0,
      };
      acumProducto.cantidad += item.cantidad;
      acumProducto.total += item.subtotal;
      porProducto.set(nombreProducto, acumProducto);

      const acumCategoria = porCategoria.get(nombreCategoria) ?? {
        cantidad: 0,
        total: 0,
      };
      acumCategoria.cantidad += item.cantidad;
      acumCategoria.total += item.subtotal;
      porCategoria.set(nombreCategoria, acumCategoria);
    }

    const topProductos = [...porProducto.entries()]
      .map(([nombre, v]) => ({ nombre, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    const porCategoriaOrdenado = [...porCategoria.entries()]
      .map(([nombre, v]) => ({ nombre, ...v }))
      .sort((a, b) => b.total - a.total);

    return { topProductos, porCategoria: porCategoriaOrdenado, articulosVendidos };
  }

  private acumular(mapa: Map<string, Acumulador>, clave: string, monto: number) {
    const actual = mapa.get(clave) ?? { total: 0, pedidos: 0 };
    actual.total += monto;
    actual.pedidos += 1;
    mapa.set(clave, actual);
  }

  private serializarMapa(mapa: Map<string, Acumulador>): InformeDesgloseDto[] {
    return [...mapa.entries()]
      .map(([clave, v]) => ({ clave, ...v }))
      .sort((a, b) => b.total - a.total);
  }

  private serializarSerieDiaria(
    porDia: Map<string, Acumulador>,
    desde: string,
    hasta: string,
  ): InformeDiaDto[] {
    const resultado: InformeDiaDto[] = [];
    let cursor = new Date(`${desde}T00:00:00`);
    const fin = new Date(`${hasta}T00:00:00`);
    while (cursor <= fin) {
      const fecha = this.formatearFecha(cursor);
      const datos = porDia.get(fecha) ?? { total: 0, pedidos: 0 };
      resultado.push({ fecha, ...datos });
      cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    }
    return resultado;
  }

  private resolverRango(desdeInput?: string, hastaInput?: string) {
    const hastaDate = hastaInput ? new Date(`${hastaInput}T00:00:00`) : new Date();
    const desdeDate = desdeInput
      ? new Date(`${desdeInput}T00:00:00`)
      : new Date(hastaDate.getTime() - 6 * 24 * 60 * 60 * 1000);

    if (Number.isNaN(desdeDate.getTime()) || Number.isNaN(hastaDate.getTime())) {
      throw new BadRequestException('Rango de fechas inválido.');
    }
    if (desdeDate > hastaDate) {
      throw new BadRequestException(
        'La fecha "desde" no puede ser posterior a "hasta".',
      );
    }

    const desde = this.formatearFecha(desdeDate);
    const hasta = this.formatearFecha(hastaDate);
    return {
      desde,
      hasta,
      desdeISO: `${desde}T00:00:00.000`,
      hastaISO: `${hasta}T23:59:59.999`,
    };
  }

  private contarDias(desde: string, hasta: string) {
    const ms =
      new Date(`${hasta}T00:00:00`).getTime() -
      new Date(`${desde}T00:00:00`).getTime();
    return Math.floor(ms / (24 * 60 * 60 * 1000)) + 1;
  }

  private formatearFecha(d: Date) {
    return d.toISOString().slice(0, 10);
  }
}
