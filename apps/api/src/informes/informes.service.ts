import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { errorDeBase } from '../common/error-de-base';
import { MENSAJE_DERIVACION } from '../mensajeria/aviso-equipo.service';
import { agregarMetricasBot, TEXTOS_REPETIR } from './metricas-bot';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  armarResumen,
  serieVentasBot,
  serializarCanales,
  serializarMapa,
  totalizarPedidos,
} from './informes-agregados';
import { armarInformeClientes, type ClienteFila } from './informes-clientes';
import {
  unificarPedidoHistorico,
  unificarPedidoVivo,
  type PedidoHistoricoFila,
  type PedidoVivoFila,
} from './informes-pedidos';
import {
  agregarItems,
  type ItemHistoricoFila,
  type ItemVivoFila,
  type ResumenItems,
} from './informes-items';
import {
  resolverGranularidad,
  serializarSerie,
  resolverRango,
  contarDias,
} from './informes-fechas';
import {
  type Granularidad,
  type InformeClientesDto,
  type InformeDto,
  type PedidoBotFila,
  type PedidoUnificado,
  type RangoInforme,
} from './informes.tipos';

// PostgREST devuelve hasta 1000 filas por request; la URL de un .in() aguanta ~200 teléfonos.
const TAMANO_PAGINA = 1000;
const TAMANO_TANDA_TELEFONOS = 200;

interface ClienteVivoRaw {
  telefono: string;
  nombre: string;
  apellido: string | null;
  created_at: string;
}

interface ClienteHistoricoRaw {
  telefono: string;
  nombre: string;
  apellido: string | null;
  primera_compra: string;
}

@Injectable()
export class InformesService {
  constructor(private readonly supabase: SupabaseService) {}

  async generar(desdeInput?: string, hastaInput?: string): Promise<InformeDto> {
    const rango = resolverRango(desdeInput, hastaInput);
    const { desde, hasta, desdeISO, hastaISO } = rango;
    const client = this.supabase.getClient();
    const granularidad = resolverGranularidad(desde, hasta);

    const [pedidosVivos, pedidosHistoricos] = await Promise.all([
      this.obtenerPedidosVivos(client, desdeISO, hastaISO),
      this.obtenerPedidosHistoricos(client, desdeISO, hastaISO),
    ]);
    const filas = [...pedidosVivos, ...pedidosHistoricos];
    const totales = totalizarPedidos(filas, granularidad);

    const items = await this.calcularItems(client, desdeISO, hastaISO);
    const bot = await this.calcularBot(client, rango, granularidad);
    const clientes = await this.calcularClientes(
      client,
      filas,
      rango,
      granularidad,
    );

    return {
      desde,
      hasta,
      granularidad,
      resumen: armarResumen(
        totales,
        filas.length,
        items.articulosVendidos,
        contarDias(desde, hasta),
      ),
      serie_diaria: serializarSerie(
        totales.porBucket,
        desde,
        hasta,
        granularidad,
      ),
      por_metodo_pago: serializarMapa(totales.porMetodo),
      por_modalidad: serializarMapa(totales.porModalidad),
      por_canal: serializarCanales(totales.porCanal),
      top_productos: items.topProductos,
      por_categoria: items.porCategoria,
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
    rango: RangoInforme,
    granularidad: Granularidad,
  ): Promise<InformeDto['bot']> {
    const [pedidos, entrantes, derivaciones, repetirToques, recompras] =
      await Promise.all([
        this.pedidosBot(client, rango),
        this.mensajesEntrantes(client, rango),
        this.contarMensajes(client, rango, 'saliente_bot', MENSAJE_DERIVACION),
        this.contarMensajes(client, rango, 'entrante', TEXTOS_REPETIR),
        this.contar(
          client
            .from('pedidos')
            .select('id', { count: 'exact', head: true })
            .gte('recompra_enviada_en', rango.desdeISO)
            .lte('recompra_enviada_en', rango.hastaISO),
        ),
      ]);

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
      serie_diaria: serializarSerie(
        serieVentasBot(pedidos, granularidad),
        rango.desde,
        rango.hasta,
        granularidad,
      ),
    };
  }

  /** Pedidos de los canales del bot (los cancelados cuentan para el embudo). */
  private pedidosBot(
    client: SupabaseClient,
    { desdeISO, hastaISO }: RangoInforme,
  ): Promise<PedidoBotFila[]> {
    return this.paginarTodo<PedidoBotFila>((d, h) =>
      client
        .from('pedidos')
        .select(
          'total, estado, created_at, programado_para, comprobante_recibido_en',
        )
        .in('canal', ['whatsapp', 'messenger', 'instagram'])
        .gte('created_at', desdeISO)
        .lte('created_at', hastaISO)
        .range(d, h),
    );
  }

  private mensajesEntrantes(
    client: SupabaseClient,
    { desdeISO, hastaISO }: RangoInforme,
  ): Promise<{ conversacion_id: string }[]> {
    return this.paginarTodo<{ conversacion_id: string }>((d, h) =>
      client
        .from('mensajes_conversacion')
        .select('conversacion_id')
        .eq('direccion', 'entrante')
        .gte('created_at', desdeISO)
        .lte('created_at', hastaISO)
        .range(d, h),
    );
  }

  /** Mensajes del rango en esa dirección con ese texto (o con uno de esos textos). */
  private contarMensajes(
    client: SupabaseClient,
    { desdeISO, hastaISO }: RangoInforme,
    direccion: string,
    texto: string | readonly string[],
  ): Promise<number> {
    const base = client
      .from('mensajes_conversacion')
      .select('id', { count: 'exact', head: true })
      .eq('direccion', direccion)
      .gte('created_at', desdeISO)
      .lte('created_at', hastaISO);
    return this.contar(
      typeof texto === 'string'
        ? base.eq('texto', texto)
        : base.in('texto', [...texto]),
    );
  }

