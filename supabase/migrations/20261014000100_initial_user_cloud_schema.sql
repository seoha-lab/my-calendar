-- Daymo pilot, phase 1: isolated per-user cloud schema.
-- Additive migration only. Does not read, copy or delete existing browser SQLite data.
-- Owner-controlled client writes use Supabase Auth + Row Level Security (RLS).
-- Sync, migration and backups will be wired up in subsequent phases.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calendars (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  title text not null,
  enabled boolean not null default true,
  kind text not null default 'local' check (kind in ('local','google')),
  read_only boolean not null default false,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);

create table if not exists public.categories (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  label text not null check (char_length(label) between 1 and 30),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  is_builtin boolean not null default false,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);

create table if not exists public.shift_types (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  code text not null,
  name text not null,
  start_time time without time zone,
  end_time time without time zone,
  crosses_midnight boolean not null default false,
  is_off boolean not null default false,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id),
  unique (user_id, code),
  check ((is_off and start_time is null and end_time is null) or
         (not is_off and start_time is not null and end_time is not null))
);

create table if not exists public.tasks (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  calendar_id text not null default 'local',
  title text not null,
  description text,
  location text,
  category_id text not null default 'other',
  deadline_at timestamptz,
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes > 0),
  priority text not null default 'medium' check (priority in ('high','medium','low')),
  stage text not null default 'todo' check (stage in ('todo','in-progress','done')),
  checked boolean not null default false,
  completed_at timestamptz,
  start_at timestamptz,
  end_at timestamptz,
  all_day boolean not null default false,
  is_event boolean not null default false,
  hidden_on_calendar boolean not null default false,
  linked_to jsonb not null default '[]'::jsonb,
  parent_id text,
  sub_tasks jsonb not null default '[]'::jsonb,
  sort_order double precision not null default 0,
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id),
  foreign key (user_id, calendar_id) references public.calendars(user_id, id)
    deferrable initially deferred,
  foreign key (user_id, parent_id) references public.tasks(user_id, id)
    deferrable initially deferred
);

create table if not exists public.task_ranges (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  task_id text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean not null default false,
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id),
  foreign key (user_id, task_id) references public.tasks(user_id, id)
    on delete cascade deferrable initially deferred,
  check (end_at > start_at)
);

create table if not exists public.shift_assignments (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  shift_date date not null,
  shift_type_id text not null,
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id),
  unique (user_id, shift_date),
  foreign key (user_id, shift_type_id) references public.shift_types(user_id, id)
    deferrable initially deferred
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

-- Reserved for a later idempotent sync protocol. No direct client writes in phase 1.
create table if not exists public.sync_operations (
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  device_id text not null,
  entity_type text not null,
  entity_id text not null,
  action text not null check (action in ('upsert','delete')),
  applied_at timestamptz not null default now(),
  primary key (user_id, operation_id)
);

