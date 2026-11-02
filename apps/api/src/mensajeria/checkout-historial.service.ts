import { Injectable } from '@nestjs/common';
import {
  CatalogService,
  type ItemCarritoResuelto,
} from '../catalog/catalog.service';
import type { ClienteBotDto } from '../pedidos/pedidos.tipos';
import { PedidosConsultasService } from '../pedidos/pedidos-consultas.service';

export interface PedidoRepetible {
  disponibles: ItemCarritoResuelto[];
  noDisponibles: number;
}

/** Lo que el checkout sabe del cliente por sus pedidos anteriores. */
@Injectable()
export class CheckoutHistorialService {
  constructor(
    private readonly catalog: CatalogService,
    private readonly consultas: PedidosConsultasService,
  ) {}

  cliente(telefono: string): Promise<ClienteBotDto | null> {
    return this.consultas.clientePorTelefono(telefono);
  }

  /**
   * Su último pedido cruzado con lo que hoy hay en el catálogo. Sin pedidos
   * anteriores devuelve vacío, igual que si ninguno sigue disponible.
   */
  async ultimoPedidoRepetible(telefono: string): Promise<PedidoRepetible> {
    const ultimo = await this.consultas.ultimoPedidoPorTelefono(telefono);
    if (!ultimo) return { disponibles: [], noDisponibles: 0 };
    return this.catalog.resolverCarrito(ultimo.items);
  }
}
