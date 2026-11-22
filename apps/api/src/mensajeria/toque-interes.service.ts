import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CatalogService } from '../catalog/catalog.service';
import { estadoAtencion } from '../common/horario';
import { ConversacionesService } from './conversaciones.service';
import { InteresProductoService } from './interes-producto.service';
import { MetaGraphService } from './meta-graph.service';
import {
  derivadoTrasInteres,
  mensajeToque,
  type CandidataToque,
} from './toque-interes';

/**
 * El segundo mensaje a quien llegó por un anuncio, preguntó por un producto y
 * se fue sin pedir (ver toque-interes.ts). Texto fijo y botones del catálogo:
 * no pasa por el modelo.
 */
@Injectable()
export class ToqueInteresService {
  private readonly logger = new Logger(ToqueInteresService.name);
  // Un solo proceso en Railway: alcanza un lock en memoria (igual que SeguimientoService).
  private ejecutando = false;

  constructor(
    private readonly interes: InteresProductoService,
    private readonly catalog: CatalogService,
    private readonly metaGraph: MetaGraphService,
    private readonly conversaciones: ConversacionesService,
  ) {}

  @Cron('*/10 * * * *', { name: 'toque-interes-anuncio' })
  async ejecutar(): Promise<void> {
    const ahora = new Date();
    // Fuera del horario del bot no se escribe: un mensaje a las 2 a.m. molesta.
    if (this.ejecutando || estadoAtencion(ahora) === 'cerrado') return;
    this.ejecutando = true;
    try {
      const candidatas = await this.interes.candidatasToque(ahora);
      for (const c of candidatas) {
        await this.enviar(c).catch((err: unknown) =>
          this.logger.error(
            `No se pudo mandar el segundo mensaje a ${c.canal}/${c.identificador_externo}: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
      }
    } finally {
      this.ejecutando = false;
    }
  }

  private async enviar(c: CandidataToque): Promise<void> {
    // Se marca primero: si algo falla después, no se le insiste en cada corrida.
    await this.interes.marcarToque(c.id);
    if (derivadoTrasInteres(c)) return;
    if (await this.interes.atendidoDesde(c.id, c.interes_en)) return;
    const producto = (await this.catalog.getProductos()).find(
      (p) => p.id === c.interes_producto_id,
    );
    if (!producto) return;
    const { texto, botones } = mensajeToque(producto);
    await this.metaGraph.enviarBotones(
      c.canal,
      c.identificador_externo,
      texto,
      botones,
    );
    await this.conversaciones.registrarMensaje(c.id, 'saliente_bot', texto);
    this.logger.log(
      `Segundo mensaje enviado — canal=${c.canal} id=${c.identificador_externo}`,
    );
  }
}
