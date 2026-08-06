-- ============================================
-- EXTENSIONES
-- ============================================
create extension if not exists "uuid-ossp";

-- ============================================
-- ENUMS
-- ============================================
create type prospect_status as enum (
  'nuevo',
  'contactado',
  'en_conversacion',
  'propuesta_enviada',
  'cerrado_ganado',
  'cerrado_perdido'
);

create type score_tier as enum ('verde', 'amarillo', 'rojo');

create type message_channel as enum ('whatsapp', 'email', 'llamada');

create type objection_type as enum ('precio', 'tiempo', 'competencia', 'otro');

create type search_status as enum ('pendiente', 'procesando', 'completado', 'error');

-- ============================================
-- FUNCIÓN: auto-actualizar updated_at
-- ============================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================
-- TABLA: profiles (identidad de negocio del usuario)
-- ============================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  sector text,
  descripcion text,
  sitio_web text,
  portafolio_url text,
  precio_promedio numeric,
  ventajas jsonb default '[]'::jsonb,       -- array de strings
  icp jsonb default '{}'::jsonb,            -- { tamano, zona, necesidades }
  onboarding_completado boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

alter table profiles enable row level security;

create policy "profiles_select_own" on profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id);

-- ============================================
-- TABLA: searches (búsquedas de prospección)
-- ============================================
create table searches (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  query text not null,
  ubicacion text,
  status search_status not null default 'pendiente',
  total_resultados int default 0,
  error_mensaje text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_searches_user_id on searches(user_id);
create index idx_searches_status on searches(status);

create trigger trg_searches_updated_at
  before update on searches
  for each row execute function set_updated_at();

alter table searches enable row level security;

create policy "searches_select_own" on searches
  for select using (auth.uid() = user_id);
create policy "searches_insert_own" on searches
  for insert with check (auth.uid() = user_id);
create policy "searches_update_own" on searches
  for update using (auth.uid() = user_id);
create policy "searches_delete_own" on searches
  for delete using (auth.uid() = user_id);

-- ============================================
-- TABLA: prospects (empresas encontradas)
-- ============================================
create table prospects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  search_id uuid references searches(id) on delete set null,  -- nullable: permite carga manual
  nombre_empresa text not null,
  telefono text,
  whatsapp text,
  sitio_web text,
  email text,
  direccion text,
  calificacion_google numeric,
  num_resenas int,
  status prospect_status not null default 'nuevo',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_prospects_user_id on prospects(user_id);
create index idx_prospects_search_id on prospects(search_id);
create index idx_prospects_status on prospects(status);

create trigger trg_prospects_updated_at
  before update on prospects
  for each row execute function set_updated_at();

alter table prospects enable row level security;

create policy "prospects_select_own" on prospects
  for select using (auth.uid() = user_id);
create policy "prospects_insert_own" on prospects
  for insert with check (auth.uid() = user_id);
create policy "prospects_update_own" on prospects
  for update using (auth.uid() = user_id);
create policy "prospects_delete_own" on prospects
  for delete using (auth.uid() = user_id);

-- ============================================
-- TABLA: audits (auditoría IA de cada prospecto)
-- ============================================
create table audits (
  id uuid primary key default uuid_generate_v4(),
  prospect_id uuid not null references prospects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,  -- denormalizado para RLS simple
  score int check (score between 1 and 10),
  tier score_tier,
  puntos_dolor jsonb default '[]'::jsonb,     -- array de strings
  markdown_crudo text,                         -- output de Firecrawl
  resumen_ia text,
  analizado_at timestamptz,
  created_at timestamptz default now()
);

create unique index idx_audits_prospect_id on audits(prospect_id);
create index idx_audits_user_id on audits(user_id);

alter table audits enable row level security;

create policy "audits_select_own" on audits
  for select using (auth.uid() = user_id);
create policy "audits_insert_own" on audits
  for insert with check (auth.uid() = user_id);
create policy "audits_update_own" on audits
  for update using (auth.uid() = user_id);

-- ============================================
-- TABLA: messages (mensajes generados)
-- ============================================
create table messages (
  id uuid primary key default uuid_generate_v4(),
  prospect_id uuid not null references prospects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  canal message_channel not null,
  contenido text not null,
  variante text,
  enviado boolean default false,
  created_at timestamptz default now()
);

create index idx_messages_prospect_id on messages(prospect_id);
create index idx_messages_user_id on messages(user_id);

alter table messages enable row level security;

create policy "messages_select_own" on messages
  for select using (auth.uid() = user_id);
create policy "messages_insert_own" on messages
  for insert with check (auth.uid() = user_id);
create policy "messages_update_own" on messages
  for update using (auth.uid() = user_id);

-- ============================================
-- TABLA: objections (copiloto de manejo de objeciones)
-- ============================================
create table objections (
  id uuid primary key default uuid_generate_v4(),
  prospect_id uuid not null references prospects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo objection_type,
  texto_objecion text not null,
  respuestas_sugeridas jsonb default '[]'::jsonb,  -- array de { enfoque, texto }
  created_at timestamptz default now()
);

create index idx_objections_prospect_id on objections(prospect_id);
create index idx_objections_user_id on objections(user_id);

alter table objections enable row level security;

create policy "objections_select_own" on objections
  for select using (auth.uid() = user_id);
create policy "objections_insert_own" on objections
  for insert with check (auth.uid() = user_id);

-- ============================================
-- TABLA: follow_ups (seguimientos programados)
-- ============================================
create table follow_ups (
  id uuid primary key default uuid_generate_v4(),
  prospect_id uuid not null references prospects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  fecha_vencimiento date not null,
  tipo text,
  completado boolean default false,
  created_at timestamptz default now()
);

create index idx_follow_ups_prospect_id on follow_ups(prospect_id);
create index idx_follow_ups_user_id on follow_ups(user_id);
create index idx_follow_ups_fecha on follow_ups(fecha_vencimiento) where completado = false;

alter table follow_ups enable row level security;

create policy "follow_ups_select_own" on follow_ups
  for select using (auth.uid() = user_id);
create policy "follow_ups_insert_own" on follow_ups
  for insert with check (auth.uid() = user_id);
create policy "follow_ups_update_own" on follow_ups
  for update using (auth.uid() = user_id);

-- ============================================
-- TRIGGER: crear profile automáticamente al registrarse
-- ============================================
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
