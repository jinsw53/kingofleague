-- =====================================================================================
-- [토너먼트] 같은 BGA 토너먼트의 중복 등록을 토너먼트 번호로 걸러내고,
--            잘못 올라간 공지를 고쳐서 다시 등록하면 그 요청의 공지로 인정하는 기능
--
-- 배경
--   · 확장 → raw_ingest_buffer INSERT → 트리거 trg_distribute_raw_data → distribute_raw_data()
--     이 함수의 TOURNAMENT_ANNOUNCEMENT 분기가
--       1) source_url "문자열 전체"가 이미 tournament_posts 에 있으면 "이미 등록됨"으로 조용히 통과(무시)
--       2) 없으면, OPEN 요청 중 [종목(대소문자·공백 무시) + 시작 시각 + 최대 인원]이 모두 같은 것을 찾아 전환(+포인트/쪽지),
--          맞는 요청이 없으면 별개의 공지를 새로 만든다(+50P).
--   · 문제 1: 같은 토너먼트라도 주소가 "...?id=624200&token=XXXX" 와 "...?id=624200"(주소창) 처럼 다르게 올 수 있는데,
--             문자열 전체 비교라 다른 글로 취급되어 같은 토너먼트가 두 번 올라갔다(+포인트, 피드, 캘린더 일정 중복).
--   · 문제 2: 요청과 안 맞게(예: 21:00 요청인데 21:33) 올린 뒤 시각을 고쳐 다시 등록해도 1)에서 걸러져
--             요청과 이어질 기회가 없었다.
--
-- 이 파일이 하는 일
--   A) [raw_ingest_buffer 앞단 트리거] 같은 BGA 토너먼트 번호(주소의 id=숫자)로 이미 올라간 글이 있으면
--      1) '본인이 올린, 요청과 연결 안 된 공지'이고 다시 보낸 값이 기존 함수와 똑같은 조건으로 OPEN 요청과 맞으면
--         → 잘못 올라간 공지와 그 부산물(소식 피드, 카톡 캘린더 일정, 중복 지급 +50P)만 정리하고 통과시킨다.
--           이후는 기존 함수가 새 등록처럼 처리하므로 요청 전환·포인트·쪽지·피드·캘린더 알림이 원래 방식 그대로 일어난다.
--      2) 그 외에는 "이미 등록된 토너먼트의 재등록"이므로, 주소를 기존 글의 주소로 맞춰서 기존 함수가 중복으로 걸러내게 한다
--         (새 글·포인트·알림이 만들어지지 않음).
--   B) [tournament_posts 앞단 트리거] 어떤 경로로든(웹 폼의 create_tournament_announcement 포함) 같은 토너먼트 번호의
--      공지를 또 INSERT 하려 하면 막는다(오류 메시지 반환, 같은 트랜잭션의 포인트 지급도 함께 취소됨).
--
-- 건드리지 않는 것
--   · 처음 보는 토너먼트 번호, 다른 종류의 이벤트: 그대로 기존 처리.
--   · 요청 행(type=REQUEST)의 INSERT 와 UPDATE(요청→공지 전환): B)는 공지 INSERT 에만 걸린다.
--   · 다른 사람이 올린 공지는 A-1)로 정리하지 않는다(등록자 본인 것만).
--
-- 안전장치
--   · A)에서 오류가 나면 모든 정리를 되돌리고(서브 트랜잭션) 경고만 남긴 채 기존 처리로 넘긴다 = 등록을 막지 않는다.
--   · 기존 트리거(trg_distribute_raw_data, 99-tr_auto_register_game)보다 먼저 실행되도록 이름이 00 으로 시작한다.
--   · 재실행해도 안전하다(함수/트리거를 덮어쓰기). 되돌리는 방법은 파일 맨 아래 주석 참고.
-- =====================================================================================


