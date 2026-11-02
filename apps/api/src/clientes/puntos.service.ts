import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';
import { MailService } from '../mail/mail.service';
import { errorDeBase } from '../common/error-de-base';
import {
  CLAVES_PUNTOS,
  canjeMaximo,
  configuracionDeFilas,
  errorDeAjuste,
  filasDeConfiguracion,
  limiteDeVencimiento,
  paramsMovimientoPuntos,
  puntosPorMonto,
  validarAjustePuntos,
} from './puntos-reglas';
import {
  LIMITE_MOVIMIENTOS_DEFECTO,
  MOVIMIENTO_PUNTOS_SELECT,
  type CanjeCalculado,
  type ConfiguracionPuntos,
  type FilaConfiguracion,
  type FilaPuntosCliente,
  type FilaSaldoCliente,
  type MovimientoPuntosDto,
  type MovimientoPuntosInput,
  type SaldoPuntosDto,
} from './puntos.tipos';

export type * from './puntos.tipos';
export { puntosPorMonto };

interface RespuestaMovimiento {
  data: unknown;
  error: { message: string } | null;
}

/**
 * Programa de fidelidad: puntos por dinero gastado, canjeables por
 * descuento en pesos. Ganar puntos nunca debe romper un checkout/venta —
 * los métodos "Seguro" atrapan el error y devuelven 0 en vez de propagar.
 * Canjear puntos si debe ser estricto: si falla, no se debe dar un
 * descuento que nunca se descontó del saldo real.
 */
