/**
 * [MOBILE LEAGUE] 모바일 전용 — 리그 콘텐츠(팀 빙고 쟁탈전 / 드루와! 챌린지 / 챔피언 / 킹 오브 리그)
 * 🌟 [재사용 원칙] league.js의 buildUI(containerId)는 컨테이너 id 하나만 받으면 4개 탭과 탭 안쪽
 *    콘텐츠(챌린지 등록/로스터/투표 캘린더, 빙고판, 챔피언 명예의 전당, 킹 오브 리그 이벤트로그)까지
 *    전부 스스로 그리는 완전 자기완결형 구조라 그대로 재사용함. 탭 바 자체가 이미
 *    "grid grid-cols-2 sm:flex"로 짜여있어(PC=가로 4개, 모바일=2x2 그리드) 대항전 포팅 때 겪었던
 *    가로 스크롤/잘림 문제가 애초에 없어서 별도 재설계가 필요 없었음.
 * 🌟 [버그수정] 헤더 배너 이미지가 상대경로("league_champion_belt_banner.png")로 박혀있어서,
 *    /mobile/ 하위 페이지에서 그대로 불러오면 사이트 루트가 아니라 /mobile/ 기준으로 요청돼
 *    경로가 깨짐 — league.js 파일은 건드리지 않고, buildUI() 실행 직후 절대경로로 교체.
 * 🌟 [버그 회피] 챌린지 카드의 "채팅방 이동" 버튼이 유일하게 PC 전용 화면전환
 *    (Boako.View.render('messenger'))을 부름 — league.js 파일은 건드리지 않고, 모바일
 *    쪽지함(mobile_messenger.js)으로 대신 연결. 쪽지함 목록에서 챌린지 채팅방은 이미
 *    "곧 지원 예정" 안내가 뜨도록 되어있어(mobile_messenger.js) 자연스럽게 처리됨.
 * 🌟 [전면 재설계] 챔피언 탭이 PC 전용 <table min-w-[600px]>+overflow-x-auto 구조라 모바일에서
 *    가로 스크롤이 생기던 문제 — 가로 스크롤은 절대 쓰지 않기로 해서, league.js는 건드리지 않고
 *    Boako.League.getChampionHTML(마크업)과 drawChampionRows(행 그리기)만 모바일 전용 카드형
 *    세로 리스트로 덮어씀. 데이터 조회(fetchAndRenderChampions)와 검색(filterChampions)은
 *    컨테이너 id(champion-tbody/champion-search)만 참조하는 자기완결형이라 그대로 재사용 —
 *    같은 id를 가진 div/input을 그대로 마련해두면 별도 손댈 필요가 없음.
 */
window.Boako = window.Boako || {};
Boako.MobileLeague = {

    render: async (container) => {
        if (!Boako.League || !Boako.League.buildUI) await Boako.Util.loadScript('/js/league.js');

        Boako.League.openChallengeChat = async () => {
            await Boako.MobileShell.openMessenger();
        };

        // 🌟 [전면 재설계] 챔피언 탭 마크업 — PC 테이블 구조 대신 카드 세로 리스트
        Boako.League.getChampionHTML = function() {
            return `
                <div style="display:flex; flex-direction:column; gap:12px;">
                    <div style="font-size:13px; font-weight:900; color:#1e293b; border-bottom:1px solid #f1f5f9; padding-bottom:10px;">🏆 인기 게임 · 종목별 MVP 챔피언</div>
                    <input onkeyup="Boako.League.filterChampions()" id="champion-search" type="text" placeholder="게임 혹은 플레이어 검색..." style="width:100%; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:10px 14px; font-size:13px; font-weight:700; color:#1e293b;">
                    <div id="champion-tbody" style="display:flex; flex-direction:column; gap:8px;">
                        <div style="text-align:center; padding:30px 0; color:#94a3b8; font-weight:700; font-size:12px;">🔄 v_game_popularity_mvp 뷰 데이터 동기화 중...</div>
                    </div>
                </div>
            `;
        };

        // 🌟 [전면 재설계] 챔피언 행 그리기 — 표의 5개 열(순위/게임/챔피언/팀/RP)을 카드 하나 안에
        // 세로로 재배치. PC의 마우스 호버 팀로고 확대 툴팁은 터치 환경엔 의미가 없어 제외.
        Boako.League.drawChampionRows = function(dataList) {
            const container = document.getElementById('champion-tbody');
            if (!container) return;
            if (dataList.length === 0) {
                container.innerHTML = `<div style="text-align:center; padding:30px 0; color:#94a3b8; font-weight:700; font-size:12px;">이번 시즌 집계된 데이터가 없습니다.</div>`;
                return;
            }
            container.innerHTML = dataList.map((row, i) => {
                const gameRank = i + 1;
                const gameName = row.game_name || '미정 종목';
                const mvpName = row.mvp_nickname || '집계 중';
                const mvpTeam = row.mvp_team_name || '무소속';
                const totalRp = row.mvp_total_rp || 0;
                const totalPlays = row.total_records_count || 0;
                const uniquePlayers = row.total_unique_players || 0;
                const teamLogo = Boako.Util.cdn(row.mvp_team_logo) || 'https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challenge%20(1).png';
                return `
                    <div style="background:#fff; border:1px solid #e2e8f0; border-radius:14px; padding:14px;">
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                            <span style="background:#f5f3ff; color:#7c3aed; font-size:10.5px; font-weight:900; padding:3px 8px; border-radius:8px; border:1px solid #ede9fe; flex-shrink:0;">TOP ${gameRank}</span>
                            <span style="font-size:14px; font-weight:900; color:#1e293b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${gameName}</span>
                        </div>
                        <div style="font-size:10.5px; color:#94a3b8; font-weight:700; margin-bottom:10px; display:flex; align-items:center; gap:6px;">
                            <span style="color:#7c3aed;">🔥 총 ${totalPlays}회 플레이</span>
                            <span style="width:1px; height:10px; background:#e2e8f0;"></span>
                            <span style="color:#2563eb;">👥 ${uniquePlayers}명 참여</span>
                        </div>
                        <div style="display:flex; align-items:center; justify-content:space-between; padding-top:10px; border-top:1px dashed #f1f5f9;">
                            <div style="display:flex; align-items:center; gap:8px; min-width:0;">
                                <img src="${Boako.Util.cdn('https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/CHAMPION.png')}" style="width:26px; height:26px; border-radius:50%; flex-shrink:0;">
                                <div style="min-width:0;">
                                    <div style="font-size:12.5px; font-weight:900; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${mvpName}</div>
                                    <div style="display:flex; align-items:center; gap:4px; margin-top:2px;">
                                        <img src="${teamLogo}" style="width:14px; height:14px; border-radius:50%; flex-shrink:0;">
                                        <span style="font-size:10.5px; color:#64748b; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${mvpTeam}</span>
                                    </div>
                                </div>
                            </div>
                            <div style="font-size:13px; font-weight:900; color:#f59e0b; flex-shrink:0; margin-left:8px;">${totalRp.toLocaleString()} RP</div>
                        </div>
                    </div>
                `;
            }).join('');
        };

        // 🌟 league.js가 containerId 하나만 받으면 4개 탭까지 전부 스스로 그림
        container.innerHTML = `<div id="mobile-league-root"></div>`;
        Boako.League.buildUI('mobile-league-root');

        const bannerImg = document.getElementById('league-header-main-img');
        if (bannerImg) bannerImg.src = '/league_champion_belt_banner.png';
    }
};
