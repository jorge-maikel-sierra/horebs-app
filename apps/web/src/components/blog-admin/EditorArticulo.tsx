'use client';

import dynamic from 'next/dynamic';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import ModalConfirmar from '@/components/ModalConfirmar';
import Campo, { Contador, describedBy } from '@/components/formulario/Campo';
import EstadoChip from './EstadoChip';
import { FOCO, TARJETA, claseCampo } from '@/components/formulario/estilos';
import {
  IconoCita,
  IconoEnlace,
  IconoExterno,
  IconoFlecha,
  IconoImagen,
  IconoLista,
  IconoListaNumerada,
  IconoPapelera,
} from './iconos';
import {
  ETIQUETAS_SUGERIDAS,
  LIMITE_RESUMEN,
  LIMITE_TITULO,
  VACIO,
  contarPalabras,
  desdePost,
  esUrlHttp,
  formatFecha,
  minutosLectura,
  slugify,
  type BlogPost,
  type Estado,
  type FormBlog,
} from './tipos';

const VistaPreviaMarkdown = dynamic(() => import('./VistaPreviaMarkdown'), {
  loading: () => (
    <div className="skeleton h-40 w-full rounded-xl" aria-hidden="true" />
  ),
});

type Errores = Partial<Record<keyof FormBlog, string>>;
type Pestana = 'escribir' | 'previa';
type Formato =
  | 'negrita'
  | 'cursiva'
  | 'h2'
  | 'h3'
  | 'lista'
  | 'numerada'
  | 'cita'
  | 'enlace';

// Orden visual de los campos: el primero con error recibe el foco al guardar.
const ORDEN_CAMPOS: (keyof FormBlog)[] = [
  'titulo',
  'slug',
  'resumen',
  'contenido',
  'imagen_url',
];

const ESTADOS: { valor: Estado; titulo: string; detalle: string }[] = [
  { valor: 'borrador', titulo: 'Borrador', detalle: 'No se ve en el sitio' },
  { valor: 'publicado', titulo: 'Publicado', detalle: 'Visible en /blog' },
];

const BOTON_FORMATO = `btn-press inline-flex h-9 min-w-8 items-center justify-center rounded-lg px-1.5 text-sm sm:min-w-9 sm:px-2 font-bold text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50 ${FOCO}`;

function validar(f: FormBlog): Errores {
  const e: Errores = {};
  if (!f.titulo.trim()) e.titulo = 'Escribe un título.';
  if (!f.slug.trim()) {
    e.slug = 'El slug es obligatorio; se genera solo desde el título.';
  }
  if (!f.resumen.trim()) e.resumen = 'Escribe un resumen corto.';
  if (!f.contenido.trim())
    e.contenido = 'El artículo todavía no tiene contenido.';
  if (f.imagen_url.trim() && !esUrlHttp(f.imagen_url.trim())) {
    e.imagen_url = 'Debe ser un enlace que empiece con https://';
  }
  return e;
}

function Tarjeta({
  titulo,
  children,
}: {
  titulo: string;
  children: ReactNode;
}) {
  return (
    <section className={TARJETA}>
      <h2 className="text-xs font-bold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
        {titulo}
      </h2>
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  );
}

