create or replace function public.get_recent_question_ids(
  p_user_id uuid,
  p_category_id uuid,
  p_limit integer default 100
)
returns table (question_id uuid)
language plpgsql
stable
as $$
begin
  return query
  select ma.question_id
  from public.match_answers ma
  join public.questions q on q.id = ma.question_id
  where ma.user_id = p_user_id
    and q.category_id = p_category_id
  group by ma.question_id
  order by max(ma.created_at) desc
  limit p_limit;
end;
$$;
