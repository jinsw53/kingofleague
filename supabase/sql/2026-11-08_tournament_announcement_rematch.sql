-- =====================================================================================
-- [토너먼트] 잘못 올라간 공지를 나중에 고치면, 그 요청의 공지로 인정하는 기능
--
-- 배경
--   · 매월/매주 시스템이 '개최 요청(REQUEST, OPEN)'을 자동으로 만든다. 사용자가 BGA 에서 토너먼트를 열고
--     크롬 확장으로 등록하면, 요청과 맞을 때 그 요청이 '공지(ANNOUNCEMENT)'로 바뀐다.
--   · 시각이나 종목이 어긋난 채로 등록하면(예: 21:00 요청인데 21:33 토너먼트) 요청과 연결되지 않은
--     별개의 공지가 생긴다. 고쳐서 다시 등록해도 "이미 등록된 토너먼트"로 무시되어 요청과 이어지지 않았다.
--
-- 이 파일이 하는 일
--   1) 같은 BGA 토너먼트(주소의 id=숫자)를 고쳐서 다시 등록하면, 무시하지 않고 기존 공지를 새 값으로 갱신한 뒤
--      요청과 다시 맞춰 본다.  (raw_ingest_buffer 앞단 트리거: 00_reconcile_tournament_announcement_ingest)
--   2) 요청과 맞으면 '요청 행'이 공지로 바뀌고(기존 성공 사례와 같은 모양), 따로 만들어졌던 공지는 정리된다.
--      소식 피드도 요청 쪽으로 옮겨 하나만 남긴다.
--   3) 공지의 시각/종목을 직접 고친 경우(관리자 수정 등)에도 자동으로 다시 맞춰 본다.
--      (tournament_posts 트리거: trg_rematch_tournament_announcement)
--   4) 놓친 건을 한 번에 훑는 함수 fn_rematch_tournament_announcements() — 수동 실행/예약 실행용.
--
-- 안전장치
--   · 새 등록(같은 토너먼트 번호가 없는 경우)과 이미 요청과 연결된 공지는 건드리지 않고 기존 처리에 그대로 맡긴다.
--   · 이 기능 안에서 오류가 나도 등록 자체를 막지 않는다(경고만 남기고 기존 처리로 넘김).
--   · 재실행해도 안전하다(함수/트리거를 덮어쓰기). 되돌리는 방법은 파일 맨 아래 주석 참고.
--
-- ⚠️ 매칭 조건 가정
--   요청과 맞는 조건은 "종목 같음 + 시작 시각(분 단위) 같음" 으로 구현했다. 기존에 요청↔공지를 이어주는 함수의 정의를
--   확인하지 못한 상태에서 데이터(이어진 29건이 모두 :00 시작)로 추정한 것이므로, 기존 조건이 다르면
--   fn_find_open_request_for() 한 곳만 고치면 전체에 반영된다.
-- =====================================================================================


-- 1) 매칭 조건 — 이 함수만 바꾸면 조건이 바뀐다 ---------------------------------------------
create or replace function public.fn_find_open_request_for(p_game text, p_when timestamptz)
returns bigint
language sql
stable
as $$
    select r.id
      from public.tournament_posts r
     where r.type = 'REQUEST'
       and r.status = 'OPEN'
       and coalesce(r.convert_to_announcement, true)            -- 요청이 "공지로 전환" 허용일 때만
       and p_game is not null and r.game_name = p_game
       and p_when is not null
       and date_trunc('minute', r.scheduled_date) = date_trunc('minute', p_when)
     order by r.created_at, r.id
     limit 1
$$;


