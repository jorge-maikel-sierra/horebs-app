-- Carrito del catálogo de WhatsApp pendiente de calcular
--
-- Cuando el cliente manda el carrito desde el catálogo nativo, se guardan
-- los ids exactos de variante y las cantidades (ya validados contra la
-- base). calcular_pedido los usa tal cual, sin que el modelo tenga que
-- volver a nombrar los productos — antes, al nombrarlos, la búsqueda
-- fallaba y el modelo inventaba totales y opciones.
--
-- Forma: [{ "varianteId": "<uuid>", "cantidad": 2 }, ...]
-- Se borra al derivar la conversación o al cambiar su estado a mano.

alter table public.conversaciones_bot
  add column if not exists carrito_pendiente jsonb;