export default function EditorArticulo({
  post,
  onVolver,
  onGuardado,
  onEliminar,
  onAviso,
}: {
  post: BlogPost | null;
  onVolver: () => void;
  onGuardado: (post: BlogPost) => void;
  onEliminar: (post: BlogPost) => void;
  onAviso: (texto: string) => void;
}) {
  const uid = useId();
  const idCampo = (nombre: string) => `${uid}-${nombre}`;

  const inicial = post ? desdePost(post) : VACIO;
  const [base, setBase] = useState<FormBlog>(inicial);
  const [form, setForm] = useState<FormBlog>(inicial);
  const [guardado, setGuardado] = useState<BlogPost | null>(post);
  const [slugTocado, setSlugTocado] = useState(Boolean(post));
  const [errores, setErrores] = useState<Errores>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [pestana, setPestana] = useState<Pestana>('escribir');
  const [confirmarSalida, setConfirmarSalida] = useState(false);
  const [imagenFallida, setImagenFallida] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const sucio = (Object.keys(form) as (keyof FormBlog)[]).some(
    (k) => form[k] !== base[k],
  );

  function cambiar<K extends keyof FormBlog>(clave: K, valor: FormBlog[K]) {
    setForm((f) => ({ ...f, [clave]: valor }));
    if (errores[clave]) setErrores((e) => ({ ...e, [clave]: undefined }));
  }

  async function guardar() {
    if (enviando) return;
    setErrorGeneral(null);
    const encontrados = validar(form);
    setErrores(encontrados);
    const primero = ORDEN_CAMPOS.find((k) => encontrados[k]);
    if (primero) {
      if (primero === 'contenido') setPestana('escribir');
      requestAnimationFrame(() =>
        document.getElementById(idCampo(primero))?.focus(),
      );
      return;
    }

    setEnviando(true);
    try {
      // Siempre se envían strings (también vacíos): así el API puede borrar
      // un campo opcional que el admin vació.
      const payload = {
        titulo: form.titulo.trim(),
        slug: form.slug.trim(),
        resumen: form.resumen.trim(),
        contenido: form.contenido,
        palabra_clave: form.palabra_clave.trim(),
        imagen_url: form.imagen_url.trim(),
        etiqueta: form.etiqueta.trim(),
        estado: form.estado,
      };
      const res = await adminFetch(
        guardado ? `/admin/blog/${guardado.id}` : '/admin/blog',
        {
          method: guardado ? 'PATCH' : 'POST',
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        if (res.status === 409) {
          // Slug repetido: el error va en el campo y el foco se queda ahí.
          setErrores({
            slug: 'Ya existe otro artículo con este slug. Cambia la dirección.',
          });
          requestAnimationFrame(() =>
            document.getElementById(idCampo('slug'))?.focus(),
          );
          return;
        }
        setErrorGeneral(
          typeof body?.message === 'string' && res.status < 500
            ? body.message
            : 'No se pudo guardar el artículo. Inténtalo de nuevo.',
        );
        return;
      }
      const nuevo = (await res.json()) as BlogPost;
      const aviso =
        form.estado === 'publicado'
          ? guardado?.estado === 'publicado'
            ? 'Cambios publicados'
            : 'Artículo publicado'
          : 'Borrador guardado';
      const datos = desdePost(nuevo);
      setGuardado(nuevo);
      setBase(datos);
      setForm(datos);
      setSlugTocado(true);
      setErrores({});
      onGuardado(nuevo);
      onAviso(aviso);
    } catch {
      setErrorGeneral('Sin conexión con el servidor. Inténtalo de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  // Ctrl/⌘ + S guarda; el handler vive en un ref para ver siempre el último form.
  const guardarActual = useRef(guardar);
  useEffect(() => {
    guardarActual.current = guardar;
  });
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void guardarActual.current();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Avisa antes de cerrar o recargar la pestaña con cambios sin guardar.
  useEffect(() => {
    if (!sucio) return;
    function onAntes(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener('beforeunload', onAntes);
    return () => window.removeEventListener('beforeunload', onAntes);
  }, [sucio]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void guardar();
  }

  function volver() {
    if (sucio) setConfirmarSalida(true);
    else onVolver();
  }

  function aplicarFormato(formato: Formato) {
    const el = areaRef.current;
    if (!el) return;
    const { selectionStart: ini, selectionEnd: fin, value } = el;
    const seleccion = value.slice(ini, fin);
    let nuevo = value;
    let desde = ini;
    let hasta = fin;

    const envolver = (antes: string, despues: string, ejemplo: string) => {
      const texto = seleccion || ejemplo;
      nuevo = value.slice(0, ini) + antes + texto + despues + value.slice(fin);
      desde = ini + antes.length;
      hasta = desde + texto.length;
    };
    // Los formatos de bloque se aplican a cada línea de la selección.
    const prefijar = (prefijo: (i: number) => string, ejemplo: string) => {
      const inicioLinea = value.lastIndexOf('\n', ini - 1) + 1;
      const bloque = value.slice(inicioLinea, fin) || ejemplo;
      const conPrefijo = bloque
        .split('\n')
        .map((linea, i) => prefijo(i) + linea)
        .join('\n');
      nuevo = value.slice(0, inicioLinea) + conPrefijo + value.slice(fin);
      desde = inicioLinea;
      hasta = inicioLinea + conPrefijo.length;
    };

    switch (formato) {
      case 'negrita':
        envolver('**', '**', 'texto en negrita');
        break;
      case 'cursiva':
        envolver('*', '*', 'texto en cursiva');
        break;
      case 'h2':
        prefijar(() => '## ', 'Subtítulo');
        break;
      case 'h3':
        prefijar(() => '### ', 'Subtítulo menor');
        break;
      case 'lista':
        prefijar(() => '- ', 'Elemento');
        break;
      case 'numerada':
        prefijar((i) => `${i + 1}. `, 'Elemento');
        break;
      case 'cita':
        prefijar(() => '> ', 'Cita');
        break;
      case 'enlace':
        envolver('[', '](https://)', 'texto del enlace');
        break;
    }

    cambiar('contenido', nuevo);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(desde, hasta);
    });
  }

  function onTeclaPestana(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const siguiente: Pestana = pestana === 'escribir' ? 'previa' : 'escribir';
    setPestana(siguiente);
    document.getElementById(idCampo(`tab-${siguiente}`))?.focus();
  }

  const palabras = contarPalabras(form.contenido);
  const minutos = minutosLectura(form.contenido);
  const slugCambiado =
    guardado?.estado === 'publicado' && form.slug !== (guardado?.slug ?? '');
  const slugSugerido = slugify(form.titulo);
  const etiquetaBoton =
    form.estado === 'publicado'
      ? guardado?.estado === 'publicado'
        ? 'Actualizar artículo'
        : 'Publicar artículo'
      : 'Guardar borrador';
  const urlImagen = form.imagen_url.trim();

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="sticky top-[69px] z-20 flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white/85 px-2.5 py-2 shadow-sm backdrop-blur-md sm:gap-3 sm:px-3 lg:top-4 dark:border-zinc-800 dark:bg-zinc-900/85">
        <button
          type="button"
          onClick={volver}
          className={`btn-press inline-flex h-10 items-center gap-1 rounded-xl px-2 text-sm font-semibold text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 sm:px-3 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50 ${FOCO}`}
        >
          <IconoFlecha />
          <span className="hidden sm:inline">Artículos</span>
          <span className="sr-only sm:hidden">Volver a artículos</span>
        </button>

        <div
          className="flex min-w-0 flex-1 items-center gap-2"
          aria-live="polite"
        >
          {guardado ? (
            <EstadoChip estado={guardado.estado} />
          ) : (
            <span className="rounded-full bg-brand-orange/15 px-2.5 py-0.5 text-xs font-bold whitespace-nowrap text-accent-ink">
              Nuevo
            </span>
          )}
          {sucio && (
            <span className="flex items-center gap-1.5 text-xs font-medium whitespace-nowrap text-amber-700 dark:text-amber-400">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-amber-500"
              />
              <span className="hidden sm:inline">Cambios sin guardar</span>
              <span className="sm:hidden">Sin guardar</span>
            </span>
          )}
        </div>

        {guardado?.estado === 'publicado' && (
          <a
            href={`/blog/${guardado.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`btn-press hidden h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 md:inline-flex dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50 ${FOCO}`}
          >
            <IconoExterno />
            Ver en el sitio
            <span className="sr-only"> (se abre en una pestaña nueva)</span>
          </a>
        )}

        <button
          type="submit"
          disabled={enviando}
          aria-busy={enviando}
          title="Ctrl/⌘ + S"
          className={`btn-gradient btn-press h-10 shrink-0 rounded-xl px-4 text-sm font-semibold text-white shadow-md shadow-brand-orange/25 disabled:opacity-60 ${FOCO}`}
        >
          {enviando ? 'Guardando…' : etiquetaBoton}
        </button>
      </div>

      {errorGeneral && (
        <div
          role="alert"
          className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          {errorGeneral}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0 space-y-6">
          <section className={`${TARJETA} space-y-5`}>
            <Campo
              id={idCampo('titulo')}
              etiqueta="Título"
              error={errores.titulo}
              contador={
                <Contador actual={form.titulo.length} limite={LIMITE_TITULO} />
              }
            >
              <input
                id={idCampo('titulo')}
                value={form.titulo}
                autoFocus={!post}
                placeholder="Ej. Cómo elegir la pizza ideal para compartir"
                aria-invalid={Boolean(errores.titulo)}
                aria-describedby={describedBy(
                  idCampo('titulo'),
                  false,
                  errores.titulo,
                )}
                onChange={(e) => {
                  const titulo = e.target.value;
                  setForm((f) => ({
                    ...f,
                    titulo,
                    slug: slugTocado ? f.slug : slugify(titulo),
                  }));
                  if (errores.titulo || (!slugTocado && errores.slug)) {
                    setErrores((er) => ({
                      ...er,
                      titulo: undefined,
                      slug: slugTocado ? er.slug : undefined,
                    }));
                  }
                }}
                className={`${claseCampo(Boolean(errores.titulo))} text-lg! font-semibold`}
              />
            </Campo>

            <Campo
              id={idCampo('slug')}
              etiqueta="Dirección (slug)"
              error={errores.slug}
              contador={
                slugTocado && slugSugerido && form.slug !== slugSugerido ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSlugTocado(false);
                      cambiar('slug', slugSugerido);
                    }}
                    className={`rounded text-xs font-semibold text-accent-ink hover:underline ${FOCO}`}
                  >
                    Regenerar
                    <span className="sr-only"> el slug desde el título</span>
                  </button>
                ) : undefined
              }
              ayuda={
                slugCambiado
                  ? 'Cambiar el slug de un artículo publicado rompe los enlaces que ya se compartieron.'
                  : 'Se genera solo a partir del título; puedes ajustarlo.'
              }
            >
              <div
                className={`mt-1.5 flex items-stretch overflow-hidden rounded-xl border bg-white transition focus-within:ring-2 dark:bg-zinc-900 ${
                  errores.slug
                    ? 'border-red-500 focus-within:ring-red-500/25'
                    : 'border-zinc-300 focus-within:border-brand-orange focus-within:ring-brand-orange/25 dark:border-zinc-700'
                }`}
              >
                <span className="flex items-center border-r border-zinc-200 bg-zinc-50 px-3 font-mono text-sm text-zinc-500 select-none dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400">
                  /blog/
                </span>
                <input
                  id={idCampo('slug')}
                  value={form.slug}
                  aria-invalid={Boolean(errores.slug)}
                  aria-describedby={describedBy(
                    idCampo('slug'),
                    true,
                    errores.slug,
                  )}
                  onChange={(e) => {
                    setSlugTocado(true);
                    cambiar('slug', slugify(e.target.value));
                  }}
                  className="min-w-0 flex-1 bg-transparent px-3 py-2.5 font-mono text-base text-zinc-900 outline-none sm:text-sm dark:text-zinc-50"
                />
              </div>
            </Campo>

            <Campo
              id={idCampo('resumen')}
              etiqueta="Resumen"
              ayuda="Aparece en el listado del blog y como descripción en Google."
              error={errores.resumen}
              contador={
                <Contador
                  actual={form.resumen.length}
                  limite={LIMITE_RESUMEN}
                />
              }
            >
              <textarea
                id={idCampo('resumen')}
                rows={3}
                value={form.resumen}
                aria-invalid={Boolean(errores.resumen)}
                aria-describedby={describedBy(
                  idCampo('resumen'),
                  true,
                  errores.resumen,
                )}
                onChange={(e) => cambiar('resumen', e.target.value)}
                className={`${claseCampo(Boolean(errores.resumen))} resize-y`}
              />
            </Campo>
          </section>

          <section className={TARJETA}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div
                role="tablist"
                aria-label="Modo del editor"
                className="inline-flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800/70"
              >
                {(
                  [
                    ['escribir', 'Escribir'],
                    ['previa', 'Vista previa'],
                  ] as const
                ).map(([clave, texto]) => {
                  const activa = pestana === clave;
                  return (
                    <button
                      key={clave}
                      id={idCampo(`tab-${clave}`)}
                      type="button"
                      role="tab"
                      aria-selected={activa}
                      aria-controls={idCampo('panel-contenido')}
                      tabIndex={activa ? 0 : -1}
                      onClick={() => setPestana(clave)}
                      onKeyDown={onTeclaPestana}
                      className={`btn-press h-9 rounded-lg px-3.5 text-sm font-semibold transition-colors ${FOCO} ${
                        activa
                          ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50'
                          : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50'
                      }`}
                    >
                      {texto}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
                {palabras} palabra{palabras === 1 ? '' : 's'}
                {minutos > 0 && ` · ${minutos} min de lectura`}
              </p>
            </div>

            <div
              id={idCampo('panel-contenido')}
              role="tabpanel"
              aria-labelledby={idCampo(`tab-${pestana}`)}
              className="mt-3"
            >
              {pestana === 'escribir' ? (
                <>
                  <div
                    role="toolbar"
                    aria-label="Formato del texto"
                    className="mb-2 flex flex-wrap items-center gap-0.5 rounded-xl border border-zinc-200 bg-white/60 p-1 dark:border-zinc-800 dark:bg-zinc-900/40"
                  >
                    <button
                      type="button"
                      onClick={() => aplicarFormato('negrita')}
                      aria-label="Negrita"
                      title="Negrita"
                      className={BOTON_FORMATO}
                    >
                      B
                    </button>
                    <button
                      type="button"
                      onClick={() => aplicarFormato('cursiva')}
                      aria-label="Cursiva"
                      title="Cursiva"
                      className={`${BOTON_FORMATO} italic`}
                    >
                      I
                    </button>
                    <span
                      aria-hidden="true"
                      className="mx-0.5 h-5 w-px bg-zinc-200 sm:mx-1 dark:bg-zinc-700"
                    />
                    <button
                      type="button"
                      onClick={() => aplicarFormato('h2')}
                      aria-label="Subtítulo"
                      title="Subtítulo"
                      className={BOTON_FORMATO}
                    >
                      H2
                    </button>
                    <button
                      type="button"
                      onClick={() => aplicarFormato('h3')}
                      aria-label="Subtítulo menor"
                      title="Subtítulo menor"
                      className={BOTON_FORMATO}
                    >
                      H3
                    </button>
                    <span
                      aria-hidden="true"
                      className="mx-0.5 h-5 w-px bg-zinc-200 sm:mx-1 dark:bg-zinc-700"
                    />
                    <button
                      type="button"
                      onClick={() => aplicarFormato('lista')}
                      aria-label="Lista con viñetas"
                      title="Lista con viñetas"
                      className={BOTON_FORMATO}
                    >
                      <IconoLista />
                    </button>
                    <button
                      type="button"
                      onClick={() => aplicarFormato('numerada')}
                      aria-label="Lista numerada"
                      title="Lista numerada"
                      className={BOTON_FORMATO}
                    >
                      <IconoListaNumerada />
                    </button>
                    <button
                      type="button"
                      onClick={() => aplicarFormato('cita')}
                      aria-label="Cita"
                      title="Cita"
                      className={BOTON_FORMATO}
                    >
                      <IconoCita />
                    </button>
                    <button
                      type="button"
                      onClick={() => aplicarFormato('enlace')}
                      aria-label="Enlace"
                      title="Enlace"
                      className={BOTON_FORMATO}
                    >
                      <IconoEnlace />
                    </button>
                  </div>
                  <label htmlFor={idCampo('contenido')} className="sr-only">
                    Contenido (Markdown)
                  </label>
                  <textarea
                    id={idCampo('contenido')}
                    ref={areaRef}
                    rows={16}
                    value={form.contenido}
                    placeholder="Escribe el artículo. Usa la barra de arriba para dar formato (Markdown)."
                    aria-invalid={Boolean(errores.contenido)}
                    aria-describedby={describedBy(
                      idCampo('contenido'),
                      false,
                      errores.contenido,
                    )}
                    onChange={(e) => cambiar('contenido', e.target.value)}
                    className={`${claseCampo(Boolean(errores.contenido))} mt-0! min-h-80 resize-y font-mono text-sm! leading-relaxed`}
                  />
                  {errores.contenido && (
                    <p
                      id={`${idCampo('contenido')}-error`}
                      className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400"
                    >
                      {errores.contenido}
                    </p>
                  )}
                </>
              ) : (
                <div className="min-h-80 rounded-xl border border-zinc-200 bg-white/60 p-4 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900/40">
                  <VistaPreviaMarkdown contenido={form.contenido} />
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="min-w-0 space-y-4">
          <Tarjeta titulo="Publicación">
            <fieldset>
              <legend className="sr-only">Estado del artículo</legend>
              <div className="grid grid-cols-2 gap-2">
                {ESTADOS.map((op) => (
                  <label key={op.valor} className="relative block">
                    <input
                      type="radio"
                      name={idCampo('estado')}
                      value={op.valor}
                      checked={form.estado === op.valor}
                      onChange={() => cambiar('estado', op.valor)}
                      className="peer sr-only"
                    />
                    <span className="block cursor-pointer rounded-xl border border-zinc-300 p-3 transition peer-checked:border-brand-orange peer-checked:bg-brand-orange/10 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-orange/60 dark:border-zinc-700">
                      <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        {op.titulo}
                      </span>
                      <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                        {op.detalle}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {guardado?.publicado_en
                ? `Publicado el ${formatFecha(guardado.publicado_en)}.`
                : 'Se fechará en el momento de publicarlo.'}
            </p>
            {guardado && (
              <button
                type="button"
                onClick={() => onEliminar(guardado)}
                className={`btn-press inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-red-300 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/70 dark:text-red-400 dark:hover:bg-red-950/40 ${FOCO}`}
              >
                <IconoPapelera />
                Eliminar artículo
              </button>
            )}
          </Tarjeta>

          <Tarjeta titulo="Imagen destacada">
            {urlImagen && esUrlHttp(urlImagen) && !imagenFallida ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL externa arbitraria del admin, solo previsualización.
              <img
                src={urlImagen}
                alt="Vista previa de la imagen destacada"
                onError={() => setImagenFallida(true)}
                className="aspect-video w-full rounded-xl object-cover"
              />
            ) : (
              <div className="flex aspect-video w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-300 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                <IconoImagen />
                <span className="px-3 text-center text-xs">
                  {imagenFallida ? 'No se pudo cargar la imagen' : 'Sin imagen'}
                </span>
              </div>
            )}
            <Campo
              id={idCampo('imagen_url')}
              etiqueta="Enlace de la imagen"
              ayuda="Opcional. Funciona mejor una imagen horizontal."
              error={errores.imagen_url}
            >
              <input
                id={idCampo('imagen_url')}
                type="url"
                inputMode="url"
                value={form.imagen_url}
                placeholder="https://…"
                aria-invalid={Boolean(errores.imagen_url)}
                aria-describedby={describedBy(
                  idCampo('imagen_url'),
                  true,
                  errores.imagen_url,
                )}
                onChange={(e) => {
                  setImagenFallida(false);
                  cambiar('imagen_url', e.target.value);
                }}
                className={claseCampo(Boolean(errores.imagen_url))}
              />
            </Campo>
          </Tarjeta>

          <Tarjeta titulo="Clasificación">
            <Campo id={idCampo('etiqueta')} etiqueta="Etiqueta">
              <input
                id={idCampo('etiqueta')}
                value={form.etiqueta}
                placeholder="Categoría corta"
                onChange={(e) => cambiar('etiqueta', e.target.value)}
                className={claseCampo(false)}
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ETIQUETAS_SUGERIDAS.map((sugerida) => {
                  const activa = form.etiqueta === sugerida;
                  return (
                    <button
                      key={sugerida}
                      type="button"
                      aria-pressed={activa}
                      onClick={() =>
                        cambiar('etiqueta', activa ? '' : sugerida)
                      }
                      className={`btn-press h-8 rounded-full border px-3 text-xs font-semibold transition-colors ${FOCO} ${
                        activa
                          ? 'border-brand-orange bg-brand-orange/10 text-accent-ink'
                          : 'border-zinc-300 text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      {sugerida}
                    </button>
                  );
                })}
              </div>
            </Campo>
            <Campo
              id={idCampo('palabra_clave')}
              etiqueta="Palabra clave principal"
              ayuda="La frase por la que quieres que te encuentren en Google."
            >
              <input
                id={idCampo('palabra_clave')}
                value={form.palabra_clave}
                aria-describedby={describedBy(idCampo('palabra_clave'), true)}
                onChange={(e) => cambiar('palabra_clave', e.target.value)}
                className={claseCampo(false)}
              />
            </Campo>
          </Tarjeta>

          <Tarjeta titulo="Así se verá en Google">
            <div className="rounded-xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-700 dark:bg-zinc-900">
              <p className="truncate text-xs text-zinc-600 dark:text-zinc-400">
                pizzeriahorebs.shop › blog › {form.slug || 'slug'}
              </p>
              <p className="mt-1 line-clamp-2 text-base leading-snug font-medium text-brand-navy dark:text-blue-300">
                {form.titulo || 'Título del artículo'}
              </p>
              <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                {form.resumen || 'El resumen aparecerá aquí.'}
              </p>
            </div>
          </Tarjeta>
        </aside>
      </div>

      {confirmarSalida && (
        <ModalConfirmar
          titulo="¿Salir sin guardar?"
          descripcion="Tienes cambios sin guardar. Si sales ahora se perderán."
          textoConfirmar="Descartar y salir"
          textoCancelar="Seguir editando"
          peligro
          onConfirmar={onVolver}
          onCancelar={() => setConfirmarSalida(false)}
        />
      )}
    </form>
  );
}
