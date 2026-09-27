create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  tracking_number text not null unique,
  recipient text not null,
  delivery_address text not null,
  stop_number integer not null,
  package_size text not null check (package_size in ('small', 'medium', 'large')),
  weight numeric(5,1) not null,
  fragile boolean not null default false,
  van_zone text check (van_zone is null or van_zone in ('A', 'B', 'C', 'D')),
  shelf text check (shelf is null or shelf in ('lower', 'middle', 'upper')),
  slot integer check (slot is null or slot >= 1),
  delivery_status text not null default 'pending' check (delivery_status in ('pending', 'delivered')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_stops (
  id uuid primary key default gen_random_uuid(),
  stop_number integer not null unique,
  address text not null,
  status text not null default 'pending' check (status in ('pending', 'delivered')),
  created_at timestamptz not null default now()
);

create table if not exists public.delivery_events (
  id uuid primary key default gen_random_uuid(),
  tracking_number text not null,
  event_type text not null,
  event_timestamp timestamptz not null default now()
);

create index if not exists packages_stop_tracking_idx
  on public.packages (stop_number, tracking_number);

create index if not exists delivery_events_tracking_idx
  on public.delivery_events (tracking_number, event_timestamp desc);

create or replace function public.set_packages_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists packages_set_updated_at on public.packages;
create trigger packages_set_updated_at
  before update on public.packages
  for each row
  execute function public.set_packages_updated_at();

alter table public.packages enable row level security;
alter table public.delivery_stops enable row level security;
alter table public.delivery_events enable row level security;

grant select, insert, update on table public.packages to anon, authenticated;
grant select, insert, update on table public.delivery_stops to anon, authenticated;
grant select, insert on table public.delivery_events to anon, authenticated;

drop policy if exists packages_public_select on public.packages;
drop policy if exists packages_public_insert on public.packages;
drop policy if exists packages_public_update on public.packages;
drop policy if exists delivery_stops_public_select on public.delivery_stops;
drop policy if exists delivery_stops_public_insert on public.delivery_stops;
drop policy if exists delivery_stops_public_update on public.delivery_stops;
drop policy if exists delivery_events_public_select on public.delivery_events;
drop policy if exists delivery_events_public_insert on public.delivery_events;

create policy packages_public_select
  on public.packages for select
  to anon, authenticated
  using (true);

create policy packages_public_insert
  on public.packages for insert
  to anon, authenticated
  with check (true);

create policy packages_public_update
  on public.packages for update
  to anon, authenticated
  using (true)
  with check (true);

create policy delivery_stops_public_select
  on public.delivery_stops for select
  to anon, authenticated
  using (true);

create policy delivery_stops_public_insert
  on public.delivery_stops for insert
  to anon, authenticated
  with check (true);

create policy delivery_stops_public_update
  on public.delivery_stops for update
  to anon, authenticated
  using (true)
  with check (true);

create policy delivery_events_public_select
  on public.delivery_events for select
  to anon, authenticated
  using (true);

create policy delivery_events_public_insert
  on public.delivery_events for insert
  to anon, authenticated
  with check (true);
