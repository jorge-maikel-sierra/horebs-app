import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';
import { MailService } from '../mail/mail.service';

export interface ConfiguracionPuntos {
  puntosPor1000Pesos: number;
  valorPuntoPesos: number;
  puntosMinimoCanje: number;
  puntosVencimientoMeses: number;
}

export interface CanjeCalculado {
  puntos: number;
  descuento: number;
}

export interface MovimientoPuntosDto {
  id: string;
  tipo: 'ganado' | 'canjeado' | 'vencido' | 'ajuste';
  puntos: number;
  referencia_tipo: string | null;
  referencia_id: string | null;
  motivo: string | null;
  created_at: string;
}

const CLAVE_PUNTOS_POR_1000 = 'puntos_por_1000_pesos';
const CLAVE_VALOR_PUNTO = 'valor_punto_pesos';
const CLAVE_MINIMO_CANJE = 'puntos_minimo_canje';
const CLAVE_VENCIMIENTO_MESES = 'puntos_vencimiento_meses';

// Mismos valores que trae la migración — solo entran en juego si por algún
// motivo las filas de configuracion no existen.
const DEFECTOS: ConfiguracionPuntos = {
  puntosPor1000Pesos: 1,
  valorPuntoPesos: 50,
  puntosMinimoCanje: 100,
  puntosVencimientoMeses: 12,
};

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
      .in('clave', [
        CLAVE_PUNTOS_POR_1000,
        CLAVE_VALOR_PUNTO,
        CLAVE_MINIMO_CANJE,
        CLAVE_VENCIMIENTO_MESES,
      ]);
    if (error) throw error;

    const mapa = new Map((data ?? []).map((f) => [f.clave, f.valor]));
    const num = (clave: string, defecto: number) => {
      const v = Number(mapa.get(clave));
      return Number.isFinite(v) && v >= 0 ? v : defecto;
    };

    return {
      puntosPor1000Pesos: num(
        CLAVE_PUNTOS_POR_1000,
        DEFECTOS.puntosPor1000Pesos,
      ),
      valorPuntoPesos: num(CLAVE_VALOR_PUNTO, DEFECTOS.valorPuntoPesos),
      puntosMinimoCanje: num(CLAVE_MINIMO_CANJE, DEFECTOS.puntosMinimoCanje),
      puntosVencimientoMeses: num(
        CLAVE_VENCIMIENTO_MESES,
        DEFECTOS.puntosVencimientoMeses,
      ),
    };
  }

  async actualizarConfiguracion(
    cambios: Partial<ConfiguracionPuntos>,
  ): Promise<void> {
    const filas: { clave: string; valor: string }[] = [];
    if (cambios.puntosPor1000Pesos !== undefined) {
      if (cambios.puntosPor1000Pesos < 0)
        throw new BadRequestException('Valor inválido.');
      filas.push({
        clave: CLAVE_PUNTOS_POR_1000,
        valor: String(cambios.puntosPor1000Pesos),
      });
    }
    if (cambios.valorPuntoPesos !== undefined) {
      if (cambios.valorPuntoPesos < 0)
        throw new BadRequestException('Valor inválido.');
      filas.push({
        clave: CLAVE_VALOR_PUNTO,
        valor: String(cambios.valorPuntoPesos),
      });
    }
    if (cambios.puntosMinimoCanje !== undefined) {
      if (cambios.puntosMinimoCanje < 0)
        throw new BadRequestException('Valor inválido.');
      filas.push({
        clave: CLAVE_MINIMO_CANJE,
        valor: String(cambios.puntosMinimoCanje),
      });
    }
    if (cambios.puntosVencimientoMeses !== undefined) {
      if (cambios.puntosVencimientoMeses < 0)
        throw new BadRequestException('Valor inválido.');
      filas.push({
        clave: CLAVE_VENCIMIENTO_MESES,
        valor: String(cambios.puntosVencimientoMeses),
      });
    }
    if (filas.length === 0) return;

    const { error } = await this.supabase
      .getClient()
      .from('configuracion')
      .upsert(filas, { onConflict: 'clave' });
    if (error) throw error;
  }

  async obtenerSaldoPorTelefono(telefono: string): Promise<{
    nombre: string;
    puntos: number;
    valorPuntoPesos: number;
    puntosMinimoCanje: number;
  } | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('clientes')
      .select('nombre, puntos_actuales')
      .eq('telefono', telefono)
      .maybeSingle();
    if (error) throw error;
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
      .single();
    if (error) throw error;

    const config = await this.obtenerConfiguracion();
    const saldo = data.puntos_actuales;
    if (saldo < config.puntosMinimoCanje) return { puntos: 0, descuento: 0 };

    const maxPorMonto = Math.floor(montoDisponible / config.valorPuntoPesos);
    const puntos = Math.max(0, Math.min(saldo, maxPorMonto));
    return { puntos, descuento: puntos * config.valorPuntoPesos };
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
    const { error } = await this.supabase
      .getClient()
      .rpc('aplicar_movimiento_puntos', {
        p_cliente_id: clienteId,
        p_tipo: 'canjeado',
        p_puntos: -puntos,
        p_referencia_tipo: 'pedido',
        p_referencia_id: pedidoId,
        p_motivo: null,
        p_created_by: null,
        p_actualizar_actividad: false,
      });
    if (error) throw error;
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
      const puntos = Math.floor(montoPagado / 1000) * config.puntosPor1000Pesos;
      if (puntos <= 0) return 0;

      const { error } = await this.supabase
        .getClient()
        .rpc('aplicar_movimiento_puntos', {
          p_cliente_id: clienteId,
          p_tipo: 'ganado',
          p_puntos: puntos,
          p_referencia_tipo: 'pedido',
          p_referencia_id: pedidoId,
          p_motivo: null,
          p_created_by: null,
          p_actualizar_actividad: true,
        });
      if (error) throw error;

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

  async ajustarPuntos(
    clienteId: string,
    puntos: number,
    motivo: string,
    usuarioId: string,
  ): Promise<number> {
    if (!Number.isFinite(puntos) || puntos === 0) {
      throw new BadRequestException(
        'La cantidad del ajuste no puede ser cero.',
      );
    }
    if (!motivo?.trim()) {
      throw new BadRequestException('Falta el motivo del ajuste.');
    }
    const { data, error } = await this.supabase
      .getClient()
      .rpc('aplicar_movimiento_puntos', {
        p_cliente_id: clienteId,
        p_tipo: 'ajuste',
        p_puntos: Math.round(puntos),
        p_referencia_tipo: 'ajuste_manual',
        p_referencia_id: null,
        p_motivo: motivo.trim(),
        p_created_by: usuarioId,
        p_actualizar_actividad: false,
      });
    if (error) {
      if (error.message?.includes('no existe')) {
        throw new BadRequestException('Cliente no encontrado.');
      }
      if (error.message?.includes('negativo')) {
        throw new BadRequestException(
          'El ajuste dejaría el saldo de puntos en negativo.',
        );
      }
      throw error;
    }
    return data as number;
  }

  async listarMovimientos(
    clienteId: string,
    limit = 50,
  ): Promise<MovimientoPuntosDto[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('movimientos_puntos')
      .select(
        'id, tipo, puntos, referencia_tipo, referencia_id, motivo, created_at',
      )
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  /**
   * Vence el saldo completo de cualquier cliente cuya última compra que
   * generó puntos haya sido hace más de puntosVencimientoMeses. Pensado
   * para correr una vez al día desde un @Cron, no desde un request.
   */
  // Nombre explícito: @nestjs/schedule genera uno con crypto.randomUUID()
  // si no se lo damos, y ese global no existe en el Node 18 de Railway.
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
    const config = await this.obtenerConfiguracion();
    const limite = new Date();
    limite.setMonth(limite.getMonth() - config.puntosVencimientoMeses);

    const { data, error } = await this.supabase
      .getClient()
      .from('clientes')
      .select('id, puntos_actuales')
      .gt('puntos_actuales', 0)
      .lt('puntos_ultima_actividad', limite.toISOString());
    if (error) throw error;

    let vencidos = 0;
    for (const cliente of data ?? []) {
      const { error: rpcError } = await this.supabase
        .getClient()
        .rpc('aplicar_movimiento_puntos', {
          p_cliente_id: cliente.id,
          p_tipo: 'vencido',
          p_puntos: -cliente.puntos_actuales,
          p_referencia_tipo: 'vencimiento',
          p_referencia_id: null,
          p_motivo: `Vencimiento por ${config.puntosVencimientoMeses} meses de inactividad`,
          p_created_by: null,
          p_actualizar_actividad: false,
        });
      if (rpcError) {
        this.logger.error(
          `No se pudo vencer puntos del cliente ${cliente.id}: ${rpcError.message}`,
        );
        continue;
      }
      vencidos++;
    }
    return vencidos;
  }
}
