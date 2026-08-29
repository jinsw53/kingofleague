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
 * 🌟 [버그수정] 빙고 탭 상단 "시즌 드롭다운 + 동기화 버튼"이 가로 배치라 좁은 화면에서 계속
 *    넘치던 문제 — 소장님 지시로 아예 세로로 쌓는 방향으로 정리(각각 폭 전체 사용).
 * 🌟 [전면 재설계 2차] 5x5 빙고판 — 소장님 최종 방향: 색은 난이도(EASY/NORMAL/HARD/CENTER)
 *    전용으로만 쓰고, 팀 점유 여부는 실제 팀 로고로 표시. 빈 칸은 번호가 크게, 점유된 칸은
 *    번호 대신 팀 로고를 크게 박고 번호는 리스트와 매치용으로 코너에 작게 유지. 게임명은
 *    칸 안에 다 못 넣으므로 그리드 아래 "칸 상세 리스트"를 별도로 붙여서 번호로 매치업.
 *    승리 라인 계산/스코어보드 갱신은 league.js의 State/함수를 그대로 재사용.
 * 🌟 [수정] 빙고칸 탭 시 Boako.Util.toast() 대신 "탭한 칸 바로 위에 뜨는 말풍선 팝업"으로
 *    변경(소장님 지시) — PC의 마우스 호버 툴팁과 유사한 느낌을 터치 환경에서 재현. 게임 로고도
 *    같이 표시(소장님 지시 — 팝업에 로고가 빠져있던 걸 추가, 이후 2배로 확대: 36px→72px).
 */
