create type public.playlist_status as enum ('draft', 'published');

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table public.playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  status public.playlist_status not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tracks (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  title text not null,
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  unique (playlist_id, position)
);

create table public.playlist_links (
  parent_id uuid not null references public.playlists(id) on delete cascade,
  child_id uuid not null references public.playlists(id) on delete cascade,
  primary key (parent_id, child_id),
  check (parent_id <> child_id)
);

-- Component torture fixture: representative scalar/default/nullability fields
-- with ownership enforced by the same RLS boundary as a real application.
create table public.component_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null unique,
  notes text,
  priority integer,
  published boolean not null default false,
  event_date date,
  status public.playlist_status not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create or replace function public.set_current_user_id()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  return new;
end;
$$;

create trigger profiles_set_current_user
before insert on public.profiles
for each row execute function public.set_current_user_id();

create trigger playlists_set_current_user
before insert on public.playlists
for each row execute function public.set_current_user_id();

alter table public.profiles enable row level security;
alter table public.playlists enable row level security;
alter table public.tracks enable row level security;
alter table public.playlist_links enable row level security;
alter table public.component_records enable row level security;

create policy "profiles_select_own" on public.profiles
for select to authenticated using ((select auth.uid()) = user_id);
create policy "profiles_insert_own" on public.profiles
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "profiles_update_own" on public.profiles
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "profiles_delete_own" on public.profiles
for delete to authenticated using ((select auth.uid()) = user_id);

create policy "playlists_select_own" on public.playlists
for select to authenticated using ((select auth.uid()) = user_id);
create policy "playlists_insert_own" on public.playlists
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "playlists_update_own" on public.playlists
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "playlists_delete_own" on public.playlists
for delete to authenticated using ((select auth.uid()) = user_id);

create policy "tracks_select_through_owner" on public.tracks
for select to authenticated using (
  exists (
    select 1 from public.playlists
    where playlists.id = tracks.playlist_id
      and playlists.user_id = (select auth.uid())
  )
);
create policy "tracks_insert_through_owner" on public.tracks
for insert to authenticated with check (
  exists (
    select 1 from public.playlists
    where playlists.id = tracks.playlist_id
      and playlists.user_id = (select auth.uid())
  )
);
create policy "tracks_update_through_owner" on public.tracks
for update to authenticated using (
  exists (
    select 1 from public.playlists
    where playlists.id = tracks.playlist_id
      and playlists.user_id = (select auth.uid())
  )
) with check (
  exists (
    select 1 from public.playlists
    where playlists.id = tracks.playlist_id
      and playlists.user_id = (select auth.uid())
  )
);
create policy "tracks_delete_through_owner" on public.tracks
for delete to authenticated using (
  exists (
    select 1 from public.playlists
    where playlists.id = tracks.playlist_id
      and playlists.user_id = (select auth.uid())
  )
);

create policy "playlist_links_select_owner" on public.playlist_links
for select to authenticated using (
  exists (select 1 from public.playlists where playlists.id = parent_id and playlists.user_id = (select auth.uid()))
);
create policy "playlist_links_insert_owner" on public.playlist_links
for insert to authenticated with check (
  exists (select 1 from public.playlists where playlists.id = parent_id and playlists.user_id = (select auth.uid()))
  and exists (select 1 from public.playlists where playlists.id = child_id and playlists.user_id = (select auth.uid()))
);
create policy "playlist_links_delete_owner" on public.playlist_links
for delete to authenticated using (
  exists (select 1 from public.playlists where playlists.id = parent_id and playlists.user_id = (select auth.uid()))
);

create policy "component_records_select_own" on public.component_records
for select to authenticated using ((select auth.uid()) = user_id);
create policy "component_records_insert_own" on public.component_records
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "component_records_update_own" on public.component_records
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "component_records_delete_own" on public.component_records
for delete to authenticated using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public)
values ('nsdb-private', 'nsdb-private', false)
on conflict (id) do update set public = excluded.public;

create policy "storage_select_own_prefix" on storage.objects
for select to authenticated using (
  bucket_id = 'nsdb-private'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy "storage_insert_own_prefix" on storage.objects
for insert to authenticated with check (
  bucket_id = 'nsdb-private'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy "storage_update_own_prefix" on storage.objects
for update to authenticated using (
  bucket_id = 'nsdb-private'
  and (storage.foldername(name))[1] = (select auth.uid())::text
) with check (
  bucket_id = 'nsdb-private'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy "storage_delete_own_prefix" on storage.objects
for delete to authenticated using (
  bucket_id = 'nsdb-private'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
