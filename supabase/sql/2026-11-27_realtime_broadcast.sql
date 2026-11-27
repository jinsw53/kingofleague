-- Realtime postgres_changes → Broadcast 전환 (1단계: 추가만 함)
-- 목적: 구독자마다 RLS 확인 쿼리를 돌리는 postgres_changes 대신, 변경 1건당 트리거가 받을 토픽에 한 번씩만 보냄.
--       Realtime 서버가 DB를 감시하지 않아도 되므로 "Too many database timeouts" 원인이 사라짐.
-- 기존 postgres_changes 구독(supabase_realtime publication)은 건드리지 않음 → 구버전 확장/사이트도 계속 동작.
-- 옛 구독 정리(publication에서 테이블 제거)는 새 확장이 다 퍼진 뒤 별도로 진행.
--
-- 토픽 규칙 (전부 private 채널, 권한은 아래 realtime.messages 정책으로 join 시 1회 확인)
--   user:<uid>   본인만 수신. 개인·팀·대화방 데이터는 받을 사람마다 이 토픽으로 나눠 보냄(fan-out).
--                messages(보낸 사람·받는 사람), user_achievements, point_history, daily_recommend_bonus_claims,
--                rival_match_votes, team_chats·team_chat_reads·team_point_history(활성 팀원),
--                challenge_chats(공격·수비 팀 활성 팀원), together_chats(확정된 모집의 참가자)
--   pub:feed     누구나(비로그인 포함). RLS가 공개(true)인 테이블만.
--                news_feed_items, rival_matches, tournament_posts, together_posts, together_participants,
--                challenges, kol_events, board_posts·board_comments(내용 없이 id만 — 배지 갱신용)
--   pub:scores   누구나. grandprix_game_scores (다른 화면엔 필요 없어서 분리)
--   auth:chat    로그인 사용자. grandprix_match_chats, schedule_polls (RLS가 authenticated)
--
-- 클라이언트가 받는 payload: { table, schema, operation, record, old_record }

-- ── 1) 보내기 함수: 실패해도 원래 INSERT/UPDATE/DELETE는 절대 막지 않음
create or replace function public.fn_rt_send(p_topic text, p_op text, p_table text, p_rec jsonb, p_old jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform realtime.send(
    jsonb_build_object('table', p_table, 'schema', 'public', 'operation', p_op, 'record', p_rec, 'old_record', p_old),
    p_op, p_topic, true);
exception when others then
  raise warning 'fn_rt_send 실패 (%): %', p_topic, sqlerrm;
end $$;

-- 팀의 활성 팀원 uid 목록 (team_members.player_name ↔ profiles.full_name, 기존 RLS와 같은 기준)
create or replace function public.fn_rt_team_uids(p_team_ids bigint[])
returns setof uuid language sql stable security definer set search_path = public as $$
  select distinct p.id
  from team_members tm join profiles p on p.full_name = tm.player_name
  where tm.team_id = any(p_team_ids) and tm.is_active = true
$$;

-- ── 2) 트리거 함수 (모든 대상 테이블 공용)
create or replace function public.fn_rt_emit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_rec jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_old jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_row jsonb := coalesce(v_rec, v_old);
  v_uid uuid;
  v_uids uuid[] := '{}';
  v_teams bigint[];
begin
  case tg_table_name
    -- 공개 토픽
    when 'news_feed_items', 'rival_matches', 'tournament_posts', 'together_posts',
         'together_participants', 'challenges', 'kol_events' then
      perform fn_rt_send('pub:feed', tg_op, tg_table_name, v_rec, v_old);
      return null;
    when 'board_posts', 'board_comments' then
      -- 임시저장·삭제 글 내용이 새지 않도록 id만 보냄 (받는 쪽은 배지만 다시 셈)
      perform fn_rt_send('pub:feed', tg_op, tg_table_name,
        case when v_rec is null then null else jsonb_build_object('id', v_rec->'id') end,
        case when v_old is null then null else jsonb_build_object('id', v_old->'id') end);
      return null;
    when 'grandprix_game_scores' then
      perform fn_rt_send('pub:scores', tg_op, tg_table_name, v_rec, v_old);
      return null;
    when 'grandprix_match_chats', 'schedule_polls' then
      perform fn_rt_send('auth:chat', tg_op, tg_table_name, v_rec, v_old);
      return null;

    -- 개인 토픽 (받을 사람 계산)
    when 'messages' then
      v_uids := array_remove(array[(v_row->>'receiver_id')::uuid, (v_row->>'sender_id')::uuid], null);
    when 'user_achievements', 'point_history', 'daily_recommend_bonus_claims' then
      v_uids := array_remove(array[(v_row->>'user_id')::uuid], null);
    when 'rival_match_votes' then
      v_uids := array_remove(array[(v_row->>'voter_id')::uuid], null);
    when 'team_chats', 'team_chat_reads', 'team_point_history' then
      select coalesce(array_agg(u), '{}') into v_uids from fn_rt_team_uids(array[(v_row->>'team_id')::bigint]) u;
    when 'challenge_chats' then
      select array[c.attacker_team_id, c.defender_team_id]::bigint[] into v_teams
      from challenges c where c.id = (v_row->>'challenge_id')::bigint;
      if v_teams is not null then
        select coalesce(array_agg(u), '{}') into v_uids from fn_rt_team_uids(v_teams) u;
      end if;
    when 'together_chats' then
      if fn_together_is_confirmed((v_row->>'post_id')::bigint) then
        select coalesce(array_agg(distinct tp.user_id), '{}') into v_uids
        from together_participants tp where tp.post_id = (v_row->>'post_id')::bigint;
      end if;
    else
      return null;
  end case;

  foreach v_uid in array (select array(select distinct unnest(v_uids))) loop
    perform fn_rt_send('user:' || v_uid, tg_op, tg_table_name, v_rec, v_old);
  end loop;
  return null;
