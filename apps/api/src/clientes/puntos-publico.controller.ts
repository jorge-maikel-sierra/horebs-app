import { Controller, Get, NotFoundException, Query } from '@nestjs/common';
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
  async obtenerSaldo(@Query('telefono') telefono?: string) {
    const saldo = telefono?.trim()
      ? await this.puntos.obtenerSaldoPorTelefono(telefono.trim())
      : null;
    // Nest responde con body vacío (no el literal "null") cuando el
    // handler devuelve null, y eso rompe el res.json() del frontend —
    // mismo criterio que CatalogController.getProductoPorSlug: 404 en
    // vez de un 200 con null.
    if (!saldo) throw new NotFoundException('Cliente no encontrado.');
    return saldo;
  }
}
