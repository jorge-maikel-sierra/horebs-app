import {
  Controller,
  Get,
  NotFoundException,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PuntosService } from './puntos.service';
import type { SaldoPuntosDto } from './puntos.tipos';

/**
 * Consulta el saldo de puntos de un cliente por teléfono. Solo el POS
 * (empleado o admin) canjea puntos, así que la ruta va protegida: pública
 * dejaba enumerar clientes y sus saldos por teléfono. El checkout web ya no
 * canjea puntos — ver docs/seguridad/auditoria-2026-11.md.
 */
@Controller('puntos')
@UseGuards(RolesGuard)
export class PuntosPublicoController {
  constructor(private readonly puntos: PuntosService) {}

  @Get('saldo')
  @Roles('admin', 'empleado')
  async obtenerSaldo(
    @Query('telefono') telefono?: string,
  ): Promise<SaldoPuntosDto> {
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
