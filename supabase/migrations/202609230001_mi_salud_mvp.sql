-- Mi Salud MVP. Run this file with `supabase db push` or in the Supabase SQL Editor.
-- All rows belong to auth.uid(); do not use the service-role key in the browser.

create extension if not exists pgcrypto;

create table if not exists public.patient_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.health_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  display_name text not null check (char_length(display_name) between 1 and 180),
  document_type text not null check (document_type in ('Receta', 'Laboratorio', 'Imagen', 'Informe', 'Vacuna', 'Otro')),
  issued_at date not null default current_date,
  issuer text not null default 'Pendiente de completar' check (char_length(issuer) <= 180),
  tags text[] not null default '{}',
  ocr_status text not null default 'Pendiente' check (ocr_status in ('Revisado', 'Pendiente', 'No aplica')),
  asset_path text not null unique,
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif')),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 15728640),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists health_documents_owner_issued_at_idx on public.health_documents(owner_id, issued_at desc);

create table if not exists public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  document_id uuid references public.health_documents(id) on delete cascade,
  occurred_at date not null default current_date,
  event_kind text not null check (event_kind in ('Consulta', 'Medicación', 'Vacuna', 'Antecedente', 'Receta', 'Laboratorio', 'Imagen', 'Informe', 'Otro')),
  title text not null check (char_length(title) between 1 and 180),
  detail text not null default '' check (char_length(detail) <= 500),
  entered_by_patient boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists timeline_events_owner_occurred_at_idx on public.timeline_events(owner_id, occurred_at desc);

create table if not exists public.share_grants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  recipient_name text not null check (char_length(recipient_name) between 1 and 160),
  recipient_relationship text not null check (char_length(recipient_relationship) between 1 and 100),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.consent_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  consent_type text not null check (consent_type in ('ocr_processing')),
  granted boolean not null,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (char_length(action) <= 80),
  resource_type text not null check (char_length(resource_type) <= 80),
  resource_id uuid,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists patient_profiles_updated_at on public.patient_profiles;
create trigger patient_profiles_updated_at before update on public.patient_profiles for each row execute function public.set_updated_at();
drop trigger if exists health_documents_updated_at on public.health_documents;
create trigger health_documents_updated_at before update on public.health_documents for each row execute function public.set_updated_at();

alter table public.patient_profiles enable row level security;
alter table public.health_documents enable row level security;
alter table public.timeline_events enable row level security;
alter table public.share_grants enable row level security;
alter table public.consent_records enable row level security;
alter table public.audit_events enable row level security;

create policy "patients manage own profile" on public.patient_profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "patients manage own documents" on public.health_documents for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "patients manage own timeline" on public.timeline_events for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "patients manage own grants" on public.share_grants for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "patients manage own consents" on public.consent_records for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "patients read own audit events" on public.audit_events for select using (owner_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('health-documents', 'health-documents', false, 15728640, array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif'])
on conflict (id) do update set public = false, file_size_limit = 15728640, allowed_mime_types = excluded.allowed_mime_types;

create policy "patients read their document objects" on storage.objects for select
  using (bucket_id = 'health-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "patients upload to their document folder" on storage.objects for insert
  with check (bucket_id = 'health-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "patients delete their document objects" on storage.objects for delete
  using (bucket_id = 'health-documents' and (storage.foldername(name))[1] = auth.uid()::text);
