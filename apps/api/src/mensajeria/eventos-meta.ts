import { ServiceUnavailableException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { errorDeBase } from '../common/error-de-base';

const TIMEOUT_MS = 10_000;
const LARGO_MAX_ERROR_GRAPH = 300;

export interface DestinoEventosMeta {
  version: string;
  datasetId: string;
  token: string;
}

/**
 * Reclama la clave (evento, referencia) ANTES de enviar: si otro proceso ya
 * la tomó, no se manda de nuevo. Si el envío falla se libera la clave para
 * que un próximo intento pueda reintentar. Meta NO deduplica los eventos de
 * mensajería, así que esta tabla es la única defensa contra los dobles.
 * Devuelve false si el evento ya se había enviado.
 */
export async function enviarEventoUnaVez(
  client: SupabaseClient,
  clave: { evento: string; referenciaId: string },
  enviar: () => Promise<void>,
): Promise<boolean> {
  const { error } = await client
    .from('eventos_meta_enviados')
    .insert({ evento: clave.evento, referencia_id: clave.referenciaId });
  if (error) {
    if (error.code === '23505') return false;
    throw errorDeBase(error);
  }
  try {
    await enviar();
    return true;
  } catch (err) {
    await client
      .from('eventos_meta_enviados')
      .delete()
      .eq('evento', clave.evento)
      .eq('referencia_id', clave.referenciaId);
    throw err;
  }
}

/** POST a `/{dataset}/events`. El token va en el header para no quedar en logs. */
export async function postearEventoMeta(
  destino: DestinoEventosMeta,
  evento: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(
    `https://graph.facebook.com/${destino.version}/${destino.datasetId}/events`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${destino.token}`,
      },
      body: JSON.stringify({ data: [evento] }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  );
  if (!res.ok) {
    const cuerpo = await res.text().catch(() => '');
    throw new ServiceUnavailableException(
      `Graph API ${res.status}: ${cuerpo.slice(0, LARGO_MAX_ERROR_GRAPH)}`,
    );
  }
}
