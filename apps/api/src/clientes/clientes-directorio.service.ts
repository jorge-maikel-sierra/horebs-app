import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { errorDeBase } from '../common/error-de-base';
import {
  armarDirectorio,
  filasDeDirectorio,
} from './clientes-directorio-reglas';
import {
  CLIENTE_DIRECTORIO_SELECT,
  PEDIDO_DIRECTORIO_SELECT,
  type ConsultaDirectorio,
  type DirectorioClientesDto,
  type FilaClienteDirectorio,
  type FilaDirectorio,
  type FilaPedidoDirectorio,
} from './clientes-directorio.tipos';

const TTL_MS = 30_000;
const LOTE = 1000; // tope de filas por consulta de Supabase

@Injectable()
export class ClientesDirectorioService {
  private cache: { expira: number; filas: FilaDirectorio[] } | null = null;
  private cargando: Promise<FilaDirectorio[]> | null = null;

  constructor(private readonly supabase: SupabaseService) {}

  /** Se llama al editar o borrar un cliente para que el directorio no muestre datos viejos. */
  invalidar(): void {
    this.cache = null;
  }

  async consultar(
    consulta: ConsultaDirectorio,
  ): Promise<DirectorioClientesDto> {
    return armarDirectorio(await this.filas(), consulta, Date.now());
  }

  /** Cache de 30 s con una sola carga en vuelo: varias personas abriendo la página no multiplican las consultas. */
  private filas(): Promise<FilaDirectorio[]> {
    if (this.cache && this.cache.expira > Date.now()) {
      return Promise.resolve(this.cache.filas);
    }
    this.cargando ??= this.construir()
      .then((filas) => {
        this.cache = { expira: Date.now() + TTL_MS, filas };
        return filas;
      })
      .finally(() => {
        this.cargando = null;
      });
    return this.cargando;
  }

  private async construir(): Promise<FilaDirectorio[]> {
    const clientes = await this.traerTodo<FilaClienteDirectorio>(
      'clientes',
      CLIENTE_DIRECTORIO_SELECT,
    );
    const pedidos = await this.traerTodo<FilaPedidoDirectorio>(
      'pedidos',
      PEDIDO_DIRECTORIO_SELECT,
    );
    return filasDeDirectorio(clientes, pedidos);
  }

  /** Supabase corta cada consulta en 1.000 filas: se pagina hasta traer todo. */
  private async traerTodo<T>(tabla: string, columnas: string): Promise<T[]> {
    const todas: T[] = [];
    for (let desde = 0; ; desde += LOTE) {
      const { data, error } = await this.supabase
        .getClient()
        .from(tabla)
        .select(columnas)
        .order('id')
        .range(desde, desde + LOTE - 1)
        .returns<T[]>();
      if (error) throw errorDeBase(error);
      const lote = data ?? [];
      todas.push(...lote);
      if (lote.length < LOTE) return todas;
    }
  }
}
