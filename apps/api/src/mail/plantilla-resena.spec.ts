import { ENLACE_RESENA_GOOGLE } from '../common/contacto';
import { correoInvitacionResena } from './plantilla-resena';

describe('correoInvitacionResena', () => {
  const correo = correoInvitacionResena({
    nombre: 'Ana',
    pedidoId: 'abcd1234-0000-0000-0000-000000000000',
  });

  it('saluda por el nombre y nombra el pedido', () => {
    expect(correo.subject).toContain('#abcd1234');
    expect(correo.text).toContain('Ana');
  });

  it('lleva el enlace directo a la reseña en texto y en HTML', () => {
    expect(correo.text).toContain(ENLACE_RESENA_GOOGLE);
    expect(correo.html).toContain(`href="${ENLACE_RESENA_GOOGLE}"`);
  });

  it('escapa el nombre en el HTML', () => {
    const malo = correoInvitacionResena({
      nombre: '<b>"x"</b>',
      pedidoId: 'abcd1234-0000-0000-0000-000000000000',
    });
    expect(malo.html).not.toContain('<b>"x"</b>');
    expect(malo.html).toContain('&lt;b&gt;&quot;x&quot;&lt;/b&gt;');
  });
});
