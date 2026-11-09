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

  it('muestra la entrega elegida', () => {
    const { texto } = armarResumenPedido({
      nombreCompleto: 'Jorge Sierra',
      lineas: LINEAS,
      modalidad: 'retiro',
      direccion: null,
      costoDomicilio: 5000,
      entrega: '6:30 p.m. (reserva)',
    });
    expect(texto).toContain('Entrega: 6:30 p.m. (reserva)');
  });

  it('muestra la nota del pedido, como qué sabores lleva una mitad y mitad', () => {
    const nota =
      'Pizza Mediana mitad Pizza Horebs Especial y mitad Pizza de Jamón y Queso. Se cobra el sabor de mayor valor: Pizza Horebs Especial, $40.000.';
    const { texto } = armarResumenPedido({
      nombreCompleto: 'Jorge Sierra',
      lineas: LINEAS,
      modalidad: 'retiro',
      direccion: null,
      costoDomicilio: 5000,
      nota,
    });
    expect(texto).toContain(`Nota: ${nota}`);
  });

  it('sin nota no agrega la línea', () => {
    const { texto } = armarResumenPedido({
      nombreCompleto: 'Jorge Sierra',
      lineas: LINEAS,
      modalidad: 'retiro',
      direccion: null,
      costoDomicilio: 5000,
    });
    expect(texto).not.toContain('Nota:');
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

  it('separa lo que valen los adicionales y el total los suma', () => {
    const { texto, total } = armarResumenPedido({
      nombreCompleto: 'Jorge Sierra',
      lineas: [
        {
          cantidad: 1,
          productoNombre: 'Pizza Hawaiana',
          varianteNombre: 'Mediana',
          precioUnitario: 35000,
        },
        {
          cantidad: 1,
          productoNombre: 'Adicional: Borde de queso',
          varianteNombre: 'Mediana',
          precioUnitario: 9000,
        },
        {
          cantidad: 2,
          productoNombre: 'Adicional: Pepperoni',
          varianteNombre: 'Mediana',
          precioUnitario: 9000,
        },
      ],
      modalidad: 'domicilio',
      direccion: 'Calle 1',
      costoDomicilio: 5000,
    });

    expect(texto).toContain('- 1x Adicional: Borde de queso (Mediana): $9.000');
    expect(texto).toContain('Adicionales: $27.000');
    expect(texto).toContain('*Total: $67.000*');
    expect(total).toBe(67000);
  });

  it('sin adicionales no agrega la línea', () => {
    const { texto } = armarResumenPedido({
      nombreCompleto: 'Jorge Sierra',
      lineas: LINEAS,
      modalidad: 'domicilio',
      direccion: 'Calle 1',
      costoDomicilio: 5000,
    });

    expect(texto).not.toContain('Adicionales:');
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

  it('con promoción descuenta el 20% de las pizzas y no del domicilio ni de las bebidas', () => {
    const { texto, total } = armarResumenPedido({
      nombreCompleto: 'Jorge Sierra',
      lineas: LINEAS,
      modalidad: 'domicilio',
      direccion: 'Calle 1',
      costoDomicilio: 5000,
      promocion: true,
    });
    // 35.000 de pizza - 7.000 + 8.000 de bebidas + 5.000 de domicilio.
    expect(total).toBe(41000);
    expect(texto).toContain('Descuento 20% en pizzas: -$7.000');
    expect(texto).toContain('Domicilio a Calle 1: $5.000');
    expect(texto).toContain('*Total: $41.000*');
  });

  it('sin promoción no muestra ninguna línea de descuento', () => {
    const { texto, total } = armarResumenPedido({
      nombreCompleto: 'Jorge Sierra',
      lineas: LINEAS,
      modalidad: 'retiro',
      direccion: null,
      costoDomicilio: 5000,
    });
    expect(total).toBe(43000);
    expect(texto).not.toContain('Descuento');
  });
});
