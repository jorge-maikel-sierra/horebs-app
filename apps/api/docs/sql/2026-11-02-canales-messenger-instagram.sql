-- Paridad de Messenger e Instagram: ampliación de canales en pedidos y persistencia de teléfono en conversaciones_bot
--
-- 1) pedidos.canal acepta ahora 'messenger' e 'instagram' además de 'web', 'pos' y 'whatsapp'.
-- 2) conversaciones_bot.telefono guarda el celular solicitado al cliente en Messenger/Instagram
--    para asociar consultas de pedidos, cliente registrado y puntos.

alter table public.pedidos drop constraint if exists pedidos_canal_check,
  add constraint pedidos_canal_check
    check (canal = any (array['web', 'pos', 'whatsapp', 'messenger', 'instagram']));

alter table public.conversaciones_bot
  add column if not exists telefono text;
