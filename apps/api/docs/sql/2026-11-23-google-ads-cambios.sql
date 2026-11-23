-- Historial de cambios de la cuenta de Google Ads (change_event): el tablero
-- los marca junto a la tendencia para explicar saltos. Sin el correo de quien
-- hizo el cambio (dato personal que el tablero no necesita).
create table if not exists google_ads_cambios (
  recurso_cambio text primary key,
  fecha date not null,
  momento text not null,
  campana_id text,
  tipo_recurso text,
  operacion text,
  campos text[] not null default '{}',
  actualizado_en timestamptz not null default now()
);
create index if not exists google_ads_cambios_fecha_idx on google_ads_cambios (fecha);

alter table google_ads_cambios enable row level security;
