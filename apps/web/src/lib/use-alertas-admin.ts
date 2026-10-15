'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { useModulos } from '@/lib/use-modulos';
import { useRol } from '@/lib/use-rol';

export type AlertasAdmin = {
  pedidosActivos: number;
  stockBajo: number;
  whatsappEsperando: number;
};

const POLL_MS = 60_000;
const VACIAS: AlertasAdmin = {
  pedidosActivos: 0,
  stockBajo: 0,
  whatsappEsperando: 0,
};

async function leerLista<T>(ruta: string): Promise<T[]> {
  const res = await adminFetch(ruta);
  return res.ok ? await res.json() : [];
}

/**
 * Conteos de alerta que ya se calculan en el dashboard (/admin) — acá se
 * exponen aparte para poder mostrarlos también en el sidebar (badges por
 * ítem) y en la campana de notificaciones, visibles desde cualquier página.
 *
 * Los tres endpoints admiten admin y empleado (@Roles('admin', 'empleado')
 * en admin.controller.ts) — no hay que filtrar por rol acá. Un módulo
 * apagado en Configuración no se consulta: no tiene badge ni cuenta en la
 * campana.
 */
export function useAlertasAdmin(): AlertasAdmin {
  const { session } = useRol();
  const { cargando, activo } = useModulos();
  const conPedidos = activo('pedidos');
  const conInventario = activo('inventario');
  const conSeguimiento = activo('seguimiento');
  const [alertas, setAlertas] = useState<AlertasAdmin>(VACIAS);

  useEffect(() => {
    if (!session || cargando) return;
    let vigente = true;

    async function cargar() {
      const [pedidos, insumos, conversaciones] = await Promise.all([
        conPedidos ? leerLista<{ estado: string }>('/admin/pedidos') : [],
        conInventario
          ? leerLista<unknown>('/inventario/insumos?stockBajo=true')
          : [],
        conSeguimiento
          ? leerLista<{ estado: string }>('/admin/seguimiento/conversaciones')
          : [],
      ]);

      const pedidosActivos = pedidos.filter(
        (p) => p.estado !== 'entregado' && p.estado !== 'cancelado',
      ).length;
      const whatsappEsperando = conversaciones.filter(
        (c) => c.estado === 'derivado',
      ).length;

      if (vigente) {
        setAlertas({
          pedidosActivos,
          stockBajo: insumos.length,
          whatsappEsperando,
        });
      }
    }

    cargar();
    const id = setInterval(cargar, POLL_MS);
    return () => {
      vigente = false;
      clearInterval(id);
    };
  }, [session, cargando, conPedidos, conInventario, conSeguimiento]);

  return alertas;
}
