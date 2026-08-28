/**
 * [MOBILE POWER ANALYSIS] 모바일 전용 — 전력분석실 (마이페이지 개인 통계)
 * 🌟 [재사용 원칙] js/power_analysis.js의 데이터 조회/집계 로직(init() 안의 Promise.all + 통계 계산)은
 *    PC 전용 DOM에 전혀 의존하지 않는 순수 계산이라 그대로 재사용함. 유일한 문제는 render() 함수가
 *    PC index.html에만 정의된 커스텀 CSS 클래스(.main-banner, .section-card, .card-header,
 *    .card-body)를 쓰는데, 모바일엔 이 스타일 정의 자체가 없어서 그대로 쓰면 카드 모양이 하나도
 *    안 나오고 밋밋한 텍스트만 나열됨.
 * 🌟 [버그 회피] power_analysis.js 파일 자체는 수정하지 않고, Boako.PowerAnalysis.render를
 *    모바일 세션에서만 완전히 다른(인라인 스타일 기반) 구현으로 교체함 — init()이 계산을 끝내고
 *    this.render(stats)를 호출하면, 교체된 이 함수가 대신 실행되어 동일한 stats 데이터를
 *    모바일 카드 UI로 그림. init()/buildUI() 자체는 건드리지 않고, buildUI() 대신 이 파일에서
 *    직접 배너+placeholder를 그린 뒤 init()만 호출함(배너도 PC 전용 클래스를 쓰므로 재사용 불가).
 * 🌟 [버그수정] 배너 텍스트가 왼쪽 정렬돼있었음 — PC .main-banner는 가운데 정렬인데 그 클래스가
 *    모바일엔 정의돼있지 않아 정렬이 다르게 보임. 인라인으로 직접 가운데 정렬 속성을 추가함.
 */