@Injectable()
export class PuntosService {
  private readonly logger = new Logger(PuntosService.name);
  private venciendoPuntos = false;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly mail: MailService,
  ) {}

  async obtenerConfiguracion(): Promise<ConfiguracionPuntos> {
    const { data, error } = await this.supabase
      .getClient()
      .from('configuracion')
      .select('clave, valor')
      .in('clave', CLAVES_PUNTOS)
      .returns<FilaConfiguracion[]>();
    if (error) throw errorDeBase(error);
    return configuracionDeFilas(data ?? []);
  }

  async actualizarConfiguracion(
    cambios: Partial<ConfiguracionPuntos>,
  ): Promise<void> {
    const filas = filasDeConfiguracion(cambios);
    if (filas.length === 0) return;

    const { error } = await this.supabase
      .getClient()
      .from('configuracion')
      .upsert(filas, { onConflict: 'clave' });
    if (error) throw errorDeBase(error);
  }

  async obtenerSaldoPorTelefono(
    telefono: string,
  ): Promise<SaldoPuntosDto | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('clientes')
      .select('nombre, puntos_actuales')
      .eq('telefono', telefono)
      .maybeSingle<FilaSaldoCliente>();
    if (error) throw errorDeBase(error);
    if (!data) return null;

    const config = await this.obtenerConfiguracion();
    return {
      nombre: data.nombre,
      puntos: data.puntos_actuales,
      valorPuntoPesos: config.valorPuntoPesos,
      puntosMinimoCanje: config.puntosMinimoCanje,
    };
  }

  /**
   * Cuántos puntos se pueden usar (y cuánto descuento representan) sin
   * pasarse del saldo real del cliente ni del monto disponible del
   * pedido. No modifica nada — solo calcula, para poder mostrar el total
   * final antes de confirmar el pedido.
   */
  async calcularCanjeMaximo(
    clienteId: string,
    montoDisponible: number,
  ): Promise<CanjeCalculado> {
    const { data, error } = await this.supabase
      .getClient()
      .from('clientes')
      .select('puntos_actuales')
      .eq('id', clienteId)
      .single<Pick<FilaPuntosCliente, 'puntos_actuales'>>();
    if (error) throw errorDeBase(error);

    const config = await this.obtenerConfiguracion();
    return canjeMaximo(data.puntos_actuales, montoDisponible, config);
  }

  /**
   * Descuenta puntos ya calculados (calcularCanjeMaximo) y deja el
   * registro en el ledger. A propósito NO atrapa errores — si el saldo
   * cambió entre el cálculo y acá (carrera improbable, ej. dos pestañas),
   * el caller decide qué hacer con el pedido ya creado en vez de que se
   * pierda un descuento que nunca se descontó de verdad.
   */
  async registrarCanje(
    clienteId: string,
    puntos: number,
    pedidoId: string,
  ): Promise<void> {
    if (puntos <= 0) return;
    const { error } = await this.aplicarMovimiento({
      clienteId,
      tipo: 'canjeado',
      puntos: -puntos,
      referenciaTipo: 'pedido',
      referenciaId: pedidoId,
      motivo: null,
      creadoPor: null,
      actualizarActividad: false,
    });
    if (error) throw errorDeBase(error);
  }

  /**
   * Nunca debe romper un checkout — si falla, se loguea y no se otorgan
   * puntos en vez de tumbar la venta que ya se registró.
   */
  async otorgarPuntosPorCompraSeguro(
    clienteId: string,
    montoPagado: number,
    pedidoId: string,
  ): Promise<number> {
    try {
      const config = await this.obtenerConfiguracion();
      const puntos = puntosPorMonto(montoPagado, config);
      if (puntos <= 0) return 0;

      const { error } = await this.aplicarMovimiento({
        clienteId,
        tipo: 'ganado',
        puntos,
        referenciaTipo: 'pedido',
        referenciaId: pedidoId,
        motivo: null,
        creadoPor: null,
        actualizarActividad: true,
      });
      if (error) throw errorDeBase(error);

      // Se guarda en el pedido solo para trazabilidad histórica — la
      // fuente de verdad del saldo sigue siendo movimientos_puntos.
      await this.supabase
        .getClient()
        .from('pedidos')
        .update({ puntos_ganados: puntos })
        .eq('id', pedidoId);

      return puntos;
    } catch (err) {
      this.logger.error(
        `No se pudieron otorgar puntos para el pedido ${pedidoId}: ${(err as Error).message}`,
      );
      return 0;
    }
  }

  /**
   * Marca el pedido como puntos_status='pendiente' y avisa por correo —
   * mismo patrón que InventarioService.descontarPorVentaSeguro para el
   * stock. Se usa cuando registrarCanje falla DESPUÉS de que el pedido ya
   * se creó con el total ya descontado.
   */
  async marcarCanjePendiente(
    pedidoId: string,
    motivoError: string,
  ): Promise<void> {
    this.logger.error(
      `No se pudo aplicar el canje de puntos del pedido ${pedidoId}: ${motivoError}`,
    );
    const { error } = await this.supabase
      .getClient()
      .from('pedidos')
      .update({ puntos_status: 'pendiente' })
      .eq('id', pedidoId);
    if (error) {
      this.logger.error(
        `Encima no se pudo marcar puntos_status='pendiente' para ${pedidoId}: ${error.message}`,
      );
    }
    this.mail.enviarAlertaPuntosPendientes({ pedidoId, motivoError });
  }

  /** Devuelve el saldo de puntos que queda tras el ajuste. */
  async ajustarPuntos(
    clienteId: string,
    puntos: number,
    motivo: string,
    usuarioId: string,
  ): Promise<number> {
    validarAjustePuntos({ puntos, motivo });
    const respuesta = await this.aplicarMovimiento({
      clienteId,
      tipo: 'ajuste',
      puntos: Math.round(puntos),
      referenciaTipo: 'ajuste_manual',
      referenciaId: null,
      motivo: motivo.trim(),
      creadoPor: usuarioId,
      actualizarActividad: false,
    });
    if (respuesta.error) {
      throw (
        errorDeAjuste(respuesta.error.message) ?? errorDeBase(respuesta.error)
      );
    }
    return respuesta.data as number;
  }

  async listarMovimientos(
    clienteId: string,
    limit = LIMITE_MOVIMIENTOS_DEFECTO,
  ): Promise<MovimientoPuntosDto[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('movimientos_puntos')
      .select(MOVIMIENTO_PUNTOS_SELECT)
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false })
      .limit(limit)
      .returns<MovimientoPuntosDto[]>();
    if (error) throw errorDeBase(error);
    return data ?? [];
  }

  /**
   * Vence el saldo completo de cualquier cliente cuya última compra que
   * generó puntos haya sido hace más de puntosVencimientoMeses. Pensado
   * para correr una vez al día desde un @Cron, no desde un request.
   */
  // Nombre explícito, mismo criterio que seguimiento.service.ts: evita
  // depender del nombre autogenerado de @nestjs/schedule.
  @Cron('0 3 * * *', { name: 'vencer-puntos-inactivos' })
  async vencerPuntosInactivos(): Promise<number> {
    if (this.venciendoPuntos) {
      this.logger.warn(
        'La corrida anterior de vencimiento de puntos todavía está en curso — se salta este tick.',
      );
      return 0;
    }
    this.venciendoPuntos = true;
    try {
      return await this.vencerPuntosInactivosInterno();
    } finally {
      this.venciendoPuntos = false;
    }
  }

  private async vencerPuntosInactivosInterno(): Promise<number> {
    const { puntosVencimientoMeses } = await this.obtenerConfiguracion();
    const limite = limiteDeVencimiento(new Date(), puntosVencimientoMeses);

    const { data, error } = await this.supabase
      .getClient()
      .from('clientes')
      .select('id, puntos_actuales')
      .gt('puntos_actuales', 0)
      .lt('puntos_ultima_actividad', limite.toISOString())
      .returns<FilaPuntosCliente[]>();
    if (error) throw errorDeBase(error);

    let vencidos = 0;
    for (const cliente of data ?? []) {
      if (await this.vencerCliente(cliente, puntosVencimientoMeses)) vencidos++;
    }
    return vencidos;
  }

  private async vencerCliente(
    cliente: FilaPuntosCliente,
    meses: number,
  ): Promise<boolean> {
    const { error } = await this.aplicarMovimiento({
      clienteId: cliente.id,
      tipo: 'vencido',
      puntos: -cliente.puntos_actuales,
      referenciaTipo: 'vencimiento',
      referenciaId: null,
      motivo: `Vencimiento por ${meses} meses de inactividad`,
      creadoPor: null,
      actualizarActividad: false,
    });
    if (error) {
      this.logger.error(
        `No se pudo vencer puntos del cliente ${cliente.id}: ${error.message}`,
      );
    }
    return !error;
  }

  private async aplicarMovimiento(
    mov: MovimientoPuntosInput,
  ): Promise<RespuestaMovimiento> {
    return await this.supabase
      .getClient()
      .rpc('aplicar_movimiento_puntos', paramsMovimientoPuntos(mov));
  }
}
