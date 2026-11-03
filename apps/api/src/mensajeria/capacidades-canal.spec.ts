import {
  CAPACIDADES_CANAL,
  obtenerCapacidades,
  partirTextoPorBytes,
} from './capacidades-canal';

describe('capacidades-canal', () => {
  it('declara las capacidades de los tres canales', () => {
    expect(obtenerCapacidades('whatsapp')).toEqual(CAPACIDADES_CANAL.whatsapp);
    expect(obtenerCapacidades('messenger')).toEqual(
      CAPACIDADES_CANAL.messenger,
    );
    expect(obtenerCapacidades('instagram')).toEqual(
      CAPACIDADES_CANAL.instagram,
    );

    expect(CAPACIDADES_CANAL.whatsapp.admiteTelefonoNativo).toBe(false);
    expect(CAPACIDADES_CANAL.messenger.admiteTelefonoNativo).toBe(true);
    expect(CAPACIDADES_CANAL.instagram.admiteTelefonoNativo).toBe(false);
    expect(CAPACIDADES_CANAL.instagram.maxBytesTexto).toBe(1000);
  });

  describe('partirTextoPorBytes', () => {
    it('devuelve el texto tal cual si no supera el límite de bytes', () => {
      const texto = 'Hola mundo, ¿cómo va todo? 🍕';
      const partes = partirTextoPorBytes(texto, 100);
      expect(partes).toEqual([texto]);
    });

    it('respeta saltos de línea al partir', () => {
      const lineas = [
        'Primera línea con pizza 🍕',
        'Segunda línea con queso',
        'Tercera línea con champiñones',
      ].join('\n');

      const maxBytes = 40;
      const partes = partirTextoPorBytes(lineas, maxBytes);
      for (const p of partes) {
        expect(Buffer.byteLength(p, 'utf8')).toBeLessThanOrEqual(maxBytes);
      }
      expect(partes.join('\n')).toBe(lineas);
    });

    it('no rompe emojis ni caracteres multi-byte al partir una palabra larga', () => {
      const emojiRepetido = '🍕'.repeat(30); // 30 * 4 = 120 bytes
      const partes = partirTextoPorBytes(emojiRepetido, 20); // 20 bytes -> 5 emojis por parte
      expect(partes.length).toBe(6);
      for (const p of partes) {
        expect(Buffer.byteLength(p, 'utf8')).toBeLessThanOrEqual(20);
        // Cada parte debe decodificarse limpiamente en emojis completos sin caracteres rotos
        expect(p).toMatch(/^(🍕)+$/);
      }
      expect(partes.join('')).toBe(emojiRepetido);
    });

    it('parte palabras normales si exceden el límite de bytes', () => {
      const palabraLarga = 'Supercalifragilisticoespialidoso';
      const partes = partirTextoPorBytes(palabraLarga, 10);
      for (const p of partes) {
        expect(Buffer.byteLength(p, 'utf8')).toBeLessThanOrEqual(10);
      }
      expect(partes.join('')).toBe(palabraLarga);
    });
  });
});
