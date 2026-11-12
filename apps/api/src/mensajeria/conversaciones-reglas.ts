import type {
  CanalMensajeria,
  ConfiguracionSeguimiento,
  EstadoConversacion,
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

export const DIGITOS_TELEFONO_CO = 10;

export function variantesTelefonoCO(telefono: string): string[] {
  const digitos = telefono.replace(/\D/g, '').slice(-DIGITOS_TELEFONO_CO);
  return [digitos, `57${digitos}`, `+57${digitos}`];
}

export function payloadEstadoManual(estado: string): Record<string, unknown> {
  return {
    estado,
    gemini_interaction_id: null,
    seguimiento_etapa: 'ninguna',
    seguimiento_enviado_en: null,
    carrito_pendiente: null,
    checkout: null,
  };
}

export function payloadConfiguracionSeguimiento(
  recordatorio: number,
  oferta: number,
): { clave: string; valor: string }[] {
  return [
    { clave: CLAVE_RECORDATORIO_MINUTOS, valor: String(recordatorio) },
    { clave: CLAVE_OFERTA_MINUTOS, valor: String(oferta) },
  ];
}

export interface VentanaConversacion {
  conversacionId: string;
  estado: EstadoConversacion;
  ultimaInteraccion: Date;
  identificadorExterno?: string;
}

export function mapearVentana(
  fila: {
    id: string;
    estado: EstadoConversacion;
    ultima_interaccion: string | null;
    identificador_externo?: string;
  } | null,
): VentanaConversacion | null {
  if (!fila?.ultima_interaccion) return null;
  return {
    conversacionId: fila.id,
    estado: fila.estado,
    ultimaInteraccion: new Date(fila.ultima_interaccion),
    ...(fila.identificador_externo
      ? { identificadorExterno: fila.identificador_externo }
      : {}),
  };
}

export function payloadCtwa(
  ctwaClid: string,
  capturadoEn: string = new Date().toISOString(),
): Record<string, unknown> {
  return { ctwa_clid: ctwaClid, ctwa_capturado_en: capturadoEn };
}

export function payloadSeguimiento(
  etapa: string,
  enviadoEn: string = new Date().toISOString(),
  ofertaEntregada = false,
): Record<string, unknown> {
  return {
    seguimiento_etapa: etapa,
    seguimiento_enviado_en: enviadoEn,
    ...(ofertaEntregada ? { oferta_enviada_en: enviadoEn } : {}),
  };
}

export function payloadMensaje(
  conversacionId: string,
  direccion: string,
  texto: string,
  autorUsuarioId?: string,
): Record<string, unknown> {
  return {
    conversacion_id: conversacionId,
    direccion,
    texto,
    autor_usuario_id: autorUsuarioId ?? null,
  };
}

export function payloadRegistroInteraccion(
  canal: CanalMensajeria,
  identificadorExterno: string,
  ahora: string,
): Record<string, unknown> {
  return {
    canal,
    identificador_externo: identificadorExterno,
    ultima_interaccion: ahora,
    seguimiento_etapa: 'ninguna',
    seguimiento_enviado_en: null,
  };
}

/**
 * Solo se le hace seguimiento a quien de verdad empezó un pedido (armó
 * carrito o entró al checkout). Antes le llegaba "¿sigues interesado?" a
 * cualquiera que solo había saludado o preguntado el horario.
 */
export const FILTRO_CON_PEDIDO_EMPEZADO =
  'carrito_pendiente.not.is.null,checkout.not.is.null';