window.Boako = window.Boako || {};
Boako.MobilePowerAnalysis = {

    _patched: false,

    _ensurePatched: () => {
        if (Boako.MobilePowerAnalysis._patched) return;
        Boako.MobilePowerAnalysis._patched = true;
        Boako.PowerAnalysis.render = function (stats) { Boako.MobilePowerAnalysis._render(stats); };
    },

    render: async (container) => {
        // 🌟 스크립트 로드가 먼저 끝나야 함 — power_analysis.js는 객체 리터럴 통째 할당이라,
        // 패치보다 로드가 늦으면 방금 건 패치가 그대로 덮어써져 사라짐
        if (!Boako.PowerAnalysis) await Boako.Util.loadScript('/js/power_analysis.js');
        Boako.MobilePowerAnalysis._ensurePatched();

        container.innerHTML = `
            <div style="background:linear-gradient(135deg,#4338ca,#1e1b4b); border-radius:16px; padding:20px; margin-bottom:14px; color:#fff; display:flex; flex-direction:column; align-items:center; text-align:center;">
                <div style="font-size:17px; font-weight:900;">🔬 전력분석실</div>
                <div style="font-size:11.5px; font-weight:700; opacity:0.85; margin-top:4px;">${Boako.MobilePowerAnalysis.escapeHtml(Boako.state.user?.nickname || '')} 님의 개인 활동 리포트</div>
            </div>
            <div id="pa-content-area">
                <div style="text-align:center; padding:60px 0; color:#94a3b8; font-weight:700; font-size:13px;">데이터 분석 중...</div>
            </div>
        `;

        // 🌟 데이터 조회/집계는 PC와 완전히 동일한 함수 그대로 실행 (계산 끝나면 위에서 교체한 render가 대신 그림)
        Boako.PowerAnalysis.init();
    },

    _render: (stats) => {
        const area = document.getElementById('pa-content-area');
        if (!area) return;

        const {
            myRecordCount, totalRecordCount, activityPct,
            distinctGameCount, totalGameCount, explorePct,
            firstWinCount, topRecordedGames, topTournamentGames,
            teamHistory
        } = stats;

        // ===== 1. 활동량 + 2. 탐험도 =====
        const statsHtml = `
            <div style="display:flex; gap:8px; margin-bottom:14px;">
                <div style="flex:1; background:#fff; border:1px solid #e2e8f0; border-radius:14px; padding:16px; text-align:center;">
                    <div style="font-size:11px; font-weight:900; color:#94a3b8;">📊 활동량</div>
                    <div style="font-size:26px; font-weight:950; color:#4338ca; margin-top:6px;">${activityPct.toFixed(1)}%</div>
                    <div style="font-size:10.5px; color:#64748b; font-weight:700; margin-top:6px; line-height:1.5;">전체 ${totalRecordCount.toLocaleString()}건 중<br><b style="color:#4338ca;">${myRecordCount.toLocaleString()}건</b></div>
                    <div style="width:100%; background:#f1f5f9; height:6px; border-radius:99px; margin-top:10px; overflow:hidden;">
                        <div style="width:${Math.min(100, activityPct)}%; background:linear-gradient(90deg,#4338ca,#7c3aed); height:100%;"></div>
                    </div>
                </div>
                <div style="flex:1; background:#fff; border:1px solid #e2e8f0; border-radius:14px; padding:16px; text-align:center;">
                    <div style="font-size:11px; font-weight:900; color:#94a3b8;">🗺️ 탐험도</div>
                    <div style="font-size:26px; font-weight:950; color:#0891b2; margin-top:6px;">${explorePct.toFixed(1)}%</div>
                    <div style="font-size:10.5px; color:#64748b; font-weight:700; margin-top:6px; line-height:1.5;">등록 ${totalGameCount.toLocaleString()}종 중<br><b style="color:#0891b2;">${distinctGameCount.toLocaleString()}종</b> 플레이</div>
                    <div style="width:100%; background:#f1f5f9; height:6px; border-radius:99px; margin-top:10px; overflow:hidden;">
                        <div style="width:${Math.min(100, explorePct)}%; background:linear-gradient(90deg,#0891b2,#06b6d4); height:100%;"></div>
                    </div>
                </div>
            </div>
        `;

        // ===== 3. 전력 분석 =====
        const recordedGamesHtml = topRecordedGames.length === 0
            ? `<div style="text-align:center; color:#94a3b8; font-weight:700; padding:16px 0; font-size:12px;">아직 기록이 없습니다.</div>`
            : topRecordedGames.map(([name, s], idx) => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:#f8fafc; border-radius:10px; margin-bottom:6px;">
                    <div style="display:flex; align-items:center; gap:8px; min-width:0;">
                        <span style="font-size:14px; flex-shrink:0;">${idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</span>
                        <span style="font-weight:800; color:#1e293b; font-size:12.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${Boako.MobilePowerAnalysis.escapeHtml(name)}</span>
                    </div>
                    <span style="font-weight:900; color:#4338ca; font-size:12px; flex-shrink:0;">${s.count}회</span>
                </div>
            `).join('');

        const tournamentGamesHtml = topTournamentGames.length === 0
            ? `<div style="text-align:center; color:#94a3b8; font-weight:700; padding:16px 0; font-size:12px;">참여한 토너먼트가 없습니다.</div>`
            : topTournamentGames.map(([name, count], idx) => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:#fffbeb; border-radius:10px; margin-bottom:6px;">
                    <div style="display:flex; align-items:center; gap:8px; min-width:0;">
                        <span style="font-size:14px; flex-shrink:0;">${idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</span>
                        <span style="font-weight:800; color:#1e293b; font-size:12.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${Boako.MobilePowerAnalysis.escapeHtml(name)}</span>
                    </div>
                    <span style="font-weight:900; color:#d97706; font-size:12px; flex-shrink:0;">${count}회</span>
                </div>
            `).join('');

        const powerAnalysisHtml = `
            <div style="background:#fff; border:1px solid #e2e8f0; border-radius:14px; padding:16px; margin-bottom:14px;">
                <div style="font-size:14px; font-weight:900; color:#1e293b; margin-bottom:12px;">⚔️ 전력 분석</div>

                <div style="display:flex; align-items:center; gap:12px; background:linear-gradient(135deg,#fef2f2,#fff); border:1px solid #fecaca; border-radius:12px; padding:14px; margin-bottom:16px;">
                    <span style="font-size:26px;">🏅</span>
                    <div>
                        <div style="font-size:10px; font-weight:800; color:#94a3b8; text-transform:uppercase;">BGA 첫승 업적</div>
                        <div style="font-size:19px; font-weight:950; color:#dc2626;">${firstWinCount}회 달성</div>
                    </div>
                </div>

                <div style="margin-bottom:14px;">
                    <div style="font-weight:900; font-size:12.5px; margin-bottom:8px; color:#1e293b;">🎲 가장 많이 기록한 게임</div>
                    ${recordedGamesHtml}
                </div>
                <div>
                    <div style="font-weight:900; font-size:12.5px; margin-bottom:8px; color:#1e293b;">🏆 가장 많이 참여한 토너먼트 종목</div>
                    ${tournamentGamesHtml}
                </div>
            </div>
        `;

        // ===== 4. 소속 히스토리 =====
        const historyHtml = teamHistory.length === 0
            ? `<div style="text-align:center; color:#94a3b8; font-weight:700; padding:24px 0; font-size:12.5px;">소속 이력이 없습니다.</div>`
            : `
            <div style="position:relative; padding-left:20px;">
                <div style="position:absolute; left:5px; top:5px; bottom:5px; width:2px; background:#e2e8f0;"></div>
                ${teamHistory.map(t => {
                    const isCurrent = t.is_active && !t.left_at;
                    return `
                    <div style="position:relative; margin-bottom:16px;">
                        <div style="position:absolute; left:-20px; top:3px; width:10px; height:10px; border-radius:50%; background:${isCurrent ? '#4338ca' : '#cbd5e1'}; border:2px solid #fff; box-shadow:0 0 0 2px ${isCurrent ? '#c7d2fe' : '#f1f5f9'};"></div>
                        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                            <span style="font-weight:900; font-size:13.5px; color:#1e293b;">${Boako.MobilePowerAnalysis.escapeHtml(t.team_name)}</span>
                            ${isCurrent ? `<span style="background:#eef2ff; color:#4338ca; font-size:9.5px; font-weight:900; padding:2px 7px; border-radius:99px;">현재 소속중</span>` : ''}
                        </div>
                        <div style="font-size:11px; color:#94a3b8; font-weight:700; margin-top:3px;">
                            ${Boako.PowerAnalysis.formatDate(t.joined_at)} ~ ${isCurrent ? '현재' : Boako.PowerAnalysis.formatDate(t.left_at)}
                        </div>
                    </div>
                `}).join('')}
            </div>
        `;

        const historySectionHtml = `
            <div style="background:#fff; border:1px solid #e2e8f0; border-radius:14px; padding:16px;">
                <div style="font-size:14px; font-weight:900; color:#1e293b; margin-bottom:12px;">🛡️ 소속 히스토리</div>
                ${historyHtml}
            </div>
        `;

        area.innerHTML = statsHtml + powerAnalysisHtml + historySectionHtml;
    },

    escapeHtml: (str) => {
        const div = document.createElement('div');
        div.innerText = str || '';
        return div.innerHTML;
    }
};
