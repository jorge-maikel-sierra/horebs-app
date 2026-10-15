import type { ReactElement } from 'react';
import {
  IconBlog,
  IconClientes,
  IconInformes,
  IconInventario,
  IconNomina,
  IconPedidos,
  IconPos,
  IconSeguimiento,
  type PropsIcono,
} from '@/components/admin-iconos';
import type { ModuloId } from '@/lib/modulos';

const ICONOS: Record<ModuloId, (p: PropsIcono) => ReactElement> = {
  pos: IconPos,
  pedidos: IconPedidos,
  clientes: IconClientes,
  inventario: IconInventario,
  nomina: IconNomina,
  seguimiento: IconSeguimiento,
  informes: IconInformes,
  blog: IconBlog,
};

export default function ModuloIcono({
  id,
  tamano = 20,
}: {
  id: ModuloId;
  tamano?: number;
}) {
  const Icono = ICONOS[id];
  return <Icono tamano={tamano} />;
}
