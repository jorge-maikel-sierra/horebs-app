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

  it('en Messenger e Instagram prohíbe mandar al cliente a WhatsApp o a la web', () => {
    for (const canal of ['messenger', 'instagram'] as const) {
      const prompt = armarSystemInstruction(canal);
      expect(prompt).toContain('NUNCA le digas que pida por WhatsApp');
      expect(prompt).toContain('puede escribir "humano"');
      expect(prompt).not.toContain('{{');
    }
    const whatsapp = armarSystemInstruction('whatsapp');
    expect(whatsapp).not.toContain('NUNCA le digas que pida por WhatsApp');
    expect(whatsapp).not.toContain('{{');
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
