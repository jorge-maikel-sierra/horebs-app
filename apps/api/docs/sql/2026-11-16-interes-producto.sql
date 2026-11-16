-- El último producto por el que preguntó el cliente de Messenger o Instagram
-- (precio, porciones o las más pedidas) y si ya se le mandó el segundo
-- mensaje: a quien llegó por un anuncio y no empezó el pedido se le escribe
-- una sola vez, 2 horas después, con ese producto (decisión del dueño,
-- 16 nov 2026).
alter table public.conversaciones_bot
  add column if not exists interes_producto_id uuid references public.productos(id) on delete set null,
  add column if not exists interes_en timestamptz,
  add column if not exists toque_interes_enviado_en timestamptz;

create index if not exists conversaciones_bot_interes_pendiente_idx
  on public.conversaciones_bot (interes_en)
  where interes_en is not null and toque_interes_enviado_en is null;
