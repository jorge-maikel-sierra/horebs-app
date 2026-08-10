import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { SupabaseClient } from '@supabase/supabase-js';

export type Granularidad = 'dia' | 'mes';

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
  granularidad: Granularidad;
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

type Acumulador = { total: number; pedidos: number };

/**
 * Los pedidos en vivo y los históricos (migrados de WooCommerce, ver
 * historico_pedidos) viven en tablas separadas con columnas distintas.
 * Se normalizan a esta forma común una sola vez para poder reusar toda
 * la lógica de agregación sin duplicarla por origen.
 */
interface PedidoUnificado {
  id: string;
  total: number;
  costo_domicilio: number;
  metodo_pago: string;
  modalidad: string;
  canal: string;
  creado_en: string;
  telefono: string | null;
  nombre_cliente: string | null;
}

@Injectable()
export class InformesService {
  constructor(private readonly supabase: SupabaseService) {}

  async generar(desdeInput?: string, hastaInput?: string): Promise<InformeDto> {
    const { desde, hasta, desdeISO, hastaISO } = this.resolverRango(
      desdeInput,
      hastaInput,
    );
    const client = this.supabase.getClient();
    const granularidad = this.resolverGranularidad(desde, hasta);

    const [pedidosVivos, pedidosHistoricos] = await Promise.all([
      this.obtenerPedidosVivos(client, desdeISO, hastaISO),
      this.obtenerPedidosHistoricos(client, desdeISO, hastaISO),
    ]);
    const filas = [...pedidosVivos, ...pedidosHistoricos];

    const porBucket = new Map<string, Acumulador>();
    const porMetodo = new Map<string, Acumulador>();
    const porModalidad = new Map<string, Acumulador>();
    const porCanal = new Map<string, Acumulador>();

    let ventasBrutas = 0;
    let costoDomicilioTotal = 0;

    for (const p of filas) {
      ventasBrutas += p.total;
      costoDomicilioTotal += p.costo_domicilio;
      this.acumular(porBucket, this.claveBucket(p.creado_en, granularidad), p.total);
      this.acumular(porMetodo, p.metodo_pago, p.total);
      this.acumular(porModalidad, p.modalidad, p.total);
      this.acumular(porCanal, p.canal, p.total);
    }

    const diasEnRango = this.contarDias(desde, hasta);

    const { topProductos, porCategoria, articulosVendidos } =
      await this.calcularItems(client, desdeISO, hastaISO);

    const clientes = await this.calcularClientes(
      client,
      filas,
      desde,
      hasta,
      desdeISO,
      granularidad,
    );

    return {
      desde,
      hasta,
      granularidad,
      resumen: {
        ventas_brutas: ventasBrutas,
        promedio_diario: diasEnRango > 0 ? ventasBrutas / diasEnRango : 0,
        pedidos: filas.length,
        articulos_vendidos: articulosVendidos,
        ticket_promedio: filas.length > 0 ? ventasBrutas / filas.length : 0,
        costo_domicilio_total: costoDomicilioTotal,
      },
      serie_diaria: this.serializarSerie(porBucket, desde, hasta, granularidad),
      por_metodo_pago: this.serializarMapa(porMetodo),
      por_modalidad: this.serializarMapa(porModalidad),
      por_canal: this.serializarMapa(porCanal),
      top_productos: topProductos,
      por_categoria: porCategoria,
      clientes,
    };
  }

  private async obtenerPedidosVivos(
    client: SupabaseClient,
    desdeISO: string,
    hastaISO: string,
  ): Promise<PedidoUnificado[]> {
    const data = await this.paginarTodo<any>((desde, hasta) =>
      client
        .from('pedidos')
        .select(
          'id, total, costo_domicilio, metodo_pago, modalidad, canal, created_at, clientes(telefono, nombre, apellido)',
        )
        .neq('estado', 'cancelado')
        .gte('created_at', desdeISO)
        .lte('created_at', hastaISO)
        .range(desde, hasta),
    );

    return data.map((p) => ({
      id: p.id,
      total: p.total,
      costo_domicilio: p.costo_domicilio ?? 0,
      metodo_pago: p.metodo_pago,
      modalidad: p.modalidad,
      canal: p.canal,
      creado_en: p.created_at,
      telefono: p.clientes?.telefono ?? null,
      nombre_cliente: p.clientes
        ? `${p.clientes.nombre} ${p.clientes.apellido ?? ''}`.trim()
        : null,
    }));
  }

