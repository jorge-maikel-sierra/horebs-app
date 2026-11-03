import { ServiceUnavailableException } from '@nestjs/common';

const BYTES_POR_KB = 1024;
const MAX_MB_MEDIA = 10;
const MAX_BYTES_MEDIA = MAX_MB_MEDIA * BYTES_POR_KB * BYTES_POR_KB;

export async function descargarMediaWhatsapp(
  version: string,
  token: string,
  mediaId: string,
): Promise<{ datos: Buffer; mime: string }> {
  const auth = { Authorization: `Bearer ${token}` };
  const meta = await fetch(`https://graph.facebook.com/${version}/${mediaId}`, {
    headers: auth,
  });
  if (!meta.ok) {
    throw new ServiceUnavailableException(
      `No se pudo obtener el archivo ${mediaId}: ${meta.status}`,
    );
  }
  const info = (await meta.json()) as {
    url?: string;
    mime_type?: string;
    file_size?: number;
  };
  if (!info.url) {
    throw new ServiceUnavailableException(
      `El archivo ${mediaId} no tiene URL.`,
    );
  }
  if ((info.file_size ?? 0) > MAX_BYTES_MEDIA) {
    throw new ServiceUnavailableException(
      `El archivo ${mediaId} pesa más de 10 MB.`,
    );
  }
  const archivo = await fetch(info.url, { headers: auth });
  if (!archivo.ok) {
    throw new ServiceUnavailableException(
      `No se pudo descargar el archivo ${mediaId}: ${archivo.status}`,
    );
  }
  return {
    datos: Buffer.from(await archivo.arrayBuffer()),
    mime: info.mime_type ?? 'application/octet-stream',
  };
}

export async function descargarMediaUrlDirecta(
  url: string,
): Promise<{ datos: Buffer; mime: string }> {
  const archivo = await fetch(url);
  if (!archivo.ok) {
    throw new ServiceUnavailableException(
      `No se pudo descargar el archivo: ${archivo.status}`,
    );
  }
  const mimeHeader =
    archivo.headers.get('content-type') ?? 'application/octet-stream';
  return {
    datos: Buffer.from(await archivo.arrayBuffer()),
    mime: mimeHeader.split(';')[0],
  };
}
