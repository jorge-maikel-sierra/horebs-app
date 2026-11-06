type Fetch = typeof fetch;

// Mensaje con el que PostgREST rechaza una llave cuyo `iat` queda adelante del
// reloj del nodo que la valida: pasa de forma intermitente cuando los relojes
// de Supabase se desfasan unos segundos.
const ERROR_RELOJ = 'JWT issued at future';
const MAX_REINTENTOS = 2;
const ESPERA_REINTENTO_MS = 400;

async function rechazadaPorReloj(respuesta: Response): Promise<boolean> {
  if (respuesta.ok) return false;
  const cuerpo = await respuesta
    .clone()
    .text()
    .catch(() => '');
  return cuerpo.includes(ERROR_RELOJ);
}

/**
 * Envuelve `fetch` para repetir la llamada cuando Supabase la rechaza por el
 * desfase de reloj. El rechazo ocurre antes de ejecutar nada, así que repetir
 * es seguro también para escrituras. Sin esto, un mensaje de un cliente o un
 * envío programado fallaba por una causa que desaparece a los pocos segundos.
 */
export function conReintentoPorReloj(
  base: Fetch = fetch,
  alReintentar: () => void = () => undefined,
  esperaMs: number = ESPERA_REINTENTO_MS,
): Fetch {
  return async (
    entrada: Parameters<Fetch>[0],
    init?: Parameters<Fetch>[1],
  ): Promise<Response> => {
    let respuesta = await base(entrada, init);
    for (
      let intento = 0;
      intento < MAX_REINTENTOS && (await rechazadaPorReloj(respuesta));
      intento++
    ) {
      alReintentar();
      await new Promise<void>((resolver) => setTimeout(resolver, esperaMs));
      respuesta = await base(entrada, init);
    }
    return respuesta;
  };
}
