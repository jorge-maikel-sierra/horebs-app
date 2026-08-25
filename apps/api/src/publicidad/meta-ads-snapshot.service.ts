import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';
import { InformesService } from '../informes/informes.service';
import { MetaAdsGraphService } from './meta-ads-graph.service';

export interface PublicidadMetaAdsDto {
  capturado_en: string;
  moneda: string;
  cuenta: {
    gasto_hoy: number;
    impresiones_hoy: number;
    clics_hoy: number;
    cpc_hoy: number | null;
    cpm_hoy: number | null;
    ctr_hoy: number | null;
    compras_hoy: number;
    valor_compras_hoy: number;
    roas_hoy: number | null;
    presupuesto_diario_total: number;
  };
  serie_ultimos_7_dias: { fecha: string; gasto: number }[];
  campanas: {
    campana_id: string;
    nombre: string;
    estado: string;
    presupuesto_diario: number | null;
    presupuesto_total: number | null;
    gasto_hoy: number;
    clics_hoy: number;
    cpc_hoy: number | null;
    ctr_hoy: number | null;
  }[];
  comparacion_hoy: {
    gasto_meta: number;
    ventas_reales_hoy: number;
    compras_atribuidas_meta: number;
    valor_compras_atribuidas_meta: number;
  };
}

// Duplicado a propósito (ver apps/api/src/nomina/semana-utils.ts) — este
// monorepo no tiene un paquete compartido entre apps.
function hoyBogota(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
}

/**
 * Snapshot horario de la cuenta de Meta Ads — persiste en Supabase para
 * que /admin/informes lea siempre de nuestra base (rápido, no depende de
 * la disponibilidad de Graph API) en vez de llamar a Meta en cada carga
 * de página. Ver apps/api/src/publicidad/README.md.
 */
@Injectable()
export class MetaAdsSnapshotService {
  private readonly logger = new Logger(MetaAdsSnapshotService.name);

