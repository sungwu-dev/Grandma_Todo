create extension if not exists "pgcrypto";

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'viewer' check (role in ('admin', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.grandma_profiles (
  group_id uuid primary key references public.groups (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists group_members_user_id_idx on public.group_members (user_id);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.grandma_profiles enable row level security;

create policy "groups_select_for_members"
  on public.groups
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.group_members gm
      where gm.group_id = groups.id
        and gm.user_id = auth.uid()
    )
  );

create policy "group_members_select_for_self_or_admin"
  on public.group_members
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.group_members gm
      where gm.group_id = group_members.group_id
        and gm.user_id = auth.uid()
        and gm.role = 'admin'
    )
  );
