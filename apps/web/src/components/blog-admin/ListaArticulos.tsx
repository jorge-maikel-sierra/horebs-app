'use client';

import { useMemo, useState } from 'react';
import CargandoSkeleton from '@/components/CargandoSkeleton';
import EstadoChip from './EstadoChip';
import { FOCO } from './estilos';
import {
  IconoDocumento,
  IconoEditar,
  IconoExterno,
  IconoLupa,
  IconoMas,
  IconoPapelera,
} from './iconos';
import {
  formatFecha,
  minutosLectura,
  normalizar,
  type BlogPost,
  type Estado,
} from './tipos';

type Filtro = 'todos' | Estado;

function Miniatura({ url }: { url: string | null }) {
  const [fallida, setFallida] = useState(false);
  if (!url || fallida) {
    return (
      <span className="flex h-14 w-20 shrink-0 items-center justify-center rounded-xl bg-brand-orange/10 text-brand-orange sm:h-16 sm:w-24">
        <IconoDocumento />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- URL externa arbitraria del admin, no vale la pena optimizarla con next/image.
    <img
      src={url}
      alt=""
      loading="lazy"
      onError={() => setFallida(true)}
      className="h-14 w-20 shrink-0 rounded-xl object-cover sm:h-16 sm:w-24"
    />
  );
}

const BOTON_ACCION = `btn-press inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition-colors sm:w-10 sm:justify-center sm:px-0 ${FOCO}`;

export default function ListaArticulos({
  posts,
  cargando,
  errorCarga,
  onNuevo,
  onEditar,
  onEliminar,
  onReintentar,
}: {
  posts: BlogPost[];
  cargando: boolean;
  errorCarga: boolean;
  onNuevo: () => void;
  onEditar: (post: BlogPost) => void;
  onEliminar: (post: BlogPost) => void;
  onReintentar: () => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');

  const conteo = useMemo(
    () => ({
      todos: posts.length,
      publicado: posts.filter((p) => p.estado === 'publicado').length,
      borrador: posts.filter((p) => p.estado === 'borrador').length,
    }),
    [posts],
  );

  const visibles = useMemo(() => {
    const q = normalizar(busqueda.trim());
    return posts.filter((p) => {
      if (filtro !== 'todos' && p.estado !== filtro) return false;
      if (!q) return true;
      return (
        normalizar(p.titulo).includes(q) ||
        normalizar(p.slug).includes(q) ||
        normalizar(p.etiqueta ?? '').includes(q)
      );
    });
  }, [posts, busqueda, filtro]);

  const FILTROS: { clave: Filtro; texto: string }[] = [
    { clave: 'todos', texto: 'Todos' },
    { clave: 'publicado', texto: 'Publicados' },
    { clave: 'borrador', texto: 'Borradores' },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
            Blog
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Artículos del sitio, publicados y en borrador.
          </p>
        </div>
        <button
          type="button"
          onClick={onNuevo}
          className={`btn-gradient btn-press inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white shadow-md shadow-brand-orange/25 ${FOCO}`}
        >
          <IconoMas />
          Nuevo artículo
        </button>
      </div>

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div
          role="group"
          aria-label="Filtrar por estado"
          className="flex gap-1 overflow-x-auto rounded-2xl bg-zinc-100 p-1 dark:bg-zinc-800/70"
        >
          {FILTROS.map((f) => {
            const activo = filtro === f.clave;
            return (
              <button
                key={f.clave}
                type="button"
                aria-pressed={activo}
                onClick={() => setFiltro(f.clave)}
                className={`btn-press flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold whitespace-nowrap transition-colors lg:flex-none ${FOCO} ${
                  activo
                    ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50'
                    : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50'
                }`}
              >
                {f.texto}
                <span className="text-xs font-bold text-zinc-500 tabular-nums dark:text-zinc-400">
                  {conteo[f.clave]}
                </span>
              </button>
            );
          })}
        </div>

        <label className="flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 text-zinc-500 focus-within:border-brand-orange focus-within:ring-2 focus-within:ring-brand-orange/25 lg:w-80 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          <IconoLupa />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por título, slug o etiqueta"
            aria-label="Buscar artículos"
            className="h-11 min-w-0 flex-1 bg-transparent text-base text-zinc-800 outline-none placeholder:text-zinc-400 sm:text-sm dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
        </label>
      </div>

      <div className="mt-6" aria-live="polite">
        {cargando ? (
          <CargandoSkeleton filas={5} />
        ) : errorCarga ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
            <p className="font-semibold">
              No se pudieron cargar los artículos.
            </p>
            <button
              type="button"
              onClick={onReintentar}
              className={`btn-press mt-3 h-10 rounded-xl border border-red-300 px-4 font-semibold hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-950 ${FOCO}`}
            >
              Reintentar
            </button>
          </div>
        ) : posts.length === 0 ? (
          <div className="card-gradient flex flex-col items-center rounded-3xl border border-dashed border-zinc-300 px-6 py-14 text-center dark:border-zinc-700">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-orange/15 text-brand-orange">
              <IconoDocumento />
            </span>
            <p className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Todavía no hay artículos
            </p>
            <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
              Escribe el primero: puedes guardarlo como borrador y publicarlo
              cuando esté listo.
            </p>
            <button
              type="button"
              onClick={onNuevo}
              className={`btn-gradient btn-press mt-5 inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white shadow-md shadow-brand-orange/25 ${FOCO}`}
            >
              <IconoMas />
              Escribir el primero
            </button>
          </div>
        ) : visibles.length === 0 ? (
          <p className="rounded-2xl border border-zinc-200 px-5 py-10 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            Ningún artículo coincide con la búsqueda.
          </p>
        ) : (
          <ul className="space-y-3">
            {visibles.map((post) => {
              const minutos = minutosLectura(post.contenido);
              const fecha = post.publicado_en
                ? `Publicado ${formatFecha(post.publicado_en)}`
                : `Creado ${formatFecha(post.created_at)}`;
              return (
                <li
                  key={post.id}
                  className="card-gradient flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-zinc-200 p-3 transition-colors hover:border-brand-orange/40 sm:p-4 dark:border-zinc-800"
                >
                  <div className="flex min-w-0 basis-full gap-3 sm:basis-0 sm:flex-1 sm:gap-4">
                    <Miniatura url={post.imagen_url} />
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => onEditar(post)}
                        className={`block max-w-full truncate rounded text-left font-semibold text-zinc-900 hover:text-brand-orange dark:text-zinc-50 ${FOCO}`}
                      >
                        {post.titulo}
                      </button>
                      <p className="mt-0.5 truncate font-mono text-xs text-zinc-500 dark:text-zinc-400">
                        /blog/{post.slug}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                        <EstadoChip estado={post.estado} />
                        {post.etiqueta && (
                          <span className="rounded-full border border-zinc-300 px-2 py-0.5 font-medium text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
                            {post.etiqueta}
                          </span>
                        )}
                        <span>{fecha}</span>
                        {minutos > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{minutos} min de lectura</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex w-full items-center justify-end gap-1 border-t border-zinc-100 pt-2 sm:w-auto sm:border-0 sm:pt-0 dark:border-zinc-800/70">
                    {post.estado === 'publicado' && (
                      <a
                        href={`/blog/${post.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Ver en el sitio"
                        className={`${BOTON_ACCION} text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50`}
                      >
                        <IconoExterno />
                        <span className="sm:sr-only">Ver</span>
                        <span className="sr-only">
                          {' '}
                          (se abre en una pestaña nueva)
                        </span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => onEditar(post)}
                      title="Editar"
                      className={`${BOTON_ACCION} text-zinc-600 hover:bg-zinc-100 hover:text-brand-orange dark:text-zinc-300 dark:hover:bg-zinc-800`}
                    >
                      <IconoEditar />
                      <span className="sm:sr-only">Editar</span>
                      <span className="sr-only"> {post.titulo}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onEliminar(post)}
                      title="Eliminar"
                      className={`${BOTON_ACCION} text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40`}
                    >
                      <IconoPapelera />
                      <span className="sm:sr-only">Eliminar</span>
                      <span className="sr-only"> {post.titulo}</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
