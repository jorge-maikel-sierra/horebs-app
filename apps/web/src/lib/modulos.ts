export type ModuloId =
  | 'pos'
  | 'pedidos'
  | 'clientes'
  | 'inventario'
  | 'nomina'
  | 'seguimiento'
  | 'informes'
  | 'blog';

export type ModuloInfo = {
  id: ModuloId;
  etiqueta: string;
  descripcion: string;
  href: string;
};

// Mismos ids que MODULOS_ACTIVABLES en apps/api/src/admin/modulos.service.ts.
// Panel, Usuarios y Configuración no se pueden apagar: sin ellos el admin
// quedaría sin forma de volver a encender un módulo.
export const MODULOS: ModuloInfo[] = [
  {
    id: 'pos',
    etiqueta: 'Punto de venta',
    descripcion: 'Registrar ventas del local y abrir o cerrar turnos.',
    href: '/admin/pos',
  },
  {
    id: 'pedidos',
    etiqueta: 'Pedidos',
    descripcion: 'Ver y gestionar los pedidos web y de domicilio.',
    href: '/admin/pedidos',
  },
  {
    id: 'clientes',
    etiqueta: 'Clientes',
    descripcion: 'Lista de clientes y programa de puntos.',
    href: '/admin/clientes',
  },
  {
    id: 'inventario',
    etiqueta: 'Inventario',
    descripcion: 'Insumos, recetas, compras y alertas de stock bajo.',
    href: '/admin/inventario',
  },
  {
    id: 'nomina',
    etiqueta: 'Nómina',
    descripcion: 'Turnos de los trabajadores y liquidación semanal.',
    href: '/admin/nomina',
  },
  {
    id: 'seguimiento',
    etiqueta: 'Seguimiento del bot',
    descripcion:
      'Bandeja de conversaciones de WhatsApp derivadas a una persona.',
    href: '/admin/seguimiento',
  },
  {
    id: 'informes',
    etiqueta: 'Informes',
    descripcion: 'Ventas, clientes y gráficos por período.',
    href: '/admin/informes',
  },
  {
    id: 'blog',
    etiqueta: 'Blog',
    descripcion: 'Editor de artículos del sitio.',
    href: '/admin/blog',
  },
];

export const MODULO_POR_ID = Object.fromEntries(
  MODULOS.map((m) => [m.id, m]),
) as Record<ModuloId, ModuloInfo>;

/** Módulo al que pertenece una ruta del panel, o null si no es apagable. */
export function moduloDeRuta(pathname: string): ModuloInfo | null {
  return (
    MODULOS.find(
      (m) => pathname === m.href || pathname.startsWith(`${m.href}/`),
    ) ?? null
  );
}
