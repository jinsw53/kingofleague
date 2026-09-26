/**
 * [POWER ANALYSIS] 전력분석실 — 마이페이지 개인 통계 카드
 * 1. 활동량: 내 기록 수 ÷ 아카이브 전체 기록 수
 * 2. 탐험도: 플레이한 게임 종류 ÷ 전체 등록 게임 종류
 * 3. 전력 분석: 첫승 업적 횟수 / 가장 많이 기록한 게임 Top3 / 가장 많이 참여한 토너먼트 종목 Top3
 * 4. 소속 히스토리: 어느 팀에 언제 있었는지 타임라인
 *
 * 🌟 개인 기록 자체는 팀 소속 여부와 무관하게 "내 활동 전체"를 보여주는 게 목적이므로
 *    무소속(Free Agent) 기록도 포함해서 집계한다. (기록실/랭킹보드의 팀 리그 전용 필터와는 다른 성격)
 * 🌟 [신규] 탐험도 카드 — 진행바 아래에 실제로 플레이한 게임 로고를 최대 6개 겹쳐서 미리보기로
 *    보여주고, 카드를 클릭하면 openExploredGamesModal()이 전체 목록을 로고+게임명+횟수 그리드로
 *    보여줌. 모바일(mobile_power_analysis.js)도 이 모달 함수를 그대로 재사용.
 * 🌟 [수정] 모달 그리드의 로고 이미지에 loading="lazy"/decoding="async" 추가 — 플레이한 게임이
 *    많을 때 모달을 여는 즉시 전부 다운로드 요청이 몰리지 않고, 스크롤해서 보이는 만큼만
 *    브라우저가 순차적으로 불러오도록 함. 모달 자체(텍스트/그리드 틀)는 항상 즉시 뜸.
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
                Boako.db.from('boako_tournaments').select('game_name, players')
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

            // 🌟 [신규] 탐험도 카드에서 "내가 실제로 어떤 게임을 했는지" 로고로 보여주기 위한 목록.
            // 게임 수가 많을 수도 있어서 로고는 games 테이블에서 한 번에 조회.
            const playedGameNames = Object.keys(gameStats);
            let playedGamesList = [];
            if (playedGameNames.length > 0) {
                const { data: gamesData } = await Boako.db.from('games').select('game_name, image_url').in('game_name', playedGameNames);
                const logoMap = Object.fromEntries((gamesData || []).map(g => [g.game_name, g.image_url]));
                playedGamesList = playedGameNames
                    .map(name => ({ name, count: gameStats[name].count, logo: logoMap[name] || null }))
                    .sort((a, b) => b.count - a.count);
            }

            const firstWinCount = rows.filter(r => r.is_first == 1).length;

            const topRecordedGames = Object.entries(gameStats)
                .sort((a, b) => b[1].count - a[1].count)
                .slice(0, 3);

            // 🌟 [수정] 가장 많이 참여한 토너먼트 "종목": 토너먼트 명칭(tournament_name)은 전부 "BOAKO..."로 시작해 변별력이 없으므로,
            // boako_tournaments.players(jsonb)에 내 닉네임이 참가자로 포함된 행을 game_name(어떤 게임의 토너먼트였는지)별로 집계
            const tournamentGameStats = {}; // game_name -> count
            (tournamentRows || []).forEach(t => {
                const players = Array.isArray(t.players) ? t.players : [];
                const isParticipant = players.some(p => p && p.name === myNick);
                if (!isParticipant || !t.game_name) return;
                tournamentGameStats[t.game_name] = (tournamentGameStats[t.game_name] || 0) + 1;
            });

            const topTournamentGames = Object.entries(tournamentGameStats)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3);

            this.render({
                myRecordCount, totalRecordCount: totalRecordCount || 0, activityPct,
                distinctGameCount, totalGameCount: totalGameCount || 0, explorePct,
                playedGamesList,
                firstWinCount, topRecordedGames, topTournamentGames,
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
            playedGamesList,
            firstWinCount, topRecordedGames, topTournamentGames,
            teamHistory
        } = stats;

        // 🌟 모달에서 참조할 수 있도록 저장해둠 (openExploredGamesModal이 인자 없이 호출되므로)
        this._playedGamesList = playedGamesList || [];

        // 🌟 탐험도 카드 안, 진행바 아래에 보여줄 미리보기 로고 (많이 한 순 최대 6개, 겹쳐서 스택)
        const previewLogos = this._playedGamesList.slice(0, 6).map((g, idx) => `
            <img src="${g.logo ? Boako.Util.cdn(g.logo) : PA_DEFAULT_LOGO}" title="${g.name}"
                 style="width:28px; height:28px; border-radius:8px; object-fit:contain; background:#f8fafc; border:2px solid #fff; box-shadow:0 1px 3px rgba(0,0,0,0.15); margin-left:${idx === 0 ? '0' : '-10px'}; position:relative; z-index:${10 - idx};">
        `).join('');
        const explorePreviewHtml = this._playedGamesList.length > 0
            ? `<div style="display:flex; align-items:center; justify-content:center; margin-top:14px;">${previewLogos}</div>
               <div style="font-size:10.5px; color:#0891b2; font-weight:800; margin-top:8px;">탭해서 전체 보기 →</div>`
            : '';

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
                <div class="section-card" style="margin-bottom:0; cursor:pointer;" onclick="Boako.PowerAnalysis.openExploredGamesModal()">
                    <div class="card-header" style="font-size:16px;">🗺️ 탐험도</div>
                    <div class="card-body" style="text-align:center; padding:30px;">
                        <div style="font-size:42px; font-weight:950; color:#0891b2; line-height:1;">${explorePct.toFixed(1)}%</div>
                        <p style="color:#64748b; font-weight:700; font-size:13px; margin-top:10px;">
                            등록된 게임 ${totalGameCount.toLocaleString()}종 중 <b style="color:#0891b2;">${distinctGameCount.toLocaleString()}종</b> 플레이
                        </p>
                        <div style="width:100%; background:#f1f5f9; height:8px; border-radius:99px; margin-top:16px; overflow:hidden;">
                            <div style="width:${Math.min(100, explorePct)}%; background:linear-gradient(90deg,#0891b2,#06b6d4); height:100%; border-radius:99px;"></div>
                        </div>
                        ${explorePreviewHtml}
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

        const tournamentGamesHtml = topTournamentGames.length === 0
            ? `<div class="text-center text-slate-400 font-bold py-6 text-sm">참여한 토너먼트가 없습니다.</div>`
            : topTournamentGames.map(([name, count], idx) => `
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
                            <h4 style="font-weight:900; font-size:14px; margin-bottom:12px; color:#1e293b;">🏆 가장 많이 참여한 토너먼트 종목</h4>
                            ${tournamentGamesHtml}
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
    },

    // 🌟 [신규] 탐험도 카드 클릭 시 — 내가 실제로 플레이한 게임을 로고와 함께 전부 보여주는 모달.
    // 좁은 카드 공간에는 미리보기 6개만 겹쳐서 보여주고, 전체 목록(수십 종일 수 있음)은 여기서 그리드로.
    openExploredGamesModal: function() {
        if (document.getElementById('pa-explore-modal-overlay')) return;
        const list = this._playedGamesList || [];

        const gridHtml = list.length === 0
            ? `<div class="text-center text-slate-400 font-bold py-10">아직 플레이한 게임이 없습니다.</div>`
            : `<div class="grid grid-cols-3 sm:grid-cols-4 gap-3">
                ${list.map(g => `
                    <div class="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-slate-200 bg-slate-50">
                        <img src="${g.logo ? Boako.Util.cdn(g.logo) : PA_DEFAULT_LOGO}" loading="lazy" decoding="async" class="w-12 h-12 rounded-lg object-contain bg-white border border-slate-100 p-1">
                        <span class="text-xs font-black text-slate-700 text-center leading-tight">${g.name}</span>
                        <span class="text-[10px] font-bold text-cyan-600">${g.count}회</span>
                    </div>
                `).join('')}
              </div>`;

        const modalHtml = `
            <div id="pa-explore-modal-overlay" class="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4" onclick="if(event.target===this) Boako.PowerAnalysis.closeExploredGamesModal()">
                <div class="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="font-black text-lg">🗺️ 내가 플레이한 게임 ${list.length}종</h3>
                        <button onclick="Boako.PowerAnalysis.closeExploredGamesModal()" class="text-slate-400 font-black text-xl">×</button>
                    </div>
                    ${gridHtml}
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    closeExploredGamesModal: function() {
        document.getElementById('pa-explore-modal-overlay')?.remove();
    }
};

// 게임 로고를 못 찾았을 때 대체용
const PA_DEFAULT_LOGO = 'https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challenge%20(1).png';
