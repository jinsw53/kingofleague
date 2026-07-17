/**
 * [POWER ANALYSIS] 전력분석실 — 마이페이지 개인 통계 카드
 * 1. 활동량: 내 기록 수 ÷ 아카이브 전체 기록 수
 * 2. 탐험도: 플레이한 게임 종류 ÷ 전체 등록 게임 종류
 * 3. 전력 분석: 첫승 업적 횟수 / 가장 많이 기록한 게임 Top3 / 가장 많이 참여한 토너먼트 Top3
 * 4. 소속 히스토리: 어느 팀에 언제 있었는지 타임라인
 *
 * 🌟 개인 기록 자체는 팀 소속 여부와 무관하게 "내 활동 전체"를 보여주는 게 목적이므로
 *    무소속(Free Agent) 기록도 포함해서 집계한다. (기록실/랭킹보드의 팀 리그 전용 필터와는 다른 성격)
 */
Boako.PowerAnalysis = {

    buildUI: function(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="main-banner" style="background: linear-gradient(135deg, #4338ca 0%, #1e1b4b 100%); flex-direction:column; gap:6px;">
                <h1>🔬 전력분석실</h1>
                <p style="font-size:14px; font-weight:700; opacity:0.9;">${Boako.state.user?.nickname || ''} 님의 개인 활동 리포트</p>
            </div>
            <div id="pa-content-area">
                <div class="text-center py-20 text-slate-400 font-bold animate-pulse">데이터 분석 중...</div>
            </div>
        `;

        this.init();
    },

    init: async function() {
        const area = document.getElementById('pa-content-area');
        if (!area) return;
        if (!Boako.db || !Boako.state.user) {
            setTimeout(() => this.init(), 300);
            return;
        }

        const myNick = Boako.state.user.nickname;

        try {
            const [
                { data: myRows, error: myRowsErr },
                { count: totalRecordCount },
                { count: totalGameCount },
                { data: teamHistory },
                { data: tournamentRows }
            ] = await Promise.all([
                Boako.db.from('v_boako_total_records').select('game_name, is_first, rp').eq('nickname', myNick),
                Boako.db.from('v_boako_total_records').select('id', { count: 'exact', head: true }),
                Boako.db.from('games').select('id', { count: 'exact', head: true }),
                Boako.db.from('team_members').select('team_name, joined_at, left_at, is_active').eq('player_name', myNick).order('joined_at', { ascending: true }),
                Boako.db.from('boako_tournaments').select('tournament_name, players')
            ]);

            if (myRowsErr) throw myRowsErr;

            const rows = myRows || [];
            const myRecordCount = rows.length;
            const activityPct = totalRecordCount > 0 ? (myRecordCount / totalRecordCount * 100) : 0;

            const gameStats = {}; // game_name -> { count, rpSum }
            rows.forEach(r => {
                if (!r.game_name) return;
                if (!gameStats[r.game_name]) gameStats[r.game_name] = { count: 0, rpSum: 0 };
                gameStats[r.game_name].count += 1;
                gameStats[r.game_name].rpSum += (r.rp || 0);
            });

            const distinctGameCount = Object.keys(gameStats).length;
            const explorePct = totalGameCount > 0 ? (distinctGameCount / totalGameCount * 100) : 0;

            const firstWinCount = rows.filter(r => r.is_first == 1).length;

            const topRecordedGames = Object.entries(gameStats)
                .sort((a, b) => b[1].count - a[1].count)
                .slice(0, 3);

            // 🌟 [신규] 가장 많이 참여한 토너먼트: boako_tournaments.players(jsonb)에 내 닉네임이 참가자로 포함된 행을 tournament_name별로 집계
            const tournamentStats = {}; // tournament_name -> count
            (tournamentRows || []).forEach(t => {
                const players = Array.isArray(t.players) ? t.players : [];
                const isParticipant = players.some(p => p && p.name === myNick);
                if (!isParticipant || !t.tournament_name) return;
                tournamentStats[t.tournament_name] = (tournamentStats[t.tournament_name] || 0) + 1;
            });

            const topTournaments = Object.entries(tournamentStats)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3);

            this.render({
                myRecordCount, totalRecordCount: totalRecordCount || 0, activityPct,
                distinctGameCount, totalGameCount: totalGameCount || 0, explorePct,
                firstWinCount, topRecordedGames, topTournaments,
                teamHistory: teamHistory || []
            });

        } catch (err) {
            console.error('전력분석실 데이터 로드 실패:', err);
            area.innerHTML = `<div class="text-center py-20 text-red-400 font-bold">데이터를 불러오지 못했습니다.</div>`;
        }
    },

    formatDate: function(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    },

    render: function(stats) {
        const area = document.getElementById('pa-content-area');
        if (!area) return;

        const {
            myRecordCount, totalRecordCount, activityPct,
            distinctGameCount, totalGameCount, explorePct,
            firstWinCount, topRecordedGames, topTournaments,
            teamHistory
        } = stats;

        // ===== 1. 활동량 + 2. 탐험도 (나란히 배치) =====
        const activityHtml = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div class="section-card" style="margin-bottom:0;">
                    <div class="card-header" style="font-size:16px;">📊 활동량</div>
                    <div class="card-body" style="text-align:center; padding:30px;">
                        <div style="font-size:42px; font-weight:950; color:#4338ca; line-height:1;">${activityPct.toFixed(1)}%</div>
                        <p style="color:#64748b; font-weight:700; font-size:13px; margin-top:10px;">
                            아카이브 전체 ${totalRecordCount.toLocaleString()}건 중 내 기록 <b style="color:#4338ca;">${myRecordCount.toLocaleString()}건</b>
                        </p>
                        <div style="width:100%; background:#f1f5f9; height:8px; border-radius:99px; margin-top:16px; overflow:hidden;">
                            <div style="width:${Math.min(100, activityPct)}%; background:linear-gradient(90deg,#4338ca,#7c3aed); height:100%; border-radius:99px;"></div>
                        </div>
                    </div>
                </div>
                <div class="section-card" style="margin-bottom:0;">
                    <div class="card-header" style="font-size:16px;">🗺️ 탐험도</div>
                    <div class="card-body" style="text-align:center; padding:30px;">
                        <div style="font-size:42px; font-weight:950; color:#0891b2; line-height:1;">${explorePct.toFixed(1)}%</div>
                        <p style="color:#64748b; font-weight:700; font-size:13px; margin-top:10px;">
                            등록된 게임 ${totalGameCount.toLocaleString()}종 중 <b style="color:#0891b2;">${distinctGameCount.toLocaleString()}종</b> 플레이
                        </p>
                        <div style="width:100%; background:#f1f5f9; height:8px; border-radius:99px; margin-top:16px; overflow:hidden;">
                            <div style="width:${Math.min(100, explorePct)}%; background:linear-gradient(90deg,#0891b2,#06b6d4); height:100%; border-radius:99px;"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // ===== 3. 전력 분석 =====
        const recordedGamesHtml = topRecordedGames.length === 0
            ? `<div class="text-center text-slate-400 font-bold py-6 text-sm">아직 기록이 없습니다.</div>`
            : topRecordedGames.map(([name, s], idx) => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:#f8fafc; border-radius:10px; margin-bottom:8px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="font-size:16px;">${idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</span>
                        <span style="font-weight:800; color:#1e293b;">${name}</span>
                    </div>
                    <span style="font-weight:900; color:#4338ca; font-size:13px;">${s.count}회</span>
                </div>
            `).join('');

        const tournamentsHtml = topTournaments.length === 0
            ? `<div class="text-center text-slate-400 font-bold py-6 text-sm">참여한 토너먼트가 없습니다.</div>`
            : topTournaments.map(([name, count], idx) => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:#fffbeb; border-radius:10px; margin-bottom:8px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="font-size:16px;">${idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</span>
                        <span style="font-weight:800; color:#1e293b;">${name}</span>
                    </div>
                    <span style="font-weight:900; color:#d97706; font-size:13px;">${count}회 참여</span>
                </div>
            `).join('');

        const powerAnalysisHtml = `
            <section class="section-card">
                <div class="card-header" style="font-size:16px;">⚔️ 전력 분석</div>
                <div class="card-body">
                    <div style="display:flex; align-items:center; gap:14px; background:linear-gradient(135deg,#fef2f2,#fff); border:1px solid #fecaca; border-radius:14px; padding:20px; margin-bottom:24px;">
                        <span style="font-size:32px;">🏅</span>
                        <div>
                            <div style="font-size:12px; font-weight:800; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em;">BGA 첫승 업적</div>
                            <div style="font-size:24px; font-weight:950; color:#dc2626;">${firstWinCount}회 달성</div>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h4 style="font-weight:900; font-size:14px; margin-bottom:12px; color:#1e293b;">🎲 가장 많이 기록한 게임</h4>
                            ${recordedGamesHtml}
                        </div>
                        <div>
                            <h4 style="font-weight:900; font-size:14px; margin-bottom:12px; color:#1e293b;">🏆 가장 많이 참여한 토너먼트</h4>
                            ${tournamentsHtml}
                        </div>
                    </div>
                </div>
            </section>
        `;

        // ===== 4. 소속 히스토리 =====
        const historyHtml = teamHistory.length === 0
            ? `<div class="text-center text-slate-400 font-bold py-10">소속 이력이 없습니다.</div>`
            : `
            <div style="position:relative; padding-left:24px;">
                <div style="position:absolute; left:6px; top:6px; bottom:6px; width:2px; background:#e2e8f0;"></div>
                ${teamHistory.map(t => {
                    const isCurrent = t.is_active && !t.left_at;
                    return `
                    <div style="position:relative; margin-bottom:20px;">
                        <div style="position:absolute; left:-24px; top:4px; width:12px; height:12px; border-radius:50%; background:${isCurrent ? '#4338ca' : '#cbd5e1'}; border:2px solid #fff; box-shadow:0 0 0 2px ${isCurrent ? '#c7d2fe' : '#f1f5f9'};"></div>
                        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                            <span style="font-weight:900; font-size:15px; color:#1e293b;">${t.team_name}</span>
                            ${isCurrent ? `<span style="background:#eef2ff; color:#4338ca; font-size:10px; font-weight:900; padding:3px 8px; border-radius:99px;">현재 소속중</span>` : ''}
                        </div>
                        <div style="font-size:12px; color:#94a3b8; font-weight:700; margin-top:4px;">
                            ${Boako.PowerAnalysis.formatDate(t.joined_at)} ~ ${isCurrent ? '현재' : Boako.PowerAnalysis.formatDate(t.left_at)}
                        </div>
                    </div>
                `}).join('')}
            </div>
        `;

        const historySectionHtml = `
            <section class="section-card">
                <div class="card-header" style="font-size:16px;">🛡️ 소속 히스토리</div>
                <div class="card-body">${historyHtml}</div>
            </section>
        `;

        area.innerHTML = activityHtml + powerAnalysisHtml + historySectionHtml;
    }
};
