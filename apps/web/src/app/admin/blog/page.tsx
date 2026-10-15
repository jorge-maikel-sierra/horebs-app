'use client';

import { useCallback, useEffect, useState } from 'react';
import RequireRol from '@/components/RequireRol';
import AvisoFlotante from '@/components/AvisoFlotante';
import ModalConfirmar from '@/components/ModalConfirmar';
import EditorArticulo from '@/components/blog-admin/EditorArticulo';
import ListaArticulos from '@/components/blog-admin/ListaArticulos';
import type { BlogPost } from '@/components/blog-admin/tipos';
import { adminFetch } from '@/lib/admin-fetch';
import { useAviso } from '@/lib/use-aviso';

type Editor = { post: BlogPost | null; clave: number };

function BlogAdminInterno() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [aEliminar, setAEliminar] = useState<BlogPost | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const { aviso, mostrar } = useAviso();

  const cargarPosts = useCallback(async () => {
    setCargando(true);
    setErrorCarga(false);
    try {
      const res = await adminFetch('/admin/blog');
      if (!res.ok) throw new Error('carga');
      setPosts(await res.json());
    } catch {
      setErrorCarga(true);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos remotos.
    void cargarPosts();
  }, [cargarPosts]);

  // Al cambiar entre lista y editor se vuelve al inicio de la pantalla.
  const hayEditor = editor !== null;
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [hayEditor]);

  function abrirEditor(post: BlogPost | null) {
    setEditor((previo) => ({ post, clave: (previo?.clave ?? 0) + 1 }));
  }

  function alGuardar(guardado: BlogPost) {
    setPosts((previos) =>
      previos.some((p) => p.id === guardado.id)
        ? previos.map((p) => (p.id === guardado.id ? guardado : p))
        : [guardado, ...previos],
    );
  }

  async function confirmarEliminar() {
    const post = aEliminar;
    if (!post) return;
    setEliminando(true);
    try {
      const res = await adminFetch(`/admin/blog/${post.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('eliminar');
      setPosts((previos) => previos.filter((p) => p.id !== post.id));
      setEditor((actual) => (actual?.post?.id === post.id ? null : actual));
      mostrar('Artículo eliminado');
    } catch {
      mostrar('No se pudo eliminar el artículo', true);
    } finally {
      setEliminando(false);
      setAEliminar(null);
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {editor ? (
        <EditorArticulo
          key={editor.clave}
          post={editor.post}
          onVolver={() => setEditor(null)}
          onGuardado={alGuardar}
          onEliminar={setAEliminar}
          onAviso={mostrar}
        />
      ) : (
        <ListaArticulos
          posts={posts}
          cargando={cargando}
          errorCarga={errorCarga}
          onNuevo={() => abrirEditor(null)}
          onEditar={abrirEditor}
          onEliminar={setAEliminar}
          onReintentar={cargarPosts}
        />
      )}

      {aEliminar && (
        <ModalConfirmar
          titulo="¿Eliminar este artículo?"
          descripcion={
            <>
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {aEliminar.titulo}
              </span>{' '}
              dejará de existir
              {aEliminar.estado === 'publicado' ? ' y también en el sitio' : ''}
              . Esta acción no se puede deshacer.
            </>
          }
          textoConfirmar="Eliminar"
          peligro
          cargando={eliminando}
          onConfirmar={confirmarEliminar}
          onCancelar={() => setAEliminar(null)}
        />
      )}

      <AvisoFlotante aviso={aviso} />
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
