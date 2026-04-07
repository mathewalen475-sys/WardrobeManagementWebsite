create table if not exists public.selected_outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  shirt_image_url text,
  shirt_name text,
  shirt_filename text,
  shirt_color text,
  shirt_color_hex text,
  pants_image_url text,
  pants_name text,
  pants_filename text,
  score integer,
  reason text,
  rank integer,
  created_at timestamptz not null default now()
);

create index if not exists selected_outfits_user_created_idx
  on public.selected_outfits (user_id, created_at desc);

create table if not exists public.outfit_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  scheduled_date date not null,
  selected_outfit_id uuid not null references public.selected_outfits(id) on delete cascade,
  shirt_image_url text,
  shirt_name text,
  shirt_color text,
  shirt_color_hex text,
  pants_image_url text,
  pants_name text,
  score integer,
  reason text,
  created_at timestamptz not null default now(),
  unique (user_id, scheduled_date)
);

create index if not exists outfit_schedules_user_date_idx
  on public.outfit_schedules (user_id, scheduled_date);
