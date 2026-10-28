/**
 * Mensaje de una respuesta de error del API (RFC 9457, Problem Details):
 * `detail` es texto pensado para mostrarse al usuario. Consume el cuerpo de
 * `res`, así que se llama una sola vez por respuesta.
 */
export async function leerErrorApi(
  res: Response,
  fallback: string,
): Promise<string> {
  const body: unknown = await res.json().catch(() => null);
  if (typeof body !== 'object' || body === null) return fallback;
  const { detail } = body as { detail?: unknown };
  return typeof detail === 'string' && detail ? detail : fallback;
}
