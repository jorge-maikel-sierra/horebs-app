import type { CanalMensajeria } from './conversaciones.tipos';

/** De qué conversación viene la llamada a la herramienta. */
export interface ContextoHerramienta {
  canal: CanalMensajeria;
  identificadorExterno: string;
  telefono: string | null;
  conversacionId: string;
}
