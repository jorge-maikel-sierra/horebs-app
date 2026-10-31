import { BadRequestException } from '@nestjs/common';
import type { DatosPedido } from './pedidos.tipos';
import { validarDatosPedido } from './validar-pedido';

const BASE: DatosPedido = {
  cliente: {
    nombre: 'Ana',
    apellido: 'Pérez',
    telefono: '3157861208',
    correo: 'ana@ejemplo.com',
  },
  modalidad: 'domicilio',
  direccion_entrega: 'Carrera 7 # 17B - 66',
  metodo_pago: 'efectivo',
  items: [{ variante_id: 'v-1', cantidad: 1 }],
};

const con = (cambios: Partial<DatosPedido>): DatosPedido => ({
  ...BASE,
  ...cambios,
});
const conCliente = (cambios: Partial<DatosPedido['cliente']>): DatosPedido =>
  con({ cliente: { ...BASE.cliente, ...cambios } });

function mensaje(input: DatosPedido, canal: 'web' | 'whatsapp'): string | null {
  try {
    validarDatosPedido(input, canal);
    return null;
  } catch (err) {
    expect(err).toBeInstanceOf(BadRequestException);
    return (err as BadRequestException).message;
  }
}

describe('validarDatosPedido', () => {
  it('acepta un pedido completo de la web', () => {
    expect(mensaje(BASE, 'web')).toBeNull();
  });

  it('en WhatsApp el correo es opcional y existe la modalidad local', () => {
    const sinCorreo = conCliente({ correo: undefined });
    expect(
      mensaje(con({ ...sinCorreo, modalidad: 'local' }), 'whatsapp'),
    ).toBeNull();
    expect(mensaje(sinCorreo, 'web')).toBe('Falta el correo del cliente.');
  });

  it('la web no acepta comer en el local', () => {
    expect(mensaje(con({ modalidad: 'local' }), 'web')).toBe(
      'Modalidad inválida.',
    );
  });

  it.each([
    [{ nombre: '  ' }, 'Falta el nombre del cliente.'],
    [{ nombre: 'x'.repeat(101) }, 'El nombre es demasiado largo.'],
    [{ apellido: '' }, 'Falta el apellido del cliente.'],
    [{ telefono: '' }, 'Falta el teléfono del cliente.'],
    [{ telefono: 'abc' }, 'El teléfono no tiene un formato válido.'],
    [{ correo: 'sin-arroba' }, 'El correo no tiene un formato válido.'],
  ])('rechaza el cliente %j', (cambios, esperado) => {
    expect(mensaje(conCliente(cambios), 'web')).toBe(esperado);
  });

  it('un domicilio pide dirección y no pasa de 300 caracteres', () => {
    expect(mensaje(con({ direccion_entrega: ' ' }), 'web')).toBe(
      'Falta la dirección de entrega.',
    );
    expect(mensaje(con({ direccion_entrega: 'x'.repeat(301) }), 'web')).toBe(
      'La dirección es demasiado larga.',
    );
  });

  it('retirar no pide dirección', () => {
    expect(
      mensaje(
        con({ modalidad: 'retiro', direccion_entrega: undefined }),
        'web',
      ),
    ).toBeNull();
  });

  it('las notas no pasan de 500 caracteres', () => {
    expect(mensaje(con({ notas: 'x'.repeat(501) }), 'web')).toBe(
      'Las notas son demasiado largas.',
    );
  });

  it('el método de pago tiene que existir', () => {
    expect(
      mensaje(
        con({ metodo_pago: 'bitcoin' as DatosPedido['metodo_pago'] }),
        'web',
      ),
    ).toBe('Método de pago inválido.');
  });
});
