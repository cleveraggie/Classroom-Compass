-- Run this once in the Supabase SQL Editor for your project.
create extension if not exists pgcrypto;

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  created_at timestamptz not null default now(),
  unique (id, class_id)
);

create table if not exists public.point_types (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  value integer not null check (value between -999 and 999 and value <> 0),
  created_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null,
  attendance_date date not null,
  status text not null check (status in ('present','late','absent','excused')),
  created_at timestamptz not null default now(),
  unique (student_id, attendance_date),
  foreign key (student_id, class_id) references public.students(id, class_id) on delete cascade
);

create table if not exists public.point_entries (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null,
  student_name text not null,
  point_type_id uuid,
  type_name text not null,
  delta integer not null check (delta between -999 and 999 and delta <> 0),
  reason text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists students_class_idx on public.students(class_id, name);
create index if not exists point_types_class_idx on public.point_types(class_id, name);
create index if not exists attendance_class_date_idx on public.attendance(class_id, attendance_date);
create index if not exists point_entries_class_created_idx on public.point_entries(class_id, created_at desc);

alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.point_types enable row level security;
alter table public.attendance enable row level security;
alter table public.point_entries enable row level security;

drop policy if exists "Teachers manage their own classes" on public.classes;
create policy "Teachers manage their own classes" on public.classes
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "Teachers manage students in their classes" on public.students;
create policy "Teachers manage students in their classes" on public.students
  for all to authenticated
  using (exists (select 1 from public.classes c where c.id = class_id and c.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.classes c where c.id = class_id and c.owner_id = (select auth.uid())));

drop policy if exists "Teachers manage point types in their classes" on public.point_types;
create policy "Teachers manage point types in their classes" on public.point_types
  for all to authenticated
  using (exists (select 1 from public.classes c where c.id = class_id and c.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.classes c where c.id = class_id and c.owner_id = (select auth.uid())));

drop policy if exists "Teachers manage attendance in their classes" on public.attendance;
create policy "Teachers manage attendance in their classes" on public.attendance
  for all to authenticated
  using (exists (select 1 from public.classes c where c.id = class_id and c.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.classes c where c.id = class_id and c.owner_id = (select auth.uid())));

drop policy if exists "Teachers manage point entries in their classes" on public.point_entries;
create policy "Teachers manage point entries in their classes" on public.point_entries
  for all to authenticated
  using (exists (select 1 from public.classes c where c.id = class_id and c.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.classes c where c.id = class_id and c.owner_id = (select auth.uid())));

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.classes, public.students, public.point_types, public.attendance, public.point_entries to authenticated;