-- 2) 요청과 맞는 공지를 요청으로 흡수 ------------------------------------------------------
--    반환: 흡수한 요청 id (맞는 요청이 없거나 대상이 아니면 NULL)
create or replace function public.fn_absorb_announcement_into_request(p_announcement_id bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
    a   public.tournament_posts%rowtype;
    req bigint;
    r   public.tournament_posts%rowtype;
begin
    select * into a from public.tournament_posts where id = p_announcement_id for update;
    if not found or a.type <> 'ANNOUNCEMENT' or a.fulfilled_by is not null or a.source_url is null then
        return null;                                            -- 이미 요청과 연결됐거나 대상이 아님
    end if;

    req := public.fn_find_open_request_for(a.game_name, a.scheduled_date);
    if req is null then
        return null;
    end if;

    select * into r from public.tournament_posts where id = req for update skip locked;
    if not found or r.status <> 'OPEN' then
        return null;                                            -- 동시에 다른 곳이 처리 중
    end if;

    -- 소식 피드를 요청 쪽으로 옮긴다 (기존 사례: 제목은 "토너먼트 개최: " + 요청 제목, 링크는 요청 번호)
    update public.news_feed_items
       set link_id = r.id::text,
           title   = '토너먼트 개최: ' || r.title
     where link_type = 'TOURNAMENT' and link_id = a.id::text;

    -- 같은 BGA 주소가 두 글에 걸려 충돌하지 않도록 따로 생긴 공지를 먼저 지운다
    delete from public.tournament_posts where id = a.id;

    -- 요청을 공지로 전환 (기존 성공 사례와 같은 모양: 요청 제목 유지, 처리자/처리 시각 기록, BGA 주소 연결)
    update public.tournament_posts
       set type         = 'ANNOUNCEMENT',
           status       = 'FULFILLED',
           source_url   = a.source_url,
           fulfilled_by = coalesce(a.author_id, r.author_id),
           fulfilled_at = now(),
           max_participants = coalesce(max_participants, a.max_participants)
     where id = r.id;

    -- 전환 때 피드를 자동으로 만드는 트리거가 있으면 피드가 둘이 되므로, 같은 글을 가리키는 피드는 가장 먼저 만든 하나만 남긴다
    delete from public.news_feed_items f
     where f.link_type = 'TOURNAMENT' and f.link_id = r.id::text
       and f.id <> (select min(id) from public.news_feed_items
                     where link_type = 'TOURNAMENT' and link_id = r.id::text);

    return r.id;
end;
$$;


-- 3) 공지의 시각/종목을 직접 고친 경우 자동 재확인 ----------------------------------------------
create or replace function public.trg_rematch_tournament_announcement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    -- 우리 함수가 일으킨 변경(트리거 깊이 2 이상)은 다시 처리하지 않는다
    if pg_trigger_depth() > 1 then
        return null;
    end if;
    if new.type = 'ANNOUNCEMENT' and new.fulfilled_by is null then
        begin
            perform public.fn_absorb_announcement_into_request(new.id);
        exception when others then
            raise warning '[rematch] 공지 % 재확인 실패(무시): %', new.id, sqlerrm;   -- 수정 자체는 막지 않는다
        end;
    end if;
    return null;
end;
$$;

drop trigger if exists trg_rematch_tournament_announcement on public.tournament_posts;
create trigger trg_rematch_tournament_announcement
    after update of scheduled_date, game_name on public.tournament_posts
    for each row execute function public.trg_rematch_tournament_announcement();


-- 4) 고쳐서 다시 등록한 경우 (확장 → raw_ingest_buffer) -----------------------------------------
--    같은 BGA 토너먼트 번호로 이미 올라가 있고 요청과 연결 안 된 공지가 있으면: 새 값으로 갱신 → 요청과 재확인.
--    그 외(새 토너먼트, 이미 요청과 연결된 공지)는 아무것도 하지 않고 기존 처리에 그대로 넘긴다.
--    확장이 보내는 payload: title, gameName, sourceUrl, reporter, maxParticipants, scheduledDate('2027-02-01T21:00:00', 한국 시각)
create or replace function public.trg_reconcile_tournament_announcement_ingest()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_url     text;
    v_tid     text;
    v_post_id bigint;
    v_raw     text;
    v_when    timestamptz;
    v_max     text;