  /**
   * Pedidos migrados de WooCommerce (ver historico_pedidos). No se filtra
   * por estado porque la migración ya excluyó pendientes/cancelados en
   * origen — todo lo que hay ahí es venta real.
   */
  private async obtenerPedidosHistoricos(
    client: SupabaseClient,
    desdeISO: string,
    hastaISO: string,
  ): Promise<PedidoUnificado[]> {
    const data = await this.paginarTodo<any>((desde, hasta) =>
      client
        .from('historico_pedidos')
        .select(
          'id, total, metodo_pago, modalidad, canal, creado_en, historico_clientes(telefono, nombre, apellido)',
        )
        .gte('creado_en', desdeISO)
        .lte('creado_en', hastaISO)
        .range(desde, hasta),
    );

    return data.map((p) => ({
      id: p.id,
      total: p.total,
      costo_domicilio: 0,
      metodo_pago: p.metodo_pago,
      modalidad: p.modalidad,
      canal: p.canal,
      creado_en: p.creado_en,
      telefono: p.historico_clientes?.telefono ?? null,
      nombre_cliente: p.historico_clientes
        ? `${p.historico_clientes.nombre} ${p.historico_clientes.apellido ?? ''}`.trim()
        : null,
    }));
  }

  /**
   * "Nuevo" vs "recurrente" se define contra la fecha real de primera
   * compra de cada teléfono, tomando la más antigua entre clientes.created_at
   * (vivo) e historico_clientes.primera_compra (migrado) — un mismo cliente
   * puede tener historial en ambas tablas.
   */
  private async calcularClientes(
    client: SupabaseClient,
    filas: PedidoUnificado[],
    desde: string,
    hasta: string,
    desdeISO: string,
    granularidad: Granularidad,
  ): Promise<InformeClientesDto> {
    const telefonos = [
      ...new Set(filas.map((p) => p.telefono).filter((t): t is string => !!t)),
    ];
    if (telefonos.length === 0) {
      return {
        nuevos: 0,
        recurrentes: 0,
        ticket_promedio: 0,
        serie_diaria_nuevos: this.serializarSerieClientes(
          new Map(),
          desde,
          hasta,
          granularidad,
        ),
        top_clientes: [],
      };
    }

    const [clientesVivos, clientesHist] = await Promise.all([
      this.buscarPorTelefonos(client, 'clientes', 'telefono, nombre, apellido, created_at', telefonos),
      this.buscarPorTelefonos(
        client,
        'historico_clientes',
        'telefono, nombre, apellido, primera_compra',
        telefonos,
      ),
    ]);

    const primeraCompra = new Map<string, { fecha: string; nombre: string }>();
    for (const c of clientesHist ?? []) {
      primeraCompra.set(c.telefono, {
        fecha: c.primera_compra,
        nombre: `${c.nombre} ${c.apellido ?? ''}`.trim(),
      });
    }
    for (const c of clientesVivos ?? []) {
      const existente = primeraCompra.get(c.telefono);
      if (!existente || new Date(c.created_at) < new Date(existente.fecha)) {
        primeraCompra.set(c.telefono, {
          fecha: c.created_at,
          nombre: `${c.nombre} ${c.apellido ?? ''}`.trim(),
        });
      }
    }

    const porClienteActivo = new Map<string, { pedidos: number; total: number }>();
    for (const p of filas) {
      if (!p.telefono) continue;
      const actual = porClienteActivo.get(p.telefono) ?? { pedidos: 0, total: 0 };
      actual.pedidos += 1;
      actual.total += p.total;
      porClienteActivo.set(p.telefono, actual);
    }

    const desdeMs = new Date(desdeISO).getTime();
    let nuevos = 0;
    let recurrentes = 0;
    const porBucketAltas = new Map<string, number>();

    for (const telefono of telefonos) {
      const info = primeraCompra.get(telefono);
      if (!info) continue;
      const esNuevo = new Date(info.fecha).getTime() >= desdeMs;
      if (esNuevo) {
        nuevos += 1;
        const bucket = this.claveBucket(info.fecha, granularidad);
        porBucketAltas.set(bucket, (porBucketAltas.get(bucket) ?? 0) + 1);
      } else {
        recurrentes += 1;
      }
    }

    const ventasActivos = [...porClienteActivo.values()].reduce(
      (s, v) => s + v.total,
      0,
    );

    const topClientes = telefonos
      .map((telefono) => {
        const info = primeraCompra.get(telefono);
        const stats = porClienteActivo.get(telefono) ?? { pedidos: 0, total: 0 };
        return {
          id: telefono,
          nombre: info?.nombre || 'Cliente',
          telefono,
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
        telefonos.length > 0 ? ventasActivos / telefonos.length : 0,
      serie_diaria_nuevos: this.serializarSerieClientes(
        porBucketAltas,
        desde,
        hasta,
        granularidad,
      ),
      top_clientes: topClientes,
    };
  }

  /**
   * PostgREST devuelve máximo 1000 filas por defecto — con el histórico
   * un rango amplio fácilmente supera eso, así que se pagina con .range()
   * hasta agotar los resultados.
   */
  private async paginarTodo<T>(
    build: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: any }>,
    tamanoPagina = 1000,
  ): Promise<T[]> {
    const resultado: T[] = [];
    for (let desde = 0; ; desde += tamanoPagina) {
      const { data, error } = await build(desde, desde + tamanoPagina - 1);
      if (error) throw error;
      resultado.push(...(data ?? []));
      if (!data || data.length < tamanoPagina) break;
    }
    return resultado;
  }

  /**
   * .in('telefono', [...]) con miles de valores rompe la request (URL
   * demasiado larga) — se banca la lista de teléfonos en tandas.
   */
  private async buscarPorTelefonos(
    client: SupabaseClient,
    tabla: string,
    select: string,
    telefonos: string[],
    tamanoTanda = 200,
  ): Promise<any[]> {
    const resultado: any[] = [];
    for (let i = 0; i < telefonos.length; i += tamanoTanda) {
      const tanda = telefonos.slice(i, i + tamanoTanda);
      const { data, error } = await client.from(tabla).select(select).in('telefono', tanda);
      if (error) throw error;
      resultado.push(...(data ?? []));
    }
    return resultado;
  }

  /**
   * Filtra por fecha vía el join en vez de pasar la lista de pedido_id
   * por la URL — con el histórico incluido puede haber miles de pedidos
   * en rango, y un .in(...) con esa cantidad de UUIDs rompe la request.
   */
  private async calcularItems(client: SupabaseClient, desdeISO: string, hastaISO: string) {
    const porProducto = new Map<string, { cantidad: number; total: number }>();
    const porCategoria = new Map<string, { cantidad: number; total: number }>();
    let articulosVendidos = 0;

    const [itemsVivos, itemsHistoricos] = await Promise.all([
      this.paginarTodo<any>((desde, hasta) =>
        client
          .from('items_pedido')
          .select(
            'cantidad, subtotal, nombre_personalizado, variantes_producto(nombre, productos(nombre, categorias(nombre))), pedidos!inner(created_at, estado)',
          )
          .neq('pedidos.estado', 'cancelado')
          .gte('pedidos.created_at', desdeISO)
          .lte('pedidos.created_at', hastaISO)
          .range(desde, hasta),
      ),
      this.paginarTodo<any>((desde, hasta) =>
        client
          .from('historico_items_pedido')
          .select(
            'cantidad, subtotal, producto_nombre, variantes_producto(productos(nombre, categorias(nombre))), historico_pedidos!inner(creado_en)',
          )
          .gte('historico_pedidos.creado_en', desdeISO)
          .lte('historico_pedidos.creado_en', hastaISO)
          .range(desde, hasta),
      ),
    ]);

    for (const item of itemsVivos as any[]) {
      articulosVendidos += item.cantidad;
      const producto = item.variantes_producto?.productos;
      const nombreProducto =
        producto?.nombre ?? item.nombre_personalizado ?? 'Personalizado';
      const nombreCategoria = producto?.categorias?.nombre ?? 'Personalizado';
      this.acumularProducto(porProducto, nombreProducto, item.cantidad, item.subtotal);
      this.acumularProducto(porCategoria, nombreCategoria, item.cantidad, item.subtotal);
    }

    for (const item of itemsHistoricos as any[]) {
      articulosVendidos += item.cantidad;
      const productoCatalogo = item.variantes_producto?.productos;
      const nombreProducto = productoCatalogo?.nombre ?? item.producto_nombre;
      const nombreCategoria = productoCatalogo?.categorias?.nombre ?? 'Personalizado';
      this.acumularProducto(porProducto, nombreProducto, item.cantidad, item.subtotal);
      this.acumularProducto(porCategoria, nombreCategoria, item.cantidad, item.subtotal);
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

  private acumularProducto(
    mapa: Map<string, { cantidad: number; total: number }>,
    clave: string,
    cantidad: number,
    total: number,
  ) {
    const actual = mapa.get(clave) ?? { cantidad: 0, total: 0 };
    actual.cantidad += cantidad;
    actual.total += total;
    mapa.set(clave, actual);
  }

  private serializarMapa(mapa: Map<string, Acumulador>): InformeDesgloseDto[] {
    return [...mapa.entries()]
      .map(([clave, v]) => ({ clave, ...v }))
      .sort((a, b) => b.total - a.total);
  }

  /**
   * Rangos largos (histórico incluido) no se pueden mostrar barra-por-día
   * sin romper el gráfico — a partir de ~2 meses se agrupa por mes.
   */
  private resolverGranularidad(desde: string, hasta: string): Granularidad {
    return this.contarDias(desde, hasta) > 62 ? 'mes' : 'dia';
  }

  private claveBucket(fechaIso: string, granularidad: Granularidad): string {
    return granularidad === 'mes' ? fechaIso.slice(0, 7) : fechaIso.slice(0, 10);
  }

  private serializarSerie(
    porBucket: Map<string, Acumulador>,
    desde: string,
    hasta: string,
    granularidad: Granularidad,
  ): InformeDiaDto[] {
    const resultado: InformeDiaDto[] = [];
    if (granularidad === 'dia') {
      let cursor = new Date(`${desde}T00:00:00`);
      const fin = new Date(`${hasta}T00:00:00`);
      while (cursor <= fin) {
        const fecha = this.formatearFecha(cursor);
        const datos = porBucket.get(fecha) ?? { total: 0, pedidos: 0 };
        resultado.push({ fecha, ...datos });
        cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
      }
    } else {
      let cursor = new Date(`${desde.slice(0, 7)}-01T00:00:00`);
      const fin = new Date(`${hasta.slice(0, 7)}-01T00:00:00`);
      while (cursor <= fin) {
        const fecha = cursor.toISOString().slice(0, 7);
        const datos = porBucket.get(fecha) ?? { total: 0, pedidos: 0 };
        resultado.push({ fecha, ...datos });
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      }
    }
    return resultado;
  }

  private serializarSerieClientes(
    porBucket: Map<string, number>,
    desde: string,
    hasta: string,
    granularidad: Granularidad,
  ): InformeClienteDiaDto[] {
    const resultado: InformeClienteDiaDto[] = [];
    if (granularidad === 'dia') {
      let cursor = new Date(`${desde}T00:00:00`);
      const fin = new Date(`${hasta}T00:00:00`);
      while (cursor <= fin) {
        const fecha = this.formatearFecha(cursor);
        resultado.push({ fecha, nuevos: porBucket.get(fecha) ?? 0 });
        cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
      }
    } else {
      let cursor = new Date(`${desde.slice(0, 7)}-01T00:00:00`);
      const fin = new Date(`${hasta.slice(0, 7)}-01T00:00:00`);
      while (cursor <= fin) {
        const fecha = cursor.toISOString().slice(0, 7);
        resultado.push({ fecha, nuevos: porBucket.get(fecha) ?? 0 });
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      }
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
