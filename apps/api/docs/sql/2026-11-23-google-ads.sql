-- Métricas de Google Ads que manda el Google Ads Script de la cuenta
-- (POST /webhooks/google-ads). Montos ya en pesos. Solo lee y escribe el API
-- (service role): RLS activado y sin políticas.

create table if not exists google_ads_campana_diario (
  fecha date not null,
  campana_id text not null,
  campana_nombre text not null,
  estado text,
  estado_principal text,
  motivos_estado text[] not null default '{}',
  estrategia_puja text,
  estado_puja text,
  presupuesto_diario numeric not null default 0,
  gasto numeric not null default 0,
  impresiones integer not null default 0,
  clics integer not null default 0,
  conversiones numeric not null default 0,
  valor_conversiones numeric not null default 0,
  llamadas integer not null default 0,
  is_busqueda numeric,
  is_perdida_presupuesto numeric,
  is_perdida_ranking numeric,
  is_superior numeric,
  is_superior_absoluta numeric,
  actualizado_en timestamptz not null default now(),
  primary key (fecha, campana_id)
);
create index if not exists google_ads_campana_diario_campana_idx
  on google_ads_campana_diario (campana_id, fecha);

create table if not exists google_ads_palabras_diario (
  fecha date not null,
  campana_id text not null,
  grupo_id text not null,
  criterio_id text not null,
  texto text not null,
  concordancia text,
  estado text,
  qs integer,
  qs_ctr text,
  qs_anuncio text,
  qs_pagina text,
  gasto numeric not null default 0,
  impresiones integer not null default 0,
  clics integer not null default 0,
  conversiones numeric not null default 0,
  actualizado_en timestamptz not null default now(),
  primary key (fecha, grupo_id, criterio_id)
);

create table if not exists google_ads_terminos_diario (
  fecha date not null,
  campana_id text not null,
  grupo_id text not null,
  termino text not null,
  estado text,
  gasto numeric not null default 0,
  impresiones integer not null default 0,
  clics integer not null default 0,
  conversiones numeric not null default 0,
  actualizado_en timestamptz not null default now(),
  primary key (fecha, grupo_id, termino)
);

-- dimension: hora (clave 0-23), dispositivo, ciudad_presencia, ciudad_interes.
create table if not exists google_ads_segmentos_diario (
  fecha date not null,
  campana_id text not null,
  dimension text not null,
  clave text not null,
  gasto numeric not null default 0,
  impresiones integer not null default 0,
  clics integer not null default 0,
  conversiones numeric not null default 0,
  actualizado_en timestamptz not null default now(),
  primary key (fecha, campana_id, dimension, clave)
);

create table if not exists google_ads_conversiones_diario (
  fecha date not null,
  campana_id text not null,
  accion text not null,
  categoria text,
  conversiones numeric not null default 0,
  valor numeric not null default 0,
  actualizado_en timestamptz not null default now(),
  primary key (fecha, campana_id, accion)
);

-- Foto del momento (sin fecha): se reemplaza completa en cada envío.
create table if not exists google_ads_anuncios (
  grupo_id text not null,
  anuncio_id text not null,
  campana_id text not null,
  tipo text,
  estado text,
  fuerza text,
  aprobacion text,
  urls_finales text[] not null default '{}',
  capturado_en timestamptz not null default now(),
  primary key (grupo_id, anuncio_id)
);

-- Un envío por parte; lote_id + parte repetidos no se vuelven a procesar.
create table if not exists google_ads_lotes (
  lote_id uuid not null,
  parte integer not null,
  total_partes integer not null,
  reporte text not null,
  desde date,
  hasta date,
  filas integer not null,
  version integer not null,
  recibido_en timestamptz not null default now(),
  primary key (lote_id, parte)
);
create index if not exists google_ads_lotes_recibido_idx
  on google_ads_lotes (recibido_en desc);

alter table google_ads_campana_diario enable row level security;
alter table google_ads_palabras_diario enable row level security;
alter table google_ads_terminos_diario enable row level security;
alter table google_ads_segmentos_diario enable row level security;
alter table google_ads_conversiones_diario enable row level security;
alter table google_ads_anuncios enable row level security;
alter table google_ads_lotes enable row level security;
