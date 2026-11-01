import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { errorDeBase } from '../common/error-de-base';
import { SupabaseService } from '../supabase/supabase.service';
import {
  EMPLEADO_SELECT,
  EmpleadosService,
  type EmpleadoDto,
} from './empleados.service';
import {
  SEMANA_SELECT,
  type AdelantoDto,
  type AsistenciaDiaDto,
  type FilaAdelantoSemana,
  type MarcarAsistenciaInput,
  type RegistrarAdelantoInput,
  type SemanaNominaDto,
  type SemanaRaw,
  type TableroFilaDto,
} from './nomina.tipos';
import {
  exigirSemanaEnCurso,
  montosDeSemana,
  validarAdelanto,
  validarFechaEnSemana,
} from './reglas-semana';
import { calcularSemana, hoyBogota } from './semana-utils';

const ADELANTO_SELECT =
  'id, empleado_id, nomina_semana_id, monto, fecha, motivo';
/** Un año de semanas: lo que ve el admin del histórico de un trabajador. */
const SEMANAS_HISTORICO_ADMIN = 52;
/** Un trimestre: lo que ve el trabajador de su propio histórico. */
const SEMANAS_HISTORICO_PROPIO = 12;
const CODIGO_VIOLACION_UNICA = '23505';

@Injectable()
export class NominaService {
  private readonly logger = new Logger(NominaService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly empleadosService: EmpleadosService,
  ) {}

  async listarTableroSemanaActual(
    fechaYMD?: string,
  ): Promise<TableroFilaDto[]> {
    const empleados = await this.empleadosService.listar(true);
    const fecha = fechaYMD ?? hoyBogota();
    const client = this.supabase.getClient();

    return Promise.all(
      empleados.map(async (empleado) => {
        const semanaRaw = await this.buscarOCrearSemana(
          client,
          empleado,
          fecha,
        );
        const semana = await this.enriquecerSemana(client, semanaRaw);
        return { empleado, semana };
      }),
    );
  }

  async obtenerSemana(id: string): Promise<SemanaNominaDto> {
    const client = this.supabase.getClient();
    const semana = await this.obtenerSemanaRaw(client, id);
    return this.enriquecerSemana(client, semana);
  }

  async marcarAsistencia(asistencia: MarcarAsistenciaInput): Promise<void> {
    const client = this.supabase.getClient();
    const semana = await this.obtenerSemanaRaw(client, asistencia.semanaId);
    exigirSemanaEnCurso(semana, 'editar la asistencia');
    validarFechaEnSemana(semana, asistencia.fecha);

    const { error } = await client.from('asistencia_nomina').upsert(
      {
        nomina_semana_id: asistencia.semanaId,
        fecha: asistencia.fecha,
        trabajo: asistencia.trabajo,
        motivo: asistencia.motivo?.trim() || null,
        registrado_por: asistencia.usuarioId,
      },
      { onConflict: 'nomina_semana_id,fecha' },
    );
    if (error) throw errorDeBase(error);
  }

  async registrarAdelanto(
    input: RegistrarAdelantoInput,
    usuarioId: string,
  ): Promise<AdelantoDto> {
    validarAdelanto(input);

    const client = this.supabase.getClient();
    const empleado = await this.buscarEmpleadoPor(
      client,
      'id',
      input.empleado_id,
    );
    if (!empleado) throw new NotFoundException('Trabajador no encontrado.');

    const semana = await this.buscarOCrearSemana(client, empleado, input.fecha);
    exigirSemanaEnCurso(semana, 'registrar un adelanto');

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
      .select(ADELANTO_SELECT)
      .single<AdelantoDto>();
    if (error) throw errorDeBase(error);
    return data;
  }

  async eliminarAdelanto(id: string): Promise<void> {
    const client = this.supabase.getClient();
    const { data: adelanto, error: adelantoError } = await client
      .from('adelantos_nomina')
      .select('id, nomina_semana_id')
      .eq('id', id)
      .maybeSingle<FilaAdelantoSemana>();
    if (adelantoError) throw errorDeBase(adelantoError);
    if (!adelanto) throw new NotFoundException('Adelanto no encontrado.');

    const semana = await this.obtenerSemanaRaw(
      client,
      adelanto.nomina_semana_id,
    );
    exigirSemanaEnCurso(semana, 'eliminar el adelanto');

    const { error } = await client
      .from('adelantos_nomina')
      .delete()
      .eq('id', id);
    if (error) throw errorDeBase(error);
  }

  async liquidar(
    semanaId: string,
    usuarioId: string,
    notas: string | undefined,
  ): Promise<SemanaNominaDto> {
    const client = this.supabase.getClient();
    const respuesta = await client.rpc('liquidar_semana_nomina', {
      p_semana_id: semanaId,
      p_liquidada_por: usuarioId,
      p_notas: notas?.trim() || null,
    });
    const { error } = respuesta;
    if (error) {
      if (error.message.includes('no existe')) {
        throw new NotFoundException('Semana de nómina no encontrada.');
      }
      if (error.message.includes('ya está liquidada')) {
        throw new ConflictException('Esa semana ya fue liquidada.');
      }
      this.logger.error(
        `liquidar_semana_nomina falló para ${semanaId}: ${error.message}`,
      );
      throw errorDeBase(error);
    }
    // La función devuelve un registro `nomina_semanas` (no un conjunto), que
    // el cliente sin tipos de Supabase deja como `any`.
    return this.enriquecerSemana(client, respuesta.data as SemanaRaw);
  }

