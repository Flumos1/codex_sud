create table if not exists public.legal_decisions (
  decision_id text primary key,
  source_url text,
  source_dataset text,
  source_attribution text,
  case_number text,
  proceeding_number text,
  court_name text,
  court_region text,
  court_level text,
  court_code text,
  decision_date date,
  registration_date date,
  publication_date date,
  proceeding_type text,
  decision_type text,
  category text,
  judge_names text[] not null default '{}',
  cited_articles text[] not null default '{}',
  cited_article_keys text[] not null default '{}',
  cited_laws text[] not null default '{}',
  outcome_label text,
  outcome_confidence numeric,
  key_excerpts text[] not null default '{}',
  text text,
  text_status text,
  text_error text,
  indexed_at timestamptz,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists legal_decisions_decision_date_idx on public.legal_decisions (decision_date desc);
create index if not exists legal_decisions_region_idx on public.legal_decisions (court_region);
create index if not exists legal_decisions_level_idx on public.legal_decisions (court_level);
create index if not exists legal_decisions_type_idx on public.legal_decisions (decision_type);
create index if not exists legal_decisions_outcome_idx on public.legal_decisions (outcome_label);
create index if not exists legal_decisions_cited_article_keys_idx on public.legal_decisions using gin (cited_article_keys);
create index if not exists legal_decisions_text_fts_idx
  on public.legal_decisions
  using gin (to_tsvector('simple', coalesce(text, '') || ' ' || coalesce(case_number, '') || ' ' || coalesce(court_name, '') || ' ' || coalesce(category, '')));

alter table public.legal_decisions enable row level security;

drop policy if exists "legal_decisions_no_direct_anon_access" on public.legal_decisions;
create policy "legal_decisions_no_direct_anon_access"
  on public.legal_decisions
  for select
  using (false);
