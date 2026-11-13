-- =====================================================================================
-- [팀] 팀 메뉴의 팀 멤버 "마지막 접속" 조회 (며칠째 미접속인지 표시용)
--
-- 배경
--   · 방문 기록은 visit_log(사이트 접속 source='web', 확장 프로그램 사용 source='extension')에 쌓이는데,
--     클라이언트(로그인 사용자 포함)가 직접 조회할 수 없다. profiles.last_seen_at/visit_count 는 9/17 이후 갱신이 멈춰 쓸 수 없다.
--   · 그래서 "그 팀의 활성 팀원"만 호출할 수 있는 읽기 전용 함수로 감싸서 제공한다.
--
-- 동작
--   · fn_get_team_member_activity(p_team_id) → (player_name, last_seen_at)
--     last_seen_at = 사이트 접속과 확장 프로그램 사용 중 더 최근 시각 (방문 기록이 없으면 NULL)
--   · 호출한 사람이 해당 팀의 활성 팀원이 아니면 빈 결과를 돌려준다. 비로그인(anon)은 호출 불가.
--   · 데이터를 바꾸지 않는다(STABLE, 읽기 전용).
--
-- 되돌리기: drop function if exists public.fn_get_team_member_activity(bigint);
-- =====================================================================================
create or replace function public.fn_get_team_member_activity(p_team_id bigint)
returns table (player_name text, last_seen_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
    select tm.player_name,
           max(v.visited_at) as last_seen_at
      from public.team_members tm
      left join public.profiles p on p.full_name = tm.player_name
      left join public.visit_log v on v.user_id = p.id
     where tm.team_id = p_team_id
       and tm.is_active = true
       -- 호출한 사람이 이 팀의 활성 팀원일 때만
       and exists (
            select 1
              from public.team_members me
              join public.profiles mp on mp.full_name = me.player_name
             where mp.id = auth.uid()
               and me.team_id = p_team_id
               and me.is_active = true
       )
     group by tm.player_name;
$$;

revoke all on function public.fn_get_team_member_activity(bigint) from public;
revoke all on function public.fn_get_team_member_activity(bigint) from anon;
grant execute on function public.fn_get_team_member_activity(bigint) to authenticated;
