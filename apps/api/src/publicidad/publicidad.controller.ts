import { Controller, Get, NotFoundException, Post, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { MetaAdsSnapshotService } from './meta-ads-snapshot.service';

@Controller('publicidad')
@UseGuards(RolesGuard)
@Roles('admin')
export class PublicidadController {
  constructor(private readonly snapshots: MetaAdsSnapshotService) {}

  @Get('meta-ads')
  async obtener() {
    const snapshot = await this.snapshots.obtenerUltimoSnapshot();
    if (!snapshot) {
      throw new NotFoundException('Todavía no hay datos de Meta Ads capturados.');
    }
    return snapshot;
  }

  @Post('meta-ads/refrescar')
  async refrescar() {
    await this.snapshots.ejecutar();
    const snapshot = await this.snapshots.obtenerUltimoSnapshot();
    if (!snapshot) {
      throw new NotFoundException('No se pudo capturar un snapshot de Meta Ads — revisá que las credenciales estén configuradas.');
    }
    return snapshot;
  }
}
