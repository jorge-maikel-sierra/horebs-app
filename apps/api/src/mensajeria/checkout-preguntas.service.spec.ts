import type { CatalogService } from '../catalog/catalog.service';
import type { PedidosConsultasService } from '../pedidos/pedidos-consultas.service';
import type { CheckoutEnviosService } from './checkout-envios.service';
import {
  BOTON,
  PREFIJO_ADICIONAL_PIZZA,
  PREFIJO_ADICIONAL_PRODUCTO,
  type ContextoCheckout,
} from './checkout-whatsapp';
import {
  CheckoutPreguntasService,
  TEXTO_PEDIR_DIRECCION,
} from './checkout-preguntas.service';
import type {
  CheckoutWhatsapp,
  ConversacionesService,
} from './conversaciones.service';

const CTX: ContextoCheckout = {
  identificadorExterno: '573157861208',
  conversacionId: 'conv-1',
  mensajeId: 'wamid-1',
};

function crearServicio(opciones: {
  ultimaDireccion?: string | null;
  direccionCliente?: string | null;
}) {
  const envios = {
    guardar: jest.fn().mockResolvedValue(undefined),
    texto: jest.fn().mockResolvedValue(undefined),
    botones: jest.fn().mockResolvedValue(undefined),
  };
  const consultas = {
    ultimoPedidoPorTelefono: jest
      .fn()
      .mockResolvedValue(
        opciones.ultimaDireccion
          ? { direccionEntrega: opciones.ultimaDireccion }
          : null,
      ),
    clientePorTelefono: jest
      .fn()
      .mockResolvedValue(
        opciones.direccionCliente
          ? { direccion: opciones.direccionCliente }
          : null,
      ),
  };
  const servicio = new CheckoutPreguntasService(
    {} as ConversacionesService,
    {} as CatalogService,
    consultas as unknown as PedidosConsultasService,
    envios as unknown as CheckoutEnviosService,
  );
  return { servicio, envios };
}

describe('CheckoutPreguntasService · dirección', () => {
  it('sin dirección previa pide que la escriba, sin botón de ubicación', async () => {
    const { servicio, envios } = crearServicio({});
    const checkout: CheckoutWhatsapp = { paso: 'modalidad' };

    await servicio.direccion(CTX, checkout);

    expect(checkout.paso).toBe('direccion');
    expect(envios.guardar).toHaveBeenCalledWith(CTX, checkout);
    expect(envios.texto).toHaveBeenCalledWith(CTX, TEXTO_PEDIR_DIRECCION);
    expect(envios.botones).not.toHaveBeenCalled();
  });

  it('con la dirección del último pedido la ofrece con "Sí, ahí" y "Otra dirección"', async () => {
    const { servicio, envios } = crearServicio({
      ultimaDireccion: 'Calle 15 # 8-20, Los Nogales',
    });
    const checkout: CheckoutWhatsapp = { paso: 'modalidad' };

    await servicio.direccion(CTX, checkout);

    expect(checkout.direccionSugerida).toBe('Calle 15 # 8-20, Los Nogales');
    expect(envios.botones).toHaveBeenCalledWith(
      CTX,
      expect.stringContaining('Calle 15 # 8-20, Los Nogales'),
      [
        { id: BOTON.direccionAnterior, titulo: 'Sí, ahí' },
        { id: BOTON.otraDireccion, titulo: 'Otra dirección' },
      ],
    );
    expect(envios.texto).not.toHaveBeenCalled();
  });

  it('usa la dirección del cliente si no hay pedido previo', async () => {
    const { servicio } = crearServicio({ direccionCliente: 'Carrera 7 # 17B' });
    const checkout: CheckoutWhatsapp = { paso: 'modalidad' };

    await servicio.direccion(CTX, checkout);

    expect(checkout.direccionSugerida).toBe('Carrera 7 # 17B');
  });

  it('pedirDireccion deja el paso en dirección y manda solo texto', async () => {
    const { servicio, envios } = crearServicio({});
    const checkout: CheckoutWhatsapp = { paso: 'pago' };

    await servicio.pedirDireccion(CTX, checkout);

    expect(checkout.paso).toBe('direccion');
    expect(envios.texto).toHaveBeenCalledWith(CTX, TEXTO_PEDIR_DIRECCION);
    expect(TEXTO_PEDIR_DIRECCION).not.toMatch(/Enviar ubicaci/i);
  });
});

