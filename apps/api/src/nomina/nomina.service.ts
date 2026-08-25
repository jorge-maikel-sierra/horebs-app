import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { EMPLEADO_SELECT, EmpleadosService, type EmpleadoDto } from './empleados.service';
import { calcularSemana, hoyBogota } from './semana-utils';

export interface AsistenciaDiaDto {
  fecha: string;
  trabajo: boolean;
  motivo: string | null;
}

export interface AdelantoDto {
  id: string;
  empleado_id: string;
  nomina_semana_id: string;
  monto: number;
  fecha: string;
  motivo: string | null;
}

export interface SemanaNominaDto {
  id: string;
  empleado_id: string;
  semana_inicio: string;
  semana_fin: string;
  monto_base: number;
  dias_esperados: number;
  dias_trabajados: number;
  total_adelantos: number;
  neto_pagar: number;
  saldo_pendiente: number;
  estado: 'en_curso' | 'liquidada';
  liquidada_en: string | null;
  notas: string | null;
  asistencia: AsistenciaDiaDto[];
  adelantos: AdelantoDto[];
}

export interface TableroFilaDto {
  empleado: EmpleadoDto;
  semana: SemanaNominaDto;
}

export interface RegistrarAdelantoInput {
  empleado_id: string;
  monto: number;
  fecha: string;
  motivo?: string;
}

interface SemanaRaw {
  id: string;
  empleado_id: string;
  semana_inicio: string;
  semana_fin: string;
  monto_base: number;
  dias_esperados: number;
  dias_trabajados: number | null;
  total_adelantos: number | null;
  neto_pagar: number | null;
  estado: 'en_curso' | 'liquidada';
  liquidada_en: string | null;
  notas: string | null;
}

const SEMANA_SELECT =
  'id, empleado_id, semana_inicio, semana_fin, monto_base, dias_esperados, dias_trabajados, total_adelantos, neto_pagar, estado, liquidada_en, notas';

@Injectable()
export class NominaService {
  private readonly logger = new Logger(NominaService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly empleadosService: EmpleadosService,
  ) {}

  async listarTableroSemanaActual(fechaYMD?: string): Promise<TableroFilaDto[]> {
    const empleados = await this.empleadosService.listar(true);
    const fecha = fechaYMD ?? hoyBogota();
    const client = this.supabase.getClient();

    return Promise.all(
      empleados.map(async (empleado) => {
        const semanaRaw = await this.buscarOCrearSemana(client, empleado, fecha);
        const semana = await this.enriquecerSemana(client, semanaRaw);
        return { empleado, semana };
      }),
    );
  }

