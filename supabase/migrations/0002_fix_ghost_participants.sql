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
  values (v_match_id, p_player_one, 1, p_mode = 'ghost' and p_source_match_id is not null);

  if p_player_two is not null then
    insert into public.match_participants (match_id, user_id, seat, is_ghost)
    values (v_match_id, p_player_two, 2, false);
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
