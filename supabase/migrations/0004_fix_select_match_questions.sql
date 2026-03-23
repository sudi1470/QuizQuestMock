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
    select rq.question_id
    from public.get_recent_question_ids(p_user_id, p_category_id, 200) rq
  ),
  desired_mix as (
    select * from (
      values
        ('easy'::public.difficulty_level, 2),
        ('medium'::public.difficulty_level, 3),
        ('hard'::public.difficulty_level, 2)
    ) as dm(difficulty_level, quota)
  ),
  primary_pool as (
    select
      q.id as candidate_question_id,
      q.difficulty as candidate_difficulty,
      row_number() over (partition by q.difficulty order by random(), q.quality_score desc) as bucket_rank
    from public.questions q
    where q.category_id = p_category_id
      and q.is_active = true
      and q.id not in (select rq.question_id from recent_questions rq)
  ),
  primary_choice as (
    select
      pp.candidate_question_id,
      pp.candidate_difficulty
    from primary_pool pp
    join desired_mix dm on dm.difficulty_level = pp.candidate_difficulty
    where pp.bucket_rank <= dm.quota
  ),
  fallback_pool as (
    select
      q.id as candidate_question_id,
      q.difficulty as candidate_difficulty,
      row_number() over (partition by q.difficulty order by random(), q.quality_score desc) as bucket_rank
    from public.questions q
    where q.category_id = p_category_id
      and q.is_active = true
  ),
  fallback_choice as (
    select
      fp.candidate_question_id,
      fp.candidate_difficulty
    from fallback_pool fp
    where fp.candidate_question_id not in (
      select pc.candidate_question_id
      from primary_choice pc
    )
    order by random()
    limit greatest(0, p_question_count - (select count(*) from primary_choice))
  ),
  chosen as (
    select
      pc.candidate_question_id,
      pc.candidate_difficulty
    from primary_choice pc
    union
    select
      fc.candidate_question_id,
      fc.candidate_difficulty
    from fallback_choice fc
  ),
  numbered as (
    select
      ch.candidate_question_id,
      ch.candidate_difficulty,
      row_number() over (order by random())::integer as question_sequence
    from chosen ch
    limit p_question_count
  )
  select
    n.candidate_question_id as question_id,
    n.candidate_difficulty as difficulty,
    n.question_sequence as sequence
  from numbered n
  order by n.question_sequence;
end;
$$;
