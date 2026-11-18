-- Ciudad y departamento por defecto de todo cliente (única sede: Riohacha).
alter table clientes
  add column if not exists ciudad text not null default 'Riohacha',
  add column if not exists departamento text not null default 'La Guajira';

-- Más datos de los anuncios de Meta.
alter table anuncios_meta_diario
  add column if not exists frecuencia numeric not null default 0,
  add column if not exists conversaciones integer not null default 0,
  add column if not exists clics_enlace integer not null default 0;

create table if not exists anuncios_meta_creativos (
  anuncio_id text primary key,
  nombre text,
  estado text,
  miniatura_url text,
  titulo text,
  texto text,
  actualizado_en timestamptz not null default now()
);
alter table anuncios_meta_creativos enable row level security;

-- Costos de producto: el vigente por variante y el de cada venta al momento de venderla.
alter table variantes_producto
  add column if not exists costo numeric check (costo is null or costo >= 0);
alter table items_pedido
  add column if not exists costo_unitario numeric check (costo_unitario is null or costo_unitario >= 0);

-- Públicos de Meta que administra la plataforma (prefijo "Horebs ·").
create table if not exists audiencias_meta (
  clave text primary key,
  nombre text not null,
  audiencia_id text,
  ultimo_envio integer,
  sincronizado_en timestamptz
);
alter table audiencias_meta enable row level security;
