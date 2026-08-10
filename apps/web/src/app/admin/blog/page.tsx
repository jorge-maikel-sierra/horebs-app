'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import RequireRol from '@/components/RequireRol';
import { adminFetch } from '@/lib/admin-fetch';

type Estado = 'borrador' | 'publicado';

type BlogPost = {
  id: string;
  titulo: string;
  slug: string;
  resumen: string;
  contenido: string;
  palabra_clave: string | null;
  imagen_url: string | null;
  estado: Estado;
  publicado_en: string | null;
  created_at: string;
};

const VACIO = {
  titulo: '',
  slug: '',
  resumen: '',
  contenido: '',
  palabra_clave: '',
  imagen_url: '',
  estado: 'borrador' as Estado,
};

function slugify(texto: string) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function BlogAdminInterno() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [cargando, setCargando] = useState(true);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState(VACIO);
  const [slugTocado, setSlugTocado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function cargarPosts() {
    setCargando(true);
    const res = await adminFetch('/admin/blog');
    if (res.ok) setPosts(await res.json());
    setCargando(false);
  }

  useEffect(() => {
    cargarPosts();
  }, []);

  function nuevo() {
    setEditandoId(null);
    setForm(VACIO);
    setSlugTocado(false);
    setError(null);
  }

  function editar(post: BlogPost) {
    setEditandoId(post.id);
    setForm({
      titulo: post.titulo,
      slug: post.slug,
      resumen: post.resumen,
      contenido: post.contenido,
      palabra_clave: post.palabra_clave ?? '',
      imagen_url: post.imagen_url ?? '',
      estado: post.estado,
    });
    setSlugTocado(true);
    setError(null);
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const payload = {
        titulo: form.titulo,
        slug: form.slug,
        resumen: form.resumen,
        contenido: form.contenido,
        palabra_clave: form.palabra_clave || undefined,
        imagen_url: form.imagen_url || undefined,
        estado: form.estado,
      };

      const res = await adminFetch(
        editandoId ? `/admin/blog/${editandoId}` : '/admin/blog',
        {
          method: editandoId ? 'PATCH' : 'POST',
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? 'No se pudo guardar el artículo.');
      }
      nuevo();
      await cargarPosts();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo guardar el artículo.',
      );
    } finally {
      setEnviando(false);
    }
  }

  async function eliminar(id: string) {
    if (!window.confirm('¿Eliminar este artículo? No se puede deshacer.')) {
      return;
    }
    await adminFetch(`/admin/blog/${id}`, { method: 'DELETE' });
    if (editandoId === id) nuevo();
    await cargarPosts();
  }

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
          Blog
        </h1>
        <Link href="/admin" className="text-sm text-brand-orange underline">
          Volver al panel
        </Link>
      </div>

      <form
        onSubmit={guardar}
        className="mt-6 space-y-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
      >
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">
          {editandoId ? 'Editar artículo' : 'Nuevo artículo'}
        </h2>

        <div>
          <label className="block text-sm font-medium">Título</label>
          <input
            required
            value={form.titulo}
            onChange={(e) => {
              const titulo = e.target.value;
              setForm((f) => ({
                ...f,
                titulo,
                slug: slugTocado ? f.slug : slugify(titulo),
              }));
            }}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Slug (URL)</label>
          <input
            required
            value={form.slug}
            onChange={(e) => {
              setSlugTocado(true);
              setForm((f) => ({ ...f, slug: slugify(e.target.value) }));
            }}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            /blog/{form.slug || 'ejemplo-de-slug'}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium">
            Resumen (para Google y el listado)
          </label>
          <textarea
            required
            rows={2}
            value={form.resumen}
            onChange={(e) => setForm((f) => ({ ...f, resumen: e.target.value }))}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">
            Palabra clave principal
          </label>
          <input
            value={form.palabra_clave}
            onChange={(e) =>
              setForm((f) => ({ ...f, palabra_clave: e.target.value }))
            }
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">
            URL de imagen (opcional)
          </label>
          <input
            value={form.imagen_url}
            onChange={(e) =>
              setForm((f) => ({ ...f, imagen_url: e.target.value }))
            }
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">
            Contenido (Markdown)
          </label>
          <textarea
            required
            rows={14}
            value={form.contenido}
            onChange={(e) =>
              setForm((f) => ({ ...f, contenido: e.target.value }))
            }
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <label className="block text-sm font-medium">Estado</label>
            <select
              value={form.estado}
              onChange={(e) =>
                setForm((f) => ({ ...f, estado: e.target.value as Estado }))
              }
              className="mt-1 rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="borrador">Borrador</option>
              <option value="publicado">Publicado</option>
            </select>
          </div>
          <div className="flex gap-2">
            {editandoId && (
              <button
                type="button"
                onClick={nuevo}
                className="rounded-lg border border-zinc-300 px-4 py-2 font-semibold dark:border-zinc-700"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={enviando}
              className="rounded-lg bg-brand-orange px-4 py-2 font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {editandoId ? 'Guardar cambios' : 'Crear artículo'}
            </button>
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      <div className="mt-8">
        {cargando ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Cargando…
          </p>
        ) : posts.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Todavía no hay artículos.
          </p>
        ) : (
          <ul className="space-y-2">
            {posts.map((post) => (
              <li
                key={post.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
              >
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">
                    {post.titulo}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    <span
                      className={
                        post.estado === 'publicado'
                          ? 'text-green-600'
                          : 'text-zinc-500'
                      }
                    >
                      {post.estado}
                    </span>
                    {' · '}/blog/{post.slug}
                  </p>
                </div>
                <div className="flex shrink-0 gap-3 text-sm">
                  <button
                    type="button"
                    onClick={() => editar(post)}
                    className="text-brand-orange hover:underline"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => eliminar(post.id)}
                    className="text-red-600 hover:underline"
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function BlogAdminPage() {
  return (
    <RequireRol roles={['admin']}>
      <BlogAdminInterno />
    </RequireRol>
  );
}
