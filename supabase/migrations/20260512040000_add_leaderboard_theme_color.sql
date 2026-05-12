alter table public.leaderboard_records
  add column if not exists theme_color text not null default '#2ec4b6'
    check (theme_color ~ '^#[0-9A-Fa-f]{6}$');

drop policy if exists "public leaderboard insert" on public.leaderboard_records;
create policy "public leaderboard insert"
  on public.leaderboard_records
  for insert
  to anon, authenticated
  with check (
    player_id ~ '^[a-zA-Z0-9_-]{1,48}$'
    and car_id ~ '^[a-zA-Z0-9_-]{1,48}$'
    and track_id ~ '^[a-zA-Z0-9_-]{1,48}$'
    and length(player_name) between 1 and 40
    and length(car_name) between 1 and 40
    and length(track_name) between 1 and 40
    and lap_ms between 1000 and 1800000
    and jsonb_typeof(sectors) = 'array'
    and theme_color ~ '^#[0-9A-Fa-f]{6}$'
  );

drop policy if exists "public leaderboard update" on public.leaderboard_records;
create policy "public leaderboard update"
  on public.leaderboard_records
  for update
  to anon, authenticated
  using (true)
  with check (
    player_id ~ '^[a-zA-Z0-9_-]{1,48}$'
    and car_id ~ '^[a-zA-Z0-9_-]{1,48}$'
    and track_id ~ '^[a-zA-Z0-9_-]{1,48}$'
    and length(player_name) between 1 and 40
    and length(car_name) between 1 and 40
    and length(track_name) between 1 and 40
    and lap_ms between 1000 and 1800000
    and jsonb_typeof(sectors) = 'array'
    and theme_color ~ '^#[0-9A-Fa-f]{6}$'
  );

create or replace function public.keep_best_leaderboard_lap()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.created_at := old.created_at;

  if new.lap_ms >= old.lap_ms then
    new.lap_ms := old.lap_ms;
    new.sectors := old.sectors;
    new.car_name := old.car_name;
    new.track_name := old.track_name;
  end if;

  return new;
end;
$$;
