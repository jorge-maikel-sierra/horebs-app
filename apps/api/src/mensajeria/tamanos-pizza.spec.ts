import { TEXTO_TAMANOS, medidaDe, tamanoMencionado } from './tamanos-pizza';

describe('tamaños de pizza', () => {
  it('el texto para el modelo sigue igual que el dato del negocio', () => {
    expect(TEXTO_TAMANOS).toBe(
      'Personal: 6 porciones, 24 centímetros de diámetro. ' +
        'Mediana: 8 porciones, 30 centímetros de diámetro. ' +
        'Grande: 12 porciones, 40 centímetros de diámetro.',
    );
  });

  it('medidaDe reconoce la variante sin importar mayúsculas', () => {
    expect(medidaDe('mediana')?.porciones).toBe(8);
    expect(medidaDe('Única')).toBeUndefined();
  });

  it('tamanoMencionado encuentra el tamaño por nombre o por centímetros', () => {
    expect(tamanoMencionado('Cuatas porciones trae la mediana')?.nombre).toBe(
      'Mediana',
    );
    expect(tamanoMencionado('y la de 40 cm?')?.nombre).toBe('Grande');
    expect(tamanoMencionado('cuantas porciones trae')).toBeUndefined();
  });
});