-- A) 재등록 처리 -----------------------------------------------------------------------
create or replace function public.trg_reconcile_tournament_announcement_ingest()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_url       text;
    v_tid       text;
    v_existing  public.tournament_posts%rowtype;
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

    v_url := new.payload->>'sourceUrl';
    v_tid := substring(coalesce(v_url, '') from '[?&]id=([0-9]+)');
    if v_tid is null then
        return new;                                     -- 토너먼트 번호를 못 읽으면 기존 처리에 맡김
    end if;

    -- 같은 BGA 토너먼트 번호로 이미 올라간 글 (요청과 연결 안 된 공지를 우선)
    select * into v_existing
      from public.tournament_posts
     where source_url ~ ('[?&]id=' || v_tid || '(&|$)')
     order by (type = 'ANNOUNCEMENT' and fulfilled_by is null) desc, id desc
     limit 1;
    if not found then
        return new;                                     -- 처음 보는 토너먼트: 기존 처리
    end if;

    -- A-1) 본인이 올린, 요청과 연결 안 된 공지를 고쳐서 다시 등록한 경우
    if v_existing.type = 'ANNOUNCEMENT' and v_existing.fulfilled_by is null then
        select id into v_author_id
          from public.profiles
         where lower(trim(full_name)) = lower(trim(new.payload->>'reporter'))
         limit 1;

        if v_author_id is not null and v_author_id is not distinct from v_existing.author_id then
            -- 다시 보낸 값을 기존 함수와 똑같이 해석
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

            -- 기존 함수와 똑같은 매칭 조건: 종목(대소문자·공백 무시) + 시작 시각 + 최대 인원, 오래된 요청 우선
            select id into v_req
              from public.tournament_posts
             where type = 'REQUEST' and status = 'OPEN'
               and lower(trim(game_name)) = lower(trim(new.payload->>'gameName'))
               and scheduled_date = v_when
               and max_participants = v_max
             order by created_at asc
             limit 1;

            if v_req is not null then
                -- 잘못 올라간 공지와 부산물 정리 (오류가 나면 아래 exception 으로 전부 되돌아간다)
                -- 카톡 캘린더 일정 취소 (기존 취소 함수를 같은 방식으로 호출; 호출은 커밋 뒤에 비동기로 나간다)
                for ev in
                    select source_type, source_id, user_id
                      from public.broadcast_kakao_events
                     where source_type = 'TOURNAMENT' and source_id = v_existing.id::text
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

                -- 소식 피드 (전환되는 요청에 대해 기존 트리거가 새 피드를 만든다)
                delete from public.news_feed_items
                 where link_type = 'TOURNAMENT' and link_id = v_existing.id::text;

                -- 이 공지를 등록할 때 지급된 +50P 회수 (기존 함수가 전환 포인트를 다시 지급하므로 이중 지급 방지)
                select id into v_award
                  from public.point_history
                 where user_id = v_existing.author_id and point_change = 50
                   and description = '🏆 토너먼트 직접 개최 (' || v_existing.title || ')'
                   and created_at between v_existing.created_at - interval '1 minute' and v_existing.created_at + interval '1 minute'
                 order by id desc
                 limit 1;
                if v_award is not null then
                    update public.profiles set points = points - 50 where id = v_existing.author_id;
                    insert into public.point_history (user_id, point_change, description)
                    values (v_existing.author_id, -50, '↩️ 정정 재등록으로 기존 공지 개최 포인트 회수 (' || v_existing.title || ')');
                end if;

                -- 공지 행 삭제 → 이후 기존 함수가 source_url 이 없는 새 등록으로 보고 요청을 전환한다
                delete from public.tournament_posts where id = v_existing.id;

                return new;
            end if;
        end if;
    end if;

    -- A-2) 이미 등록된 토너먼트의 재등록: 주소를 기존 글의 주소로 맞춰, 기존 함수가 중복으로 걸러내게 한다
    if v_existing.source_url is distinct from v_url then
        new.payload := jsonb_set(new.payload, '{sourceUrl}', to_jsonb(v_existing.source_url));
    end if;
    return new;

exception when others then
    raise warning '[rematch] 재등록 처리 실패(변경 없이 기존 처리로 넘김): %', sqlerrm;
    return new;
end;
$$;

drop trigger if exists "00_reconcile_tournament_announcement_ingest" on public.raw_ingest_buffer;
create trigger "00_reconcile_tournament_announcement_ingest"
    before insert on public.raw_ingest_buffer
    for each row execute function public.trg_reconcile_tournament_announcement_ingest();


-- B) 어떤 경로로든 같은 토너먼트 번호의 공지 중복 INSERT 를 막는다 -------------------------------
create or replace function public.trg_guard_duplicate_tournament_announcement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_tid text;
begin
    v_tid := substring(coalesce(new.source_url, '') from '[?&]id=([0-9]+)');
    if v_tid is null then
        return new;
    end if;
    if exists (select 1 from public.tournament_posts
                where source_url ~ ('[?&]id=' || v_tid || '(&|$)')) then
        raise exception '이미 등록된 토너먼트입니다. (BGA 토너먼트 번호 %)', v_tid using errcode = 'unique_violation';
    end if;
    return new;
end;
$$;

drop trigger if exists "00_guard_duplicate_tournament_announcement" on public.tournament_posts;
create trigger "00_guard_duplicate_tournament_announcement"
    before insert on public.tournament_posts
    for each row when (new.type = 'ANNOUNCEMENT')
    execute function public.trg_guard_duplicate_tournament_announcement();


-- =====================================================================================
-- 되돌리기 (필요할 때만 주석을 풀어 실행)
-- =====================================================================================
-- drop trigger  if exists "00_reconcile_tournament_announcement_ingest" on public.raw_ingest_buffer;
-- drop trigger  if exists "00_guard_duplicate_tournament_announcement"   on public.tournament_posts;
-- drop function if exists public.trg_reconcile_tournament_announcement_ingest();
-- drop function if exists public.trg_guard_duplicate_tournament_announcement();
