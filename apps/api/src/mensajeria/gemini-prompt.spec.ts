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
    expect(prompt).toContain('pedile su número de celular');
    expect(prompt).not.toContain('Aviso inicial obligatorio');
  });

  it('adapta el prompt para Instagram Direct con saludo inicial si es el primer mensaje', () => {
    const prompt = armarSystemInstruction('instagram', true);
    expect(prompt).toContain('Respondés por Instagram Direct');
    expect(prompt).toContain('NO uses asteriscos');
    expect(prompt).toContain('Aviso inicial obligatorio');
  });
});