describe('CheckoutPreguntasService · adicionales', () => {
  const PRECIOS: [string, number][] = [
    ['Personal', 5000],
    ['Mediana', 9000],
    ['Grande', 12000],
  ];
  const adicional = (id: string, nombre: string) => ({
    id,
    nombre,
    variantes: PRECIOS.map(([n, precio]) => ({
      id: `${id}-${n}`,
      nombre: n,
      precio,
      precio_oferta: null,
    })),
  });
  const PRODUCTOS = [
    adicional('ad-borde', 'Adicional: Borde de queso'),
    adicional('ad-pina', 'Adicional: Piña'),
  ];
  const pizza = (varianteId: string, nombre: string, tamano: string) => ({
    varianteId,
    productoNombre: nombre,
    varianteNombre: tamano,
    conTamanos: true,
    cantidad: 1,
    precio: 35000,
  });
  const HAWAIANA = pizza('hw-M', 'Pizza Hawaiana', 'Mediana');
  const MARGARITA = pizza('mg-G', 'Pizza Margarita', 'Grande');

  // El carrito vive en la conversación del canal: pedirlo de otro canal da vacío.
  function crear(
    carritoResuelto: ReturnType<typeof pizza>[],
    canalDelCarrito = 'whatsapp',
  ) {
    const carrito = carritoResuelto.map((i) => ({
      varianteId: i.varianteId,
      cantidad: i.cantidad,
    }));
    const envios = {
      guardar: jest.fn().mockResolvedValue(undefined),
      guardarCarrito: jest.fn().mockResolvedValue(undefined),
      texto: jest.fn().mockResolvedValue(undefined),
      botones: jest.fn().mockResolvedValue(undefined),
      lista: jest.fn().mockResolvedValue(undefined),
    };
    const servicio = new CheckoutPreguntasService(
      {
        obtenerCarrito: jest
          .fn()
          .mockImplementation((canal: string) =>
            Promise.resolve(canal === canalDelCarrito ? carrito : []),
          ),
      } as unknown as ConversacionesService,
      {
        getProductos: jest.fn().mockResolvedValue(PRODUCTOS),
        resolverCarrito: jest.fn().mockResolvedValue({
          disponibles: carritoResuelto,
          noDisponibles: 0,
        }),
      } as unknown as CatalogService,
      {} as PedidosConsultasService,
      envios as unknown as CheckoutEnviosService,
    );
    return { servicio, envios };
  }

  it('infoAdicionales contesta con los precios de la base y no toca el carrito', async () => {
    const { servicio, envios } = crear([HAWAIANA]);

    await expect(servicio.infoAdicionales(CTX)).resolves.toBe(true);

    expect(envios.texto).toHaveBeenCalledWith(
      CTX,
      expect.stringContaining(
        'Personal $5.000, Mediana $9.000, Grande $12.000',
      ),
    );
    expect(envios.guardarCarrito).not.toHaveBeenCalled();
  });

  it('ofrece los adicionales con botones cuando hay una pizza', async () => {
    const { servicio, envios } = crear([HAWAIANA]);
    const checkout: CheckoutWhatsapp = { paso: 'modalidad' };

    await expect(
      servicio.ofrecerAdicionales(CTX, checkout, '¡Anotado!'),
    ).resolves.toBe(true);

    expect(checkout.paso).toBe('adicionales');
    expect(envios.botones).toHaveBeenCalledWith(
      CTX,
      expect.stringContaining('adicionales'),
      [
        { id: BOTON.adicionalesSi, titulo: 'Sí, agregar' },
        { id: BOTON.adicionalesNo, titulo: 'No, seguir' },
      ],
    );
  });

  it('sin pizza en el carrito no ofrece adicionales', async () => {
    const { servicio, envios } = crear([
      { ...HAWAIANA, productoNombre: 'Bebidas', varianteNombre: 'Sprite' },
    ]);
    const checkout: CheckoutWhatsapp = { paso: 'modalidad' };

    await expect(
      servicio.ofrecerAdicionales(CTX, checkout, '¡Anotado!'),
    ).resolves.toBe(false);

    expect(checkout.paso).toBe('modalidad');
    expect(envios.botones).not.toHaveBeenCalled();
  });

  it('"Sí, agregar" muestra la lista de adicionales sin el prefijo', async () => {
    const { servicio, envios } = crear([HAWAIANA]);

    const respuesta = await servicio.responderAdicionales(
      CTX,
      { paso: 'adicionales' },
      { tipo: 'boton', id: BOTON.adicionalesSi },
    );

    expect(respuesta).toBe('esperando');
    expect(envios.lista).toHaveBeenCalledWith(
      CTX,
      expect.any(String),
      'Ver adicionales',
      [
        {
          id: `${PREFIJO_ADICIONAL_PRODUCTO}ad-borde`,
          titulo: 'Borde de queso',
        },
        { id: `${PREFIJO_ADICIONAL_PRODUCTO}ad-pina`, titulo: 'Piña' },
      ],
    );
  });

  it('con una sola pizza suma el adicional del MISMO tamaño y muestra su precio', async () => {
    const { servicio, envios } = crear([HAWAIANA]);
    const checkout: CheckoutWhatsapp = { paso: 'adicionales' };

    await servicio.responderAdicionales(CTX, checkout, {
      tipo: 'boton',
      id: `${PREFIJO_ADICIONAL_PRODUCTO}ad-borde`,
    });

    expect(envios.guardarCarrito).toHaveBeenCalledWith(CTX, [
      { varianteId: 'hw-M', cantidad: 1 },
      { varianteId: 'ad-borde-Mediana', cantidad: 1 },
    ]);
    expect(envios.botones).toHaveBeenCalledWith(
      CTX,
      expect.stringContaining(
        '*Borde de queso* a tu Pizza Hawaiana (Mediana): $9.000',
      ),
      [
        { id: BOTON.adicionalesSi, titulo: 'Otro adicional' },
        { id: BOTON.adicionalesNo, titulo: 'Listo, seguir' },
      ],
    );
    expect(checkout.adicionalProductoId).toBeUndefined();
  });

  it('en Instagram suma el adicional al carrito de Instagram y no pierde la pizza', async () => {
    const { servicio, envios } = crear([HAWAIANA], 'instagram');
    const ctxInstagram = {
      ...CTX,
      canal: 'instagram' as const,
      identificadorExterno: 'igsid-1',
    };

    await servicio.responderAdicionales(
      ctxInstagram,
      { paso: 'adicionales' },
      { tipo: 'boton', id: `${PREFIJO_ADICIONAL_PRODUCTO}ad-borde` },
    );

    expect(envios.guardarCarrito).toHaveBeenCalledWith(ctxInstagram, [
      { varianteId: 'hw-M', cantidad: 1 },
      { varianteId: 'ad-borde-Mediana', cantidad: 1 },
    ]);
  });

  it('con varias pizzas pregunta a cuál y cobra según el tamaño de la elegida', async () => {
    const { servicio, envios } = crear([HAWAIANA, MARGARITA]);
    const checkout: CheckoutWhatsapp = { paso: 'adicionales' };

    await servicio.responderAdicionales(CTX, checkout, {
      tipo: 'boton',
      id: `${PREFIJO_ADICIONAL_PRODUCTO}ad-pina`,
    });

    expect(envios.guardarCarrito).not.toHaveBeenCalled();
    expect(checkout.adicionalProductoId).toBe('ad-pina');
    expect(envios.lista).toHaveBeenCalledWith(
      CTX,
      expect.stringContaining('2. Pizza Margarita (Grande)'),
      'Elegir pizza',
      [
        { id: `${PREFIJO_ADICIONAL_PIZZA}hw-M`, titulo: 'Pizza 1' },
        { id: `${PREFIJO_ADICIONAL_PIZZA}mg-G`, titulo: 'Pizza 2' },
      ],
    );

    await servicio.responderAdicionales(CTX, checkout, {
      tipo: 'boton',
      id: `${PREFIJO_ADICIONAL_PIZZA}mg-G`,
    });

    expect(envios.guardarCarrito).toHaveBeenCalledWith(CTX, [
      { varianteId: 'hw-M', cantidad: 1 },
      { varianteId: 'mg-G', cantidad: 1 },
      { varianteId: 'ad-pina-Grande', cantidad: 1 },
    ]);
    expect(envios.botones).toHaveBeenCalledWith(
      CTX,
      expect.stringContaining('(Grande): $12.000'),
      expect.any(Array),
    );
  });

  it('"No, seguir" y "no" escrito terminan el paso', async () => {
    const { servicio } = crear([HAWAIANA]);

    await expect(
      servicio.responderAdicionales(
        CTX,
        { paso: 'adicionales' },
        { tipo: 'boton', id: BOTON.adicionalesNo },
      ),
    ).resolves.toBe('listo');
    await expect(
      servicio.responderAdicionales(
        CTX,
        { paso: 'adicionales' },
        { tipo: 'texto', texto: 'no gracias' },
      ),
    ).resolves.toBe('listo');
  });

  it('una pregunta escrita en el paso se la deja a Gemini', async () => {
    const { servicio } = crear([HAWAIANA]);

    await expect(
      servicio.responderAdicionales(
        CTX,
        { paso: 'adicionales' },
        { tipo: 'texto', texto: '¿cuánto vale el borde?' },
      ),
    ).resolves.toBe('ignorar');
  });

  it('un adicional escrito ("con piña") se agrega en cualquier paso', async () => {
    const { servicio, envios } = crear([HAWAIANA]);
    const checkout: CheckoutWhatsapp = { paso: 'pago' };

    await expect(
      servicio.adicionalEscrito(CTX, checkout, 'con piña'),
    ).resolves.toBe(true);

    expect(checkout.paso).toBe('adicionales');
    expect(envios.guardarCarrito).toHaveBeenCalledWith(CTX, [
      { varianteId: 'hw-M', cantidad: 1 },
      { varianteId: 'ad-pina-Mediana', cantidad: 1 },
    ]);
  });

  it('un texto que no nombra un adicional no lo toma el checkout', async () => {
    const { servicio, envios } = crear([HAWAIANA]);

    await expect(
      servicio.adicionalEscrito(CTX, { paso: 'nombre' }, 'Ana Piña'),
    ).resolves.toBe(false);

    expect(envios.guardarCarrito).not.toHaveBeenCalled();
  });
});

