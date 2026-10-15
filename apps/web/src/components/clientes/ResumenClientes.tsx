import { TarjetaKpi } from '@/components/informes/TarjetasResumen';
import { formatPrecio } from '@/lib/formato';
import type { Directorio } from '@/lib/clientes-directorio';
import { IconChequeo, IconEstrella, IconUsuarioMas } from './iconos';
import { IconClientes } from '@/components/admin-iconos';

const NUMERO = new Intl.NumberFormat('es-CO');
const PCT = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

/** Cifras de toda la base de clientes (no cambian con la búsqueda). */
export default function ResumenClientes({
  resumen,
  valorPunto,
}: {
  resumen: Directorio['resumen'] | null;
  /** Valor en pesos de un punto; solo lo conoce el admin. */
  valorPunto: number | null;
}) {
  if (!resumen) {
    return (
      <div
        className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4"
        aria-hidden="true"
      >
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-32 rounded-2xl" />
        ))}
      </div>
    );
  }

  const conPedidosPct =
    resumen.clientes > 0 ? (resumen.con_pedidos / resumen.clientes) * 100 : 0;

  return (
    <div className="animate-fade-up grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      <TarjetaKpi
        icono={<IconClientes tamano={20} />}
        label="Clientes"
        valor={NUMERO.format(resumen.clientes)}
        detalle="En toda la base"
        tono="naranja"
      />
      <TarjetaKpi
        icono={<IconChequeo />}
        label="Con pedidos"
        valor={NUMERO.format(resumen.con_pedidos)}
        detalle={`${PCT.format(conPedidosPct)} % de la base`}
        tono="verde"
      />
      <TarjetaKpi
        icono={<IconUsuarioMas />}
        label="Nuevos · 30 días"
        valor={NUMERO.format(resumen.nuevos_30d)}
        detalle="Se registraron este mes"
        tono="azul"
      />
      <TarjetaKpi
        icono={<IconEstrella tamano={18} />}
        label="Puntos en circulación"
        valor={NUMERO.format(resumen.puntos_total)}
        detalle={
          valorPunto !== null
            ? `≈ ${formatPrecio(resumen.puntos_total * valorPunto)} en descuentos`
            : 'Suma de todos los clientes'
        }
        tono="amarillo"
      />
    </div>
  );
}
