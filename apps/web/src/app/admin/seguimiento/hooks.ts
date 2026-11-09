'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { leerErrorApi } from '@/lib/error-api';
import {
  INTERVALO_HILO_MS,
  INTERVALO_LISTA_MS,
  type Conversacion,
  type EstadoConversacion,
  type Mensaje,
} from './tipos';

const MS_RELOJ = 30_000;

/** Hora actual que se refresca sola: los "hace 5 min" no se quedan viejos. */
export function useAhora(): number {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), MS_RELOJ);
    return () => clearInterval(id);
  }, []);
  return ahora;
}

function mensajeDeError(err: unknown, porDefecto: string): string {
  return err instanceof Error ? err.message : porDefecto;
}

/**
 * Lista de conversaciones con refresco periódico. Se pausa con la pestaña en
 * segundo plano para no gastar cupo del rate limit.
 */
export function useConversaciones() {
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actualizadoEn, setActualizadoEn] = useState<number | null>(null);

  const refrescar = useCallback(async () => {
    try {
      const res = await adminFetch('/admin/seguimiento/conversaciones');
      if (!res.ok) throw new Error('No se pudo cargar la lista.');
      setConversaciones(await res.json());
      setActualizadoEn(Date.now());
      setError(null);
    } catch (err) {
      setError(mensajeDeError(err, 'Error desconocido.'));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    // setTimeout 0: la primera carga ocurre después del render, no dentro de él.
    const inicial = setTimeout(refrescar, 0);
    const id = setInterval(() => {
      if (!document.hidden) refrescar();
    }, INTERVALO_LISTA_MS);
    return () => {
      clearTimeout(inicial);
      clearInterval(id);
    };
  }, [refrescar]);

  const cambiarEstado = useCallback(
    async (id: string, estado: EstadoConversacion): Promise<string | null> => {
      try {
        const res = await adminFetch(`/admin/seguimiento/conversaciones/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ estado }),
        });
        if (!res.ok) {
          throw new Error(
            await leerErrorApi(res, 'No se pudo actualizar el estado.'),
          );
        }
        await refrescar();
        return null;
      } catch (err) {
        return mensajeDeError(err, 'No se pudo actualizar el estado.');
      }
    },
    [refrescar],
  );

  return {
    conversaciones,
    cargando,
    error,
    actualizadoEn,
    refrescar,
    cambiarEstado,
  };
}

/**
 * Hilo de una conversación: carga inicial, refresco cada 5 s y envío. Se usa
 * con `key={conversacionId}`, así que cada conversación tiene su propia
 * instancia y no hay que limpiar el estado al cambiar de una a otra.
 */
export function useHilo(conversacionId: string) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const res = await adminFetch(
        `/admin/seguimiento/conversaciones/${conversacionId}/mensajes`,
      );
      if (!res.ok) throw new Error('No se pudo cargar la conversación.');
      setMensajes(await res.json());
      setError(null);
    } catch (err) {
      setError(mensajeDeError(err, 'Error desconocido.'));
    } finally {
      setCargando(false);
    }
  }, [conversacionId]);

  useEffect(() => {
    const inicial = setTimeout(cargar, 0);
    const id = setInterval(() => {
      if (!document.hidden) cargar();
    }, INTERVALO_HILO_MS);
    return () => {
      clearTimeout(inicial);
      clearInterval(id);
    };
  }, [cargar]);

  const enviar = useCallback(
    async (texto: string): Promise<string | null> => {
      try {
        const res = await adminFetch(
          `/admin/seguimiento/conversaciones/${conversacionId}/mensajes`,
          { method: 'POST', body: JSON.stringify({ texto }) },
        );
        if (!res.ok) {
          throw new Error(
            await leerErrorApi(res, 'No se pudo enviar el mensaje.'),
          );
        }
        await cargar();
        return null;
      } catch (err) {
        return mensajeDeError(err, 'No se pudo enviar el mensaje.');
      }
    },
    [conversacionId, cargar],
  );

  return { mensajes, cargando, error, enviar };
}
