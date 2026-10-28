import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { errorDeBase } from '../common/error-de-base';
import { MENSAJE_DERIVACION } from '../mensajeria/aviso-equipo.service';
import {
  agregarMetricasBot,
  TEXTOS_REPETIR,
} from './metricas-bot';
import type { SupabaseClient } from '@supabase/supabase-js';
import { acumular, acumularProducto, serializarMapa } from './informes-agregados';
import {
  resolverGranularidad,
  claveBucket,
  serializarSerie,
  serializarSerieClientes,
  resolverRango,
  contarDias,
} from './informes-fechas';
import {
  type Acumulador,
  type Granularidad,
  type InformeClienteListaDto,
  type InformeClientesDto,
  MAX_LISTA_CLIENTES,
  type InformeDto,
} from './informes.tipos';


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
    const { desde, hasta, desdeISO, hastaISO } = resolverRango(
      desdeInput,
      hastaInput,
    );
    const client = this.supabase.getClient();
    const granularidad = resolverGranularidad(desde, hasta);

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
      acumular(porBucket, claveBucket(p.creado_en, granularidad), p.total);
      acumular(porMetodo, p.metodo_pago, p.total);
      acumular(porModalidad, p.modalidad, p.total);
      acumular(porCanal, p.canal, p.total);
    }

    const diasEnRango = contarDias(desde, hasta);

    const { topProductos, porCategoria, articulosVendidos } =
      await this.calcularItems(client, desdeISO, hastaISO);

    const bot = await this.calcularBot(
      client,
      desde,
      hasta,
      desdeISO,
      hastaISO,
      granularidad,
    );

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
      serie_diaria: serializarSerie(porBucket, desde, hasta, granularidad),
      por_metodo_pago: serializarMapa(porMetodo),
      por_modalidad: serializarMapa(porModalidad),
      por_canal: serializarMapa(porCanal),
      top_productos: topProductos,
      por_categoria: porCategoria,
      clientes,
      bot,
    };
  }

  /**
   * Métricas del bot de WhatsApp en el rango: conversaciones con mensajes
   * del cliente, pedidos canal 'whatsapp' (incluye cancelados para el
   * embudo), derivaciones, toques de "repetir" y recompras enviadas.
   */
  private async calcularBot(
    client: SupabaseClient,
    desde: string,
    hasta: string,
    desdeISO: string,
    hastaISO: string,
    granularidad: Granularidad,
  ): Promise<InformeDto['bot']> {
    const contar = async (
      consulta: PromiseLike<{
        count: number | null;
        error: { message: string } | null;
      }>,
    ): Promise<number> => {
      const { count, error } = await consulta;
      if (error) throw errorDeBase(error);
      return count ?? 0;
    };

    const [pedidos, entrantes, derivaciones, repetirToques, recompras] =
      await Promise.all([
        this.paginarTodo<{
          total: number;
          estado: string;
          created_at: string;
          programado_para: string | null;
          comprobante_recibido_en: string | null;
        }>((d, h) =>
          client
            .from('pedidos')
            .select(
              'total, estado, created_at, programado_para, comprobante_recibido_en',
            )
            .eq('canal', 'whatsapp')
            .gte('created_at', desdeISO)
            .lte('created_at', hastaISO)
            .range(d, h),
        ),
        this.paginarTodo<{ conversacion_id: string }>((d, h) =>
          client
            .from('mensajes_conversacion')
            .select('conversacion_id')
            .eq('direccion', 'entrante')
            .gte('created_at', desdeISO)
            .lte('created_at', hastaISO)
            .range(d, h),
        ),
        contar(
          client
            .from('mensajes_conversacion')
            .select('id', { count: 'exact', head: true })
            .eq('direccion', 'saliente_bot')
            .eq('texto', MENSAJE_DERIVACION)
            .gte('created_at', desdeISO)
            .lte('created_at', hastaISO),
        ),
        contar(
          client
            .from('mensajes_conversacion')
            .select('id', { count: 'exact', head: true })
            .eq('direccion', 'entrante')
            .in('texto', TEXTOS_REPETIR)
            .gte('created_at', desdeISO)
            .lte('created_at', hastaISO),
        ),
        contar(
          client
            .from('pedidos')
            .select('id', { count: 'exact', head: true })
            .gte('recompra_enviada_en', desdeISO)
            .lte('recompra_enviada_en', hastaISO),
        ),
      ]);

    const porBucket = new Map<string, Acumulador>();
    for (const p of pedidos) {
      if (p.estado === 'cancelado') continue;
      acumular(
        porBucket,
        claveBucket(p.created_at, granularidad),
        Number(p.total),
      );
    }

    return {
      ...agregarMetricasBot({
        pedidos: pedidos.map((p) => ({
          total: Number(p.total),
          estado: p.estado,
          reserva: Boolean(p.programado_para),
          comprobante: Boolean(p.comprobante_recibido_en),
        })),
        conversacionesConMensaje: entrantes.map((m) => m.conversacion_id),
        derivaciones,
        repetirToques,
        recomprasEnviadas: recompras,
      }),
      serie_diaria: serializarSerie(porBucket, desde, hasta, granularidad),
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
        serie_diaria_nuevos: serializarSerieClientes(
          new Map(),
          desde,
          hasta,
          granularidad,
        ),
        top_clientes: [],
        lista_nuevos: [],
        lista_recurrentes: [],
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
    const listaNuevos: InformeClienteListaDto[] = [];
    const listaRecurrentes: InformeClienteListaDto[] = [];

    for (const telefono of telefonos) {
      const info = primeraCompra.get(telefono);
      if (!info) continue;
      const stats = porClienteActivo.get(telefono) ?? { pedidos: 0, total: 0 };
      const cliente: InformeClienteListaDto = {
        id: telefono,
        nombre: info.nombre || 'Cliente',
        telefono,
        pedidos: stats.pedidos,
        total: stats.total,
        primera_compra: info.fecha,
      };
      const esNuevo = new Date(info.fecha).getTime() >= desdeMs;
      if (esNuevo) {
        nuevos += 1;
        listaNuevos.push(cliente);
        const bucket = claveBucket(info.fecha, granularidad);
        porBucketAltas.set(bucket, (porBucketAltas.get(bucket) ?? 0) + 1);
      } else {
        recurrentes += 1;
        listaRecurrentes.push(cliente);
      }
    }

    listaNuevos.sort(
      (a, b) =>
        new Date(b.primera_compra).getTime() -
        new Date(a.primera_compra).getTime(),
    );
    listaRecurrentes.sort((a, b) => b.total - a.total);

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
      serie_diaria_nuevos: serializarSerieClientes(
        porBucketAltas,
        desde,
        hasta,
        granularidad,
      ),
      top_clientes: topClientes,
      lista_nuevos: listaNuevos.slice(0, MAX_LISTA_CLIENTES),
      lista_recurrentes: listaRecurrentes.slice(0, MAX_LISTA_CLIENTES),
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
      if (error) throw errorDeBase(error);
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
      if (error) throw errorDeBase(error);
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
      acumularProducto(porProducto, nombreProducto, item.cantidad, item.subtotal);
      acumularProducto(porCategoria, nombreCategoria, item.cantidad, item.subtotal);
    }

    for (const item of itemsHistoricos as any[]) {
      articulosVendidos += item.cantidad;
      const productoCatalogo = item.variantes_producto?.productos;
      const nombreProducto = productoCatalogo?.nombre ?? item.producto_nombre;
      const nombreCategoria = productoCatalogo?.categorias?.nombre ?? 'Personalizado';
      acumularProducto(porProducto, nombreProducto, item.cantidad, item.subtotal);
      acumularProducto(porCategoria, nombreCategoria, item.cantidad, item.subtotal);
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
}
