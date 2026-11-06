/**
 * [ROUND RP] 시즌 라운드(R1~R9)별 팀 RP 합계 + 라운드 순위
 *  - PC 랭킹(js/ranking.js)과 모바일 랭킹(js/mobile_team.js)이 같이 쓰는 계산/갱신 모듈.
 *    화면(마크업)은 각자 그리고, 데이터 조회·합산·순위·주기 갱신은 여기 한 곳에서만 한다.
 *
 * 집계 기준 (랭킹보드와 동일)
 *  - 팀 소속 선수의 인증 완료(is_verified = 0) 기록만. 무소속(b_all_team 없음)은 제외.
 *  - 조회는 v_boako_total_records 의 season_no / round_no / rp 만 사용 (DB 변경 없음).
 *
 * 순위 규칙
 *  - 그 라운드에 참여한 팀(= 그 라운드에 인증 완료 기록이 하나라도 있는 팀)만 순위를 받는다.
 *    참여하지 않은 팀은 순위도 LP도 없음(화면에는 "-").
 *  - RP 높은 순. 같으면 공동순위(1위, 1위, 3위) — 라운드 단위의 타이브레이커는 두지 않는다.
 *    (최종 우승을 가를 때만 타이브레이커를 쓴다)
 *
 * 갱신 방식 (리얼타임 아님, 브라우저 타이머)
 *  - 60초마다 "기록 건수"만 가볍게 확인하고, 건수가 바뀌었을 때만 전체를 다시 읽는다.
 *    (RP 수정처럼 건수가 안 바뀌는 변경을 놓치지 않도록 5번에 한 번은 무조건 다시 읽음)
 *  - 화면이 가려져 있거나(document.hidden) 그 화면을 떠났으면(isAlive=false) 멈춘다.
 *  - 끝난 시즌은 값이 바뀌지 않으므로 한 번만 읽는다(poll:false).
 */
window.Boako = window.Boako || {};
Boako.RoundRp = (function () {
    const ROUNDS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const PAGE = 1000;          // PostgREST 한 번에 최대 행 수
    const POLL_MS = 60000;
    const FULL_EVERY = 5;       // 건수가 같아도 5번에 한 번은 전체를 다시 읽음

    let timer = null;
    let gen = 0;                // start/stop 마다 올라가서, 늦게 끝난 이전 요청을 버린다

    function baseQuery(seasonNo, headOnly) {
        const q = Boako.db.from('v_boako_total_records');
        return (headOnly ? q.select('id', { count: 'exact', head: true }) : q.select('b_all_team, round_no, rp'))
            .eq('season_no', seasonNo).eq('is_verified', 0)
            .not('b_all_team', 'is', null).not('round_no', 'is', null);
    }

    async function countRows(seasonNo) {
        const { count, error } = await baseQuery(seasonNo, true);
        if (error) throw error;
        return count || 0;
    }

    async function fetchAllRows(seasonNo) {
        let rows = [];
        for (let from = 0; ; from += PAGE) {
            const { data, error } = await baseQuery(seasonNo, false)
                .order('created_at', { ascending: true }).order('id', { ascending: true })
                .range(from, from + PAGE - 1);
            if (error) throw error;
            rows = rows.concat(data || []);
            if (!data || data.length < PAGE) break;
        }
        return rows;
    }

    // 팀×라운드 합산 + 라운드별 공동순위
    function build(rows) {
        const rp = {}, plays = {};
        rows.forEach(r => {
            (rp[r.b_all_team] = rp[r.b_all_team] || {})[r.round_no] = ((rp[r.b_all_team] || {})[r.round_no] || 0) + (r.rp || 0);
            (plays[r.b_all_team] = plays[r.b_all_team] || {})[r.round_no] = ((plays[r.b_all_team] || {})[r.round_no] || 0) + 1;
        });
        const ranks = {};   // ranks[round][team] = { rank, tied }
        ROUNDS.forEach(n => {
            const list = Object.keys(rp).filter(t => rp[t][n] !== undefined).map(t => ({ t, v: rp[t][n] }));
            ranks[n] = {};
            list.forEach(a => {
                const higher = list.filter(b => b.v > a.v).length;
                const same = list.filter(b => b.v === a.v).length;
                ranks[n][a.t] = { rank: higher + 1, tied: same > 1 };
            });
        });
        return { rp, plays, ranks, currentRound: null };
    }

    // 진행 중인 라운드 (선택한 시즌이 지금 시즌일 때만)
    async function currentRoundOf(seasonNo) {
        try {
            const { data } = await Boako.db.rpc('get_season_info', { p_date: new Date().toISOString() });
            const info = Array.isArray(data) ? data[0] : data;
            return (info && info.season_no === seasonNo) ? (info.round_no || null) : null;
        } catch (e) { return null; }
    }

    async function load(seasonNo, wantCurrentRound) {
        const rows = await fetchAllRows(seasonNo);
        const data = build(rows);
        if (wantCurrentRound) data.currentRound = await currentRoundOf(seasonNo);
        return data;
    }

    function stop() {
        if (timer) { clearInterval(timer); timer = null; }
        gen++;
    }

    /**
     * opts.poll     : false 면 한 번만 읽는다(끝난 시즌)
     * opts.isAlive(): 그 화면이 아직 떠 있는지 — false 가 되면 갱신을 멈춘다
     * opts.onData(d): 새 데이터가 도착할 때(처음 한 번 + 값이 바뀌었을 때만) 호출
     */
    function start(seasonNo, opts) {
        stop();
        const my = gen;
        const poll = opts.poll !== false;
        let lastCount = -1, lastSig = '', tick = 0;

        async function run(force) {
            if (my !== gen) return;
            if (!opts.isAlive()) { stop(); return; }
            try {
                const c = poll ? await countRows(seasonNo) : -2;
                tick++;
                if (force || c !== lastCount || tick % FULL_EVERY === 0) {
                    const data = await load(seasonNo, poll);
                    if (my !== gen || !opts.isAlive()) return;
                    lastCount = c;
                    const sig = JSON.stringify([data.rp, data.ranks, data.currentRound]);
                    if (sig !== lastSig) { lastSig = sig; opts.onData(data); }
                }
            } catch (e) {
                console.warn('라운드 RP 갱신 실패:', e);
            }
        }

        run(true);
        if (poll) timer = setInterval(() => { if (!document.hidden) run(false); }, POLL_MS);
    }

    // 화면에서 쓰기 쉬운 형태: 해당 팀의 n라운드 값 (참여하지 않았으면 null)
    function cell(data, team, n) {
        if (!data || !data.rp[team] || data.rp[team][n] === undefined) return null;
        const r = data.ranks[n][team];
        return { rp: data.rp[team][n], rank: r.rank, tied: r.tied };
    }

    return { ROUNDS, start, stop, cell, build };
})();
