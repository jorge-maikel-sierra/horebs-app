-- Reservas del bot y comprobantes de transferencia
--
-- 1) programado_para: el bot toma pedidos de 11:00 a.m. a 11:00 p.m.; los
--    que llegan antes de las 4:00 p.m. quedan reservados para la franja que
--    elige el cliente. null = lo antes posible.
-- 2) comprobante_path / comprobante_recibido_en: foto o PDF del comprobante
--    de transferencia que el cliente manda por WhatsApp, guardado en el
--    bucket privado `comprobantes` (solo el API con la service role accede;
--    el panel lo abre con una URL firmada).

alter table public.pedidos
  add column if not exists programado_para timestamptz,
  add column if not exists comprobante_path text,
  add column if not exists comprobante_recibido_en timestamptz;

insert into storage.buckets (id, name, public)
  values ('comprobantes', 'comprobantes', false)
  on conflict (id) do nothing;
