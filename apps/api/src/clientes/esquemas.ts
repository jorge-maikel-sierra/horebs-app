import { Esquema, numero, opcional, texto } from '../common/validacion';

export const ESQUEMA_AJUSTE_PUNTOS: Esquema = {
  // Puede ser negativo; el cero lo rechaza el service.
  puntos: numero({ entero: true }),
  motivo: texto({ max: 300 }),
};

/** Cadena vacía borra un dato (el service la vuelve null); `nombre` no se puede vaciar. */
const TEXTO_BORRABLE = opcional(texto({ min: 0, max: 200 }));

export const ESQUEMA_EDITAR_CLIENTE: Esquema = {
  nombre: opcional(texto({ max: 100 })),
  apellido: TEXTO_BORRABLE,
  telefono: opcional(texto({ min: 0, max: 30 })),
  direccion: TEXTO_BORRABLE,
  correo: TEXTO_BORRABLE,
  cedula: opcional(texto({ min: 0, max: 30 })),
};