exception when others then
  raise warning 'fn_rt_emit 실패 (%): %', tg_table_name, sqlerrm;
  return null;
end $$;

-- ── 3) 트리거 (클라이언트가 실제로 듣는 이벤트만)
do $$
declare
  t record;
begin
  for t in select * from (values
    ('messages',                     'insert'),
    ('user_achievements',            'insert'),
    ('point_history',                'insert'),
    ('daily_recommend_bonus_claims', 'update'),
    ('rival_match_votes',            'update'),
    ('team_chats',                   'insert'),
    ('team_chat_reads',              'insert or update or delete'),
    ('team_point_history',           'insert'),
    ('challenge_chats',              'insert'),
    ('together_chats',               'insert'),
    ('news_feed_items',              'insert'),
    ('rival_matches',                'insert'),
    ('tournament_posts',             'insert or update or delete'),
    ('together_posts',               'insert or update or delete'),
    ('together_participants',        'insert or update or delete'),
    ('challenges',                   'insert or update or delete'),
    ('kol_events',                   'insert'),
    ('board_posts',                  'insert or update or delete'),
    ('board_comments',               'insert or update or delete'),
    ('grandprix_game_scores',        'insert or update or delete'),
    ('grandprix_match_chats',        'insert'),
    ('schedule_polls',               'insert or update or delete')
  ) as v(tbl, ops) loop
    execute format('drop trigger if exists trg_rt_emit on public.%I', t.tbl);
    execute format('create trigger trg_rt_emit after %s on public.%I for each row execute function public.fn_rt_emit()', t.ops, t.tbl);
  end loop;
end $$;

-- ── 4) 수신 권한 (private 채널 join 시 1회 확인)
drop policy if exists "rt_receive_user_topic" on realtime.messages;
create policy "rt_receive_user_topic" on realtime.messages
  for select to authenticated
  using (realtime.topic() = 'user:' || auth.uid()::text or realtime.topic() = 'auth:chat');

drop policy if exists "rt_receive_public_topic" on realtime.messages;
create policy "rt_receive_public_topic" on realtime.messages
  for select to anon, authenticated
  using (realtime.topic() in ('pub:feed', 'pub:scores'));

-- ── 5) 내부 함수는 API(RPC)로 직접 못 부르게 막음 (누구나 임의 토픽에 메시지를 쏘거나 팀원 id를 조회하는 것 방지)
revoke all on function public.fn_rt_send(text, text, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.fn_rt_team_uids(bigint[]) from public, anon, authenticated;
revoke all on function public.fn_rt_emit() from public, anon, authenticated;

-- 되돌리기:
--   do $$ declare t text; begin foreach t in array array['messages','user_achievements','point_history',
--     'daily_recommend_bonus_claims','rival_match_votes','team_chats','team_chat_reads','team_point_history',
--     'challenge_chats','together_chats','news_feed_items','rival_matches','tournament_posts','together_posts',
--     'together_participants','challenges','kol_events','board_posts','board_comments','grandprix_game_scores',
--     'grandprix_match_chats','schedule_polls'] loop execute format('drop trigger if exists trg_rt_emit on public.%I', t);
--     end loop; end $$;
--   drop policy if exists "rt_receive_user_topic" on realtime.messages;
--   drop policy if exists "rt_receive_public_topic" on realtime.messages;
--   drop function if exists public.fn_rt_emit(), public.fn_rt_team_uids(bigint[]), public.fn_rt_send(text,text,text,jsonb,jsonb);
