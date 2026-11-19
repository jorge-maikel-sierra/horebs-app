-- Campañas propias que no pasan por Meta Ads: difusiones de WhatsApp Business
-- (las de los sábados), y campañas por el bot de WhatsApp, Messenger e
-- Instagram. La caja elige la campaña al digitar el pedido para medir cuántos
-- pedidos y cuánta plata trajo cada una frente a lo que costó.
create table if not exists campanas_mensajeria (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  canal text not null
    check (canal in ('whatsapp_business', 'whatsapp_bot', 'messenger', 'instagram')),
  mensaje text not null,
  creativo_path text,
  creativo_tipo text check (creativo_tipo in ('imagen', 'video')),
  enviada_en timestamptz not null,
  -- Lo que se le pagó a Meta por la difusión; null si fue gratis o no se sabe.
  costo numeric check (costo >= 0),
  destinatarios integer check (destinatarios >= 0),
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists campanas_mensajeria_enviada_en_idx
  on campanas_mensajeria (enviada_en desc);

alter table campanas_mensajeria enable row level security;

-- Aparte de origen_campana_id (id de campaña de Meta, texto): así la
-- atribución de anuncios no cambia. restrict: una campaña con pedidos no se
-- borra, se desactiva.
alter table pedidos
  add column if not exists campana_mensajeria_id uuid
  references campanas_mensajeria (id) on delete restrict;

create index if not exists pedidos_campana_mensajeria_id_idx
  on pedidos (campana_mensajeria_id)
  where campana_mensajeria_id is not null;

-- 'whatsapp' sigue siendo el número de WhatsApp Business del local; el bot es
-- otro número y otra estrategia.
alter table pedidos drop constraint if exists pedidos_origen_venta_check;
alter table pedidos
  add constraint pedidos_origen_venta_check
  check (origen_venta in ('mostrador', 'whatsapp', 'whatsapp_bot', 'llamada', 'messenger', 'instagram'));

-- Creativos de las campañas (imagen o video). Público: son piezas de
-- publicidad que ya se mandaron a los clientes. El API firma la subida.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'campanas',
  'campanas',
  true,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']
)
on conflict (id) do nothing;