  // Lock en memoria: alcanza porque Railway corre un solo proceso de este
  // servicio (sin escalado horizontal) — mismo criterio que
  // SeguimientoService. Evita que el refresco manual y el cron horario se
  // pisen si coinciden.
  private ejecutando = false;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly metaAds: MetaAdsGraphService,
    private readonly informes: InformesService,
  ) {}

  @Cron('0 * * * *', { name: 'meta-ads-snapshot' })
  async ejecutar(): Promise<void> {
    if (this.ejecutando) {
      this.logger.warn('El snapshot anterior de Meta Ads todavía está en curso — se salta este tick.');
      return;
    }
    if (!this.metaAds.estaConfigurado()) {
      this.logger.warn('Meta Ads no está configurado — no se puede capturar el snapshot.');
      return;
    }
    this.ejecutando = true;
    try {
      const [moneda, resumen, campanas] = await Promise.all([
        this.metaAds.obtenerMoneda(),
        this.metaAds.obtenerResumenCuenta(),
        this.metaAds.obtenerCampanasActivas(),
      ]);

      const presupuestoDiarioTotal = campanas.reduce(
        (acc, c) => acc + (c.presupuestoDiario ?? 0),
        0,
      );

      // Log puntual para poder cotejar a mano el presupuesto crudo contra
      // Ads Manager la primera vez que corre con credenciales reales —
      // ver el gotcha de unidades de moneda en publicidad/README.md.
      this.logger.log(
        `Snapshot Meta Ads: moneda=${moneda}, presupuestos diarios crudos=${JSON.stringify(
          campanas.map((c) => ({ nombre: c.nombre, presupuestoDiario: c.presupuestoDiario })),
        )}`,
      );

      const client = this.supabase.getClient();
      const { data: snapshot, error: snapshotError } = await client
        .from('meta_ads_snapshots')
        .insert({
          moneda,
          gasto_hoy: resumen.gastoHoy,
          impresiones_hoy: resumen.impresionesHoy,
          clics_hoy: resumen.clicsHoy,
          cpc_hoy: resumen.cpcHoy,
          cpm_hoy: resumen.cpmHoy,
          ctr_hoy: resumen.ctrHoy,
          compras_hoy: resumen.comprasHoy,
          valor_compras_hoy: resumen.valorComprasHoy,
          roas_hoy: resumen.roasHoy,
          presupuesto_diario_total: presupuestoDiarioTotal,
          serie_ultimos_7_dias: resumen.serieUltimos7Dias,
        })
        .select('id')
        .single();
      if (snapshotError) throw snapshotError;

      if (campanas.length > 0) {
        const { error: campanasError } = await client.from('meta_ads_campanas_snapshot').insert(
          campanas.map((c) => ({
            snapshot_id: snapshot.id,
            campana_id: c.campanaId,
            nombre: c.nombre,
            estado: c.estado,
            presupuesto_diario: c.presupuestoDiario,
            presupuesto_total: c.presupuestoTotal,
            gasto_hoy: c.gastoHoy,
            impresiones_hoy: c.impresionesHoy,
            clics_hoy: c.clicsHoy,
            cpc_hoy: c.cpcHoy,
            cpm_hoy: c.cpmHoy,
            ctr_hoy: c.ctrHoy,
            compras_hoy: c.comprasHoy,
            valor_compras_hoy: c.valorComprasHoy,
          })),
        );
        if (campanasError) throw campanasError;
      }
    } catch (err) {
      this.logger.error(`No se pudo capturar el snapshot de Meta Ads: ${(err as Error).message}`);
    } finally {
      this.ejecutando = false;
    }
  }

  async obtenerUltimoSnapshot(): Promise<PublicidadMetaAdsDto | null> {
    const client = this.supabase.getClient();
    const { data: snapshot, error: snapshotError } = await client
      .from('meta_ads_snapshots')
      .select(
        'id, capturado_en, moneda, gasto_hoy, impresiones_hoy, clics_hoy, cpc_hoy, cpm_hoy, ctr_hoy, compras_hoy, valor_compras_hoy, roas_hoy, presupuesto_diario_total, serie_ultimos_7_dias',
      )
      .order('capturado_en', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (snapshotError) throw snapshotError;
    if (!snapshot) return null;

    const [{ data: campanas, error: campanasError }, hoyInforme] = await Promise.all([
      client
        .from('meta_ads_campanas_snapshot')
        .select(
          'campana_id, nombre, estado, presupuesto_diario, presupuesto_total, gasto_hoy, clics_hoy, cpc_hoy, ctr_hoy',
        )
        .eq('snapshot_id', snapshot.id)
        .order('gasto_hoy', { ascending: false }),
      this.informes.generar(hoyBogota(), hoyBogota()),
    ]);
    if (campanasError) throw campanasError;

    return {
      capturado_en: snapshot.capturado_en,
      moneda: snapshot.moneda,
      cuenta: {
        gasto_hoy: snapshot.gasto_hoy,
        impresiones_hoy: snapshot.impresiones_hoy,
        clics_hoy: snapshot.clics_hoy,
        cpc_hoy: snapshot.cpc_hoy,
        cpm_hoy: snapshot.cpm_hoy,
        ctr_hoy: snapshot.ctr_hoy,
        compras_hoy: snapshot.compras_hoy,
        valor_compras_hoy: snapshot.valor_compras_hoy,
        roas_hoy: snapshot.roas_hoy,
        presupuesto_diario_total: snapshot.presupuesto_diario_total,
      },
      serie_ultimos_7_dias: snapshot.serie_ultimos_7_dias,
      campanas: campanas ?? [],
      comparacion_hoy: {
        gasto_meta: snapshot.gasto_hoy,
        ventas_reales_hoy: hoyInforme.resumen.ventas_brutas,
        compras_atribuidas_meta: snapshot.compras_hoy,
        valor_compras_atribuidas_meta: snapshot.valor_compras_hoy,
      },
    };
  }
}
