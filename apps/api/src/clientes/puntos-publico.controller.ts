import { Controller, Get, Query } from '@nestjs/common';
import { PuntosService } from './puntos.service';

/**
 * Sin guard, igual que PedidosController/CatalogController — el checkout
 * público y el POS necesitan consultar el saldo de puntos de un cliente
 * por teléfono antes de crear el pedido, sin sesión de admin.
 */
@Controller('puntos')
export class PuntosPublicoController {
  constructor(private readonly puntos: PuntosService) {}

  @Get('saldo')
  obtenerSaldo(@Query('telefono') telefono?: string) {
    if (!telefono?.trim()) return null;
    return this.puntos.obtenerSaldoPorTelefono(telefono.trim());
  }
}
