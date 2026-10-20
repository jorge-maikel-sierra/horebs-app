import type { CSSProperties } from 'react';
import Link from 'next/link';
import { NEGOCIO, whatsappUrl } from '@/lib/negocio';
import { formatPrecio } from '@/lib/formato';
import WhatsappCta from '@/components/WhatsappCta';
import EstadoAbierto from '@/components/EstadoAbierto';
import EscenarioDividido, { type FotoEscenario } from '@/components/home/EscenarioDividido';
import Entradas from '@/components/home/Entradas';
import FirmasTamanos from '@/components/home/FirmasTamanos';
import CartaCompleta from '@/components/home/CartaCompleta';
import ResenaCarta from '@/components/home/ResenaCarta';
import PreguntasLectura from '@/components/home/PreguntasLectura';
import PedirWhatsapp from '@/components/home/PedirWhatsapp';
import { esPizza, precioDesde, type ProductoCarta } from '@/components/home/productos';

async function getProductos(): Promise<ProductoCarta[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
  try {
    const res = await fetch(`${apiUrl}/catalogo/productos`, { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

function escalon(d: number) {
  return { '--d': d } as CSSProperties;
}

export default async function Home() {
  const productos = await getProductos();
  // La Especial va primero: es la firma de la casa (CLAUDE.md).
  const firmas = productos
    .filter((p) => p.destacado)
    .sort((a, b) => Number(/especial/i.test(b.nombre)) - Number(/especial/i.test(a.nombre)));
  const preciosPizza = productos
    .filter(esPizza)
    .map(precioDesde)
    .filter((p): p is number => p !== null);
  const pizzaDesde = preciosPizza.length > 0 ? Math.min(...preciosPizza) : null;

  const fotos: FotoEscenario[] = [
    {
      src: '/hero-pizza-especial.webp',
      alt: 'Pizza Horebs Especial recién horneada, con el queso estirándose al servir una porción',
      posicion: '60% 50%',
    },
    ...firmas
      .filter((p) => p.imagen_url)
      .map((p) => ({ src: p.imagen_url!, alt: `${p.nombre} a domicilio en Riohacha` })),
  ];

  return (
    <div className="home">
      <EscenarioDividido fotos={fotos}>
        <section id="inicio" aria-labelledby="titulo-inicio" data-foto={0} className="portada">
          <h1 id="titulo-inicio" style={escalon(0)} className="aparece t-display">
            {NEGOCIO.nombre}
          </h1>
          <p style={escalon(1)} className="aparece t-entrada mt-8 max-w-[34ch]">
            Pizza artesanal de masa crocante y bien cargada de queso, hecha en Riohacha y llevada a
            tu puerta.
          </p>
          <ul style={escalon(2)} className="aparece t-cuerpo mt-8 space-y-1.5">
            <li>
              <EstadoAbierto className="font-semibold" />
            </li>
            <li>Domicilio {formatPrecio(NEGOCIO.costoDomicilio)}, o la retiras en el local.</li>
            {pizzaDesde !== null && <li>Pizzas desde {formatPrecio(pizzaDesde)}.</li>}
          </ul>
          <div
            style={escalon(3)}
            className="aparece mt-10 flex max-w-xs flex-col gap-3 sm:max-w-none sm:flex-row"
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
        </section>

        {firmas.length > 0 && <FirmasTamanos firmas={firmas} />}
      </EscenarioDividido>

      <CartaCompleta productos={productos} />
      <ResenaCarta />
      <PreguntasLectura />
      <PedirWhatsapp />

      <Entradas />
    </div>
  );
}
