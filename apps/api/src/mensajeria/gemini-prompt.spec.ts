import { armarSystemInstruction, SYSTEM_INSTRUCTION } from './gemini-prompt';

describe('armarSystemInstruction', () => {
  it('genera instrucción para WhatsApp por defecto', () => {
    const prompt = armarSystemInstruction();
    expect(prompt).toContain('Respondés por WhatsApp');
    expect(prompt).toContain('UN SOLO asterisco');
    expect(prompt).not.toContain('Aviso inicial obligatorio');
    expect(prompt).toBe(SYSTEM_INSTRUCTION);
  });

  it('agrega aviso inicial en WhatsApp cuando esInicio es true', () => {
    const prompt = armarSystemInstruction('whatsapp', true);
    expect(prompt).toContain('Aviso inicial obligatorio');
    expect(prompt).toContain('asistente virtual de Pizzería Horebs');
  });

  it('adapta el prompt para Messenger sin Markdown', () => {
    const prompt = armarSystemInstruction('messenger', false);
    expect(prompt).toContain('Respondés por Messenger');
    expect(prompt).toContain('NO uses asteriscos');
    expect(prompt).not.toContain('Aviso inicial obligatorio');
  });

  it('en Messenger e Instagram no manda a pedir nombre ni teléfono antes del pedido', () => {
    for (const canal of ['messenger', 'instagram'] as const) {
      const prompt = armarSystemInstruction(canal);
      expect(prompt).toContain('NUNCA le pidas su nombre ni su teléfono');
      expect(prompt).toContain('No llames a obtener_cliente_registrado');
      expect(prompt).not.toContain('usá SIEMPRE obtener_cliente_registrado');
      expect(prompt).not.toContain('pedile su número de celular');
    }
  });

  it('en Messenger e Instagram no manda al cliente a otro canal, pero da el enlace de WhatsApp si lo pide', () => {
    for (const canal of ['messenger', 'instagram'] as const) {
      const prompt = armarSystemInstruction(canal);
      expect(prompt).toContain('NUNCA le sugieras por tu cuenta');
      expect(prompt).toContain('nunca le digas que no tenemos WhatsApp');
      expect(prompt).toContain('https://wa.me/573157861208');
      expect(prompt).toContain('NUNCA digas a qué zonas');
      expect(prompt).not.toContain('{{');
    }
    const whatsapp = armarSystemInstruction('whatsapp');
    expect(whatsapp).not.toContain('NUNCA le sugieras por tu cuenta');
    expect(whatsapp).not.toContain('{{');
  });

  it('en Messenger e Instagram el modelo conoce el descuento del 20% y no inventa medios de pago', () => {
    for (const canal of ['messenger', 'instagram'] as const) {
      const prompt = armarSystemInstruction(canal);
      expect(prompt).toContain(
        'SOLO los miércoles y jueves, hasta las 8:00 p.m.',
      );
      expect(prompt).toContain('Nunca digas que no hay descuentos');
      expect(prompt).toContain('NUNCA preguntes ni nombres medios de pago');
    }
    expect(armarSystemInstruction('whatsapp')).not.toContain(
      'SOLO los miércoles y jueves',
    );
  });

  it('en todos los canales prohíbe prometer avisos o recordatorios que el bot no puede cumplir', () => {
    for (const canal of ['whatsapp', 'messenger', 'instagram'] as const) {
      expect(armarSystemInstruction(canal)).toContain(
        'NUNCA le ofrezcas "avisarte cuando abramos"',
      );
    }
  });

  it('en WhatsApp sigue usando obtener_cliente_registrado en el primer mensaje', () => {
    expect(armarSystemInstruction('whatsapp')).toContain(
      'usá SIEMPRE obtener_cliente_registrado',
    );
  });

  it('el cierre del pedido lo hace el sistema en los tres canales, sin derivar a una persona', () => {
    for (const canal of ['whatsapp', 'messenger', 'instagram'] as const) {
      const prompt = armarSystemInstruction(canal);
      expect(prompt).toContain('el sistema registra el pedido solo');
      expect(prompt).not.toContain('Solo fuera de WhatsApp');
    }
  });

  it('adapta el prompt para Instagram Direct con saludo inicial si es el primer mensaje', () => {
    const prompt = armarSystemInstruction('instagram', true);
    expect(prompt).toContain('Respondés por Instagram Direct');
    expect(prompt).toContain('NO uses asteriscos');
    expect(prompt).toContain('Aviso inicial obligatorio');
  });
});