  async obtenerSemana(id: string): Promise<SemanaNominaDto> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('nomina_semanas')
      .select(SEMANA_SELECT)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException('Semana de nómina no encontrada.');
    return this.enriquecerSemana(client, data);
  }

  async marcarAsistencia(
    semanaId: string,
    fecha: string,
    trabajo: boolean,
    motivo: string | undefined,
    usuarioId: string,
  ): Promise<void> {
    const client = this.supabase.getClient();
    const semana = await this.obtenerSemanaRaw(client, semanaId);
    if (semana.estado === 'liquidada') {
      throw new BadRequestException('Esa semana ya está liquidada, no se puede editar la asistencia.');
    }
    if (fecha < semana.semana_inicio || fecha > semana.semana_fin) {
      throw new BadRequestException('La fecha no pertenece a esa semana.');
    }

    const { error } = await client.from('asistencia_nomina').upsert(
      {
        nomina_semana_id: semanaId,
        fecha,
        trabajo,
        motivo: motivo?.trim() || null,
        registrado_por: usuarioId,
      },
      { onConflict: 'nomina_semana_id,fecha' },
    );
    if (error) throw error;
  }

  async registrarAdelanto(input: RegistrarAdelantoInput, usuarioId: string): Promise<AdelantoDto> {
    if (typeof input.monto !== 'number' || input.monto <= 0) {
      throw new BadRequestException('El monto del adelanto debe ser mayor a cero.');
    }
    if (!input.fecha) {
      throw new BadRequestException('Falta la fecha del adelanto.');
    }

    const client = this.supabase.getClient();
    const { data: empleado, error: empleadoError } = await client
      .from('empleados')
      .select(EMPLEADO_SELECT)
      .eq('id', input.empleado_id)
      .maybeSingle();
    if (empleadoError) throw empleadoError;
    if (!empleado) throw new NotFoundException('Trabajador no encontrado.');

    const semana = await this.buscarOCrearSemana(client, empleado, input.fecha);
    if (semana.estado === 'liquidada') {
      throw new BadRequestException('Esa semana ya está liquidada, no se puede registrar un adelanto.');
    }

    const { data, error } = await client
      .from('adelantos_nomina')
      .insert({
        empleado_id: input.empleado_id,
        nomina_semana_id: semana.id,
        monto: input.monto,
        fecha: input.fecha,
        motivo: input.motivo?.trim() || null,
        registrado_por: usuarioId,
      })
      .select('id, empleado_id, nomina_semana_id, monto, fecha, motivo')
      .single();
    if (error) throw error;
    return data;
  }

  async eliminarAdelanto(id: string): Promise<void> {
    const client = this.supabase.getClient();
    const { data: adelanto, error: adelantoError } = await client
      .from('adelantos_nomina')
      .select('id, nomina_semana_id')
      .eq('id', id)
      .maybeSingle();
    if (adelantoError) throw adelantoError;
    if (!adelanto) throw new NotFoundException('Adelanto no encontrado.');

    const semana = await this.obtenerSemanaRaw(client, adelanto.nomina_semana_id);
    if (semana.estado === 'liquidada') {
      throw new BadRequestException('Esa semana ya está liquidada, no se puede eliminar el adelanto.');
    }

    const { error } = await client.from('adelantos_nomina').delete().eq('id', id);
    if (error) throw error;
  }

  async liquidar(semanaId: string, usuarioId: string, notas: string | undefined): Promise<SemanaNominaDto> {
    const client = this.supabase.getClient();
    const { data, error } = await client.rpc('liquidar_semana_nomina', {
      p_semana_id: semanaId,
      p_liquidada_por: usuarioId,
      p_notas: notas?.trim() || null,
    });
    if (error) {
      if (error.message?.includes('no existe')) {
        throw new NotFoundException('Semana de nómina no encontrada.');
      }
      if (error.message?.includes('ya está liquidada')) {
        throw new BadRequestException('Esa semana ya fue liquidada.');
      }
      this.logger.error(`liquidar_semana_nomina falló para ${semanaId}: ${error.message}`);
      throw new BadRequestException('No se pudo liquidar la semana.');
    }
    return this.enriquecerSemana(client, data);
  }

  async obtenerHistoricoEmpleado(empleadoId: string, limite = 52): Promise<SemanaNominaDto[]> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('nomina_semanas')
      .select(SEMANA_SELECT)
      .eq('empleado_id', empleadoId)
      .order('semana_inicio', { ascending: false })
      .limit(limite);
    if (error) throw error;
    return Promise.all((data ?? []).map((semana) => this.enriquecerSemana(client, semana)));
  }

  async obtenerMiSemanaActual(usuarioId: string): Promise<SemanaNominaDto | null> {
    const client = this.supabase.getClient();
    const empleado = await this.buscarEmpleadoPorUsuario(client, usuarioId);
    if (!empleado) return null;

    const semanaRaw = await this.buscarOCrearSemana(client, empleado, hoyBogota());
    return this.enriquecerSemana(client, semanaRaw);
  }

  async listarMiHistorico(usuarioId: string, limite = 12): Promise<SemanaNominaDto[]> {
    const client = this.supabase.getClient();
    const empleado = await this.buscarEmpleadoPorUsuario(client, usuarioId);
    if (!empleado) return [];
    return this.obtenerHistoricoEmpleado(empleado.id, limite);
  }

  private async buscarEmpleadoPorUsuario(
    client: SupabaseClient,
    usuarioId: string,
  ): Promise<EmpleadoDto | null> {
    const { data, error } = await client
      .from('empleados')
      .select(EMPLEADO_SELECT)
      .eq('usuario_id', usuarioId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  private async obtenerSemanaRaw(client: SupabaseClient, semanaId: string): Promise<SemanaRaw> {
    const { data, error } = await client
      .from('nomina_semanas')
      .select(SEMANA_SELECT)
      .eq('id', semanaId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException('Semana de nómina no encontrada.');
    return data;
  }

  private async buscarOCrearSemana(
    client: SupabaseClient,
    empleado: EmpleadoDto,
    fechaYMD: string,
  ): Promise<SemanaRaw> {
    const { inicio, fin } = calcularSemana(fechaYMD);

    const { data: existente, error: buscarError } = await client
      .from('nomina_semanas')
      .select(SEMANA_SELECT)
      .eq('empleado_id', empleado.id)
      .eq('semana_inicio', inicio)
      .maybeSingle();
    if (buscarError) throw buscarError;
    if (existente) return existente;

    const { data: creada, error: crearError } = await client
      .from('nomina_semanas')
      .insert({
        empleado_id: empleado.id,
        semana_inicio: inicio,
        semana_fin: fin,
        monto_base: empleado.monto_semanal,
        dias_esperados: empleado.dias_esperados_semana,
      })
      .select(SEMANA_SELECT)
      .single();
    if (!crearError) return creada;

    // Carrera: otra request ya creó la misma semana entre el select y el
    // insert (índice único empleado_id+semana_inicio) — se relee en vez
    // de fallar.
    if (crearError.code === '23505') {
      const { data: reintento, error: reintentoError } = await client
        .from('nomina_semanas')
        .select(SEMANA_SELECT)
        .eq('empleado_id', empleado.id)
        .eq('semana_inicio', inicio)
        .single();
      if (reintentoError) throw reintentoError;
      return reintento;
    }
    throw crearError;
  }

  private async enriquecerSemana(client: SupabaseClient, semana: SemanaRaw): Promise<SemanaNominaDto> {
    const [{ data: asistencia, error: asistenciaError }, { data: adelantos, error: adelantosError }] =
      await Promise.all([
        client
          .from('asistencia_nomina')
          .select('fecha, trabajo, motivo')
          .eq('nomina_semana_id', semana.id)
          .order('fecha'),
        client
          .from('adelantos_nomina')
          .select('id, empleado_id, nomina_semana_id, monto, fecha, motivo')
          .eq('nomina_semana_id', semana.id)
          .order('fecha'),
      ]);
    if (asistenciaError) throw asistenciaError;
    if (adelantosError) throw adelantosError;

    let diasTrabajados = semana.dias_trabajados;
    let totalAdelantos = semana.total_adelantos;
    let netoPagar = semana.neto_pagar;

    if (semana.estado === 'en_curso') {
      diasTrabajados = (asistencia ?? []).filter((a) => a.trabajo).length;
      const adelantosEnCurso = (adelantos ?? []).reduce((acc, a) => acc + a.monto, 0);
      totalAdelantos = adelantosEnCurso;
      const bruto = Math.round((semana.monto_base / semana.dias_esperados) * diasTrabajados);
      netoPagar = Math.max(0, bruto - adelantosEnCurso);
    }

    const bruto = Math.round((semana.monto_base / semana.dias_esperados) * (diasTrabajados ?? 0));
    const saldoPendiente = Math.max(0, (totalAdelantos ?? 0) - bruto);

    return {
      ...semana,
      dias_trabajados: diasTrabajados ?? 0,
      total_adelantos: totalAdelantos ?? 0,
      neto_pagar: netoPagar ?? 0,
      saldo_pendiente: saldoPendiente,
      asistencia: asistencia ?? [],
      adelantos: adelantos ?? [],
    };
  }
}
