-- Conversions API for Business Messaging (Click-to-WhatsApp)
--
-- 1) Guarda el ctwa_clid que Meta manda en el `referral` del primer mensaje
--    de una conversación que empezó desde un anuncio. Sin ese id no se puede
--    atribuir un Lead/Purchase al anuncio.
-- 2) Registro de eventos ya enviados: Meta NO deduplica eventos de
--    mensajería, así que la idempotencia es responsabilidad nuestra.

alter table public.conversaciones_bot
  add column if not exists ctwa_clid text,
  add column if not exists ctwa_capturado_en timestamptz;

create table if not exists public.eventos_meta_enviados (
  evento        text        not null,
  referencia_id uuid        not null,
  enviado_en    timestamptz not null default now(),
  primary key (evento, referencia_id)
);

-- Igual que el resto de las tablas: solo la service role del API accede.
alter table public.eventos_meta_enviados enable row level security;
