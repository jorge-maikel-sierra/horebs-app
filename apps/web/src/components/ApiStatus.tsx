'use client';

import { useEffect, useState } from 'react';

type HealthResponse = {
  status: 'ok' | 'degraded';
  timestamp: string;
  supabase: { ok: boolean; error?: string };
};

export default function ApiStatus() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
    fetch(`${apiUrl}/health`)
      .then((res) => res.json())
      .then(setHealth)
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <p className="text-sm text-red-600">
        No se pudo conectar con el API ({error}). Verifica que esté corriendo y que
        NEXT_PUBLIC_API_URL apunte a la URL correcta.
      </p>
    );
  }

  if (!health) {
    return <p className="text-sm text-zinc-500">Verificando conexión con el API…</p>;
  }

  return (
    <div className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
      <p>
        API: <strong>{health.status}</strong>
      </p>
      <p>
        Supabase: <strong>{health.supabase.ok ? 'conectado' : 'sin conexión'}</strong>
        {health.supabase.error ? ` (${health.supabase.error})` : ''}
      </p>
    </div>
  );
}
