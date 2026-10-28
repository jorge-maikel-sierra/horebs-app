'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { useModulos } from '@/lib/use-modulos';
import { useRol } from '@/lib/use-rol';

export type AlertasAdmin = {
  pedidosActivos: number;
  stockBajo: number;
  whatsappEsperando: number;
  /** Pedidos del bot de WhatsApp todavía sin confirmar. */
  pedidosWhatsappPendientes: number;
  /** Último aviso de pedido nuevo: cuántos entraron y cuándo (para el toast). */
  pedidoNuevo: { cantidad: number; en: number } | null;
};

// 30s: un pedido del bot no puede quedar un minuto sin que nadie se entere.
const POLL_MS = 30_000;
const VACIAS: AlertasAdmin = {
  pedidosActivos: 0,
  stockBajo: 0,
  whatsappEsperando: 0,
  pedidosWhatsappPendientes: 0,
  pedidoNuevo: null,
};

export const CLAVE_SONIDO_PEDIDOS = 'horebs:sonido-pedidos';

/** Preferencia del equipo; sin localStorage (modo privado) suena igual. */
export function sonidoPedidosActivo(): boolean {
  try {
    return localStorage.getItem(CLAVE_SONIDO_PEDIDOS) !== '0';
  } catch {
    return true;
  }
}

/**
 * Dos tonos cortos con Web Audio (sin archivo). El navegador puede
 * bloquearlo si todavía no hubo un clic en la página: se ignora.
 */
function sonarPedidoNuevo() {
  try {
    const Contexto =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Contexto) return;
    const ctx = new Contexto();
    [880, 1175].forEach((frecuencia, i) => {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      const inicio = ctx.currentTime + i * 0.18;
      osc.frequency.value = frecuencia;
      vol.gain.setValueAtTime(0.0001, inicio);
      vol.gain.exponentialRampToValueAtTime(0.25, inicio + 0.02);
      vol.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.16);
      osc.connect(vol).connect(ctx.destination);
      osc.start(inicio);
      osc.stop(inicio + 0.17);
    });
    setTimeout(() => void ctx.close(), 800);
  } catch {
    // Sin audio: el toast y el título siguen avisando.
  }
}

const PREFIJO_TITULO = /^\(\d+\) Nuevo pedido — /;

/** "(2) Nuevo pedido — Pedidos | Horebs" mientras haya pendientes nuevos. */
export function marcarTituloPedidos(cantidad: number) {
  const base = document.title.replace(PREFIJO_TITULO, '');
  document.title = cantidad > 0 ? `(${cantidad}) Nuevo pedido — ${base}` : base;
}

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
    let previo: number | null = null;

    async function cargar() {
      const [pedidos, insumos, conversaciones] = await Promise.all([
        conPedidos
          ? leerLista<{ estado: string; canal: string }>('/admin/pedidos')
          : [],
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
      const pedidosWhatsappPendientes = pedidos.filter(
        (p) => p.canal === 'whatsapp' && p.estado === 'pendiente',
      ).length;
      // En la primera carga no se avisa: solo lo que entra con el panel abierto.
      const nuevos =
        previo === null ? 0 : Math.max(0, pedidosWhatsappPendientes - previo);
      previo = pedidosWhatsappPendientes;
      if (!vigente) return;

      if (nuevos > 0) {
        if (sonidoPedidosActivo()) sonarPedidoNuevo();
        marcarTituloPedidos(pedidosWhatsappPendientes);
      } else if (pedidosWhatsappPendientes === 0) {
        marcarTituloPedidos(0);
      }
      setAlertas((anterior) => ({
        pedidosActivos,
        stockBajo: insumos.length,
        whatsappEsperando,
        pedidosWhatsappPendientes,
        pedidoNuevo:
          nuevos > 0
            ? { cantidad: nuevos, en: Date.now() }
            : anterior.pedidoNuevo,
      }));
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
