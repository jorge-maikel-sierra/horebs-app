import { Injectable, Logger } from '@nestjs/common';
import {
  parsearComentarios,
  pideInformacion,
  TEXTO_RESPUESTA_COMENTARIO,
  type ComentarioEntrante,
  type EntradaConCambios,
} from './comentarios';
import { ConversacionesService } from './conversaciones.service';
import { MetaGraphService } from './meta-graph.service';

/**
 * Responde por privado a los comentarios que piden información. Se llama sin
 * `await` desde el webhook (Meta exige el 200 al instante); nunca lanza.
 */
@Injectable()
export class ComentariosService {
  private readonly logger = new Logger(ComentariosService.name);

  constructor(
    private readonly conversaciones: ConversacionesService,
    private readonly metaGraph: MetaGraphService,
  ) {}

  procesar(
    entradas: EntradaConCambios[] | undefined,
    canal: 'messenger' | 'instagram',
  ): void {
    for (const comentario of parsearComentarios(entradas, canal)) {
      this.responder(comentario).catch((err: Error) =>
        this.logger.error(
          `No se pudo responder el comentario ${comentario.comentarioId} de ${canal}: ${err.message}`,
        ),
      );
    }
  }

  async responder(comentario: ComentarioEntrante): Promise<void> {
    if (!pideInformacion(comentario.texto)) return;
    // Meta reenvía webhooks y solo permite una respuesta privada por
    // comentario: el id queda registrado igual que el de un mensaje.
    const repetido = await this.conversaciones.yaProcesado(
      comentario.canal,
      `comentario:${comentario.comentarioId}`,
    );
    if (repetido) return;
    await this.metaGraph.enviarRespuestaPrivada(
      comentario.comentarioId,
      TEXTO_RESPUESTA_COMENTARIO,
    );
    this.logger.log(
      `Respuesta privada enviada a un comentario de ${comentario.canal} (${comentario.comentarioId}).`,
    );
  }
}
