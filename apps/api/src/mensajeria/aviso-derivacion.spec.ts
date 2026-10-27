import { armarAvisoDerivacion } from './aviso-derivacion';

const RESUMEN = [
  '*Resumen de tu pedido*',
  'Cliente: Jorge Sierra',
  '- 1x Pizza Vegetariana (Mediana): $35.000',
  'Domicilio a Carrera 7H1 # 33 - 66: $5.000',
  '*Total: $40.000*',
  '',
  '¿Cuál va a ser tu método de pago: *efectivo*, *transferencia* o *tarjeta*?',
].join('\n');

const CON_PEDIDO = [
  { direccion: 'entrante' as const, texto: 'Hola' },
  { direccion: 'saliente_bot' as const, texto: RESUMEN },
  { direccion: 'entrante' as const, texto: 'Transferencia' },
];

describe('armarAvisoDerivacion', () => {
  it('con pedido: nombre, total, link de WhatsApp y método de pago', () => {
    const aviso = armarAvisoDerivacion({
      canal: 'whatsapp',
      identificadorExterno: '573187592616',
      telefono: '573187592616',
      mensajes: CON_PEDIDO,
    });
    expect(aviso.asunto).toBe(
      '🔔 Jorge Sierra espera atención — pedido de $40.000',
    );
    expect(aviso.texto).toContain('Contacto: +57 318 759 2616');
    expect(aviso.texto).toContain('Escribile: https://wa.me/573187592616');
    expect(aviso.texto).toContain('Total: $40.000');
    expect(aviso.texto).toContain(
      'Último mensaje del cliente: "Transferencia"',
    );
    expect(aviso.textoWhatsapp).toContain('Pedido: $40.000');
    expect(aviso.html).toContain('href="https://wa.me/573187592616"');
  });

  it('el correo no arrastra el formato de WhatsApp', () => {
    const { texto } = armarAvisoDerivacion({
      canal: 'whatsapp',
      identificadorExterno: '573187592616',
      telefono: '573187592616',
      mensajes: CON_PEDIDO,
    });
    expect(texto).toContain('Resumen de tu pedido');
    expect(texto).not.toContain('*Total');
  });

  it('sin pedido: avisa que pidió hablar con una persona', () => {
    const aviso = armarAvisoDerivacion({
      canal: 'whatsapp',
      identificadorExterno: '573001112233',
      telefono: '573001112233',
      mensajes: [{ direccion: 'entrante', texto: 'quiero hablar con alguien' }],
    });
    expect(aviso.asunto).toBe('🔔 +57 300 111 2233 espera atención');
    expect(aviso.texto).toContain('pidió hablar con una persona');
    expect(aviso.textoWhatsapp).toContain('Pidió hablar con una persona');
  });

  it('Messenger no tiene teléfono: sin link de WhatsApp', () => {
    const aviso = armarAvisoDerivacion({
      canal: 'messenger',
      identificadorExterno: 'psid-1',
      telefono: null,
      mensajes: [{ direccion: 'entrante', texto: 'hola' }],
    });
    expect(aviso.texto).toContain('messenger psid-1');
    expect(aviso.texto).not.toContain('wa.me');
  });

  it('escapa el HTML de lo que escribe el cliente', () => {
    const { html } = armarAvisoDerivacion({
      canal: 'whatsapp',
      identificadorExterno: '573001112233',
      telefono: '573001112233',
      mensajes: [{ direccion: 'entrante', texto: '<script>alert(1)</script>' }],
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
