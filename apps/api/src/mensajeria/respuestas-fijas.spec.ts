import {
  detectarIntencion,
  diaSemanaBogota,
  textoDescuento,
  textoDomicilio,
  textoHorarioFijo,
  textoMitadYMitad,
  textoTamanos,
  type IntencionFija,
} from './respuestas-fijas';

// Noviembre de 2026: martes 3, miércoles 4, jueves 5, viernes 6, sábado 7,
// domingo 8, lunes 9. Bogotá es UTC-5, sin horario de verano.
const bogota = (dia: number, hora: string): Date =>
  new Date(`2026-11-${String(dia).padStart(2, '0')}T${hora}:00-05:00`);

describe('textoDescuento (20% solo miércoles y jueves hasta las 8:00 p.m.)', () => {
  it('el miércoles antes de las 8:00 p.m. está activo', () => {
    const texto = textoDescuento(bogota(4, '15:00'));
    expect(texto).toContain('Hoy miércoles está activo el descuento del 20%');
    expect(texto).toContain('hasta las 8:00 p.m.');
  });

  it('a las 7:59 p.m. todavía está activo y a las 8:00 p.m. ya no', () => {
    expect(textoDescuento(bogota(4, '19:59'))).toContain('está activo');
    const cerrado = textoDescuento(bogota(4, '20:00'));
    expect(cerrado).toContain('Hoy ya terminó');
    expect(cerrado).toContain('mañana jueves');
  });

  it('el jueves antes de las 8:00 p.m. está activo; después, el próximo es el miércoles', () => {
    expect(textoDescuento(bogota(5, '10:00'))).toContain(
      'Hoy jueves está activo',
    );
    const tarde = textoDescuento(bogota(5, '20:30'));
    expect(tarde).toContain('Hoy ya terminó');
    expect(tarde).toContain('el próximo miércoles');
  });

  it('los demás días explica la regla y cuándo vuelve', () => {
    const regla = 'aplica solo los miércoles y jueves, hasta las 8:00 p.m.';
    expect(textoDescuento(bogota(3, '12:00'))).toContain('mañana miércoles');
    expect(textoDescuento(bogota(6, '12:00'))).toContain(
      'el próximo miércoles',
    );
    expect(textoDescuento(bogota(7, '12:00'))).toContain(regla);
    expect(textoDescuento(bogota(8, '12:00'))).toContain(
      'Hoy domingo no está activo',
    );
    expect(textoDescuento(bogota(9, '12:00'))).toContain('este miércoles');
  });

  it('usa el día de Bogotá y no el de UTC', () => {
    // Miércoles 8:30 p.m. en Bogotá = jueves 1:30 a.m. UTC.
    const instante = new Date('2026-11-05T01:30:00Z');
    expect(diaSemanaBogota(instante)).toBe(3);
    expect(textoDescuento(instante)).toContain('mañana jueves');
  });
});

describe('textos fijos del negocio', () => {
  it('el horario y el estado salen del código, sin repetir "ahora mismo"', () => {
    const cerrado = textoHorarioFijo(bogota(4, '08:00'));
    expect(cerrado).toContain('4:00pm – 11:00pm');
    expect(cerrado.match(/[Aa]hora mismo/g)).toHaveLength(1);
    expect(textoHorarioFijo(bogota(4, '18:00'))).toContain('abierto');
  });

  it('domicilio, tamaños y mitad y mitad usan los datos confirmados', () => {
    expect(textoDomicilio()).toContain('$5.000');
    expect(textoTamanos()).toContain('Mediana: 8 porciones, 30 centímetros');
    expect(textoMitadYMitad()).toContain('sabor de mayor valor');
    expect(textoMitadYMitad()).not.toMatch(/\$\d/);
  });
});

describe('detectarIntencion con mensajes reales de clientes', () => {
  const casos: [string, IntencionFija | null][] = [
    ['¿Cómo aplico el 20% de descuento?', 'descuento'],
    ['hay alguna promo?', 'descuento'],
    ['Me regalas el menú', 'menu'],
    ['regálame la carta', 'menu'],
    ['Tienen carta,?', 'menu'],
    ['Enviame el menú por fa', 'menu'],
    ['Ver menú 🍕', 'menu'],
    ['Hacer un pedido 🛵', 'pedir'],
    ['Horario y ubicación 📍', 'horarioUbicacion'],
    ['¿Qué horario tienen?', 'horario'],
    ['dónde están hubicad', 'ubicacion'],
    ['direcion', 'ubicacion'],
    ['En que parte de Riohacha están ubicados', 'ubicacion'],
    ['Y el envío sale por cuanto', 'domicilio'],
    ['¿Llegan a domicilio a mi barrio?', 'domicilio'],
    ['Que precio tiene las pizzas', 'precios'],
    ['Cuanto cuesta la pizza', 'precios'],
    ['Precio de la hawaiana porción personal', 'precios'],
    ['cuántas porciones trae la mediana', 'tamanos'],
    ['Como trasfiero?', null],
    ['Como transfiero?', 'pagos'],
    ['Tengo nequi', 'pagos'],
    ['Mi vida necesito hablar con una persona', 'humano'],
    ['Hablar con una persona 👤', 'humano'],
    ['humano', 'humano'],
    ['buenas', 'saludo'],
    ['Hola', 'saludo'],
    ['iniciar', 'saludo'],
    [
      'Una pregunta al encargar la media solo us de un menú o uno puede pedir mural una y mitad otra',
      'mitad',
    ],
    ['¿Se puede mitad y mitad?', 'mitad'],
  ];

  it.each(casos)('"%s" → %s', (texto, esperado) => {
    expect(detectarIntencion(texto)).toBe(esperado);
  });

  it('lo que no es de texto fijo sigue su camino (Gemini o el pedido)', () => {
    expect(detectarIntencion('¿Qué trae la Horebs Especial?')).toBeNull();
    expect(detectarIntencion('Una mediana')).toBeNull();
    expect(
      detectarIntencion('Hola quiero una hawaiana mediana para dos personas'),
    ).toBeNull();
  });

  it('un mensaje largo con los datos de un pedido no lo agarra una respuesta fija', () => {
    const pedido =
      'Liseth Amaya Medina \nCarrera 12A #38-14 Barrio Comunitario \n3015643983\nPago por Nequi o Brebe';
    expect(detectarIntencion(pedido)).toBeNull();
    const mitad =
      'Yessedy Cotes \n3188043918\nCalle 14 a #22-14 cooperativo\nPizza media \nMitad jamón con queso y la otra pizza ranchera';
    expect(detectarIntencion(mitad)).toBeNull();
  });

  it('"humano" y el descuento se contestan aunque el mensaje sea largo', () => {
    expect(
      detectarIntencion(
        'Hola buenas tardes mi nombre es Carlos y vi la publicidad del 20% de descuento en Facebook, ¿cómo lo aplico?',
      ),
    ).toBe('descuento');
  });
});
