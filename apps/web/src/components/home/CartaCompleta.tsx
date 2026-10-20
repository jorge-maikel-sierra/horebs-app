import type { CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { formatPrecio } from '@/lib/formato';
import { NEGOCIO, whatsappUrl } from '@/lib/negocio';
import { TAMANOS } from '@/lib/tamanos';
import WhatsappCta from '@/components/WhatsappCta';
import {
  NOMBRES_TAMANO,
  esPizza,
  hrefProducto,
  precioTamano,
  precioVariante,
  type ProductoCarta,
} from './productos';

function escalon(d: number) {
  return { '--d': d } as CSSProperties;
}

function Foto({ producto, className }: { producto: ProductoCarta; className: string }) {
  if (!producto.imagen_url) return <div aria-hidden="true" className={className} />;
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Image
        src={producto.imagen_url}
        alt={producto.nombre}
        fill
        sizes="96px"
        className="object-cover"
      />
    </div>
  );
}

function TablaPizzas({ pizzas }: { pizzas: ProductoCarta[] }) {
  return (
    <table className="w-full border-collapse text-left">
      <caption className="sr-only">Pizzas y precio de cada tamaño</caption>
      <thead className="max-sm:sr-only">
        <tr className="t-chico text-tinta-suave">
          <th scope="col" colSpan={2} className="pb-4 pl-2 font-semibold">
            Pizza
          </th>
          {NOMBRES_TAMANO.map((t) => (
            <th key={t} scope="col" className="pb-4 text-right font-semibold">
              {t}
              <span className="block font-normal">
                {TAMANOS[t].porciones} porc. · {TAMANOS[t].cm} cm
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {pizzas.map((p) => (
          <tr
            key={p.id}
            className="fila-carta grid grid-cols-[5rem_repeat(3,minmax(0,1fr))] gap-x-3 gap-y-3 py-5 sm:table-row"
          >
            <td className="row-span-2 sm:w-28 sm:py-4 sm:pr-5 sm:pl-2 sm:align-top">
              <Foto producto={p} className="aspect-square w-20 sm:w-24" />
            </td>
            <th scope="row" className="col-span-3 font-normal sm:py-4 sm:pr-8 sm:align-top">
              <Link
                href={hrefProducto(p)}
                className="t-cuerpo font-semibold underline-offset-4 hover:text-accent-ink hover:underline"
              >
                {p.nombre}
              </Link>
              {p.descripcion && (
                <p className="t-chico mt-1 max-w-[60ch] text-tinta-suave">{p.descripcion}</p>
              )}
            </th>
            {NOMBRES_TAMANO.map((t) => {
              const precio = precioTamano(p, t);
              return (
                <td
                  key={t}
                  className="t-cuerpo text-right whitespace-nowrap tabular-nums max-sm:text-left sm:py-4 sm:pr-2 sm:pl-4 sm:align-top"
                >
                  <span className="t-chico block text-tinta-suave sm:hidden">{t}</span>
                  {precio !== null ? formatPrecio(precio) : '—'}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Otro({ producto }: { producto: ProductoCarta }) {
  const variantes = [...producto.variantes].sort((a, b) => precioVariante(a) - precioVariante(b));
  return (
    <div className="min-w-0">
      <div className="flex items-start gap-5">
        <Foto producto={producto} className="aspect-square w-20 shrink-0" />
        <div className="min-w-0">
          <h3 className="t-titulo">
            <Link href={hrefProducto(producto)} className="hover:text-accent-ink">
              {producto.nombre}
            </Link>
          </h3>
          {producto.descripcion && (
            <p className="t-chico mt-2 text-tinta-suave">{producto.descripcion}</p>
          )}
        </div>
      </div>
      <table className="mt-6 w-full border-collapse">
        <caption className="sr-only">{producto.nombre}: precios</caption>
        <tbody>
          {variantes.map((v, i) => (
            <tr key={v.id ?? i} className="t-cuerpo">
              <th scope="row" className="py-1.5 pr-4 text-left font-normal">
                {v.nombre ?? producto.nombre}
              </th>
              <td className="py-1.5 text-right whitespace-nowrap tabular-nums">
                {formatPrecio(precioVariante(v))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Toda la carta en una hoja impresa sobre el navy: las pizzas con el precio
 * de cada tamaño, de la más pedida a la menos pedida, y después el resto
 * (panzerottis, bebidas) con sus sabores. Rompe el escenario dividido y va
 * de borde a borde.
 */
export default function CartaCompleta({ productos }: { productos: ProductoCarta[] }) {
  if (productos.length === 0) return null;
  const porVentas = [...productos].sort(
    (a, b) => (b.ventas_historicas ?? 0) - (a.ventas_historicas ?? 0),
  );
  const pizzas = porVentas.filter(esPizza);
  const otros = porVentas.filter((p) => !esPizza(p));

  return (
    <section
      id="carta"
      aria-labelledby="titulo-carta"
      className="bg-brand-navy px-[var(--margen)] py-[clamp(3rem,6vw,6rem)]"
    >
      <div className="hoja-festoneada bg-[var(--background)] px-[clamp(1.25rem,5vw,5rem)] py-[clamp(4rem,7vw,7rem)]">
        <header data-entrada className="text-center">
          <h2 id="titulo-carta" style={escalon(0)} className="entra t-titulo">
            Toda la carta
          </h2>
          <p style={escalon(1)} className="entra t-cuerpo mx-auto mt-4 max-w-[52ch]">
            {pizzas.length} pizzas en tres tamaños, de la más pedida a la menos pedida. Más abajo,
            los panzerottis y las bebidas.
          </p>
        </header>

        {pizzas.length > 0 && (
          <div data-entrada className="mt-14">
            <div style={escalon(0)} className="entra">
              <TablaPizzas pizzas={pizzas} />
            </div>
          </div>
        )}

        {otros.length > 0 && (
          <div data-entrada className="mt-20 grid gap-16 md:grid-cols-2 md:gap-x-16 lg:gap-x-24">
            {otros.map((p, i) => (
              <div key={p.id} style={escalon(i)} className="entra">
                <Otro producto={p} />
              </div>
            ))}
          </div>
        )}

        <div data-entrada className="mt-20 flex flex-col items-center gap-6 text-center">
          <p style={escalon(0)} className="entra t-cuerpo">
            Domicilio {formatPrecio(NEGOCIO.costoDomicilio)} en Riohacha, o la retiras en el local
            sin costo.
            <br />
            {NEGOCIO.horario}.
          </p>
          <div
            style={escalon(1)}
            className="entra flex w-full max-w-xs flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center"
          >
            <Link href="/catalogo" className="boton boton-pedir">
              Pedir online
            </Link>
            <WhatsappCta
              href={whatsappUrl('¡Hola! Quiero hacer un pedido.')}
              className="boton boton-secundario"
            >
              Pedir por WhatsApp
            </WhatsappCta>
          </div>
        </div>
      </div>
    </section>
  );
}
