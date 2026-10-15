import { segmentar } from '@/lib/pedidos-busqueda';

/** Texto con las coincidencias de la búsqueda marcadas (sin tildes ni mayúsculas). */
export default function Resaltado({
  texto,
  terminos,
}: {
  texto: string;
  terminos: string[];
}) {
  const segmentos = segmentar(texto, terminos);
  if (segmentos.length === 1 && !segmentos[0].resaltado) return <>{texto}</>;
  return (
    <>
      {segmentos.map((s, i) =>
        s.resaltado ? (
          <mark key={i} className="marca-busqueda">
            {s.texto}
          </mark>
        ) : (
          <span key={i}>{s.texto}</span>
        ),
      )}
    </>
  );
}