  private async contar(
    consulta: PromiseLike<{
      count: number | null;
      error: { message: string } | null;
    }>,
  ): Promise<number> {
    const { count, error } = await consulta;
    if (error) throw errorDeBase(error);
    return count ?? 0;
  }

  private async obtenerPedidosVivos(
    client: SupabaseClient,
    desdeISO: string,
    hastaISO: string,
  ): Promise<PedidoUnificado[]> {
    const data = await this.paginarTodo<PedidoVivoFila>((desde, hasta) =>
      client
        .from('pedidos')
        .select(
          'id, total, costo_domicilio, metodo_pago, modalidad, canal, created_at, clientes(telefono, nombre, apellido)',
        )
        .neq('estado', 'cancelado')
        .gte('created_at', desdeISO)
        .lte('created_at', hastaISO)
        .range(desde, hasta)
        .returns<PedidoVivoFila[]>(),
    );
    return data.map(unificarPedidoVivo);
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
    const data = await this.paginarTodo<PedidoHistoricoFila>((desde, hasta) =>
      client
        .from('historico_pedidos')
        .select(
          'id, total, metodo_pago, modalidad, canal, creado_en, historico_clientes(telefono, nombre, apellido)',
        )
        .gte('creado_en', desdeISO)
        .lte('creado_en', hastaISO)
        .range(desde, hasta)
        .returns<PedidoHistoricoFila[]>(),
    );
    return data.map(unificarPedidoHistorico);
  }

  /**
   * Trae las fechas de primera compra de los teléfonos del rango (en vivo e
   * histórico) y delega la clasificación nuevo/recurrente a
   * `armarInformeClientes`.
   */
  private async calcularClientes(
    client: SupabaseClient,
    filas: PedidoUnificado[],
    rango: { desde: string; hasta: string; desdeISO: string },
    granularidad: Granularidad,
  ): Promise<InformeClientesDto> {
    const telefonos = [
      ...new Set(filas.map((p) => p.telefono).filter((t): t is string => !!t)),
    ];
    const [vivos, historicos] =
      telefonos.length === 0
        ? [[], []]
        : await Promise.all([
            this.buscarPorTelefonos<ClienteVivoRaw>(
              client,
              'clientes',
              'telefono, nombre, apellido, created_at',
              telefonos,
            ),
            this.buscarPorTelefonos<ClienteHistoricoRaw>(
              client,
              'historico_clientes',
              'telefono, nombre, apellido, primera_compra',
              telefonos,
            ),
          ]);
    const clientesVivos: ClienteFila[] = vivos.map((c) => ({
      ...c,
      fecha: c.created_at,
    }));
    const clientesHistoricos: ClienteFila[] = historicos.map((c) => ({
      ...c,
      fecha: c.primera_compra,
    }));
    return armarInformeClientes({
      filas,
      clientesVivos,
      clientesHistoricos,
      granularidad,
      ...rango,
    });
  }

  /**
   * PostgREST devuelve máximo 1000 filas por defecto — con el histórico
   * un rango amplio fácilmente supera eso, así que se pagina con .range()
   * hasta agotar los resultados.
   */
  private async paginarTodo<T>(
    build: (
      desde: number,
      hasta: number,
    ) => PromiseLike<{ data: T[] | null; error: unknown }>,
  ): Promise<T[]> {
    const resultado: T[] = [];
    for (let desde = 0; ; desde += TAMANO_PAGINA) {
      const { data, error } = await build(desde, desde + TAMANO_PAGINA - 1);
      if (error) throw errorDeBase(error);
      resultado.push(...(data ?? []));
      if (!data || data.length < TAMANO_PAGINA) break;
    }
    return resultado;
  }

  /**
   * .in('telefono', [...]) con miles de valores rompe la request (URL
   * demasiado larga) — se banca la lista de teléfonos en tandas.
   */
  private async buscarPorTelefonos<T>(
    client: SupabaseClient,
    tabla: string,
    select: string,
    telefonos: string[],
  ): Promise<T[]> {
    const resultado: T[] = [];
    for (let i = 0; i < telefonos.length; i += TAMANO_TANDA_TELEFONOS) {
      const tanda = telefonos.slice(i, i + TAMANO_TANDA_TELEFONOS);
      const { data, error } = await client
        .from(tabla)
        .select(select)
        .in('telefono', tanda)
        .returns<T[]>();
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
  private async calcularItems(
    client: SupabaseClient,
    desdeISO: string,
    hastaISO: string,
  ): Promise<ResumenItems> {
    const [vivos, historicos] = await Promise.all([
      this.paginarTodo<ItemVivoFila>((desde, hasta) =>
        client
          .from('items_pedido')
          .select(
            'cantidad, subtotal, nombre_personalizado, variantes_producto(nombre, productos(nombre, categorias(nombre))), pedidos!inner(created_at, estado)',
          )
          .neq('pedidos.estado', 'cancelado')
          .gte('pedidos.created_at', desdeISO)
          .lte('pedidos.created_at', hastaISO)
          .range(desde, hasta)
          .returns<ItemVivoFila[]>(),
      ),
      this.paginarTodo<ItemHistoricoFila>((desde, hasta) =>
        client
          .from('historico_items_pedido')
          .select(
            'cantidad, subtotal, producto_nombre, variantes_producto(productos(nombre, categorias(nombre))), historico_pedidos!inner(creado_en)',
          )
          .gte('historico_pedidos.creado_en', desdeISO)
          .lte('historico_pedidos.creado_en', hastaISO)
          .range(desde, hasta)
          .returns<ItemHistoricoFila[]>(),
      ),
    ]);
    return agregarItems(vivos, historicos);
  }
}
