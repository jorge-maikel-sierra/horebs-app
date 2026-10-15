'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Misma clase `blog-content` que la página pública: lo que se ve acá es
// lo que verá el cliente.
export default function VistaPreviaMarkdown({
  contenido,
}: {
  contenido: string;
}) {
  if (!contenido.trim()) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Aún no hay nada que previsualizar. Escribe algo en la pestaña
        “Escribir”.
      </p>
    );
  }
  return (
    <div className="blog-content text-zinc-700 dark:text-zinc-300">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{contenido}</ReactMarkdown>
    </div>
  );
}
