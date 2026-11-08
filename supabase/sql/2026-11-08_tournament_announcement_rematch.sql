-- =====================================================================================
-- [토너먼트] 잘못 올라간 공지를 고쳐서 다시 등록하면, 그 요청의 공지로 인정하는 기능
--
-- 배경 (실제 사고: 요청 #65 = 21:00 인데 21:33 토너먼트를 등록해 별개 공지 #66 이 생김)
--   · 확장 → raw_ingest_buffer INSERT → 트리거 trg_distribute_raw_data → distribute_raw_data()
--     이 함수의 TOURNAMENT_ANNOUNCEMENT 분기가
--       1) source_url 이 이미 tournament_posts 에 있으면 "이미 등록됨"으로 조용히 통과(무시)
--       2) 없으면, OPEN 요청 중 [종목(대소문자·공백 무시) + 시작 시각 + 최대 인원]이 모두 같은 것을 찾아 전환(+포인트/쪽지),
--          맞는 요청이 없으면 별개의 공지를 새로 만든다(+50P).
--   · 그래서 시각을 바로잡아 다시 등록해도 1)에서 걸러져, 요청과 이어질 기회가 없었다.
--
-- 이 파일이 하는 일
--   raw_ingest_buffer 의 기존 트리거보다 먼저 도는 앞단 트리거를 하나 추가한다.
--   "같은 BGA 토너먼트로 이미 올라간, 요청과 연결 안 된 내 공지"가 있고, 다시 보낸 값이 기존 함수와 똑같은 조건으로
--   OPEN 요청과 맞으면 → 잘못 올라간 공지와 그 부산물만 정리하고 그대로 통과시킨다.
--   이후는 기존 함수가 새 등록처럼 처리하므로 요청 전환·포인트·쪽지·소식 피드·카톡 캘린더 알림이 원래 방식 그대로 일어난다.
--
--   정리하는 것(잘못 올라간 공지 #stray 의 부산물)
--     · 소식 피드(news_feed_items, link_type=TOURNAMENT, link_id=#stray)
--     · 카톡 캘린더 일정 — 기존 kakao-calendar-broadcast-cancel 함수를 같은 방식으로 호출해 각 사용자 캘린더에서 지움
--     · 그 공지 등록 때 지급된 +50P (기존 함수가 전환 포인트를 다시 주므로 이중 지급 방지, point_history 에 회수 내역 기록)
--     · 공지 행 자체
--
-- 건드리지 않는 것
--   · 새 토너먼트 등록, 이미 요청과 연결된 공지의 재전송, 다른 종류의 이벤트: 그대로 기존 처리로 넘긴다.
--   · 정정해도 맞는 요청이 없으면: 아무것도 바꾸지 않는다(기존처럼 무시).
--   · 다른 사람이 올린 공지는 정리하지 않는다(등록자 본인 것만).
--
-- 안전장치
--   · 이 트리거 안에서 오류가 나면 모든 정리를 되돌리고(서브 트랜잭션) 경고만 남긴 채 기존 처리로 넘긴다 = 등록을 막지 않는다.
--   · 기존 트리거 이름(trg_distribute_raw_data)보다 앞서 실행되도록 이름이 숫자로 시작한다(00_...).
--   · 재실행해도 안전하다(함수/트리거를 덮어쓰기). 되돌리는 방법은 파일 맨 아래 주석 참고.
-- =====================================================================================

create or replace function public.trg_reconcile_tournament_announcement_ingest()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_url       text;
    v_tid       text;
    v_stray     public.tournament_posts%rowtype;
    v_author_id uuid;
    v_when      timestamptz;
    v_max       integer;
    v_req       bigint;
    v_award     bigint;
    ev          record;
begin
    if upper(new.data_type) is distinct from 'TOURNAMENT_ANNOUNCEMENT' then
        return new;
    end if;

    -- 1) 같은 BGA 토너먼트(주소의 id=숫자)로 이미 올라간 '요청과 연결 안 된' 공지
    v_url := new.payload->>'sourceUrl';
    v_tid := substring(coalesce(v_url, '') from '[?&]id=([0-9]+)');
    if v_tid is null then
        return new;
    end if;

    select * into v_stray
      from public.tournament_posts
     where type = 'ANNOUNCEMENT' and fulfilled_by is null
       and source_url ~ ('[?&]id=' || v_tid || '(&|$)')
     order by id desc
     limit 1;
    if not found then
        return new;                                     -- 새 등록이거나 이미 요청과 연결된 공지: 기존 처리에 맡김
    end if;

    -- 2) 등록자 (기존 함수와 동일: reporter 닉네임으로 프로필 조회). 올린 본인의 공지만 정리한다.
    select id into v_author_id
      from public.profiles
     where lower(trim(full_name)) = lower(trim(new.payload->>'reporter'))
     limit 1;
    if v_author_id is null or v_author_id is distinct from v_stray.author_id then
        return new;
    end if;

    -- 3) 다시 보낸 값을 기존 함수와 똑같이 해석
    v_when := null;
    if new.payload->>'scheduledDate' ~ '^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})?' then
        begin
            v_when := (new.payload->>'scheduledDate')::timestamptz;
        exception when others then
            v_when := null;
        end;
    end if;
    v_max := null;
    if new.payload->>'maxParticipants' ~ '^\d+$' then
        v_max := (new.payload->>'maxParticipants')::integer;
    end if;

    -- 4) 기존 함수와 똑같은 매칭 조건으로 OPEN 요청이 있는지 확인 (종목 + 시작 시각 + 최대 인원, 오래된 요청 우선)
    select id into v_req
      from public.tournament_posts
     where type = 'REQUEST' and status = 'OPEN'
       and lower(trim(game_name)) = lower(trim(new.payload->>'gameName'))
       and scheduled_date = v_when
       and max_participants = v_max
     order by created_at asc
     limit 1;
    if v_req is null then
        return new;                                     -- 고쳐도 맞는 요청이 없으면 기존처럼 무시
    end if;

    -- 5) 잘못 올라간 공지와 부산물 정리 (이 블록에서 오류가 나면 아래 exception 으로 전부 되돌아간다)
    -- 5-a) 카톡 캘린더 일정 취소 (기존 취소 함수를 같은 방식으로 호출; 호출은 커밋 뒤에 비동기로 나간다)
    for ev in
        select source_type, source_id, user_id
          from public.broadcast_kakao_events
         where source_type = 'TOURNAMENT' and source_id = v_stray.id::text
    loop
        perform net.http_post(
            url     := 'https://qrredwrxdnvqwdxzanba.supabase.co/functions/v1/kakao-calendar-broadcast-cancel',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'INTERNAL_TRIGGER_SECRET' limit 1)
            ),
            body    := jsonb_build_object('source_type', ev.source_type, 'source_id', ev.source_id, 'user_id', ev.user_id)
        );
    end loop;

    -- 5-b) 소식 피드 (전환되는 요청에 대해 기존 트리거가 새 피드를 만든다)
    delete from public.news_feed_items
     where link_type = 'TOURNAMENT' and link_id = v_stray.id::text;

    -- 5-c) 이 공지를 등록할 때 지급된 +50P 회수 (기존 함수가 전환 포인트를 다시 지급하므로 이중 지급 방지)
    select id into v_award
      from public.point_history
     where user_id = v_stray.author_id and point_change = 50
       and description = '🏆 토너먼트 직접 개최 (' || v_stray.title || ')'
       and created_at between v_stray.created_at - interval '1 minute' and v_stray.created_at + interval '1 minute'
     order by id desc
     limit 1;
    if v_award is not null then
        update public.profiles set points = points - 50 where id = v_stray.author_id;
        insert into public.point_history (user_id, point_change, description)
        values (v_stray.author_id, -50, '↩️ 정정 재등록으로 기존 공지 개최 포인트 회수 (' || v_stray.title || ')');
    end if;

    -- 5-d) 공지 행 삭제 → 이후 기존 함수가 source_url 이 없는 새 등록으로 보고 요청을 전환한다
    delete from public.tournament_posts where id = v_stray.id;

    return new;

exception when others then
    raise warning '[rematch] 정정 재등록 처리 실패(변경 없이 기존 처리로 넘김): %', sqlerrm;
    return new;
end;
$$;

drop trigger if exists "00_reconcile_tournament_announcement_ingest" on public.raw_ingest_buffer;
create trigger "00_reconcile_tournament_announcement_ingest"
    before insert on public.raw_ingest_buffer
    for each row execute function public.trg_reconcile_tournament_announcement_ingest();


-- =====================================================================================
-- 되돌리기 (필요할 때만 주석을 풀어 실행)
-- =====================================================================================
-- drop trigger  if exists "00_reconcile_tournament_announcement_ingest" on public.raw_ingest_buffer;
-- drop function if exists public.trg_reconcile_tournament_announcement_ingest();
