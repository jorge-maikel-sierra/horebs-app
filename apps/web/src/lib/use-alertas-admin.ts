'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { useRol } from '@/lib/use-rol';

export type AlertasAdmin = {
  pedidosActivos: number;
  stockBajo: number;
  whatsappEsperando: number;
};

const POLL_MS = 60_000;
const VACIAS: AlertasAdmin = { pedidosActivos: 0, stockBajo: 0, whatsappEsperando: 0 };

/**
 * Conteos de alerta que ya se calculan en el dashboard (/admin) — acá se
 * exponen aparte para poder mostrarlos también en el sidebar (badges por
 * ítem) y en la campana de notificaciones, visibles desde cualquier página.
 *
 * Los tres endpoints admiten admin y empleado (@Roles('admin', 'empleado')
 * en admin.controller.ts) — no hay que filtrar por rol acá.
 */
export function useAlertasAdmin(): AlertasAdmin {
  const { session } = useRol();
  const [alertas, setAlertas] = useState<AlertasAdmin>(VACIAS);

  useEffect(() => {
    if (!session) return;
    let activo = true;

    async function cargar() {
      const [pedidosRes, insumosRes, convRes] = await Promise.all([
        adminFetch('/admin/pedidos'),
        adminFetch('/inventario/insumos?stockBajo=true'),
        adminFetch('/admin/seguimiento/conversaciones'),
      ]);
      const pedidos: { estado: string }[] = pedidosRes.ok ? await pedidosRes.json() : [];
      const insumos: unknown[] = insumosRes.ok ? await insumosRes.json() : [];
      const conversaciones: { estado: string }[] = convRes.ok ? await convRes.json() : [];

      const pedidosActivos = pedidos.filter(
        (p) => p.estado !== 'entregado' && p.estado !== 'cancelado',
      ).length;
      const whatsappEsperando = conversaciones.filter((c) => c.estado === 'derivado').length;

      if (activo) {
        setAlertas({ pedidosActivos, stockBajo: insumos.length, whatsappEsperando });
      }
    }

    cargar();
    const id = setInterval(cargar, POLL_MS);
    return () => {
      activo = false;
      clearInterval(id);
    };
  }, [session]);

  return alertas;
}