-- Only metadata here; actual encrypted backup objects will be implemented later.
-- Do not assume that these rows, by themselves, mean backups are active.
create table if not exists public.backup_snapshots (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  storage_path text not null,
  checksum_sha256 text not null check (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  format_version integer not null check (format_version > 0),
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists daymo_tasks_user_updated_idx on public.tasks(user_id, updated_at);
create index if not exists daymo_tasks_user_deleted_idx on public.tasks(user_id, deleted_at);
create index if not exists daymo_ranges_task_idx on public.task_ranges(user_id, task_id);
create index if not exists daymo_ranges_user_updated_idx on public.task_ranges(user_id, updated_at);
create index if not exists daymo_shifts_user_date_idx on public.shift_assignments(user_id, shift_date);

-- Explicit grants because automatically exposing new tables was disabled.
-- Anonymous clients receive no access to private Daymo data.
revoke all on table public.profiles, public.calendars, public.categories,
  public.shift_types, public.tasks, public.task_ranges,
  public.shift_assignments, public.user_preferences,
  public.sync_operations, public.backup_snapshots from anon;

grant usage on schema public to authenticated;
grant select, insert, update, delete on table
  public.profiles, public.calendars, public.categories,
  public.shift_types, public.tasks, public.task_ranges,
  public.shift_assignments, public.user_preferences to authenticated;
grant select on table public.sync_operations, public.backup_snapshots to authenticated;

alter table public.profiles enable row level security;
alter table public.calendars enable row level security;
alter table public.categories enable row level security;
alter table public.shift_types enable row level security;
alter table public.tasks enable row level security;
alter table public.task_ranges enable row level security;
alter table public.shift_assignments enable row level security;
alter table public.user_preferences enable row level security;
alter table public.sync_operations enable row level security;
alter table public.backup_snapshots enable row level security;

-- profile id is the authenticated user ID.
create policy "daymo_profile_read" on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "daymo_profile_insert" on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
create policy "daymo_profile_update" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "daymo_profile_delete" on public.profiles for delete to authenticated
  using (id = (select auth.uid()));

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'calendars','categories','shift_types','tasks','task_ranges',
    'shift_assignments','user_preferences'
  ] loop
    execute format(
      'create policy daymo_owner_select on public.%I for select to authenticated using (user_id = (select auth.uid()))',table_name);
    execute format(
      'create policy daymo_owner_insert on public.%I for insert to authenticated with check (user_id = (select auth.uid()))',table_name);
    execute format(
      'create policy daymo_owner_update on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',table_name);
    execute format(
      'create policy daymo_owner_delete on public.%I for delete to authenticated using (user_id = (select auth.uid()))',table_name);
  end loop;
end $$;

create policy "daymo_sync_read" on public.sync_operations for select to authenticated
  using (user_id = (select auth.uid()));
create policy "daymo_backup_read" on public.backup_snapshots for select to authenticated
  using (user_id = (select auth.uid()));

-- Default user data is created inside the same transaction as Supabase Auth signup.
create or replace function public.daymo_create_user_defaults()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles(id) values (new.id)
    on conflict (id) do nothing;
  insert into public.calendars(user_id,id,title,kind)
    values (new.id,'local','내 캘린더','local')
    on conflict (user_id,id) do nothing;
  insert into public.categories(user_id,id,label,color,is_builtin)
    values
      (new.id,'hospital','병원','#D8A2A2',true),
      (new.id,'lecture','강의','#A9C9E8',true),
      (new.id,'graduate','대학원','#C8B6D9',true),
      (new.id,'research','연구','#9FC5C1',true),
      (new.id,'study','공부','#F2DFA7',true),
      (new.id,'exercise','운동','#8EA66B',true),
      (new.id,'personal','개인','#F3C6A8',true),
      (new.id,'other','기타','#C9C7C1',true)
    on conflict (user_id,id) do nothing;
  insert into public.shift_types(
    user_id,id,code,name,start_time,end_time,crosses_midnight,is_off,enabled,sort_order)
    values
      (new.id,'shift-d','D','데이','06:30','14:30',false,false,true,1),
      (new.id,'shift-e','E','이브닝','14:30','22:30',false,false,true,2),
      (new.id,'shift-n','N','나이트','22:30','06:30',true,false,true,3),
      (new.id,'shift-d2','D2','데이2','10:30','18:30',false,false,true,4),
      (new.id,'shift-d7','D7','데이(12시간)','06:30','18:30',false,false,true,10),
      (new.id,'shift-n7','N7','나이트(12시간)','18:30','06:30',true,false,true,20),
      (new.id,'shift-off','OFF','오프',null,null,false,true,true,30)
    on conflict (user_id,id) do nothing;
  return new;
end $$;

do $$
begin
  if not exists(
    select 1 from pg_trigger where tgname = 'daymo_on_auth_user_created'
  ) then
    create trigger daymo_on_auth_user_created
      after insert on auth.users
      for each row execute function public.daymo_create_user_defaults();
  end if;
end $$;
