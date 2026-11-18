create table if not exists public.admin_impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  admin_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists admin_impersonation_lookup_idx
  on public.admin_impersonation_sessions (token_hash, admin_id, user_id, expires_at);

alter table public.admin_impersonation_sessions enable row level security;
drop policy if exists impersonation_admin_all on public.admin_impersonation_sessions;
create policy impersonation_admin_all on public.admin_impersonation_sessions for all
  using (public.is_admin()) with check (public.is_admin());
