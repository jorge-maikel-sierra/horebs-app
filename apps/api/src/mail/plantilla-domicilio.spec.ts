import {
  construirHtmlDomicilio,
  type NotificacionDomicilio,
} from './plantilla-domicilio';

/** El espaciado entre etiquetas no cambia lo que ve el cliente de correo. */
const normalizar = (html: string) =>
  html.replace(/\s+/g, ' ').replace(/> </g, '><').trim();

const base: NotificacionDomicilio = {
  pedidoId: '0b0e6a4e-5d0e-4f6a-8f0e-3b7d1b1f2c3d',
  clienteNombre: 'Ana Pérez',
  clienteTelefono: '3157861208',
  direccionEntrega: 'Carrera 7 # 17B - 66',
  items: [
    {
      cantidad: 2,
      nombre: 'Pizza Horebs Especial (Mediana)',
      precioUnitario: 38000,
    },
    { cantidad: 1, nombre: 'Gaseosa', precioUnitario: 4000 },
  ],
  costoDomicilio: 5000,
  metodoPago: 'efectivo',
  total: 85000,
  notas: 'Sin cebolla, por favor',
};

describe('construirHtmlDomicilio', () => {
  it('efectivo, con teléfono, domicilio y notas', () => {
    expect(normalizar(construirHtmlDomicilio(base))).toMatchSnapshot();
  });

  it('transferencia, sin teléfono, sin notas y sin costo de domicilio', () => {
    const html = construirHtmlDomicilio({
      ...base,
      clienteTelefono: null,
      notas: null,
      costoDomicilio: null,
      metodoPago: 'transferencia',
    });
    expect(normalizar(html)).toMatchSnapshot();
  });

  it('tarjeta, mostrando el método ya pagado', () => {
    const html = construirHtmlDomicilio({ ...base, metodoPago: 'tarjeta' });
    expect(normalizar(html)).toMatchSnapshot();
  });

  it('escapa el HTML que escribe el cliente, incluidas las comillas', () => {
    const html = construirHtmlDomicilio({
      ...base,
      clienteNombre: '<script>alert(1)</script>',
      clienteTelefono: '3157"onmouseover="x',
      direccionEntrega: 'Calle "5" & <b>8</b>',
      notas: '"><img src=x>',
    });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('"onmouseover="x');
    expect(normalizar(html)).toMatchSnapshot();
  });
});
