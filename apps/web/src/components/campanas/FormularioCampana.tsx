'use client';

import { useEffect, useState, type FormEvent } from 'react';
import ModalBase from '@/components/ModalBase';
import { adminFetch } from '@/lib/admin-fetch';
import { leerErrorApi } from '@/lib/error-api';
import {
  CANALES_CAMPANA,
  CANAL_CAMPANA_LABEL,
  diaBogota,
  type CampanaMensajeria,
  type CanalCampana,
} from '@/lib/campanas-mensajeria';

/** Extensiones que acepta el API (`ESQUEMA_SUBIR_CREATIVO`). */
const EXTENSION_DE_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
};
const MAX_MB_CREATIVO = 50;
const BYTES_POR_MB = 1024 * 1024;

const CAMPO =
  'mt-1.5 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50';
const ETIQUETA = 'text-sm font-semibold text-zinc-900 dark:text-zinc-50';

type Borrador = {
  nombre: string;
  canal: CanalCampana;
  mensaje: string;
  enviada_en: string;
  costo: string;
  destinatarios: string;
};

function borradorDe(c: CampanaMensajeria | null): Borrador {
  return {
    nombre: c?.nombre ?? '',
    canal: c?.canal ?? 'whatsapp_business',
    mensaje: c?.mensaje ?? '',
    enviada_en: c ? diaBogota(c.enviada_en) : diaBogota(new Date().toISOString()),
    costo: c?.costo != null ? String(c.costo) : '',
    destinatarios: c?.destinatarios != null ? String(c.destinatarios) : '',
  };
}

function numeroOpcional(valor: string): number | null {
  const limpio = valor.replace(/[^\d]/g, '');
  return limpio ? Number(limpio) : null;
}

/** Sube el archivo directo a Storage con la URL firmada que da el API. */
async function subirCreativo(campanaId: string, archivo: File): Promise<void> {
  const extension = EXTENSION_DE_MIME[archivo.type];
  const res = await adminFetch(`/admin/campanas-mensajeria/${campanaId}/creativos`, {
    method: 'POST',
    body: JSON.stringify({ extension }),
  });
  if (!res.ok) throw new Error(await leerErrorApi(res, 'No se pudo preparar la subida del creativo.'));
  const { url_subida, mime } = (await res.json()) as { url_subida: string; mime: string };
  const subida = await fetch(url_subida, {
    method: 'PUT',
    headers: { 'Content-Type': mime },
    body: archivo,
  });
  if (!subida.ok) throw new Error('La campaña se guardó, pero el creativo no se pudo subir. Intentá de nuevo.');
}

