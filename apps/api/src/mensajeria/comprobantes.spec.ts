import {
  armarAvisoComprobante,
  esComprobanteValido,
  nombreArchivoComprobante,
} from './comprobantes';
import { mediaDe } from './webhooks.service';

describe('comprobantes', () => {
  it('acepta fotos y PDF, no audios ni otros', () => {
    expect(esComprobanteValido('image/jpeg')).toBe(true);
    expect(esComprobanteValido('application/pdf')).toBe(true);
    expect(esComprobanteValido('audio/ogg')).toBe(false);
  });

  it('el nombre sale del wamid: un reenvío de Meta pisa, no duplica', () => {
    expect(nombreArchivoComprobante('wamid.HBgM=', 'image/jpeg')).toBe(
      'wamidHBgM.jpg',
    );
  });

  it('el correo trae número, total y el link firmado', () => {
    const aviso = armarAvisoComprobante({
      pedidoId: 'bc11b812-2c3a-4875-95a9-bbf775c69b42',
      total: 70000,
      nombre: 'Jorge Sierra',
      telefono: '573187592616',
      url: 'https://firmado.example/x',
    });
    expect(aviso.asunto).toBe(
      '💸 Comprobante del pedido #bc11b812 — Jorge Sierra — $70.000',
    );
    expect(aviso.html).toContain('href="https://firmado.example/x"');
  });
});

describe('mediaDe', () => {
  const base = { from: '573001112233' };

  it('foto con texto', () => {
    expect(
      mediaDe({ ...base, type: 'image', image: { id: 'm1', caption: 'pago' } }),
    ).toEqual({ id: 'm1', tipo: 'imagen', texto: '📎 Imagen: pago' });
  });

  it('PDF', () => {
    expect(
      mediaDe({
        ...base,
        type: 'document',
        document: { id: 'm2', filename: 'nu.pdf' },
      }),
    ).toEqual({ id: 'm2', tipo: 'documento', texto: '📎 Documento: nu.pdf' });
  });

  it('nota de voz', () => {
    expect(
      mediaDe({ ...base, type: 'audio', audio: { id: 'm3', voice: true } }),
    ).toEqual({ id: 'm3', tipo: 'audio', texto: '🎤 Nota de voz' });
  });

  it('texto común no es media', () => {
    expect(
      mediaDe({ ...base, type: 'text', text: { body: 'hola' } }),
    ).toBeNull();
  });
});
