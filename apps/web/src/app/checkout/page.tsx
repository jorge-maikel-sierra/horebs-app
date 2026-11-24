'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Session } from '@supabase/supabase-js';
import { useCart } from '@/lib/cart-context';
import { formatPrecio } from '@/lib/formato';
import { supabase } from '@/lib/supabase';
import {
  trackBeginCheckout,
  trackErrorPedido,
  trackErrorValidacionCheckout,
  trackMetodoPagoElegido,
  trackModalidadElegida,
  trackPedidoEnviado,
  type CampoCheckout,
} from '@/lib/analytics';
import { leerAtribucion } from '@/lib/atribucion';
import { errorClass } from '@/lib/feedback-estilos';
import { NEGOCIO } from '@/lib/negocio';
import ModalCargando from '@/components/ModalCargando';
import AvisoHorario from '@/components/checkout/AvisoHorario';
import Campo from '@/components/checkout/CampoCheckout';
import GrupoOpciones from '@/components/checkout/GrupoOpciones';
import InfoPago, { type MetodoPago } from '@/components/checkout/InfoPago';
import ResumenPedido from '@/components/checkout/ResumenPedido';
import { leerErrorApi } from '@/lib/error-api';
import { marcarCompraNueva } from '@/components/TrackPurchase';

function IconPaquete() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8 12 3 3 8l9 5 9-5Z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </svg>
  );
}

function IconTienda() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9 4 4h16l1 5" />
      <path d="M3 9a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0" />
      <path d="M5 9v10h14V9" />
      <path d="M9 19v-6h6v6" />
    </svg>
  );
}

function IconEfectivo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M6 9v.01M18 15v.01" />
    </svg>
  );
}

function IconTransferencia() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4v6h6" />
      <path d="M20 20v-6h-6" />
      <path d="M4.5 15a8 8 0 0 0 14.5 3.4M19.5 9A8 8 0 0 0 5 5.6" />
    </svg>
  );
}

function IconTarjeta() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <path d="M6 15h4" />
    </svg>
  );
}

type SaldoPuntos = {
  puntos: number;
  valorPuntoPesos: number;
  puntosMinimoCanje: number;
};

function IconGoogle() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C33.9 6.1 29.2 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5Z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C33.9 6.1 29.2 4 24 4c-7.6 0-14.1 4.3-17.7 10.7Z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.1 0 9.8-2 13.3-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44Z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C40.7 36.3 44 30.9 44 24c0-1.3-.1-2.7-.4-3.5Z"
      />
    </svg>
  );
}

function iniciales(nombre: string, correo: string) {
  const n = nombre.trim();
  if (n) return n.slice(0, 2).toUpperCase();
  return correo.slice(0, 2).toUpperCase();
}

function IconEstrella() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z" />
    </svg>
  );
}

const OPCIONES_MODALIDAD = [
  { valor: 'domicilio' as const, etiqueta: 'Domicilio', icono: <IconPaquete /> },
  { valor: 'retiro' as const, etiqueta: 'Retiro en local', icono: <IconTienda /> },
];

const OPCIONES_PAGO = [
  { valor: 'efectivo' as const, etiqueta: 'Efectivo', icono: <IconEfectivo /> },
  { valor: 'transferencia' as const, etiqueta: 'Transferencia', icono: <IconTransferencia /> },
  { valor: 'tarjeta' as const, etiqueta: 'Tarjeta', icono: <IconTarjeta /> },
];

/** Orden en pantalla: el primer campo con error es el que recibe el foco. */
const ORDEN_CAMPOS: CampoCheckout[] = ['nombre', 'apellido', 'telefono', 'correo', 'direccion'];