describe('CheckoutPreguntasService · pago con descuento', () => {
  const PIZZA = {
    varianteId: 'hw-M',
    productoNombre: 'Pizza Hawaiana',
    varianteNombre: 'Mediana',
    conTamanos: true,
    cantidad: 1,
    precio: 35000,
  };
  const CHECKOUT_PAGO: CheckoutWhatsapp = {
    paso: 'hora',
    modalidad: 'domicilio',
    direccion: 'Calle 1',
    nombre: 'Ana',
    apellido: 'Pérez',
  };

  function crear(ofertaEnviadaEn: string | null = null) {
    const envios = {
      ofertaEnviadaEn: jest.fn().mockResolvedValue(ofertaEnviadaEn),
      guardar: jest.fn().mockResolvedValue(undefined),
      texto: jest.fn().mockResolvedValue(undefined),
      botones: jest.fn().mockResolvedValue(undefined),
    };
    const servicio = new CheckoutPreguntasService(
      {
        obtenerCarrito: jest.fn().mockResolvedValue([]),
      } as unknown as ConversacionesService,
      {
        resolverCarrito: jest
          .fn()
          .mockResolvedValue({ disponibles: [PIZZA], noDisponibles: 0 }),
      } as unknown as CatalogService,
      {} as PedidosConsultasService,
      envios as unknown as CheckoutEnviosService,
    );
    return { servicio, envios };
  }

  afterEach(() => jest.useRealTimers());

  // Noviembre de 2026: miércoles 4 y viernes 6, hora de Bogotá (UTC-5).
  it('en Messenger un miércoles antes de las 8 p.m. el resumen lleva el 20% de la pizza, no del domicilio', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-04T15:00:00-05:00') });
    const { servicio, envios } = crear();
    const checkout = { ...CHECKOUT_PAGO };

    const texto = await servicio.pago({ ...CTX, canal: 'messenger' }, checkout);

    expect(texto).toContain('Descuento 20% en pizzas: -$7.000');
    expect(texto).toContain('Domicilio a Calle 1: $5.000');
    expect(texto).toContain('*Total: $33.000*');
    expect(checkout.promocionCotizadaEn).toBe('2026-11-04T20:00:00.000Z');
    expect(envios.guardar).toHaveBeenCalled();
  });

  it('un viernes no hay descuento y no queda cotización guardada', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-06T15:00:00-05:00') });
    const { servicio } = crear();
    const checkout = { ...CHECKOUT_PAGO, promocionCotizadaEn: 'vieja' };

    const texto = await servicio.pago({ ...CTX, canal: 'instagram' }, checkout);

    expect(texto).not.toContain('Descuento');
    expect(texto).toContain('*Total: $40.000*');
    expect(checkout.promocionCotizadaEn).toBeUndefined();
  });

  it('con la oferta del seguimiento vigente, un viernes lleva el 10% de las pizzas personales', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-06T15:00:00-05:00') });
    const { servicio } = crear('2026-11-06T10:00:00-05:00');
    const checkout = { ...CHECKOUT_PAGO };

    const texto = await servicio.pago({ ...CTX, canal: 'messenger' }, checkout);

    // La pizza del carrito es mediana: la oferta no la toca.
    expect(texto).not.toContain('Oferta');
    expect(checkout.ofertaCotizadaEn).toBe('2026-11-06T20:00:00.000Z');
    expect(checkout.promocionCotizadaEn).toBeUndefined();
  });

  it('un miércoles con oferta vigente gana el 20% y no se acumulan', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-04T15:00:00-05:00') });
    const { servicio } = crear('2026-11-04T10:00:00-05:00');
    const checkout = { ...CHECKOUT_PAGO };

    const texto = await servicio.pago({ ...CTX, canal: 'messenger' }, checkout);

    expect(texto).toContain('Descuento 20% en pizzas');
    expect(texto).not.toContain('Oferta');
    expect(checkout.ofertaCotizadaEn).toBeUndefined();
  });

  it('en WhatsApp no se aplica aunque sea miércoles', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-04T15:00:00-05:00') });
    const { servicio } = crear();
    const checkout = { ...CHECKOUT_PAGO };

    const texto = await servicio.pago(CTX, checkout);

    expect(texto).not.toContain('Descuento');
    expect(checkout.promocionCotizadaEn).toBeUndefined();
  });
});
