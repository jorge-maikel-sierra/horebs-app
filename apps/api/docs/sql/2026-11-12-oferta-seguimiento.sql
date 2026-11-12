-- Cuándo le llegó al cliente la oferta del 10% del seguimiento.
--
-- seguimiento_etapa y seguimiento_enviado_en se reinician en cuanto el
-- cliente vuelve a escribir, así que no sirven para saber si la oferta sigue
-- vigente cuando arma el pedido. Esta columna no se reinicia: el checkout la
-- lee para aplicar el descuento prometido (24 h, ver common/promocion.ts).

alter table public.conversaciones_bot
  add column if not exists oferta_enviada_en timestamptz;
