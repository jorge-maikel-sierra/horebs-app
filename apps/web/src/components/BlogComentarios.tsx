'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSession } from '@/lib/use-session';
import { adminFetch } from '@/lib/admin-fetch';
import { formatFecha, formatHora } from '@/lib/formato';

type Comentario = {
  id: string;
  usuario_id: string;
  autor_nombre: string;
  contenido: string;
  created_at: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export default function BlogComentarios({ slug }: { slug: string }) {
  const { cargando: cargandoSesion, session } = useSession();
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    fetch(`${API_URL}/blog/posts/${slug}/comentarios`)
      .then((r) => r.json())
      .then((data) => {
        if (activo) setComentarios(data);
      })
      .catch(() => {
        if (activo) setComentarios([]);
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [slug]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!texto.trim()) return;

    setEnviando(true);
    try {
      const res = await adminFetch(`/blog/posts/${slug}/comentarios`, {
        method: 'POST',
        body: JSON.stringify({ contenido: texto.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.message ?? 'No se pudo publicar el comentario.',
        );
      }
      const nuevo = await res.json();
      setComentarios((prev) => [...prev, nuevo]);
      setTexto('');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo publicar el comentario.',
      );
    } finally {
      setEnviando(false);
    }
  }

  async function borrar(id: string) {
    const anteriores = comentarios;
    setComentarios((prev) => prev.filter((c) => c.id !== id));
    try {
      const res = await adminFetch(`/blog/comentarios/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error();
    } catch {
      setComentarios(anteriores);
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
        Comentarios{comentarios.length > 0 && ` (${comentarios.length})`}
      </h2>

      {!cargandoSesion &&
        (session ? (
          <form onSubmit={enviar} className="mt-4 space-y-2">
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Escribí tu comentario…"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 outline-none transition-colors focus:border-brand-orange dark:border-zinc-700 dark:bg-zinc-950"
            />
            {error && (
              <p className="animate-fade-up text-sm text-red-600">{error}</p>
            )}
            <button
              type="submit"
              disabled={enviando || !texto.trim()}
              className="btn-press btn-gradient rounded-lg px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {enviando ? 'Publicando…' : 'Publicar comentario'}
            </button>
          </form>
        ) : (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            <Link
              href="/cuenta"
              className="font-semibold text-brand-orange underline"
            >
              Iniciá sesión
            </Link>{' '}
            para dejar un comentario.
          </p>
        ))}

      <div className="mt-6 space-y-3">
        {cargando ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="skeleton h-20 rounded-2xl" />
            ))}
          </div>
        ) : comentarios.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Todavía no hay comentarios. ¡Sé el primero!
          </p>
        ) : (
          comentarios.map((c, i) => (
            <div
              key={c.id}
              className="card-gradient animate-fade-up flex items-start gap-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800"
              style={{ animationDelay: `${Math.min(i, 4) * 0.06}s` }}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-orange/15 text-sm font-semibold text-brand-orange">
                {c.autor_nombre.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      {c.autor_nombre}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {formatFecha(c.created_at)} · {formatHora(c.created_at)}
                    </p>
                  </div>
                  {session?.user.id === c.usuario_id && (
                    <button
                      type="button"
                      onClick={() => borrar(c.id)}
                      className="shrink-0 text-xs text-zinc-400 transition-colors hover:text-red-600"
                    >
                      Borrar
                    </button>
                  )}
                </div>
                <p className="mt-2 text-sm whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                  {c.contenido}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
