-- 팀챗 시간 9시간 빠르게 저장되는 문제 수정 (2026-11-27)
-- 원인: team_chats.created_at 기본값이 timezone('utc', now())
--       → "UTC 기준 시계 숫자"만 뽑은 뒤, DB 시간대(Asia/Seoul)로 다시 해석해서 9시간 이른 시각이 됨.
-- 수정: 기본값을 now()로 (시각 자체를 저장, 표시는 화면에서 KST로).

begin;

alter table public.team_chats alter column created_at set default now();

-- 기존 14건 보정 (+9시간). 전부 같은 기본값으로 들어간 행이라 똑같이 밀려 있음.
update public.team_chats set created_at = created_at + interval '9 hours';

-- 확인: 가장 최근 메시지가 실제 보낸 시각(11/27 17:51 KST)으로 보여야 함
select id, created_at from public.team_chats order by id desc limit 3;

commit;

-- 참고: shop_items.created_at 기본값 (now() AT TIME ZONE 'Asia/Seoul')는 DB 시간대가 Seoul인 지금은 결과가 맞음.
--       DB 시간대가 바뀌면 틀어지므로 같이 now()로 바꿔두는 게 안전함(아래 한 줄, 기존 데이터는 그대로 둠).
alter table public.shop_items alter column created_at set default now();
