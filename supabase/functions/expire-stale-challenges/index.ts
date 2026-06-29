import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * expire-stale-challenges
 * 시즌 종료 시, 완료되지 않고 방치된 챌린지를 EXPIRED로 폐기 처리하는 Edge Function.
 *
 * 폐기 대상 status:
 *   - PENDING       : 응전 없이 방치
 *   - NEGOTIATING   : 협상 중 방치
 *   - ROSTER_WAITING: 로스터 미제출
 *   - UPCOMING      : 경기 미진행
 *   - IN_PROGRESS   : 진행 중 방치
 *   - RESULT_PENDING: 결과 미입력
 *
 * 호출 방법:
 *   POST /functions/v1/expire-stale-challenges
 *   Body (선택): { "season_no": 1 }  → 특정 시즌만 처리
 *   Body 없음   → 종료된 모든 시즌 자동 처리
 */

const EXPIRE_STATUSES = [
  'PENDING',
  'NEGOTIATING',
  'ROSTER_WAITING',
  'UPCOMING',
  'IN_PROGRESS',
  'RESULT_PENDING'
];

Deno.serve(async (req: Request) => {
  try {
    // 간단한 시크릿 키 검증 (선택)
    const authHeader = req.headers.get('Authorization');
    const cronSecret = Deno.env.get('CRON_SECRET');
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: '인증 실패' }), { status: 401 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 요청 본문에서 특정 시즌 번호 파싱 (없으면 자동 탐색)
    let targetSeasonNo: number | null = null;
    try {
      const body = await req.json();
      if (body?.season_no) targetSeasonNo = Number(body.season_no);
    } catch (_) { /* body 없어도 정상 */ }

    // 1. 처리할 시즌 목록 조회 (end_date < 지금)
    let seasonsQuery = supabase
      .from('seasons')
      .select('season_no, title, end_date')
      .lt('end_date', new Date().toISOString());

    if (targetSeasonNo !== null) {
      seasonsQuery = seasonsQuery.eq('season_no', targetSeasonNo);
    }

    const { data: endedSeasons, error: seasonErr } = await seasonsQuery;

    if (seasonErr) throw new Error(`시즌 조회 실패: ${seasonErr.message}`);
    if (!endedSeasons || endedSeasons.length === 0) {
      return new Response(
        JSON.stringify({ message: '처리할 종료 시즌 없음', results: [] }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    const results = [];

    for (const season of endedSeasons) {
      // 2. 해당 시즌의 폐기 대상 챌린지 조회
      const { data: staleChallenges, error: fetchErr } = await supabase
        .from('challenges')
        .select('id, status, attacker_team_id, defender_team_id, attacker_team_name, defender_team_name')
        .eq('season_no', season.season_no)
        .in('status', EXPIRE_STATUSES);

      if (fetchErr) {
        results.push({ season_no: season.season_no, error: fetchErr.message });
        continue;
      }

      if (!staleChallenges || staleChallenges.length === 0) {
        results.push({
          season_no: season.season_no,
          title: season.title,
          expired_count: 0,
          message: '폐기 대상 없음'
        });
        continue;
      }

      // 3. EXPIRED 일괄 처리
      const staleIds = staleChallenges.map(c => c.id);
      const { error: updateErr } = await supabase
        .from('challenges')
        .update({
          status: 'EXPIRED',
          updated_at: new Date().toISOString()
        })
        .in('id', staleIds);

      if (updateErr) {
        results.push({ season_no: season.season_no, error: updateErr.message });
        continue;
      }

      const summary = staleChallenges.map(c => ({
        id: c.id,
        prev_status: c.status,
        attacker: c.attacker_team_name,
        defender: c.defender_team_name
      }));

      results.push({
        season_no: season.season_no,
        title: season.title,
        end_date: season.end_date,
        expired_count: staleChallenges.length,
        expired_challenges: summary
      });

      console.log(
        `[expire-stale-challenges] 시즌 ${season.season_no} - ${staleChallenges.length}개 챌린지 EXPIRED 처리 완료`
      );
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('[expire-stale-challenges] 오류:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
