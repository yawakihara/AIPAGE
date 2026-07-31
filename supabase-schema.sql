create extension if not exists pgcrypto with schema extensions;

create table if not exists public.high_scores (
  name_key text primary key,
  display_name text not null,
  score bigint not null check (score >= 0),
  pin_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.high_scores enable row level security;
revoke all on table public.high_scores from anon, authenticated;

create or replace function public.get_leaderboard(p_limit integer default 20)
returns table (
  display_name text,
  score bigint,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select hs.display_name, hs.score, hs.updated_at
  from public.high_scores as hs
  order by hs.score desc, hs.updated_at asc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

create or replace function public.submit_high_score(
  p_name text,
  p_score bigint,
  p_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_display_name text := btrim(p_name);
  v_name_key text := lower(btrim(p_name));
  v_existing public.high_scores%rowtype;
begin
  if v_display_name is null
     or char_length(v_display_name) < 1
     or char_length(v_display_name) > 20 then
    raise exception using errcode = 'P0001', message = 'INVALID_NAME';
  end if;

  if p_score is null or p_score < 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_SCORE';
  end if;

  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_PIN';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_name_key));

  select *
  into v_existing
  from public.high_scores
  where name_key = v_name_key
  for update;

  if not found then
    insert into public.high_scores (
      name_key,
      display_name,
      score,
      pin_hash
    )
    values (
      v_name_key,
      v_display_name,
      p_score,
      crypt(p_pin, gen_salt('bf', 10))
    );

    return jsonb_build_object(
      'status', 'created',
      'displayName', v_display_name,
      'score', p_score
    );
  end if;

  if crypt(p_pin, v_existing.pin_hash) <> v_existing.pin_hash then
    raise exception using errcode = 'P0001', message = 'PIN_MISMATCH';
  end if;

  if p_score <= v_existing.score then
    return jsonb_build_object(
      'status', 'not_improved',
      'displayName', v_existing.display_name,
      'score', v_existing.score
    );
  end if;

  update public.high_scores
  set score = p_score,
      updated_at = now()
  where name_key = v_name_key;

  return jsonb_build_object(
    'status', 'updated',
    'displayName', v_existing.display_name,
    'score', p_score
  );
end;
$$;

revoke all on function public.get_leaderboard(integer) from public;
revoke all on function public.submit_high_score(text, bigint, text) from public;
grant execute on function public.get_leaderboard(integer) to anon, authenticated;
grant execute on function public.submit_high_score(text, bigint, text) to anon, authenticated;
