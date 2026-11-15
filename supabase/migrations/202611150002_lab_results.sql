-- Resultados de laboratorio extraídos localmente de un documento. Solo los ve su dueño (RLS).
create table if not exists public.lab_results (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  document_id uuid not null references public.health_documents(id) on delete cascade,
  collected_on date not null default current_date,
  analyte text not null check (char_length(analyte) between 1 and 120),
  value numeric not null,
  unit text not null default '' check (char_length(unit) <= 20),
  ref_low numeric,
  ref_high numeric,
  ref_text text not null default '' check (char_length(ref_text) <= 80),
  flag text not null check (flag in ('Bajo', 'Normal', 'Alto', 'Sin referencia')),
  raw_line text not null default '' check (char_length(raw_line) <= 300),
  created_at timestamptz not null default now()
);

create index if not exists lab_results_owner_analyte_idx on public.lab_results(owner_id, analyte, collected_on);

alter table public.lab_results enable row level security;

create policy "patients manage own lab results" on public.lab_results for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
