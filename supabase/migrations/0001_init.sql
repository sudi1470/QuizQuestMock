create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

create type public.difficulty_level as enum ('easy', 'medium', 'hard');
create type public.answer_option as enum ('A', 'B', 'C', 'D');
create type public.match_type as enum ('live_random', 'async_random', 'friend_challenge');
create type public.match_mode as enum ('live', 'ghost');
create type public.match_state as enum ('waiting', 'ready', 'question_active', 'interstitial', 'results', 'complete');
create type public.match_outcome as enum ('win', 'loss', 'draw', 'pending', 'abandoned');
create type public.rating_scope as enum ('global', 'category');
create type public.friendship_status as enum ('pending', 'accepted', 'blocked');
create type public.queue_status as enum ('queued', 'matched', 'expired', 'cancelled');
create type public.notification_type as enum ('async_turn_ready', 'friend_challenge', 'match_result', 'leaderboard_movement');

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (char_length(username) between 3 and 24),
  avatar text,
  xp integer not null default 0 check (xp >= 0),
  level integer not null default 1 check (level >= 1),
  global_rating integer not null default 1200 check (global_rating >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete cascade,
  difficulty public.difficulty_level not null,
  question_text text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_answer public.answer_option not null,
  explanation text,
  source text,
  quality_score numeric(5, 2) not null default 1.00,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists questions_category_text_unique
  on public.questions (category_id, md5(lower(question_text)));

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id),
  match_type public.match_type not null,
  mode public.match_mode not null,
  state public.match_state not null default 'waiting',
  current_question integer not null default 0 check (current_question between 0 and 7),
  total_questions integer not null default 7 check (total_questions = 7),
  penalty_factor numeric(10, 4) not null default 0.08,
  question_time_limit_ms integer not null default 10000,
  source_match_id uuid references public.matches (id),
  ghost_seed_user_id uuid references public.profiles (id),
  winner_user_id uuid references public.profiles (id),
  started_at timestamptz,
  question_started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.match_participants (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  seat integer not null check (seat in (1, 2)),
  is_ghost boolean not null default false,
  ready_at timestamptz,
  joined_at timestamptz not null default timezone('utc', now()),
  final_score integer not null default 0 check (final_score >= 0),
  outcome public.match_outcome not null default 'pending',
  abandoned_at timestamptz,
  suspicious_score integer not null default 0,
  unique (match_id, user_id),
  unique (match_id, seat)
);

create table if not exists public.match_questions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  question_id uuid not null references public.questions (id),
  sequence integer not null check (sequence between 1 and 7),
  difficulty public.difficulty_level not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (match_id, sequence),
  unique (match_id, question_id)
);

create table if not exists public.match_answers (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  question_id uuid not null references public.questions (id),
  user_id uuid not null references public.profiles (id) on delete cascade,
  question_sequence integer not null check (question_sequence between 1 and 7),
  selected_answer public.answer_option,
  is_correct boolean not null default false,
  response_time_ms integer not null default 0 check (response_time_ms >= 0),
  answered_at_offset_ms integer not null default 0 check (answered_at_offset_ms >= 0),
  score_awarded integer not null default 0 check (score_awarded >= 0),
  cumulative_score integer not null default 0 check (cumulative_score >= 0),
  submitted_at timestamptz not null default timezone('utc', now()),
  validation_flags jsonb not null default '[]'::jsonb,
  is_rejected boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  unique (match_id, user_id, question_sequence)
);

create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  scope public.rating_scope not null,
  category_id uuid references public.categories (id) on delete cascade,
  rating integer not null default 1200 check (rating >= 0),
  placement_matches_played integer not null default 0 check (placement_matches_played >= 0),
  provisional boolean not null default true,
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  draws integer not null default 0 check (draws >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique nulls not distinct (user_id, scope, category_id),
  check (
    (scope = 'global' and category_id is null)
    or (scope = 'category' and category_id is not null)
  )
);

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  friend_id uuid not null references public.profiles (id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, friend_id),
  check (user_id <> friend_id)
);

