import { armarResumenPedido } from './resumen-pedido';

const LINEAS = [
  {
    cantidad: 1,
    productoNombre: 'Pizza Vegetariana',
    varianteNombre: 'Mediana',
    precioUnitario: 35000,
  },
  {
    cantidad: 2,
    productoNombre: 'Bebidas',
    varianteNombre: 'Jugo Hit 400ml',
    precioUnitario: 4000,
  },
];

describe('armarResumenPedido', () => {
  it('suma productos y domicilio desde los precios recibidos', () => {
    const { texto, total } = armarResumenPedido({
      nombreCompleto: 'Jorge Sierra',
      lineas: LINEAS,
      modalidad: 'domicilio',
      direccion: 'Carrera 7H1 # 33 - 66',
      costoDomicilio: 5000,
    });
    expect(total).toBe(48000);
    expect(texto).toContain('- 1x Pizza Vegetariana (Mediana): $35.000');
    expect(texto).toContain('- 2x Bebidas (Jugo Hit 400ml): $8.000');
    expect(texto).toContain('Domicilio a Carrera 7H1 # 33 - 66: $5.000');
    expect(texto).toContain('*Total: $48.000*');
    // La pregunta del pago va en los botones, no en el resumen.
    expect(texto).not.toContain('método de pago');
  });

  it('no incluye los puntos: van en un mensaje aparte al día siguiente', () => {
    const { texto } = armarResumenPedido({
      nombreCompleto: 'Jorge Sierra',
      lineas: LINEAS,
      modalidad: 'domicilio',
      direccion: 'Calle 1',
      costoDomicilio: 5000,
    });
    expect(texto).not.toMatch(/puntos/i);
  });

  it('sin domicilio no cobra el envío', () => {
    const { texto, total } = armarResumenPedido({
      nombreCompleto: 'Jorge Sierra',
      lineas: LINEAS,
      modalidad: 'retiro',
      direccion: null,
      costoDomicilio: 5000,
    });
    expect(total).toBe(43000);
    expect(texto).toContain('Modalidad: para retirar en el local');
    expect(texto).not.toContain('Domicilio');
  });

  it('no muestra la variante de un producto que tiene una sola', () => {
    const { texto } = armarResumenPedido({
      nombreCompleto: 'Jorge Sierra',
      lineas: [
        {
          cantidad: 1,
          productoNombre: 'Panzerotti',
          varianteNombre: null,
          precioUnitario: 9000,
        },
      ],
      modalidad: 'local',
      direccion: null,
      costoDomicilio: 5000,
    });
    expect(texto).toContain('- 1x Panzerotti: $9.000');
  });

  it('nunca incluye datos de pago', () => {
    const { texto } = armarResumenPedido({
      nombreCompleto: 'Jorge Sierra',
      lineas: LINEAS,
      modalidad: 'domicilio',
      direccion: 'Calle 1',
      costoDomicilio: 5000,
    });
    expect(texto).not.toMatch(/nequi|daviplata|cuenta|llave|\d{7,}/i);
  });
});
