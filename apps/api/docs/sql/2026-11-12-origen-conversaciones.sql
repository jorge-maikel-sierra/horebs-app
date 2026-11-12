-- Origen de cada conversación del bot (anuncio, enlace m.me/ig.me con ref, o
-- referral de WhatsApp) y del pedido que sale de ella.
--
-- Hasta ahora el ad_id solo se escribía al log. Sin guardarlo no se puede
-- saber qué anuncio trajo cada venta ni armar públicos de compradores.
--
-- Primer toque (origen_*): se escribe una sola vez y no se pisa.
-- Último toque (ultimo_*): se actualiza con cada referral nuevo; es el que se
-- copia al pedido, igual que la atribución por último clic de Meta.

alter table public.conversaciones_bot
  add column if not exists origen_fuente        text,
  add column if not exists origen_anuncio_id    text,
  add column if not exists origen_ref           text,
  add column if not exists origen_titulo        text,
  add column if not exists origen_capturado_en  timestamptz,
  add column if not exists ultimo_origen_fuente text,
  add column if not exists ultimo_anuncio_id    text,
  add column if not exists ultimo_ref           text,
  add column if not exists ultimo_origen_en     timestamptz;

alter table public.pedidos
  add column if not exists origen_fuente     text,
  add column if not exists origen_anuncio_id text,
  add column if not exists origen_ref        text;

-- Para el futuro tablero de ventas por anuncio.
create index if not exists pedidos_origen_anuncio_idx
  on public.pedidos (origen_anuncio_id)
  where origen_anuncio_id is not null;
