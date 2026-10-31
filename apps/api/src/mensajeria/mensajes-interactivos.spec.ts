import {
  interactivoBotones,
  interactivoCatalogo,
  interactivoLista,
  interactivoTarjetaProducto,
  normalizarNegritaWhatsapp,
  textoTarjetasProductos,
  type TarjetaProducto,
} from './mensajes-interactivos';

const PIZZA: TarjetaProducto = {
  nombre: 'Pizza Hawaiana',
  descripcion: 'Jamón y piña',
  imagenUrl: null,
  precioDesde: 28000,
};

describe('normalizarNegritaWhatsapp', () => {
  it('pasa la negrita de Markdown a la de WhatsApp', () => {
    expect(normalizarNegritaWhatsapp('Una **Hawaiana** y **dos** colas')).toBe(
      'Una *Hawaiana* y *dos* colas',
    );
  });
});

describe('interactivoBotones', () => {
  it('respeta los límites de WhatsApp: 3 botones, títulos de 20 y cuerpo de 1024', () => {
    const botones = Array.from({ length: 5 }, (_, i) => ({
      id: `b${i}`,
      titulo: 'x'.repeat(30),
    }));
    const msg = interactivoBotones('y'.repeat(2000), botones) as {
      body: { text: string };
      action: { buttons: { reply: { id: string; title: string } }[] };
    };
    expect(msg.body.text).toHaveLength(1024);
    expect(msg.action.buttons).toHaveLength(3);
    expect(msg.action.buttons[0].reply.title).toHaveLength(20);
    expect(msg.action.buttons[0].reply.id).toBe('b0');
  });
});

describe('interactivoLista', () => {
  it('recorta a 10 filas con títulos de 24', () => {
    const filas = Array.from({ length: 12 }, (_, i) => ({
      id: `f${i}`,
      titulo: 'z'.repeat(40),
    }));
    const msg = interactivoLista({
      cuerpo: 'Elegí',
      boton: 'Elegir',
      filas,
    }) as {
      action: { sections: { rows: { id: string; title: string }[] }[] };
    };
    const rows = msg.action.sections[0].rows;
    expect(rows).toHaveLength(10);
    expect(rows[0].title).toHaveLength(24);
  });
});

describe('interactivoCatalogo', () => {
  it('lleva la miniatura solo si se pasa', () => {
    const sin = interactivoCatalogo() as { action: Record<string, unknown> };
    const con = interactivoCatalogo('var-1') as {
      action: { parameters: { thumbnail_product_retailer_id: string } };
    };
    expect(sin.action).toEqual({ name: 'catalog_message' });
    expect(con.action.parameters.thumbnail_product_retailer_id).toBe('var-1');
  });
});

describe('interactivoTarjetaProducto', () => {
  it('sin foto usa el nombre de encabezado y en negrita en el cuerpo', () => {
    const msg = interactivoTarjetaProducto(PIZZA) as {
      header: { type: string; text: string };
      body: { text: string };
      action: { buttons: { reply: { id: string; title: string } }[] };
    };
    expect(msg.header).toEqual({ type: 'text', text: 'Pizza Hawaiana' });
    expect(msg.body.text).toBe(
      `*Pizza Hawaiana*\nJamón y piña\nDesde $${(28000).toLocaleString('es-CO')}`,
    );
    expect(msg.action.buttons[0].reply).toEqual({
      id: 'pedir:Pizza Hawaiana',
      title: 'Agregar al pedido',
    });
  });

  it('con foto la imagen es el encabezado y el cuerpo no repite el nombre', () => {
    const msg = interactivoTarjetaProducto({
      ...PIZZA,
      imagenUrl: 'https://img/p.jpg',
    }) as { header: unknown; body: { text: string } };
    expect(msg.header).toEqual({
      type: 'image',
      image: { link: 'https://img/p.jpg' },
    });
    expect(msg.body.text.startsWith('Jamón')).toBe(true);
  });
});

describe('textoTarjetasProductos', () => {
  it('arma la lista en texto para Messenger e Instagram', () => {
    expect(textoTarjetasProductos([PIZZA])).toBe(
      `Estas son algunas opciones:\n• Pizza Hawaiana: desde $${(28000).toLocaleString('es-CO')}`,
    );
  });
});
