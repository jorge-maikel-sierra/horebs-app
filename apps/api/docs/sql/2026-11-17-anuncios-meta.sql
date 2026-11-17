-- Gasto diario de los anuncios de Meta (Marketing API) y campaña con la que
-- la caja atribuye una venta. Solo lo lee y escribe el API (service role).
create table if not exists anuncios_meta_diario (
  fecha date not null,
  anuncio_id text not null,
  anuncio_nombre text,
  campana_id text not null,
  campana_nombre text,
  gasto numeric not null default 0,
  impresiones integer not null default 0,
  alcance integer not null default 0,
  clics integer not null default 0,
  actualizado_en timestamptz not null default now(),
  primary key (fecha, anuncio_id)
);

create index if not exists anuncios_meta_diario_campana_idx
  on anuncios_meta_diario (campana_id, fecha);

alter table anuncios_meta_diario enable row level security;

alter table pedidos
  add column if not exists origen_campana_id text;