  /**
   * `PUT .../liquidacion`: dejar la semana liquidada es idempotente. Si ya
   * lo estaba, se devuelve la liquidación existente en vez de un 409.
   */
  async asegurarLiquidada(
    semanaId: string,
    usuarioId: string,
    notas: string | undefined,
  ): Promise<SemanaNominaDto> {
    try {
      return await this.liquidar(semanaId, usuarioId, notas);
    } catch (error) {
      if (error instanceof ConflictException) {
        return this.obtenerSemana(semanaId);
      }
      throw error;
    }
  }

  async obtenerHistoricoEmpleado(
    empleadoId: string,
    limite = SEMANAS_HISTORICO_ADMIN,
  ): Promise<SemanaNominaDto[]> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('nomina_semanas')
      .select(SEMANA_SELECT)
      .eq('empleado_id', empleadoId)
      .order('semana_inicio', { ascending: false })
      .limit(limite)
      .returns<SemanaRaw[]>();
    if (error) throw errorDeBase(error);
    return Promise.all(
      data.map((semana) => this.enriquecerSemana(client, semana)),
    );
  }

  async obtenerMiSemanaActual(
    usuarioId: string,
  ): Promise<SemanaNominaDto | null> {
    const client = this.supabase.getClient();
    const empleado = await this.buscarEmpleadoPor(
      client,
      'usuario_id',
      usuarioId,
    );
    if (!empleado) return null;

    const semanaRaw = await this.buscarOCrearSemana(
      client,
      empleado,
      hoyBogota(),
    );
    return this.enriquecerSemana(client, semanaRaw);
  }

  async listarMiHistorico(
    usuarioId: string,
    limite = SEMANAS_HISTORICO_PROPIO,
  ): Promise<SemanaNominaDto[]> {
    const client = this.supabase.getClient();
    const empleado = await this.buscarEmpleadoPor(
      client,
      'usuario_id',
      usuarioId,
    );
    if (!empleado) return [];
    return this.obtenerHistoricoEmpleado(empleado.id, limite);
  }

  private async buscarEmpleadoPor(
    client: SupabaseClient,
    columna: 'id' | 'usuario_id',
    valor: string,
  ): Promise<EmpleadoDto | null> {
    const { data, error } = await client
      .from('empleados')
      .select(EMPLEADO_SELECT)
      .eq(columna, valor)
      .maybeSingle<EmpleadoDto>();
    if (error) throw errorDeBase(error);
    return data;
  }

  private async obtenerSemanaRaw(
    client: SupabaseClient,
    semanaId: string,
  ): Promise<SemanaRaw> {
    const { data, error } = await client
      .from('nomina_semanas')
      .select(SEMANA_SELECT)
      .eq('id', semanaId)
      .maybeSingle<SemanaRaw>();
    if (error) throw errorDeBase(error);
    if (!data) throw new NotFoundException('Semana de nómina no encontrada.');
    return data;
  }

  private async buscarSemanaDeEmpleado(
    client: SupabaseClient,
    empleadoId: string,
    semanaInicio: string,
  ): Promise<SemanaRaw | null> {
    const { data, error } = await client
      .from('nomina_semanas')
      .select(SEMANA_SELECT)
      .eq('empleado_id', empleadoId)
      .eq('semana_inicio', semanaInicio)
      .maybeSingle<SemanaRaw>();
    if (error) throw errorDeBase(error);
    return data;
  }

  private async buscarOCrearSemana(
    client: SupabaseClient,
    empleado: EmpleadoDto,
    fechaYMD: string,
  ): Promise<SemanaRaw> {
    const { inicio, fin } = calcularSemana(fechaYMD);
    const existente = await this.buscarSemanaDeEmpleado(
      client,
      empleado.id,
      inicio,
    );
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
      .single<SemanaRaw>();
    if (!crearError) return creada;

    // Carrera: otra request ya creó la misma semana entre el select y el
    // insert (índice único empleado_id+semana_inicio) — se relee en vez
    // de fallar.
    if (crearError.code === CODIGO_VIOLACION_UNICA) {
      const reintento = await this.buscarSemanaDeEmpleado(
        client,
        empleado.id,
        inicio,
      );
      if (reintento) return reintento;
    }
    throw errorDeBase(crearError);
  }

  private async leerDetalleSemana(
    client: SupabaseClient,
    semanaId: string,
  ): Promise<{ asistencia: AsistenciaDiaDto[]; adelantos: AdelantoDto[] }> {
    const [asistencia, adelantos] = await Promise.all([
      client
        .from('asistencia_nomina')
        .select('fecha, trabajo, motivo')
        .eq('nomina_semana_id', semanaId)
        .order('fecha')
        .returns<AsistenciaDiaDto[]>(),
      client
        .from('adelantos_nomina')
        .select(ADELANTO_SELECT)
        .eq('nomina_semana_id', semanaId)
        .order('fecha')
        .returns<AdelantoDto[]>(),
    ]);
    if (asistencia.error) throw errorDeBase(asistencia.error);
    if (adelantos.error) throw errorDeBase(adelantos.error);
    return { asistencia: asistencia.data, adelantos: adelantos.data };
  }

  private async enriquecerSemana(
    client: SupabaseClient,
    semana: SemanaRaw,
  ): Promise<SemanaNominaDto> {
    const { asistencia, adelantos } = await this.leerDetalleSemana(
      client,
      semana.id,
    );
    return {
      ...semana,
      ...montosDeSemana(semana, asistencia, adelantos),
      asistencia,
      adelantos,
    };
  }
}
