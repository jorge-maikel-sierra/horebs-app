import type { MailService } from '../mail/mail.service';
import type { ConversionesMetaService } from '../mensajeria/conversiones-meta.service';
import { AvisosVentaService } from './avisos-venta.service';
import type {
  FilaClienteVenta,
  FilaPedidoVenta,
  ItemVentaCalculado,
} from './pedidos-admin.tipos';

const CLIENTE: FilaClienteVenta = {
  id: 'c-1',
  nombre: 'Ana',
  apellido: null,
  telefono: '573157861208',
  correo: null,
  cedula: null,
};
const ITEMS: ItemVentaCalculado[] = [
  {
    variante_id: 'v-1',
    nombre_personalizado: null,
    producto_nombre: 'Pizza Hawaiana',
    variante_nombre: 'Personal',
    cantidad: 2,
    precio_unitario: 18000,
    subtotal: 36000,
  },
  {
    variante_id: null,
    nombre_personalizado: 'Borde de queso',
    producto_nombre: 'Borde de queso',
    variante_nombre: '',
    cantidad: 1,
    precio_unitario: 4000,
    subtotal: 4000,
  },
];

function pedido(cambios: Partial<FilaPedidoVenta> = {}): FilaPedidoVenta {
  return {
    id: 'ped-1',
    modalidad: 'local',
    direccion_entrega: null,
    costo_domicilio: 0,
    metodo_pago: 'efectivo',
    total: 40000,
    created_at: '2026-11-01T20:00:00Z',
    ...cambios,
  };
}

function crearServicio() {
  const mail = { enviarNotificacionDomicilio: jest.fn() };
  const conversionesMeta = { avisarCompra: jest.fn() };
  const servicio = new AvisosVentaService(
    mail as unknown as MailService,
    conversionesMeta as unknown as ConversionesMetaService,
  );
  return { servicio, mail, conversionesMeta };
}

describe('AvisosVentaService.avisar', () => {
  it('toda venta avisa la compra a Meta con el teléfono y el total', () => {
    const { servicio, conversionesMeta, mail } = crearServicio();

    servicio.avisar({
      pedido: pedido(),
      cliente: CLIENTE,
      items: ITEMS,
      notas: null,
    });

    expect(conversionesMeta.avisarCompra).toHaveBeenCalledWith({
      telefono: '573157861208',
      pedidoId: 'ped-1',
      total: 40000,
    });
    expect(mail.enviarNotificacionDomicilio).not.toHaveBeenCalled();
  });

  it('un domicilio también manda el correo, con el nombre de la variante solo si existe', () => {
    const { servicio, mail } = crearServicio();

    servicio.avisar({
      pedido: pedido({
        modalidad: 'domicilio',
        direccion_entrega: 'Carrera 7 # 17B - 66',
        costo_domicilio: 5000,
      }),
      cliente: CLIENTE,
      items: ITEMS,
      notas: 'Sin cebolla',
    });

    expect(mail.enviarNotificacionDomicilio).toHaveBeenCalledWith(
      expect.objectContaining({
        pedidoId: 'ped-1',
        clienteNombre: 'Ana',
        direccionEntrega: 'Carrera 7 # 17B - 66',
        costoDomicilio: 5000,
        notas: 'Sin cebolla',
        items: [
          {
            cantidad: 2,
            nombre: 'Pizza Hawaiana (Personal)',
            precioUnitario: 18000,
          },
          { cantidad: 1, nombre: 'Borde de queso', precioUnitario: 4000 },
        ],
      }),
    );
  });

  it('un domicilio sin dirección guardada no manda correo', () => {
    const { servicio, mail } = crearServicio();

    servicio.avisar({
      pedido: pedido({ modalidad: 'domicilio', direccion_entrega: null }),
      cliente: CLIENTE,
      items: ITEMS,
      notas: null,
    });

    expect(mail.enviarNotificacionDomicilio).not.toHaveBeenCalled();
  });
});