create table if not exists public.matchmaking_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  match_type public.match_type not null,
  rating_snapshot integer not null default 1200 check (rating_snapshot >= 0),
  region text not null default 'global',
  platform text not null default 'mobile',
  status public.queue_status not null default 'queued',
  enqueued_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null default (timezone('utc', now()) + interval '2 minutes'),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.suspicious_match_logs (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null,
  evidence jsonb not null default '{}'::jsonb,
  severity integer not null default 1 check (severity between 1 and 10),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.question_ingestion_staging (
  id uuid primary key default gen_random_uuid(),
  category_name text not null,
  difficulty public.difficulty_level not null,
  question_text text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_answer public.answer_option not null,
  explanation text,
  source text,
  payload jsonb not null default '{}'::jsonb,
  imported_by uuid references public.profiles (id),
  validation_errors jsonb not null default '[]'::jsonb,
  is_promoted boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists matchmaking_queue_match_lookup_idx
  on public.matchmaking_queue (status, match_type, category_id, rating_snapshot, enqueued_at);

create index if not exists match_answers_history_idx
  on public.match_answers (user_id, question_id, created_at desc);

create index if not exists match_answers_match_question_idx
  on public.match_answers (match_id, question_sequence, user_id);

create index if not exists ratings_leaderboard_idx
  on public.ratings (scope, category_id, rating desc);

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);

create index if not exists suspicious_match_logs_match_idx
  on public.suspicious_match_logs (match_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.slugify_username(seed text)
returns text
language plpgsql
as $$
declare
  normalized text;
  suffix text;
begin
  normalized := regexp_replace(lower(coalesce(seed, 'player')), '[^a-z0-9]+', '', 'g');
  normalized := left(coalesce(nullif(normalized, ''), 'player'), 16);
  suffix := right(replace(gen_random_uuid()::text, '-', ''), 6);
  return normalized || suffix;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, avatar)
  values (
    new.id,
    public.slugify_username(coalesce(new.raw_user_meta_data ->> 'user_name', new.email)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.ratings (user_id, scope, category_id, provisional)
  values (new.id, 'global', null, true)
  on conflict (user_id, scope, category_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.ensure_player_ratings(p_user_id uuid, p_category_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.ratings (user_id, scope, category_id, provisional)
  values (p_user_id, 'global', null, true)
  on conflict (user_id, scope, category_id) do nothing;

  insert into public.ratings (user_id, scope, category_id, provisional)
  values (p_user_id, 'category', p_category_id, true)
  on conflict (user_id, scope, category_id) do nothing;
end;
$$;

create or replace function public.calculate_answer_score(
  p_is_correct boolean,
  p_response_time_ms integer,
  p_penalty_factor numeric
)
returns integer
language sql
immutable
as $$
  select case
    when not p_is_correct then 0
    else greatest(0, floor(1000 - (p_response_time_ms * p_penalty_factor))::integer)
  end;
$$;

create or replace function public.calculate_elo_delta(
  p_player_rating integer,
  p_opponent_rating integer,
  p_score numeric,
  p_provisional boolean
)
returns integer
language sql
immutable
as $$
  with params as (
    select
      case when p_provisional then 48.0 else 24.0 end as k_factor,
      1.0 / (1.0 + power(10.0, (p_opponent_rating - p_player_rating) / 400.0)) as expected_score
  )
  select round(k_factor * (p_score - expected_score))::integer
  from params;
$$;

create or replace function public.get_recent_question_ids(
  p_user_id uuid,
  p_category_id uuid,
  p_limit integer default 100
)
returns table (question_id uuid)
language sql
stable
as $$
  select ma.question_id
  from public.match_answers ma
  join public.questions q on q.id = ma.question_id
  where ma.user_id = p_user_id
    and q.category_id = p_category_id
  group by ma.question_id
  order by max(ma.created_at) desc
  limit p_limit;
$$;

create or replace function public.select_match_questions(
  p_user_id uuid,
  p_category_id uuid,
  p_question_count integer default 7
)
returns table (
  question_id uuid,
  difficulty public.difficulty_level,
  sequence integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with recent_questions as (
    select question_id
    from public.get_recent_question_ids(p_user_id, p_category_id, 200)
  ),
  desired_mix as (
    select * from (
      values
        ('easy'::public.difficulty_level, 2),
        ('medium'::public.difficulty_level, 3),
        ('hard'::public.difficulty_level, 2)
    ) as dm(difficulty, quota)
  ),
  primary_pool as (
    select
      q.id as question_id,
      q.difficulty,
      row_number() over (partition by q.difficulty order by random(), q.quality_score desc) as bucket_rank
    from public.questions q
    where q.category_id = p_category_id
      and q.is_active = true
      and q.id not in (select question_id from recent_questions)
  ),
  fallback_pool as (
    select
      q.id as question_id,
      q.difficulty,
      row_number() over (partition by q.difficulty order by random(), q.quality_score desc) as bucket_rank
    from public.questions q
    where q.category_id = p_category_id
      and q.is_active = true
  ),
  chosen as (
    select pp.question_id, pp.difficulty
    from primary_pool pp
    join desired_mix dm on dm.difficulty = pp.difficulty
    where pp.bucket_rank <= dm.quota
    union
    select fp.question_id, fp.difficulty
    from fallback_pool fp
    where fp.question_id not in (
      select question_id from primary_pool pp2
      join desired_mix dm2 on dm2.difficulty = pp2.difficulty
      where pp2.bucket_rank <= dm2.quota
    )
    order by random()
    limit greatest(0, p_question_count - (
      select count(*)
      from primary_pool pp3
      join desired_mix dm3 on dm3.difficulty = pp3.difficulty
      where pp3.bucket_rank <= dm3.quota
    ))
  ),
  numbered as (
    select
      question_id,
      difficulty,
      row_number() over (order by random())::integer as sequence
    from chosen
    limit p_question_count
  )
  select question_id, difficulty, sequence
  from numbered
  order by sequence;
end;
$$;

create or replace function public.create_match_with_questions(
  p_category_id uuid,
  p_match_type public.match_type,
  p_mode public.match_mode,
  p_player_one uuid,
  p_player_two uuid default null,
  p_source_match_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match_id uuid;
  v_question record;
begin
  insert into public.matches (
    category_id,
    match_type,
    mode,
    state,
    source_match_id,
    ghost_seed_user_id
  )
  values (
    p_category_id,
    p_match_type,
    p_mode,
    'waiting',
    p_source_match_id,
    case when p_mode = 'ghost' then p_player_one else null end
  )
  returning id into v_match_id;

  insert into public.match_participants (match_id, user_id, seat, is_ghost)
  values (v_match_id, p_player_one, 1, false);

  if p_player_two is not null then
    insert into public.match_participants (match_id, user_id, seat, is_ghost)
    values (v_match_id, p_player_two, 2, p_mode = 'ghost');
  end if;

  if p_source_match_id is not null then
    insert into public.match_questions (match_id, question_id, sequence, difficulty)
    select
      v_match_id,
      mq.question_id,
      mq.sequence,
      mq.difficulty
    from public.match_questions mq
    where mq.match_id = p_source_match_id
    order by mq.sequence;
  else
    for v_question in
      select * from public.select_match_questions(p_player_one, p_category_id, 7)
    loop
      insert into public.match_questions (match_id, question_id, sequence, difficulty)
      values (v_match_id, v_question.question_id, v_question.sequence, v_question.difficulty);
    end loop;
  end if;

  perform public.ensure_player_ratings(p_player_one, p_category_id);
  if p_player_two is not null then
    perform public.ensure_player_ratings(p_player_two, p_category_id);
  end if;

  return v_match_id;
end;
$$;

create or replace function public.find_live_match_candidate(
  p_queue_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate uuid;
begin
  select q2.id
  into v_candidate
  from public.matchmaking_queue q1
  join public.matchmaking_queue q2
    on q1.id <> q2.id
   and q1.status = 'queued'
   and q2.status = 'queued'
   and q1.match_type = 'live_random'
   and q2.match_type = 'live_random'
   and q1.category_id = q2.category_id
   and abs(q1.rating_snapshot - q2.rating_snapshot) <= 200
   and q1.user_id <> q2.user_id
  where q1.id = p_queue_id
  order by q2.enqueued_at asc
  limit 1;

  return v_candidate;
end;
$$;

create or replace function public.is_ghost_seed_reusable(p_match_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.matches m
    join public.match_participants mp on mp.match_id = m.id and mp.seat = 1
    where m.id = p_match_id
      and m.mode = 'ghost'
      and m.state = 'complete'
      and mp.abandoned_at is null
      and (
        select count(*)
        from public.match_answers ma
        where ma.match_id = m.id
          and ma.user_id = mp.user_id
      ) = 7
  );
$$;

create or replace function public.log_suspicious_match(
  p_match_id uuid,
  p_user_id uuid,
  p_reason text,
  p_evidence jsonb,
  p_severity integer default 1
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.suspicious_match_logs (match_id, user_id, reason, evidence, severity)
  values (p_match_id, p_user_id, p_reason, p_evidence, greatest(1, least(10, p_severity)));
$$;

create or replace function public.promote_staged_questions(p_imported_by uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_promoted integer := 0;
begin
  insert into public.categories (name, icon)
  select distinct s.category_name, 'sparkles'
  from public.question_ingestion_staging s
  where s.imported_by = p_imported_by
    and coalesce(jsonb_array_length(s.validation_errors), 0) = 0
    and not s.is_promoted
  on conflict (name) do nothing;

  insert into public.questions (
    category_id,
    difficulty,
    question_text,
    option_a,
    option_b,
    option_c,
    option_d,
    correct_answer,
    explanation,
    source
  )
  select
    c.id,
    s.difficulty,
    s.question_text,
    s.option_a,
    s.option_b,
    s.option_c,
    s.option_d,
    s.correct_answer,
    s.explanation,
    s.source
  from public.question_ingestion_staging s
  join public.categories c on c.name = s.category_name
  where s.imported_by = p_imported_by
    and coalesce(jsonb_array_length(s.validation_errors), 0) = 0
    and not s.is_promoted
  on conflict do nothing;

  update public.question_ingestion_staging
  set is_promoted = true
  where imported_by = p_imported_by
    and coalesce(jsonb_array_length(validation_errors), 0) = 0
    and not is_promoted;

  get diagnostics v_promoted = row_count;
  return v_promoted;
end;
$$;

create or replace view public.global_leaderboard as
select
  row_number() over (order by r.rating desc, p.xp desc, p.created_at asc) as rank,
  p.id as user_id,
  p.username,
  p.avatar,
  p.xp,
  r.rating
from public.ratings r
join public.profiles p on p.id = r.user_id
where r.scope = 'global';

create or replace view public.category_leaderboard as
select
  row_number() over (
    partition by r.category_id
    order by r.rating desc, p.xp desc, p.created_at asc
  ) as rank,
  r.category_id,
  p.id as user_id,
  p.username,
  p.avatar,
  p.xp,
  r.rating
from public.ratings r
join public.profiles p on p.id = r.user_id
where r.scope = 'category';

create or replace view public.weekly_leaderboard as
select
  row_number() over (order by sum(ma.score_awarded) desc, count(*) filter (where ma.is_correct) desc) as rank,
  mp.user_id,
  p.username,
  p.avatar,
  sum(ma.score_awarded)::integer as weekly_points,
  count(*) filter (where ma.is_correct) as correct_answers
from public.match_answers ma
join public.match_participants mp on mp.match_id = ma.match_id and mp.user_id = ma.user_id
join public.profiles p on p.id = mp.user_id
where ma.created_at >= date_trunc('week', timezone('utc', now()))
group by mp.user_id, p.username, p.avatar;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

create trigger set_questions_updated_at
  before update on public.questions
  for each row execute procedure public.set_updated_at();

create trigger set_matches_updated_at
  before update on public.matches
  for each row execute procedure public.set_updated_at();

create trigger set_ratings_updated_at
  before update on public.ratings
  for each row execute procedure public.set_updated_at();

create trigger set_friendships_updated_at
  before update on public.friendships
  for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.questions enable row level security;
alter table public.matches enable row level security;
alter table public.match_participants enable row level security;
alter table public.match_questions enable row level security;
alter table public.match_answers enable row level security;
alter table public.ratings enable row level security;
alter table public.friendships enable row level security;
alter table public.matchmaking_queue enable row level security;
alter table public.notifications enable row level security;
alter table public.suspicious_match_logs enable row level security;
alter table public.question_ingestion_staging enable row level security;

create policy "profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "users update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "categories readable"
  on public.categories for select
  using (is_active = true);

create policy "questions readable by authenticated users"
  on public.questions for select
  using (auth.role() = 'authenticated');

create policy "players can view their matches"
  on public.matches for select
  using (
    exists (
      select 1
      from public.match_participants mp
      where mp.match_id = id
        and mp.user_id = auth.uid()
    )
  );

create policy "players can view participants in their matches"
  on public.match_participants for select
  using (
    exists (
      select 1
      from public.match_participants self
      where self.match_id = match_id
        and self.user_id = auth.uid()
    )
  );

create policy "players can view match questions"
  on public.match_questions for select
  using (
    exists (
      select 1
      from public.match_participants mp
      where mp.match_id = match_id
        and mp.user_id = auth.uid()
    )
  );

create policy "players can view match answers in their matches"
  on public.match_answers for select
  using (
    exists (
      select 1
      from public.match_participants mp
      where mp.match_id = match_id
        and mp.user_id = auth.uid()
    )
  );

create policy "players can queue themselves"
  on public.matchmaking_queue for select
  using (auth.uid() = user_id);

create policy "players can view own ratings"
  on public.ratings for select
  using (auth.uid() = user_id);

create policy "players can view own friendships"
  on public.friendships for select
  using (auth.uid() = user_id or auth.uid() = friend_id);

create policy "players can view own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "players can update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);

create policy "admins can manage staging"
  on public.question_ingestion_staging for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