export default function CheckoutPage() {
  const { items, total, clear } = useCart();
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [cargandoGoogle, setCargandoGoogle] = useState(false);

  async function iniciarConGoogle() {
    setCargandoGoogle(true);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/checkout` },
    });
    // Si signInWithOAuth falla no hay redirect, así que hay que apagar el
    // modal a mano — si funciona, la navegación al proveedor lo hace
    // irrelevante (la página ya no sigue montada).
    if (oauthError) setCargandoGoogle(false);
  }
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [modalidad, setModalidad] = useState<'domicilio' | 'retiro'>('domicilio');
  const [direccion, setDireccion] = useState('');
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo');
  const [notas, setNotas] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errores, setErrores] = useState<Partial<Record<CampoCheckout, string>>>({});
  const errorApiRef = useRef<HTMLDivElement>(null);
  const [saldoPuntos, setSaldoPuntos] = useState<SaldoPuntos | null>(null);
  const [usarPuntos, setUsarPuntos] = useState(false);
  // Una sola clave por intento de checkout (no por click) — si el mismo
  // submit dispara dos requests (doble clic más rápido que el disabled del
  // botón, o un reintento de red), el backend descarta el segundo insert
  // en vez de crear un pedido duplicado.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  // Una sola vez por visita al checkout — sin este guard, cualquier
  // cambio de estado (ej. tipear el teléfono) volvería a disparar el
  // evento al re-renderizar.
  const beginCheckoutDisparado = useRef(false);
  useEffect(() => {
    if (items.length === 0 || beginCheckoutDisparado.current) return;
    beginCheckoutDisparado.current = true;
    trackBeginCheckout(items, total);
  }, [items, total]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: subscripcion } = supabase.auth.onAuthStateChange(
      (_event, nuevaSesion) => setSession(nuevaSesion),
    );
    return () => subscripcion.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    const meta = session.user.user_metadata ?? {};
    // Mismo fallback que /cuenta: Google no manda las claves
    // nombre/apellido propias del registro por email, manda
    // full_name/name — se usan como default hasta que la persona las
    // edite (guardarPerfil en /cuenta o, acá, al confirmar el pedido).
    const nombreGoogle: string = meta.full_name ?? meta.name ?? '';
    const [nombreDefault, ...restoDefault] = nombreGoogle.split(' ');
    setNombre(meta.nombre ?? nombreDefault ?? '');
    setApellido(meta.apellido ?? restoDefault.join(' '));
    setCorreo(session.user.email ?? '');
    if (meta.telefono) setTelefono(meta.telefono);
  }, [session]);

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-orange/15 text-accent-ink">
          <IconPaquete />
        </span>
        <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Tu carrito está vacío</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Arranca por la firma de la casa, la Pizza Horebs Especial, o mira todo el menú.
        </p>
        <Link
          href="/catalogo"
          className="btn-gradient btn-press mt-6 inline-flex h-11 items-center rounded-xl px-6 text-sm font-semibold text-white"
        >
          Ver el menú
        </Link>
      </div>
    );
  }

  async function consultarSaldoPuntos() {
    const tel = telefono.trim();
    if (!tel) {
      setSaldoPuntos(null);
      setUsarPuntos(false);
      return;
    }
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
      const res = await fetch(`${apiUrl}/puntos/saldo?telefono=${encodeURIComponent(tel)}`);
      if (!res.ok) return;
      const saldo: SaldoPuntos | null = await res.json();
      setSaldoPuntos(saldo);
      if (!saldo || saldo.puntos < saldo.puntosMinimoCanje) setUsarPuntos(false);
    } catch {
      // Silencioso — la consulta de saldo es un extra, no debe frenar el checkout.
    }
  }

  const puedeCanjear = saldoPuntos !== null && saldoPuntos.puntos >= saldoPuntos.puntosMinimoCanje;
  const canjePuntos =
    puedeCanjear && saldoPuntos
      ? Math.min(saldoPuntos.puntos, Math.floor(total / saldoPuntos.valorPuntoPesos))
      : 0;
  const descuentoPuntos = usarPuntos ? canjePuntos * (saldoPuntos?.valorPuntoPesos ?? 0) : 0;
  const totalConDescuento = total - descuentoPuntos;
  // El API suma el domicilio al pedido (costoDomicilioDeCheckout); el total
  // que ve el cliente lo suma también. NEGOCIO.costoDomicilio debe coincidir
  // con COSTO_DOMICILIO_DEFAULT del API.
  const domicilio = modalidad === 'domicilio' ? NEGOCIO.costoDomicilio : 0;
  const totalAPagar = totalConDescuento + domicilio;

  async function enviarPedido(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Todos los errores a la vez, cada uno bajo su campo, y el foco al
    // primero: antes salía uno solo al pie del formulario.
    const nuevos: Partial<Record<CampoCheckout, string>> = {};
    if (!session && !nombre.trim()) nuevos.nombre = 'Escribe tu nombre.';
    if (!apellido.trim()) nuevos.apellido = 'Escribe tu apellido.';
    if (!telefono.trim()) nuevos.telefono = 'Escribe tu número de WhatsApp.';
    if (!session && !correo.trim()) nuevos.correo = 'Escribe tu correo.';
    if (modalidad === 'domicilio' && !direccion.trim()) nuevos.direccion = 'Escribe a dónde llevamos el pedido.';
    setErrores(nuevos);
    const primero = ORDEN_CAMPOS.find((c) => nuevos[c]);
    if (primero) {
      trackErrorValidacionCheckout(primero);
      const campo = document.getElementById(`checkout-${primero}`);
      campo?.focus();
      campo?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }

    trackPedidoEnviado({
      metodoPago,
      modalidad,
      value: totalConDescuento,
      items: items.reduce((n, i) => n + i.cantidad, 0),
      usaPuntos: usarPuntos,
      conSesion: Boolean(session),
    });
    setEnviando(true);
    let status: number | null = null;
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
      const res = await fetch(`${apiUrl}/pedidos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente: { nombre, apellido, telefono, correo, direccion: direccion || undefined },
          modalidad,
          direccion_entrega: modalidad === 'domicilio' ? direccion : undefined,
          metodo_pago: metodoPago,
          notas: notas || undefined,
          items: items.map((i) => ({
            variante_id: i.varianteId,
            cantidad: i.cantidad,
          })),
          idempotency_key: idempotencyKey,
          usar_puntos: usarPuntos,
          atribucion: leerAtribucion(),
        }),
      });

      if (!res.ok) {
        status = res.status;
        throw new Error(await leerErrorApi(res, 'No se pudo crear el pedido.'));
      }

      const pedido = await res.json();
      // Fire-and-forget: si vino logueado, guarda/actualiza el teléfono
      // en el perfil para que el próximo checkout ya no lo pida (o lo
      // traiga corregido si lo cambió en este pedido).
      if (session) {
        supabase.auth
          .updateUser({ data: { telefono: telefono.trim() } })
          .catch(() => {
            // Silencioso a propósito — el pedido ya se creó, esto es solo
            // para no volver a pedir el teléfono la próxima vez.
          });
      }
      clear();
      marcarCompraNueva(pedido.id);
      router.push(`/pedido/${pedido.id}`);
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : 'No se pudo crear el pedido.';
      trackErrorPedido(status, mensaje);
      setError(mensaje);
      setEnviando(false);
      // El aviso queda junto al botón; el foco va a él para que se lea.
      requestAnimationFrame(() => errorApiRef.current?.focus());
    }
  }

  /** Cambia un campo y borra su error en cuanto se corrige. */
  function cambiar(campo: CampoCheckout, setter: (v: string) => void) {
    return (v: string) => {
      setter(v);
      if (errores[campo]) setErrores((e) => ({ ...e, [campo]: undefined }));
    };
  }

  // Solo la trae Google (login por email no tiene foto) — el avatar
  // vive únicamente en user_metadata, no hay carga manual todavía.
  const avatarUrl: string | undefined =
    session?.user.user_metadata?.avatar_url ?? session?.user.user_metadata?.picture;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">Confirma tu pedido</h1>

      {/* Escritorio: formulario a la izquierda y el resumen fijo a la derecha.
          Teléfono: el resumen arriba, para saber qué se está pidiendo. */}
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-10">
        <aside className="lg:sticky lg:top-24 lg:order-2">
          <ResumenPedido
            items={items}
            subtotal={total}
            domicilio={domicilio}
            descuentoPuntos={descuentoPuntos}
            puntosCanjeados={canjePuntos}
            total={totalAPagar}
          />
        </aside>

        <div className="min-w-0 space-y-6">
          <AvisoHorario />

          {session ? (
            <div data-ph-mask className="flex items-center gap-3 rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- URL externa de Google, no vale la pena optimizarla con next/image.
                <img src={avatarUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-orange/15 text-sm font-bold text-accent-ink">
                  {iniciales(nombre, correo)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  {nombre ? `${nombre} ${apellido}`.trim() : correo}
                </p>
                <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{correo}</p>
              </div>
              <button
                type="button"
                onClick={() => supabase.auth.signOut()}
                className="-my-1 h-11 shrink-0 rounded-lg px-3 text-sm text-zinc-600 underline underline-offset-2 hover:text-accent-ink dark:text-zinc-400"
              >
                No soy yo
              </button>
            </div>
          ) : (
            <div>
              <button
                type="button"
                onClick={iniciarConGoogle}
                disabled={cargandoGoogle}
                className="btn-press flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-zinc-300 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                <IconGoogle />
                Continuar con Google
              </button>
              <p className="mt-2 text-center text-xs text-zinc-500 dark:text-zinc-400">
                Llenamos tus datos por ti y la próxima vez no los vuelves a escribir.
              </p>
              {cargandoGoogle && <ModalCargando mensaje="Conectando con Google…" />}
              <div className="mt-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
                <span className="text-xs text-zinc-500 dark:text-zinc-400">o escribe tus datos</span>
                <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
              </div>
            </div>
          )}

          <form onSubmit={enviarPedido} noValidate className="space-y-6">
            <fieldset className="space-y-4">
              <legend className="sr-only">Tus datos</legend>
              {!session && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Campo id="checkout-nombre" etiqueta="Nombre" autoComplete="given-name" value={nombre} onChange={cambiar('nombre', setNombre)} error={errores.nombre} />
                  <Campo id="checkout-apellido" etiqueta="Apellido" autoComplete="family-name" value={apellido} onChange={cambiar('apellido', setApellido)} error={errores.apellido} />
                </div>
              )}
              {session && !apellido.trim() && (
                <Campo id="checkout-apellido" etiqueta="Apellido" autoComplete="family-name" value={apellido} onChange={cambiar('apellido', setApellido)} error={errores.apellido} />
              )}
              <Campo
                id="checkout-telefono"
                etiqueta="WhatsApp"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={telefono}
                onChange={cambiar('telefono', setTelefono)}
                onBlur={consultarSaldoPuntos}
                error={errores.telefono}
                pista="Por aquí confirmamos el pedido."
              />
              {!session && (
                <Campo id="checkout-correo" etiqueta="Correo" type="email" inputMode="email" autoComplete="email" value={correo} onChange={cambiar('correo', setCorreo)} error={errores.correo} />
              )}

              {puedeCanjear && (
                <div className="animate-entrada-seccion flex items-center justify-between gap-3 rounded-xl border border-brand-orange/25 bg-brand-orange/[0.06] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-orange/15 text-accent-ink">
                      <IconEstrella />
                    </span>
                    <label htmlFor="usar-puntos" className="text-sm text-zinc-700 dark:text-zinc-300">
                      Tienes{' '}
                      <span className="font-semibold text-zinc-900 tabular-nums dark:text-zinc-50">{saldoPuntos?.puntos} puntos</span>.
                      Usa {canjePuntos} y te descontamos{' '}
                      <span className="font-semibold text-zinc-900 tabular-nums dark:text-zinc-50">
                        {formatPrecio(canjePuntos * (saldoPuntos?.valorPuntoPesos ?? 0))}
                      </span>
                      .
                    </label>
                  </div>
                  <input
                    id="usar-puntos"
                    type="checkbox"
                    checked={usarPuntos}
                    onChange={(e) => setUsarPuntos(e.target.checked)}
                    className="h-5 w-5 shrink-0 accent-brand-orange"
                  />
                </div>
              )}
            </fieldset>

            <div>
              <GrupoOpciones
                nombre="modalidad"
                leyenda="¿Cómo lo recibes?"
                opciones={OPCIONES_MODALIDAD}
                valor={modalidad}
                onCambiar={(v) => {
                  setModalidad(v);
                  trackModalidadElegida(v);
                }}
                columnas={2}
              />
              {modalidad === 'domicilio' ? (
                <div className="animate-entrada-seccion mt-4">
                  <Campo
                    id="checkout-direccion"
                    etiqueta="Dirección de entrega"
                    autoComplete="street-address"
                    value={direccion}
                    onChange={cambiar('direccion', setDireccion)}
                    error={errores.direccion}
                    pista={`Calle o carrera, barrio y una referencia. Llevamos a ${NEGOCIO.coberturaDomicilio} por ${formatPrecio(NEGOCIO.costoDomicilio)}.`}
                  />
                </div>
              ) : (
                <p className="animate-entrada-seccion mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                  Lo recoges en {NEGOCIO.direccion}.
                </p>
              )}
            </div>

            <div>
              <GrupoOpciones
                nombre="metodo-pago"
                leyenda="¿Cómo pagas?"
                opciones={OPCIONES_PAGO}
                valor={metodoPago}
                onCambiar={(v) => {
                  setMetodoPago(v);
                  trackMetodoPagoElegido(v);
                }}
                columnas={3}
              />
              <InfoPago metodo={metodoPago} />
            </div>

            <Campo
              id="checkout-notas"
              etiqueta="Notas (opcional)"
              multilinea
              placeholder="Ej.: sin cebolla, pago con $50.000"
              value={notas}
              onChange={setNotas}
            />

            <div className="space-y-3">
              {error && (
                <div ref={errorApiRef} tabIndex={-1} role="alert" className={`${errorClass} outline-none`}>
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={enviando}
                className="btn-press btn-gradient flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold text-white shadow-sm transition-opacity disabled:opacity-60"
              >
                {enviando && (
                  <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                )}
                {enviando ? 'Enviando…' : (
                  <span className="tabular-nums">Pedir por {formatPrecio(totalAPagar)}</span>
                )}
              </button>
              <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
                En el siguiente paso confirmas el pedido por WhatsApp.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
