import { ORIGEN_CAJA_SIN_DATO, origenDePedido } from './informes-origen';

describe('origenDePedido', () => {
  it('usa el origen que eligió la caja', () => {
    expect(origenDePedido('llamada', 'pos')).toBe('llamada');
  });

  it('separa WhatsApp Business del bot y junta el bot de la caja con el del canal', () => {
    expect(origenDePedido('whatsapp', 'pos')).toBe('whatsapp_business');
    expect(origenDePedido('whatsapp_bot', 'pos')).toBe('whatsapp');
    expect(origenDePedido(null, 'whatsapp')).toBe('whatsapp');
  });

  it('una venta de caja sin origen queda aparte, no se adivina', () => {
    expect(origenDePedido(null, 'pos')).toBe(ORIGEN_CAJA_SIN_DATO);
  });

  it('los demás canales son su propio origen', () => {
    expect(origenDePedido(null, 'web')).toBe('web');
    expect(origenDePedido(null, 'messenger')).toBe('messenger');
  });
});