export default function FormularioCampana({
  campana,
  onCerrar,
  onGuardada,
}: {
  /** null = campaña nueva. */
  campana: CampanaMensajeria | null;
  onCerrar: () => void;
  onGuardada: () => void;
}) {
  const [b, setB] = useState<Borrador>(() => borradorDe(campana));
  const [archivo, setArchivo] = useState<File | null>(null);
  const [vista, setVista] = useState<string | null>(campana?.creativo_url ?? null);
  const [tipoVista, setTipoVista] = useState(campana?.creativo_tipo ?? null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // La vista previa local (blob:) se libera al cambiarla o al cerrar el formulario.
  useEffect(() => {
    if (!vista?.startsWith('blob:')) return;
    return () => URL.revokeObjectURL(vista);
  }, [vista]);

  const cambiar = (campo: keyof Borrador, valor: string) => setB((x) => ({ ...x, [campo]: valor }));

  function elegirArchivo(f: File | undefined) {
    setError(null);
    if (!f) return;
    if (!EXTENSION_DE_MIME[f.type]) {
      setError('El creativo tiene que ser JPG, PNG, WEBP, MP4 o MOV.');
      return;
    }
    if (f.size > MAX_MB_CREATIVO * BYTES_POR_MB) {
      setError(`El creativo no puede pasar de ${MAX_MB_CREATIVO} MB.`);
      return;
    }
    setArchivo(f);
    setVista(URL.createObjectURL(f));
    setTipoVista(f.type.startsWith('video/') ? 'video' : 'imagen');
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const res = await adminFetch(
        campana ? `/admin/campanas-mensajeria/${campana.id}` : '/admin/campanas-mensajeria',
        {
          method: campana ? 'PATCH' : 'POST',
          body: JSON.stringify({
            nombre: b.nombre,
            canal: b.canal,
            mensaje: b.mensaje,
            enviada_en: b.enviada_en,
            costo: numeroOpcional(b.costo),
            destinatarios: numeroOpcional(b.destinatarios),
          }),
        },
      );
      if (!res.ok) throw new Error(await leerErrorApi(res, 'No se pudo guardar la campaña.'));
      const guardada = (await res.json()) as CampanaMensajeria;
      if (archivo) await subirCreativo(guardada.id, archivo);
      onGuardada();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la campaña.');
      setGuardando(false);
    }
  }

  return (
    <ModalBase
      titulo={campana ? 'Editar campaña' : 'Nueva campaña'}
      subtitulo="Difusiones y campañas que no pasan por los anuncios de Meta."
      cerrarConFondo={false}
      bloqueado={guardando}
      onCerrar={onCerrar}
      pie={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCerrar}
            disabled={guardando}
            className="btn-press h-11 rounded-xl border border-zinc-200 px-4 text-sm font-semibold text-zinc-700 dark:border-zinc-800 dark:text-zinc-300"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="formulario-campana"
            disabled={guardando}
            className="btn-press btn-gradient h-11 rounded-xl px-5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      }
    >
      <form id="formulario-campana" onSubmit={guardar} className="space-y-4">
        <label className="block">
          <span className={ETIQUETA}>Nombre</span>
          <input
            required
            maxLength={120}
            value={b.nombre}
            onChange={(e) => cambiar('nombre', e.target.value)}
            placeholder="Sábado 22 nov · Jamón y Queso + Postobón"
            className={CAMPO}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={ETIQUETA}>Canal</span>
            <select value={b.canal} onChange={(e) => cambiar('canal', e.target.value)} className={CAMPO}>
              {CANALES_CAMPANA.map((c) => (
                <option key={c} value={c}>
                  {CANAL_CAMPANA_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={ETIQUETA}>Día del envío</span>
            <input
              required
              type="date"
              value={b.enviada_en}
              onChange={(e) => cambiar('enviada_en', e.target.value)}
              className={`${CAMPO} appearance-none min-w-0 [&::-webkit-date-and-time-value]:text-left`}
            />
          </label>
        </div>

        <label className="block">
          <span className={ETIQUETA}>Mensaje</span>
          <textarea
            required
            maxLength={4000}
            rows={4}
            value={b.mensaje}
            onChange={(e) => cambiar('mensaje', e.target.value)}
            className={`${CAMPO} py-2`}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={ETIQUETA}>Costo (opcional)</span>
            <input
              inputMode="numeric"
              value={b.costo}
              onChange={(e) => cambiar('costo', e.target.value)}
              placeholder="Lo que cobró Meta por el envío"
              className={CAMPO}
            />
          </label>
          <label className="block">
            <span className={ETIQUETA}>Destinatarios (opcional)</span>
            <input
              inputMode="numeric"
              value={b.destinatarios}
              onChange={(e) => cambiar('destinatarios', e.target.value)}
              className={CAMPO}
            />
          </label>
        </div>

        <div>
          <span className={ETIQUETA}>Creativo (opcional)</span>
          <input
            type="file"
            accept={Object.keys(EXTENSION_DE_MIME).join(',')}
            onChange={(e) => elegirArchivo(e.target.files?.[0])}
            className="mt-1.5 block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-zinc-800 dark:text-zinc-300 dark:file:bg-zinc-800 dark:file:text-zinc-100"
          />
          {vista && (
            <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
              {tipoVista === 'video' ? (
                <video src={vista} controls className="max-h-64 w-full bg-black object-contain" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:) o del bucket
                <img src={vista} alt="Vista previa del creativo" className="max-h-64 w-full object-contain" />
              )}
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
      </form>
    </ModalBase>
  );
}
