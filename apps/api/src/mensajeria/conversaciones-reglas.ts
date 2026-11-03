import type {
  CanalMensajeria,
  ConfiguracionSeguimiento,
} from './conversaciones.tipos';

export const CLAVE_RECORDATORIO_MINUTOS = 'seguimiento_recordatorio_minutos';
export const CLAVE_OFERTA_MINUTOS = 'seguimiento_oferta_minutos';
// Mismos valores que trae la migración — solo entran en juego si por algún
// motivo las filas de configuracion no existen.
const DEFECTO_RECORDATORIO_MINUTOS = 180;
const DEFECTO_OFERTA_MINUTOS = 360;

const MS_POR_MINUTO = 60_000;

/** Instante de hace `minutos` minutos, en ISO. */
export function haceMinutos(minutos: number, ahora: Date = new Date()): string {
  return new Date(ahora.getTime() - minutos * MS_POR_MINUTO).toISOString();
}

const minutosValidos = (valor: unknown, defecto: number): number => {
  const minutos = Number(valor);
  return Number.isFinite(minutos) && minutos > 0 ? minutos : defecto;
};

/** Plazos del seguimiento a partir de las filas de `configuracion`; lo inválido o ausente cae al valor por defecto. */
export function configuracionDeFilas(
  filas: { clave: string; valor: string }[],
): ConfiguracionSeguimiento {
  const mapa = new Map(filas.map((f) => [f.clave, f.valor]));
  return {
    recordatorioMinutos: minutosValidos(
      mapa.get(CLAVE_RECORDATORIO_MINUTOS),
      DEFECTO_RECORDATORIO_MINUTOS,
    ),
    ofertaMinutos: minutosValidos(
      mapa.get(CLAVE_OFERTA_MINUTOS),
      DEFECTO_OFERTA_MINUTOS,
    ),
  };
}

export interface VentanaLimite {
  inicio: string;
  contador: number;
}

/**
 * Cuenta un mensaje más en la ventana del freno de costo: si la ventana
 * previa sigue vigente se suma, si venció (o no había) arranca una nueva.
 */
export function avanzarVentanaLimite(
  previa: { inicio: string | null; contador: number | null },
  ahora: Date,
  ventanaMinutos: number,
): VentanaLimite {
  const inicioPrevio = previa.inicio ? new Date(previa.inicio) : null;
  const vigente =
    inicioPrevio !== null &&
    ahora.getTime() - inicioPrevio.getTime() < ventanaMinutos * MS_POR_MINUTO;
  return vigente
    ? {
        inicio: inicioPrevio.toISOString(),
        contador: (previa.contador ?? 0) + 1,
      }
    : { inicio: ahora.toISOString(), contador: 1 };
}

export function payloadDerivacion(
  canal: CanalMensajeria,
  identificadorExterno: string,
  ahora: Date = new Date(),
): Record<string, unknown> {
  return {
    canal,
    identificador_externo: identificadorExterno,
    estado: 'derivado',
    ultima_interaccion: ahora.toISOString(),
    gemini_interaction_id: null,
    seguimiento_etapa: 'ninguna',
    seguimiento_enviado_en: null,
    carrito_pendiente: null,
    checkout: null,
  };
}

export function payloadFrenoCosto(
  canal: CanalMensajeria,
  identificadorExterno: string,
  ventana: VentanaLimite,
): Record<string, unknown> {
  return {
    canal,
    identificador_externo: identificadorExterno,
    limite_ventana_inicio: ventana.inicio,
    limite_ventana_contador: ventana.contador,
  };
}