begin
    if new.data_type is distinct from 'TOURNAMENT_ANNOUNCEMENT' then
        return new;
    end if;

    v_url := new.payload->>'sourceUrl';
    v_tid := substring(coalesce(v_url, '') from '[?&]id=([0-9]+)');
    if v_tid is null then
        return new;
    end if;

    select id into v_post_id
      from public.tournament_posts
     where type = 'ANNOUNCEMENT' and fulfilled_by is null
       and source_url ~ ('[?&]id=' || v_tid || '(&|$)')
     order by id desc
     limit 1;
    if v_post_id is null then
        return new;                                             -- 새 등록이거나 이미 처리된 건: 기존 처리에 맡김
    end if;

    -- 시간대가 붙어 있으면 그대로, 없으면 한국 시각으로 해석 (기존 등록 결과가 +09:00 으로 저장된 것과 동일)
    v_raw := nullif(new.payload->>'scheduledDate', '');
    if v_raw is not null then
        v_when := case when v_raw ~ '(Z|[+-][0-9]{2}(:?[0-9]{2})?)$'
                       then v_raw::timestamptz
                       else (v_raw::timestamp) at time zone 'Asia/Seoul' end;
    end if;
    v_max := new.payload->>'maxParticipants';

    update public.tournament_posts
       set title            = coalesce(nullif(new.payload->>'title', ''), title),
           game_name        = coalesce(nullif(new.payload->>'gameName', ''), game_name),
           scheduled_date   = coalesce(v_when, scheduled_date),
           max_participants = case when v_max ~ '^[0-9]+$' then v_max::int else max_participants end,
           source_url       = coalesce(nullif(v_url, ''), source_url)
     where id = v_post_id;

    perform public.fn_absorb_announcement_into_request(v_post_id);

    return null;                                                -- 갱신으로 처리했으니 "이미 등록됨" 처리로 넘기지 않는다
exception when others then
    raise warning '[rematch] 재등록 처리 실패(기존 처리로 넘김): %', sqlerrm;   -- 등록 자체를 막지 않는다
    return new;
end;
$$;

drop trigger if exists "00_reconcile_tournament_announcement_ingest" on public.raw_ingest_buffer;
create trigger "00_reconcile_tournament_announcement_ingest"
    before insert on public.raw_ingest_buffer
    for each row execute function public.trg_reconcile_tournament_announcement_ingest();


-- 5) 놓친 건을 한 번에 훑기 (수동 실행 또는 예약 실행용) ------------------------------------------
--    예) select public.fn_rematch_tournament_announcements();   → 흡수한 건수
create or replace function public.fn_rematch_tournament_announcements()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    rec record;
    n   integer := 0;
begin
    for rec in
        select id from public.tournament_posts
         where type = 'ANNOUNCEMENT' and fulfilled_by is null
         order by id
    loop
        begin
            if public.fn_absorb_announcement_into_request(rec.id) is not null then
                n := n + 1;
            end if;
        exception when others then
            raise warning '[rematch] 공지 % 재확인 실패(건너뜀): %', rec.id, sqlerrm;
        end;
    end loop;
    return n;
end;
$$;

-- 이 함수들은 서버 안에서만 쓴다 (브라우저에서 직접 호출 못 하게)
revoke all on function public.fn_absorb_announcement_into_request(bigint) from public, anon, authenticated;
revoke all on function public.fn_rematch_tournament_announcements()        from public, anon, authenticated;


-- =====================================================================================
-- 되돌리기 (필요할 때만 주석을 풀어 실행)
-- =====================================================================================
-- drop trigger  if exists "00_reconcile_tournament_announcement_ingest" on public.raw_ingest_buffer;
-- drop trigger  if exists trg_rematch_tournament_announcement            on public.tournament_posts;
-- drop function if exists public.trg_reconcile_tournament_announcement_ingest();
-- drop function if exists public.trg_rematch_tournament_announcement();
-- drop function if exists public.fn_rematch_tournament_announcements();
-- drop function if exists public.fn_absorb_announcement_into_request(bigint);
-- drop function if exists public.fn_find_open_request_for(text, timestamptz);
