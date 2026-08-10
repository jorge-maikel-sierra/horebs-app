'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from '@/lib/use-session';
import { adminFetch } from '@/lib/admin-fetch';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8Z" />
    </svg>
  );
}

export default function BlogLikeButton({ slug }: { slug: string }) {
  const { cargando: cargandoSesion, session } = useSession();
  const [total, setTotal] = useState<number | null>(null);
  const [meGusta, setMeGusta] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mostrarAviso, setMostrarAviso] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/blog/posts/${slug}/likes`)
      .then((r) => r.json())
      .then((d) => setTotal(d.total))
      .catch(() => setTotal(0));
  }, [slug]);

  useEffect(() => {
    if (!session) {
      setMeGusta(false);
      return;
    }
    adminFetch(`/blog/posts/${slug}/likes/estado`)
      .then((r) => (r.ok ? r.json() : { meGusta: false }))
      .then((d) => setMeGusta(!!d.meGusta))
      .catch(() => {});
  }, [slug, session]);

  async function toggle() {
    if (!session) {
      setMostrarAviso(true);
      return;
    }
    setEnviando(true);
    const totalAnterior = total;
    const meGustaAnterior = meGusta;
    setMeGusta(!meGusta);
    setTotal((t) => (t ?? 0) + (meGusta ? -1 : 1));

    try {
      const res = await adminFetch(`/blog/posts/${slug}/likes`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTotal(data.total);
      setMeGusta(data.meGusta);
    } catch {
      setTotal(totalAnterior);
      setMeGusta(meGustaAnterior);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        disabled={enviando || cargandoSesion}
        className={`btn-press flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${
          meGusta
            ? 'btn-gradient border-transparent text-white'
            : 'border-zinc-300 text-zinc-700 hover:border-brand-orange hover:text-brand-orange dark:border-zinc-700 dark:text-zinc-300'
        }`}
      >
        <span
          key={meGusta ? 'on' : 'off'}
          className="animate-pop-in inline-flex items-center gap-2"
        >
          <HeartIcon filled={meGusta} />
          {meGusta ? 'Te gusta' : 'Me gusta'}
        </span>
        {total !== null && <span className="tabular-nums">{total}</span>}
      </button>
      {mostrarAviso && !session && (
        <p className="animate-fade-up mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          <Link href="/cuenta" className="text-brand-orange underline">
            Iniciá sesión
          </Link>{' '}
          para dar me gusta.
        </p>
      )}
    </div>
  );
}
