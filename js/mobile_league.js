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
 * 🌟 [버그수정] 빙고 탭 상단 "시즌 드롭다운(고정폭 180px) + 동기화 버튼"이 좁은 화면에서
 *    넘치던 문제 — CSS로 드롭다운을 flex:1로 바꿔서 남은 공간을 채우도록 수정(마크업은 그대로,
 *    CSS만 보정).
 * 🌟 [전면 재설계] 5x5 빙고판 각 칸의 게임명이 1줄+말줄임(line-clamp-1)이라 대부분 한 글자만
 *    보이고 잘리던 문제 — league.js는 건드리지 않고 Boako.League.renderBingoBoard를 모바일
 *    전용으로 덮어써서: 1) 게임명을 2줄까지 자연스럽게 줄바꿈, 2) 그래도 잘릴 수 있으니 칸을
 *    탭하면 전체 게임명(+점유 팀)을 토스트로 보여주는 기능 추가. 나머지 로직(승리 라인 계산,
 *    난이도 배지, 점유 팀 오버레이, 스코어보드 갱신)은 league.js의 State/calculateWinningCells/
 *    updateStats를 그대로 재사용.
 */
window.Boako = window.Boako || {};
Boako.MobileLeague = {

    render: async (container) => {
        if (!Boako.League || !Boako.League.buildUI) await Boako.Util.loadScript('/js/league.js');

        if (!document.getElementById('mobile-league-style')) {
            const style = document.createElement('style');
            style.id = 'mobile-league-style';
            style.textContent = `
                /* 🌟 [버그수정] 빙고 시즌 드롭다운(고정폭 180px)이 동기화 버튼과 함께 넘치던 문제 —
                   남은 공간을 채우도록 flex:1로 변경 */
                #mobile-league-root #bingo-season-dropdown-container {
                    width: auto !important;
                    flex: 1 1 auto !important;
                }
            `;
            document.head.appendChild(style);
        }

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

        // 🌟 [전면 재설계] 5x5 빙고판 — 게임명 1줄+말줄임 대신 2줄 줄바꿈 + 탭하면 전체 게임명을
        // 토스트로 확인 가능하게 함. 승리 라인 계산/난이도 배지/점유 팀 오버레이/스코어보드 갱신은
        // league.js의 State와 함수(calculateWinningCells/updateStats)를 그대로 재사용.
        Boako.League.renderBingoBoard = function() {
            const grid = document.getElementById('bingo-grid'); if (!grid) return; grid.innerHTML = '';
            const winCells = Boako.League.calculateWinningCells();
            const myTeamName = Boako.state.team?.info?.team_name;
            const difficulties = Boako.League.State.missionDifficulties || Array(25).fill("EASY");

            Boako.League.State.bingoBoard.forEach((ownerTeam, idx) => {
                const cell = document.createElement('div');
                const isWinner = winCells.includes(idx);
                const isMyTeam = ownerTeam && ownerTeam === myTeamName;
                const diffStatus = difficulties[idx] || "EASY";
                const gameName = Boako.League.State.boardGames25[idx] || "지정 미정";
                const gameLogoUrl = Boako.League.State.boardLogos25[idx];

                let bgClass = "bg-slate-50 border-slate-200/60";
                if (ownerTeam) {
                    if (isMyTeam) {
                        bgClass = "bg-gradient-to-br from-violet-600 to-indigo-600 text-white border-violet-400 bingo-won-pulse border-2 scale-[0.97] shadow-md";
                        if (!isWinner) bgClass = "bg-gradient-to-br from-violet-50 to-indigo-50 border-violet-300 text-violet-950 font-black scale-[0.97] shadow-inner border";
                    } else {
                        bgClass = isWinner ? "bg-slate-700 text-slate-100 border-slate-500 scale-[0.97] opacity-80" : "bg-slate-100 border-slate-200 text-slate-700 font-bold scale-[0.97]";
                    }
                }
                if (diffStatus === 'HARD_CENTER_PENALTY') bgClass += " fire-border-glow border-orange-500 z-20 scale-[0.98]";

                // 🌟 h-24 → h-28로 살짝 키워서 2줄 라벨이 들어갈 여유 확보
                cell.className = `h-28 rounded-2xl border flex flex-col items-center justify-center transition-all text-center relative overflow-hidden group cursor-pointer ${bgClass}`;

                const gameLogoOpacity = ownerTeam ? "opacity-20 grayscale transition-all duration-300 group-hover:opacity-10" : "opacity-100 drop-shadow-md";
                const gameImageHtml = gameLogoUrl
                    ? `<div class="absolute inset-0 flex items-center justify-center pointer-events-none z-10 pb-5"><img src="${Boako.Util.cdn(gameLogoUrl)}" alt="${gameName}" class="w-[60%] h-auto max-h-full object-contain ${gameLogoOpacity}"></div>`
                    : `<div class="absolute inset-0 flex items-center justify-center pointer-events-none text-3xl pb-5 z-10 ${gameLogoOpacity}">🎲</div>`;

                let massiveOverlayHtml = '';
                if (ownerTeam) {
                    const teamLogoUrl = Boako.Util.cdn(Boako.League.State.bingoTeamLogos25[idx] || 'https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challenge%20(1).png');
                    massiveOverlayHtml = `<div class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/40 backdrop-blur-[2px] transition-all pb-2 pointer-events-none"><img src="${teamLogoUrl}" alt="${ownerTeam}" class="w-12 h-12 object-contain drop-shadow-xl"></div>`;
                }

                let diffBadgeHtml = '';
                if (diffStatus === 'HARD_CENTER_PENALTY') {
                    diffBadgeHtml = `<span class="absolute top-1 right-1 z-30 bg-gradient-to-r from-orange-500 to-red-500 text-white font-black text-[7px] px-1.5 py-0.5 rounded shadow-sm pointer-events-none">🔥 CENTER</span>`;
                } else {
                    const diffColors = { EASY: "bg-emerald-500/90 text-white", NORMAL: "bg-blue-500/90 text-white", HARD: "bg-rose-500/90 text-white" };
                    diffBadgeHtml = `<span class="absolute top-1 right-1 z-30 ${diffColors[diffStatus] || 'bg-slate-500'} font-black text-[7px] px-1 py-0.5 rounded shadow-sm pointer-events-none">${diffStatus}</span>`;
                }

                const crownHtml = isWinner ? `<span class="absolute top-1 ${diffStatus === 'HARD_CENTER_PENALTY' ? 'right-12' : 'right-8'} text-xs text-amber-400 z-30 pointer-events-none">👑</span>` : '';

                // 🌟 [버그수정] 말줄임(line-clamp-1 truncate) 대신 2줄 줄바꿈 허용
                const gameLabelHtml = `<div class="absolute bottom-1 left-0 w-full px-1 z-30 pointer-events-none"><div class="w-full px-1 bg-white/90 backdrop-blur-md py-1 rounded-sm border border-slate-200/80 shadow-sm flex items-center justify-center min-h-[26px]"><span class="text-[8px] font-black text-slate-800 leading-tight" style="display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; word-break:keep-all;">${gameName}</span></div></div>`;

                cell.innerHTML = `${gameImageHtml}${massiveOverlayHtml}${diffBadgeHtml}${crownHtml}${gameLabelHtml}`;

                // 🌟 [신규] 2줄로도 잘릴 수 있는 긴 게임명을 탭하면 전체 이름(+점유 팀)을 토스트로 확인
                cell.addEventListener('click', () => {
                    const msg = ownerTeam ? `🎲 ${gameName} · 점유: ${ownerTeam}` : `🎲 ${gameName}`;
                    Boako.Util.toast(msg);
                });

                grid.appendChild(cell);
            });

            Boako.League.updateStats();
        };

        // 🌟 league.js가 containerId 하나만 받으면 4개 탭까지 전부 스스로 그림
        container.innerHTML = `<div id="mobile-league-root"></div>`;
        Boako.League.buildUI('mobile-league-root');

        const bannerImg = document.getElementById('league-header-main-img');
        if (bannerImg) bannerImg.src = '/league_champion_belt_banner.png';
    }
};