window.Boako = window.Boako || {};
Boako.MobileLeague = {

    render: async (container) => {
        if (!Boako.League || !Boako.League.buildUI) await Boako.Util.loadScript('/js/league.js');

        if (!document.getElementById('mobile-league-style')) {
            const style = document.createElement('style');
            style.id = 'mobile-league-style';
            style.textContent = `
                /* 🌟 [버그수정] 빙고 시즌 드롭다운 + 동기화 버튼이 가로 배치라 좁은 화면에서
                   계속 넘치던 문제 — 세로로 쌓아서 각각 폭 전체를 쓰게 정리 */
                #mobile-league-root div:has(> #bingo-sync-btn) {
                    flex-direction: column !important;
                    align-items: stretch !important;
                    width: 100%;
                    gap: 8px !important;
                }
                #mobile-league-root #bingo-season-dropdown-container {
                    width: 100% !important;
                    flex: none !important;
                }
                #mobile-league-root #bingo-sync-btn {
                    width: 100%;
                    justify-content: center;
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

        // 🌟 [신규] 빙고칸 탭 시 PC 호버 툴팁과 유사하게 "탭한 칸 바로 위에 뜨는 말풍선 팝업"
        // (소장님 지시: 토스트 대신 이 방식으로). 화면 밖으로 나가지 않게 위치를 보정하고,
        // 화면 위쪽 칸이라 위에 공간이 부족하면 아래쪽에 뜨도록 자동 반전. 바깥 탭 또는
        // 4초 후 자동으로 닫힘. 동시에 하나만 떠 있도록 매번 이전 팝업을 먼저 제거.
        Boako.MobileLeague.showBingoCellPopup = (cellEl, gameName, diffInfo, ownerTeam, gameLogoUrl) => {
            document.getElementById('mobile-bingo-cell-popup')?.remove();
            document.getElementById('mobile-bingo-cell-popup-dim')?.remove();

            const rect = cellEl.getBoundingClientRect();

            const dim = document.createElement('div');
            dim.id = 'mobile-bingo-cell-popup-dim';
            dim.style.cssText = 'position:fixed; inset:0; z-index:9998; background:transparent;';
            dim.addEventListener('click', () => { popup.remove(); dim.remove(); });
            document.body.appendChild(dim);

            // 🌟 [2배 확대] 소장님 지시로 로고 크기를 36px → 72px로 확대
            const logoHtml = gameLogoUrl
                ? `<img src="${Boako.Util.cdn(gameLogoUrl)}" style="width:72px; height:72px; object-fit:contain; background:#fff; border-radius:10px; padding:4px; margin:0 auto 8px; display:block;">`
                : `<div style="width:72px; height:72px; display:flex; align-items:center; justify-content:center; font-size:40px; margin:0 auto 8px;">🎲</div>`;

            const popup = document.createElement('div');
            popup.id = 'mobile-bingo-cell-popup';
            popup.style.cssText = 'position:fixed; z-index:9999; background:#1e293b; color:#fff; border-radius:12px; padding:12px 14px; font-size:12.5px; max-width:220px; text-align:center; box-shadow:0 10px 24px rgba(0,0,0,0.3); visibility:hidden;';
            popup.innerHTML = `
                ${logoHtml}
                <div style="font-weight:900; margin-bottom:4px;">${gameName}</div>
                <div style="display:flex; align-items:center; justify-content:center; gap:6px; font-size:11px; opacity:0.9;">
                    <span style="background:${diffInfo.bg}; color:${diffInfo.fg}; padding:1px 6px; border-radius:5px; font-weight:900;">${diffInfo.label}</span>
                    <span style="font-weight:700;">${ownerTeam ? ownerTeam + ' 점유' : '비어있음'}</span>
                </div>
                <div id="mobile-bingo-cell-popup-arrow" style="position:absolute; left:50%; transform:translateX(-50%) rotate(45deg); width:10px; height:10px; background:#1e293b;"></div>
            `;
            document.body.appendChild(popup);

            const popupRect = popup.getBoundingClientRect();
            let left = rect.left + rect.width / 2 - popupRect.width / 2;
            left = Math.max(8, Math.min(left, window.innerWidth - popupRect.width - 8));

            const spaceAbove = rect.top;
            const showBelow = spaceAbove < popupRect.height + 16;
            const top = showBelow ? rect.bottom + 10 : rect.top - popupRect.height - 10;

            popup.style.left = left + 'px';
            popup.style.top = top + 'px';
            popup.style.visibility = 'visible';

            const arrow = document.getElementById('mobile-bingo-cell-popup-arrow');
            const arrowLeft = (rect.left + rect.width / 2 - left) + 'px';
            if (showBelow) {
                arrow.style.top = '-5px';
                arrow.style.bottom = '';
            } else {
                arrow.style.bottom = '-5px';
                arrow.style.top = '';
            }
            arrow.style.left = arrowLeft;

            setTimeout(() => { popup.remove(); dim.remove(); }, 4000);
        };

        // 🌟 [전면 재설계 2차] 5x5 빙고판 — 소장님 최종 방향: 색은 난이도(EASY/NORMAL/HARD/CENTER)
        // 전용으로만 쓰고, 팀 점유 여부는 실제 팀 로고로 표시. 빈 칸은 번호가 크게, 점유된 칸은
        // 번호 대신 팀 로고를 크게 박고 번호는 리스트와 매치용으로 코너에 작게 유지. 게임명은
        // 칸 안에 다 못 넣으므로 그리드 아래 "칸 상세 리스트"를 별도로 붙여서 번호로 매치업.
        // 승리 라인 계산/스코어보드 갱신은 league.js의 State/함수를 그대로 재사용.
        Boako.League.renderBingoBoard = function() {
            const grid = document.getElementById('bingo-grid'); if (!grid) return; grid.innerHTML = '';
            const winCells = Boako.League.calculateWinningCells();
            const myTeamName = Boako.state.team?.info?.team_name;
            const difficulties = Boako.League.State.missionDifficulties || Array(25).fill("EASY");

            const diffColors = {
                EASY: { bg: '#97c459', fg: '#173404', label: 'EASY' },
                NORMAL: { bg: '#85b7eb', fg: '#042c53', label: 'NORMAL' },
                HARD: { bg: '#f09595', fg: '#501313', label: 'HARD' },
                HARD_CENTER_PENALTY: { bg: '#ef9f27', fg: '#412402', label: 'CENTER' }
            };

            Boako.League.State.bingoBoard.forEach((ownerTeam, idx) => {
                const cell = document.createElement('div');
                const num = idx + 1;
                const isWinner = winCells.includes(idx);
                const diffStatus = difficulties[idx] || "EASY";
                const diffInfo = diffColors[diffStatus] || diffColors.EASY;
                const gameName = Boako.League.State.boardGames25[idx] || "지정 미정";
                const gameLogoUrl = Boako.League.State.boardLogos25[idx];

                cell.style.cssText = `position:relative; aspect-ratio:1; border-radius:10px; border:1px solid #e2e8f0; background:#f8fafc; display:flex; align-items:center; justify-content:center; overflow:hidden; cursor:pointer; ${isWinner ? 'box-shadow:0 0 0 2px #f59e0b;' : ''}`;

                const diffBadgeHtml = `<span style="position:absolute; top:2px; left:2px; font-size:6.5px; font-weight:900; padding:1px 3px; border-radius:4px; background:${diffInfo.bg}; color:${diffInfo.fg}; z-index:3;">${diffInfo.label}</span>`;
                const crownHtml = isWinner ? `<span style="position:absolute; top:2px; right:2px; font-size:10px; z-index:3;">👑</span>` : '';

                let mainHtml, numberBadgeHtml = '';
                if (ownerTeam) {
                    // 🌟 점유된 칸 — 번호 대신 실제 팀 로고를 크게
                    const teamLogoUrl = Boako.Util.cdn(Boako.League.State.bingoTeamLogos25[idx] || 'https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challenge%20(1).png');
                    mainHtml = `<img src="${teamLogoUrl}" alt="${ownerTeam}" style="width:60%; height:60%; object-fit:contain; z-index:2;">`;
                    numberBadgeHtml = `<span style="position:absolute; bottom:2px; right:2px; font-size:7px; font-weight:900; color:#64748b; background:rgba(255,255,255,0.85); padding:0 3px; border-radius:4px; z-index:3;">${num}</span>`;
                } else {
                    // 🌟 빈 칸 — 번호를 크게
                    mainHtml = `<span style="font-size:17px; font-weight:900; color:#1e293b; z-index:2;">${num}</span>`;
                }

                cell.innerHTML = `${diffBadgeHtml}${crownHtml}${mainHtml}${numberBadgeHtml}`;

                cell.addEventListener('click', (e) => {
                    e.stopPropagation();
                    Boako.MobileLeague.showBingoCellPopup(cell, gameName, diffInfo, ownerTeam, gameLogoUrl);
                });

                grid.appendChild(cell);
            });

            // 🌟 [신규] 그리드 안에 다 못 넣는 정보(게임명/난이도/점유팀)를 번호로 매치업하는
            // 상세 리스트를 그리드 카드 바로 아래에 붙임(처음 호출 시 1회 생성, 이후 갱신).
            let listWrap = document.getElementById('mobile-bingo-detail-list');
            if (!listWrap) {
                listWrap = document.createElement('div');
                listWrap.id = 'mobile-bingo-detail-list';
                listWrap.style.cssText = 'margin-top:12px; border-top:1px solid #f1f5f9;';
                grid.parentElement.appendChild(listWrap);
            }
            listWrap.innerHTML = Boako.League.State.bingoBoard.map((ownerTeam, idx) => {
                const num = idx + 1;
                const diffStatus = difficulties[idx] || "EASY";
                const diffInfo = diffColors[diffStatus] || diffColors.EASY;
                const gameName = Boako.League.State.boardGames25[idx] || "지정 미정";
                const statusHtml = ownerTeam
                    ? `<span style="font-size:11px; color:#64748b; font-weight:700; flex-shrink:0;">${ownerTeam} 점유</span>`
                    : `<span style="font-size:11px; color:#cbd5e1; font-weight:700; flex-shrink:0;">비어있음</span>`;
                return `
                    <div style="display:flex; align-items:center; gap:8px; padding:9px 2px; border-bottom:1px solid #f1f5f9;">
                        <span style="width:20px; height:20px; border-radius:50%; background:#f1f5f9; color:#334155; font-size:10.5px; font-weight:900; display:flex; align-items:center; justify-content:center; flex-shrink:0;">${num}</span>
                        <span style="flex:1; font-size:12.5px; font-weight:700; color:#1e293b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${gameName}</span>
                        <span style="font-size:9px; font-weight:900; padding:2px 5px; border-radius:5px; background:${diffInfo.bg}; color:${diffInfo.fg}; flex-shrink:0;">${diffInfo.label}</span>
                        ${statusHtml}
                    </div>
                `;
            }).join('');

            Boako.League.updateStats();
        };

        // 🌟 league.js가 containerId 하나만 받으면 4개 탭까지 전부 스스로 그림
        container.innerHTML = `<div id="mobile-league-root"></div>`;
        Boako.League.buildUI('mobile-league-root');

        const bannerImg = document.getElementById('league-header-main-img');
        if (bannerImg) bannerImg.src = '/league_champion_belt_banner.png';
    }
};
