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

  function crear(carritoResuelto: ReturnType<typeof pizza>[]) {
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
        obtenerCarrito: jest.fn().mockResolvedValue(carrito),
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
