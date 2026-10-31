import { BadRequestException } from '@nestjs/common';
import { METODOS_PAGO } from '../common/metodos-pago';
import type { CanalPedido, DatosPedido } from './pedidos.tipos';

const MODALIDADES: Record<CanalPedido, string[]> = {
  web: ['domicilio', 'retiro'],
  whatsapp: ['domicilio', 'retiro', 'local'],
};

const MAX_NOMBRE = 100;
const MAX_DIRECCION = 300;
const MAX_NOTAS = 500;
const TELEFONO = /^\+?[0-9 ()-]{7,20}$/;
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function exigirTexto(
  valor: string | undefined,
  falta: string,
  largo: string,
  max: number,
): void {
  if (!valor?.trim()) throw new BadRequestException(falta);
  if (valor.trim().length > max) throw new BadRequestException(largo);
}

function validarContacto(
  cliente: DatosPedido['cliente'] | undefined,
  canal: CanalPedido,
): void {
  if (!cliente?.telefono?.trim()) {
    throw new BadRequestException('Falta el teléfono del cliente.');
  }
  if (!TELEFONO.test(cliente.telefono.trim())) {
    throw new BadRequestException('El teléfono no tiene un formato válido.');
  }
  if (canal === 'web' && !cliente.correo?.trim()) {
    throw new BadRequestException('Falta el correo del cliente.');
  }
  if (cliente.correo && !CORREO.test(cliente.correo.trim())) {
    throw new BadRequestException('El correo no tiene un formato válido.');
  }
}

function validarCliente(
  cliente: DatosPedido['cliente'] | undefined,
  canal: CanalPedido,
): asserts cliente is DatosPedido['cliente'] {
  exigirTexto(
    cliente?.nombre,
    'Falta el nombre del cliente.',
    'El nombre es demasiado largo.',
    MAX_NOMBRE,
  );
  exigirTexto(
    cliente?.apellido,
    'Falta el apellido del cliente.',
    'El apellido es demasiado largo.',
    MAX_NOMBRE,
  );
  validarContacto(cliente, canal);
}

function validarEntrega(input: DatosPedido, canal: CanalPedido): void {
  // canal es 'web' | 'whatsapp' fijo desde el código, nunca input externo.
  // eslint-disable-next-line security/detect-object-injection
  if (!MODALIDADES[canal].includes(input.modalidad)) {
    throw new BadRequestException('Modalidad inválida.');
  }
  if (input.modalidad === 'domicilio' && !input.direccion_entrega?.trim()) {
    throw new BadRequestException('Falta la dirección de entrega.');
  }
  if (
    input.direccion_entrega &&
    input.direccion_entrega.trim().length > MAX_DIRECCION
  ) {
    throw new BadRequestException('La dirección es demasiado larga.');
  }
}

/** Reglas de entrada de un pedido nuevo; lanza 400 con el primer problema. */
export function validarDatosPedido(
  input: DatosPedido,
  canal: CanalPedido,
): void {
  validarCliente(input.cliente, canal);
  validarEntrega(input, canal);
  if (input.notas && input.notas.trim().length > MAX_NOTAS) {
    throw new BadRequestException('Las notas son demasiado largas.');
  }
  if (!METODOS_PAGO.includes(input.metodo_pago)) {
    throw new BadRequestException('Método de pago inválido.');
  }
}
