/**
 * 🎯 [LEAGUE] 실시간 리그 콘텐츠 전당 (상단 수평 레이아웃 및 거대 배너 완결본)
 * 관리 책임자: 소장님 MASTER
 */

Boako.League = Boako.League || {};

// 💡 1. 리그 전용 로컬 상태 관리 (명칭 일치 및 오염 방지)
Boako.League.State = {
    currentTab: 'bingo',
    bingoBoard: Array(25).fill(null),       // 🌟 뷰의 occupying_team_name 적재
    boardGames25: Array(25).fill("지정 미정"), // 🌟 뷰의 game_name 적재
    boardLogos25: Array(25).fill(null),      // 🌟 뷰의 game_logo_url 적재
    bingoTeamLogos25: Array(25).fill(null),  // 🌟 뷰의 occupying_team_logo_url 적재
    missionDifficulties: Array(25).fill("EASY"), // 🌟 [방 생성 완료] 뷰의 mission_difficulty 적재
    teamBingoScores: [],
    champions: [],
    challenges: [],
    
    // 🌟 커스텀 드롭다운 상태 관리
    currentBingoSeason: 'live',
    bingoSeasonOptions: [],
    challengeParams: {
        attacker: '블루 타이거',
        defender: '레드 피닉스',
        game: '스플렌더'
    }
};

// 🌟 공용 커스텀 드롭다운 토글 함수
Boako.League.toggleDropdown = function(id) {
    const menu = document.getElementById(id + '-menu');
    const overlay = document.getElementById(id + '-overlay');
    if (menu && overlay) {
        menu.classList.toggle('hidden');
        overlay.classList.toggle('hidden');
    }
};

// 💡 2. 메인 UI 사출 엔진 (기존 좌측 텍스트를 날리고 수평 라인을 유지한 채 배너 확장)
Boako.League.buildUI = function(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

   container.innerHTML = `
    <div class="w-full max-w-4xl mx-auto bg-white border border-slate-200/80 rounded-3xl premium-shadow overflow-hidden transition-all duration-300">
        
        <div class="p-6 sm:p-8 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6 bg-slate-50/50">
            
            <div id="league-header-img-container" class="flex-1 w-full h-20 rounded-2xl overflow-hidden border border-slate-200/60 shadow-inner bg-slate-100 p-1.5 flex items-center justify-center">
                <img id="league-header-main-img" src="league_champion_belt_banner.png" alt="LEAGUE BANNER" style="width: 100%; height: 100%; object-fit: contain;">
            </div>

            <div class="grid grid-cols-2 sm:flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/50 w-full md:w-auto shrink-0">
                <button id="tab-bingo" onclick="Boako.League.switchTab('bingo')" class="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black transition-all duration-200">
                    <span>🎲 팀 빙고 쟁탈전</span>
                </button>
                <button id="tab-challenge" onclick="Boako.League.switchTab('challenge')" class="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black transition-all duration-200">
                    <span>🔥 야, 너네 나와! 챌린지</span>
                </button>
                <button id="tab-champion" onclick="Boako.League.switchTab('champion')" class="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black transition-all duration-200">
                    <span>👑 챔피언</span>
                </button>
                <button id="tab-king_of_league" onclick="Boako.League.switchTab('king_of_league')" class="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black transition-all duration-200">
                    <span>🏅 킹 오브 리그</span>
                </button>
            </div>
        </div>

        <div id="league-view-container" class="p-6 sm:p-8"></div>
    </div>
`;

    this.switchTab('bingo');
};

// 💡 3. 서브 탭 제어 및 동적 사출 컨트롤러
Boako.League.switchTab = async function(tabId) {
    if (typeof sfx !== 'undefined') sfx.playClick();
    Boako.League.State.currentTab = tabId;

    const tabs = ['bingo', 'challenge', 'champion', 'king_of_league'];
    tabs.forEach(t => {
        const btn = document.getElementById(`tab-${t}`);
        if (btn) {
            btn.className = "flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black transition-all duration-200 " + 
                            (t === tabId 
                                ? "bg-violet-600 text-white tab-glow shadow-md" 
                                : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50");
        }
    });

    const mainImg = document.getElementById('league-header-main-img');
    if (mainImg) {
        mainImg.style.objectFit = "contain"; 
        if (tabId === 'bingo') {
            mainImg.src = "https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/teambingo.png";
        } else if (tabId === 'challenge') {
            mainImg.src = "https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challenge.png";
        } else if (tabId === 'champion') {
            mainImg.src = "https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/CHAMPION.png";
        } else if (tabId === 'king_of_league') {
            mainImg.src = "https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/king_of_league.png";
        }
    }

    const container = document.getElementById('league-view-container');
    if (!container) return;

    if (tabId === 'bingo') {
        container.innerHTML = Boako.League.getBingoHTML();
        await Boako.League.loadBingoBoardData(); 
    } else if (tabId === 'challenge') {
        container.innerHTML = Boako.League.getChallengeHTML();
        Boako.League.renderChallenges();
    } else if (tabId === 'champion') {
        container.innerHTML = Boako.League.getChampionHTML();
        await Boako.League.fetchAndRenderChampions(); 
    } else if (tabId === 'king_of_league') {
        container.innerHTML = Boako.League.getKingOfLeagueHTML();
    }
    
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
};

// ====================================================================
// 🎲 탭 1: 5x5 팀 빙고전 실시간 가상 뷰 연동단
// ====================================================================
Boako.League.getBingoHTML = function() {
    return `
        <div class="space-y-6">
            <div class="p-6 bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-100 rounded-2xl space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-violet-200/60 pb-4">
                    <div>
                        <h3 class="font-black text-slate-800 text-base flex items-center gap-2">🎲 BTL 영토 빙고전</h3>
                        <p class="text-xs text-slate-500 font-bold mt-1">팀원들의 누적 전적 통계가 난이도 충족 조건에 매칭되면 자동으로 영토 소유권이 마킹됩니다.</p>
                    </div>
                    
                    <div class="flex items-center gap-2 shrink-0">
                        <div id="bingo-season-dropdown-container" class="relative w-[180px] z-30">
                            <button class="w-full bg-white px-4 py-2.5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between gap-2 text-xs font-black text-slate-700">
                                <span>🌐 시즌 분석 중...</span>
                            </button>
                        </div>
                        
                        <button id="bingo-sync-btn" onclick="Boako.League.loadBingoBoardData()" class="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-3.5 py-2.5 rounded-xl shadow-sm transition-colors flex items-center gap-1.5 h-full">
                            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
                            <span>동기화</span>
                        </button>
                    </div>
                </div>

                <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] font-bold text-slate-600">
                    <div class="bg-white/80 border border-slate-200 p-2.5 rounded-xl flex items-center gap-1.5">
                        <span class="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded-md font-black">EASY</span>
                        <span>팀원 전원 충족</span>
                    </div>
                    <div class="bg-white/80 border border-slate-200 p-2.5 rounded-xl flex items-center gap-1.5">
                        <span class="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-md font-black">NORMAL</span>
                        <span>팀원 75% 이상</span>
                    </div>
                    <div class="bg-white/80 border border-slate-200 p-2.5 rounded-xl flex items-center gap-1.5">
                        <span class="bg-rose-100 text-rose-700 text-[10px] px-1.5 py-0.5 rounded-md font-black">HARD</span>
                        <span>팀원 50% 이상</span>
                    </div>
                    <div class="bg-amber-500/10 border border-amber-400/30 p-2.5 rounded-xl flex items-center gap-1.5 animate-pulse">
                        <span class="bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[9px] px-1.5 py-0.5 rounded-md font-black">🔥 CENTER</span>
                        <span class="text-amber-800 font-black">중앙 페널티: 전원</span>
                    </div>
                </div>
                <p class="text-[10px] text-slate-400 font-medium pt-1">🎯 기본 규칙: 차지한 칸마다 리그 승점 <span class="text-indigo-600 font-bold">1 점</span>을 획득하며, 빙고줄 완성 시 스코어보드 보너스가 연산됩니다.</p>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div class="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
                    <div class="grid grid-cols-5 gap-2" id="bingo-grid"></div>
                </div>
                <div class="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-4">
                    <h5 class="font-black text-slate-800 text-sm border-b border-violet-100 pb-2.5 flex items-center gap-2">
                        <i data-lucide="award" class="w-4 h-4 text-amber-500"></i> 빙고 스코어 보드
                    </h5>
                    <div id="team-stat-rows-container" class="space-y-2 text-xs">
                        <div class="text-center py-4 text-slate-400 font-bold">집계 데이터를 계산 중...</div>
                    </div>
                </div>
            </div>
        </div>
    `;
};

// ====================================================================
// 🌟 빙고 드롭다운 렌더러 & 선택기
// ====================================================================
Boako.League.selectBingoSeason = function(val) {
    Boako.League.toggleDropdown('bingo-season');
    if (Boako.League.State.currentBingoSeason !== val) {
        Boako.League.State.currentBingoSeason = val;
        Boako.League.loadBingoBoardData(); // 데이터 재로드
    }
};

Boako.League.renderBingoSeasonDropdown = function() {
    const container = document.getElementById('bingo-season-dropdown-container');
    if (!container) return;
    
    let currentText = Boako.League.State.currentBingoSeason === 'live' 
        ? `🔴 실시간 시즌 (라이브)` 
        : `🕒 시즌 ${Boako.League.State.currentBingoSeason} 아카이브`;

    container.innerHTML = `
        <button onclick="Boako.League.toggleDropdown('bingo-season')" class="w-full bg-white px-4 py-2.5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between gap-2 text-xs font-black text-slate-700 hover:border-violet-500 hover:text-violet-600 transition-colors">
            <span class="truncate">${currentText}</span>
            <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-slate-400 shrink-0"></i>
        </button>
        <div id="bingo-season-overlay" onclick="Boako.League.toggleDropdown('bingo-season')" class="hidden fixed inset-0 z-40"></div>
        <div id="bingo-season-menu" class="hidden absolute top-full right-0 mt-2 w-[200px] bg-slate-800 rounded-xl shadow-xl border border-slate-700 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            <div onclick="Boako.League.selectBingoSeason('live')" class="px-4 py-3 text-xs font-black cursor-pointer transition-colors ${Boako.League.State.currentBingoSeason === 'live' ? 'bg-violet-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}">🔴 실시간 시즌 (라이브)</div>
            ${Boako.League.State.bingoSeasonOptions.map(sNo => `
                <div onclick="Boako.League.selectBingoSeason('${sNo}')" class="px-4 py-3 text-xs font-black cursor-pointer transition-colors ${Boako.League.State.currentBingoSeason === String(sNo) ? 'bg-violet-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}">🕒 시즌 ${sNo} 아카이브</div>
            `).join('')}
        </div>
    `;
    if(window.lucide) lucide.createIcons();
};

Boako.League.loadBingoBoardData = async function() {
    const grid = document.getElementById('bingo-grid');
    
    if (grid && grid.innerHTML.includes("데이터를 불러오는 중")) {
        // 중복 방지
    } else if (grid) {
        grid.innerHTML = `<div class="col-span-5 text-center py-10 font-bold text-slate-400">🌐 데이터를 배달하는 중...</div>`;
    }

    try {
        if (!Boako.db) throw new Error("Supabase 비가동 상태");

        const { data: rawSeasons, error: sNoErr } = await Boako.db
            .from('bingo_team_scores_history')
            .select('season_no');
            
        if (sNoErr) throw sNoErr;

        const uniqueSeasons = [...new Set((rawSeasons || []).map(r => parseInt(r.season_no)))]
            .filter(n => !isNaN(n))
            .sort((a, b) => b - a);

        const maxHistorySeason = uniqueSeasons.length > 0 ? uniqueSeasons[0] : 0;
        const currentLiveSeason = maxHistorySeason + 1;

        Boako.League.State.bingoSeasonOptions = uniqueSeasons;
        Boako.League.renderBingoSeasonDropdown();

        const selectedSeason = Boako.League.State.currentBingoSeason;
        let boardData = null;
        let scoreData = null;

        if (selectedSeason === 'live') {
            const { data: bData, error: bError } = await Boako.db
                .from('v_bingo_board_live_scoring')
                .select('*')
                .order('coordinate_id', { ascending: true });
            if (bError) throw bError;
            boardData = bData;

            const { data: sData, error: sError } = await Boako.db
                .from('v_bingo_team_total_scores')
                .select('*')
                .order('bingo_total_score', { ascending: false });
            if (sError) throw sError;
            scoreData = sData;

        } else {
            const seasonNo = parseInt(selectedSeason);
            const { data: bData, error: bError } = await Boako.db
                .from('bingo_board_history')
                .select('*')
                .eq('season_no', seasonNo)
                .order('coordinate_id', { ascending: true });
            if (bError) throw bError;
            boardData = bData;

            const { data: sData, error: sError } = await Boako.db
                .from('bingo_team_scores_history')
                .select('*')
                .eq('season_no', seasonNo)
                .order('bingo_total_score', { ascending: false });
            if (sError) throw sError;
            scoreData = sData;
        }

        const initializedBoard = Array(25).fill(null);
        const initializedGames = Array(25).fill("미정 종목");
        const initializedGameLogos = Array(25).fill(null);
        const initializedTeamLogos = Array(25).fill(null);
        const initializedDiffs = Array(25).fill("EASY");

        if (boardData && boardData.length > 0) {
            boardData.forEach(row => {
                const idx = parseInt(row.coordinate_id) - 1;
                if (idx >= 0 && idx < 25) {
                    initializedBoard[idx] = row.occupying_team_name || null; 
                    initializedGames[idx] = row.game_name || "지정 미정";
                    initializedGameLogos[idx] = row.game_logo_url || null;
                    initializedTeamLogos[idx] = row.occupying_team_logo_url || null;
                    
                    if (row.mission_difficulty) {
                        initializedDiffs[idx] = row.mission_difficulty.trim().toUpperCase();
                    }
                }
            });
        }
        
        Boako.League.State.bingoBoard = initializedBoard;
        Boako.League.State.boardGames25 = initializedGames;
        Boako.League.State.boardLogos25 = initializedGameLogos;
        Boako.League.State.bingoTeamLogos25 = initializedTeamLogos;
        Boako.League.State.missionDifficulties = initializedDiffs;
        
        Boako.League.State.teamBingoScores = scoreData || [];
        
        Boako.League.renderBingoBoard();

    } catch (err) {
        console.error("지능형 시즌 트래커 구동 중 치명적 오류:", err);
        if (grid) grid.innerHTML = `<div class="col-span-5 text-center py-10 font-black text-rose-500">❌ 시즌 연동 연산 장치 오류 (${err.message})</div>`;
    }
};

// ====================================================================
// 🖼️ [마킹 사이즈 극대화] 밴댕이 똥꾸멍 배지 삭제 ➡️ 거대 오버레이 마킹 도입
// ====================================================================
Boako.League.renderBingoBoard = function() {
    const grid = document.getElementById('bingo-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    const winCells = Boako.League.calculateWinningCells();
    const myTeamName = Boako.state.team?.info?.team_name;
    const difficulties = Boako.League.State.missionDifficulties || Array(25).fill("EASY");
    
    Boako.League.State.bingoBoard.forEach((ownerTeam, idx) => {
        const cell = document.createElement('div');
        const isWinner = winCells.includes(idx);
        const isMyTeam = ownerTeam && ownerTeam === myTeamName;
        const diffStatus = difficulties[idx] || "EASY";
        
        let bgClass = "bg-slate-50 border-slate-200/60";
        if (ownerTeam) {
            if (isMyTeam) {
                bgClass = "bg-gradient-to-br from-violet-600 to-indigo-600 text-white border-violet-400 bingo-won-pulse border-2 scale-[0.97] shadow-md";
                if (!isWinner) {
                    bgClass = "bg-gradient-to-br from-violet-50 to-indigo-50 border-violet-300 text-violet-950 font-black scale-[0.97] shadow-inner border";
                }
            } else {
                bgClass = isWinner 
                    ? "bg-slate-700 text-slate-100 border-slate-500 scale-[0.97] opacity-80" 
                    : "bg-slate-100 border-slate-200 text-slate-700 font-bold scale-[0.97]";
            }
        }

        if (diffStatus === 'HARD_CENTER_PENALTY') {
            bgClass += " fire-border-glow border-orange-500 z-20 scale-[0.98]";
        }

        cell.className = `h-24 rounded-2xl border flex flex-col items-center justify-center p-2 gap-1.5 transition-all text-center relative overflow-hidden group ${bgClass}`;
        
        const gameLogoUrl = Boako.League.State.boardLogos25[idx];
        const gameImageHtml = gameLogoUrl 
            ? `<div class="w-full h-[52px] flex items-center justify-center pointer-events-none z-10">
                   <img src="${gameLogoUrl}" alt="${Boako.League.State.boardGames25[idx]}" 
                        class="w-full h-auto max-h-full object-contain opacity-40 transition-opacity"
                        style="filter: drop-shadow(0px 2px 3px rgba(15, 23, 42, 0.28));">
               </div>`
            : `<div class="w-full h-[52px] flex items-center justify-center opacity-10 pointer-events-none text-2xl bg-slate-100 rounded-lg">🎲</div>`;

        // 🌟 [거대 점유 오버레이] 로고와 팀명이 칸의 중앙을 쾅! 가리도록 렌더링
        let massiveOverlayHtml = '';
        if (ownerTeam) {
            const teamLogoUrl = Boako.League.State.bingoTeamLogos25[idx] || 'https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challenge.png';
            massiveOverlayHtml = `
                <div class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/40 backdrop-blur-[2.5px] transition-all">
                    <img src="${teamLogoUrl}" alt="${ownerTeam}" class="w-12 h-12 object-contain drop-shadow-xl transform group-hover:scale-110 transition-transform duration-300">
                    <span class="mt-1 px-2.5 py-0.5 bg-slate-900/90 text-white text-[10px] font-black rounded-lg shadow-sm backdrop-blur-md">${ownerTeam}</span>
                </div>
            `;
        }

        let diffBadgeHtml = '';
        if (diffStatus === 'HARD_CENTER_PENALTY') {
            diffBadgeHtml = `<span class="absolute top-1.5 right-1.5 z-30 bg-gradient-to-r from-orange-500 to-red-500 text-white font-black text-[8px] px-1.5 py-0.5 rounded-md shadow-sm">🔥 CENTER</span>`;
        } else {
            const diffColors = {
                EASY: "bg-emerald-500/90 text-white",
                NORMAL: "bg-blue-500/90 text-white",
                HARD: "bg-rose-500/90 text-white"
            };
            diffBadgeHtml = `<span class="absolute top-1.5 right-1.5 z-30 ${diffColors[diffStatus] || 'bg-slate-500'} font-black text-[7px] px-1 py-0.5 rounded shadow-sm scale-90">${diffStatus}</span>`;
        }
        
        const crownHtml = isWinner ? `<span class="absolute top-1.5 ${diffStatus === 'HARD_CENTER_PENALTY' ? 'right-14' : 'right-9'} text-xs text-amber-400 animate-bounce z-30">👑</span>` : '';
        
        cell.innerHTML = `
            ${massiveOverlayHtml}
            ${diffBadgeHtml}
            ${gameImageHtml}
            <div class="w-full z-10">
                <div class="w-full px-1 bg-white/70 backdrop-blur-[2px] py-1 rounded-lg border border-white/50 shadow-sm flex items-center justify-center min-h-[28px]">
                    <p class="text-[9px] font-black text-slate-800 tracking-tight leading-tight line-clamp-2 break-all">${Boako.League.State.boardGames25[idx]}</p>
                </div>
            </div>
            ${crownHtml}
        `;
        
        grid.appendChild(cell);
    });

    Boako.League.updateStats();
};

if (!document.getElementById('bingo-fire-border-style')) {
    const styleId = document.createElement('style');
    styleId.id = 'bingo-fire-border-style';
    styleId.innerHTML = `
        @keyframes fireBorderGlow {
            0% { border-color: #f97316; box-shadow: 0 0 6px #ea580c, inset 0 0 4px rgba(234, 88, 12, 0.2); }
            50% { border-color: #ef4444; box-shadow: 0 0 14px #dc2626, inset 0 0 8px rgba(220, 38, 38, 0.4); }
            100% { border-color: #f59e0b; box-shadow: 0 0 6px #d97706, inset 0 0 5px rgba(217, 119, 6, 0.3); }
        }
        .fire-border-glow {
            animation: fireBorderGlow 1.4s infinite ease-in-out alternate !important;
            border-width: 2px !important;
        }
    `;
    document.head.appendChild(styleId);
}

Boako.League.calculateWinningCells = function() {
    const size = 5; const winningSet = new Set(); const board = Boako.League.State.bingoBoard;
    for (let r = 0; r < size; r++) { let base = board[r * size]; if (base) { let match = true; for (let c = 1; c < size; c++) if (board[r * size + c] !== base) match = false; if (match) for (let c = 0; c < size; c++) winningSet.add(r * size + c); } }
    for (let c = 0; c < size; c++) { let base = board[c]; if (base) { let match = true; for (let r = 1; r < size; r++) if (board[r * size + c] !== base) match = false; if (match) for (let r = 0; r < size; r++) winningSet.add(r * size + c); } }
    let baseDiag1 = board[0]; if (baseDiag1) { let match = true; for (let i = 1; i < size; i++) if (board[i * size + i] !== baseDiag1) match = false; if (match) for (let i = 0; i < size; i++) winningSet.add(i * size + i); }
    let baseDiag2 = board[size - 1]; if (baseDiag2) { let match = true; for (let i = 1; i < size; i++) if (board[i * size + (size - 1 - i)] !== baseDiag2) match = false; if (match) for (let i = 0; i < size; i++) winningSet.add(i * size + (size - 1 - i)); }
    return Array.from(winningSet);
};

// ====================================================================
// 🏅 [스코어보드 방패 박멸] 찐 팀 로고 아이콘으로 교체 완료
// ====================================================================
Boako.League.updateStats = function() {
    const statContainer = document.getElementById('team-stat-rows-container');
    if (!statContainer) return;

    const scoreData = Boako.League.State.teamBingoScores || [];

    if (scoreData.length === 0) {
        statContainer.innerHTML = `<div class="text-center py-6 text-slate-400 font-bold border border-dashed border-slate-200 rounded-xl">🏳️ 현재 빙고를 완성한 팀이 없습니다.</div>`;
        return;
    }

    let html = '';
    
    scoreData.forEach(row => {
        const teamName = row.team_name;
        const basicSlots = row.basic_slots_score || 0;
        const totalLines = row.bingo_lines_count || 0;
        const totalScore = row.bingo_total_score || 0;
        
        // 🌟 DB에서 넘어온 팀 로고 혹은 빙고 보드에 맵핑된 팀 로고 긁어오기 (없으면 챌린지 로고 대체)
        let teamLogoUrl = row.team_logo_url || row.logo_url;
        if (!teamLogoUrl) {
            const boardIdx = Boako.League.State.bingoBoard.indexOf(teamName);
            if (boardIdx !== -1) {
                teamLogoUrl = Boako.League.State.bingoTeamLogos25[boardIdx];
            }
        }
        teamLogoUrl = teamLogoUrl || 'https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challenge.png';

        let badgesHtml = '';
        
        for (let i = 1; i <= 5; i++) {
            if (row[`is_row_${i}_completed`] === true) {
                badgesHtml += `<span class="bg-blue-50 text-blue-700 border border-blue-200 text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-sm">↔️ 가로 ${i}열</span>`;
            }
        }
        for (let i = 1; i <= 5; i++) {
            if (row[`is_col_${i}_completed`] === true) {
                badgesHtml += `<span class="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-sm">↕️ 세로 ${i}행</span>`;
            }
        }
        if (row.is_diagonal_down_completed === true) {
            badgesHtml += `<span class="bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-sm">↘️ 대각선 우하</span>`;
        }
        if (row.is_diagonal_up_completed === true) {
            badgesHtml += `<span class="bg-violet-50 text-violet-700 border border-violet-200 text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-sm">↗️ 대각선 우상</span>`;
        }
        
        if (!badgesHtml) {
            badgesHtml = `<span class="text-slate-400 font-medium text-[10px] italic">현재 빙고 조합 연산 중...</span>`;
        }

        html += `
            <div class="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-sm space-y-3 transition-all hover:border-slate-300">
                <div class="flex justify-between items-center">
                    <span class="font-black text-slate-800 text-xs flex items-center gap-1.5">
                        <img src="${teamLogoUrl}" class="w-4 h-4 object-contain rounded-full shadow-sm bg-slate-50 border border-slate-100"> ${teamName}
                    </span>
                    <div class="text-right">
                        <span class="text-[10px] text-slate-400 font-bold">총점</span>
                        <span class="text-indigo-600 font-black text-sm ml-0.5">${totalScore} XP</span>
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-2 text-center bg-slate-50 p-2 rounded-xl text-[10px] font-bold text-slate-500 border border-slate-100">
                    <div>점유 영토 <span class="text-slate-800 font-black">${basicSlots}칸</span></div>
                    <div class="border-l border-slate-200">완성 라인 <span class="text-amber-500 font-black">${totalLines}줄</span></div>
                </div>
                
                <div class="flex flex-wrap gap-1 pt-1 border-t border-dashed border-slate-100">
                    ${badgesHtml}
                </div>
            </div>
        `;
    });

    statContainer.innerHTML = html;
};

// ==========================================
// 🔥 탭 2: 챌린지방 (커스텀 드롭다운 풀적용)
// ==========================================
Boako.League.selectChallengeOpt = function(type, val, label) {
    Boako.League.State.challengeParams[type] = val;
    document.getElementById(`challenge-${type}-label`).innerText = label;
    Boako.League.toggleDropdown(`challenge-${type}`);
};

Boako.League.getChallengeHTML = function() {
    const p = Boako.League.State.challengeParams;
    
    return `
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div class="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-4 h-fit">
                <h5 class="font-black text-slate-800 text-sm border-b border-slate-200/60 pb-2 flex items-center gap-2">
                    <i data-lucide="pencil" class="w-4 h-4 text-violet-600"></i> 결투 혈투장 작성
                </h5>
                <div class="space-y-3 text-xs font-bold text-slate-600">
                    
                    <div class="relative z-30">
                        <label class="block mb-1.5">도전 가문</label>
                        <button onclick="Boako.League.toggleDropdown('challenge-attacker')" class="w-full bg-white px-3.5 py-3 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between text-xs font-black text-slate-700 hover:border-violet-400">
                            <span id="challenge-attacker-label">${p.attacker === '블루 타이거' ? '💙 블루 타이거' : p.attacker === '레드 피닉스' ? '❤️ 레드 피닉스' : p.attacker === '그린 드래곤' ? '💚 그린 드래곤' : '💛 골드 세이버'}</span>
                            <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-slate-400"></i>
                        </button>
                        <div id="challenge-attacker-overlay" onclick="Boako.League.toggleDropdown('challenge-attacker')" class="hidden fixed inset-0 z-40"></div>
                        <div id="challenge-attacker-menu" class="hidden absolute top-full left-0 mt-1 w-full bg-slate-800 rounded-xl shadow-xl border border-slate-700 overflow-hidden z-50">
                            <div onclick="Boako.League.selectChallengeOpt('attacker', '블루 타이거', '💙 블루 타이거')" class="px-4 py-3 cursor-pointer text-slate-200 hover:bg-slate-700">💙 블루 타이거</div>
                            <div onclick="Boako.League.selectChallengeOpt('attacker', '레드 피닉스', '❤️ 레드 피닉스')" class="px-4 py-3 cursor-pointer text-slate-200 hover:bg-slate-700">❤️ 레드 피닉스</div>
                            <div onclick="Boako.League.selectChallengeOpt('attacker', '그린 드래곤', '💚 그린 드래곤')" class="px-4 py-3 cursor-pointer text-slate-200 hover:bg-slate-700">💚 그린 드래곤</div>
                            <div onclick="Boako.League.selectChallengeOpt('attacker', '골드 세이버', '💛 골드 세이버')" class="px-4 py-3 cursor-pointer text-slate-200 hover:bg-slate-700">💛 골드 세이버</div>
                        </div>
                    </div>

                    <div class="relative z-20">
                        <label class="block mb-1.5">적출 대상 가문</label>
                        <button onclick="Boako.League.toggleDropdown('challenge-defender')" class="w-full bg-white px-3.5 py-3 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between text-xs font-black text-slate-700 hover:border-violet-400">
                            <span id="challenge-defender-label">${p.defender === '레드 피닉스' ? '❤️ 레드 피닉스' : p.defender === '블루 타이거' ? '💙 블루 타이거' : p.defender === '그린 드래곤' ? '💚 그린 드래곤' : '💛 골드 세이버'}</span>
                            <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-slate-400"></i>
                        </button>
                        <div id="challenge-defender-overlay" onclick="Boako.League.toggleDropdown('challenge-defender')" class="hidden fixed inset-0 z-40"></div>
                        <div id="challenge-defender-menu" class="hidden absolute top-full left-0 mt-1 w-full bg-slate-800 rounded-xl shadow-xl border border-slate-700 overflow-hidden z-50">
                            <div onclick="Boako.League.selectChallengeOpt('defender', '레드 피닉스', '❤️ 레드 피닉스')" class="px-4 py-3 cursor-pointer text-slate-200 hover:bg-slate-700">❤️ 레드 피닉스</div>
                            <div onclick="Boako.League.selectChallengeOpt('defender', '블루 타이거', '💙 블루 타이거')" class="px-4 py-3 cursor-pointer text-slate-200 hover:bg-slate-700">💙 블루 타이거</div>
                            <div onclick="Boako.League.selectChallengeOpt('defender', '그린 드래곤', '💚 그린 드래곤')" class="px-4 py-3 cursor-pointer text-slate-200 hover:bg-slate-700">💚 그린 드래곤</div>
                            <div onclick="Boako.League.selectChallengeOpt('defender', '골드 세이버', '💛 골드 세이버')" class="px-4 py-3 cursor-pointer text-slate-200 hover:bg-slate-700">💛 골드 세이버</div>
                        </div>
                    </div>

                    <div class="relative z-10">
                        <label class="block mb-1.5">종목 보드게임</label>
                        <button onclick="Boako.League.toggleDropdown('challenge-game')" class="w-full bg-white px-3.5 py-3 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between text-xs font-black text-slate-700 hover:border-violet-400">
                            <span id="challenge-game-label">${p.game}</span>
                            <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-slate-400"></i>
                        </button>
                        <div id="challenge-game-overlay" onclick="Boako.League.toggleDropdown('challenge-game')" class="hidden fixed inset-0 z-40"></div>
                        <div id="challenge-game-menu" class="hidden absolute top-full left-0 mt-1 w-full bg-slate-800 rounded-xl shadow-xl border border-slate-700 overflow-hidden z-50">
                            <div onclick="Boako.League.selectChallengeOpt('game', '스플렌더', '스플렌더 (Splendor)')" class="px-4 py-3 cursor-pointer text-slate-200 hover:bg-slate-700">스플렌더 (Splendor)</div>
                            <div onclick="Boako.League.selectChallengeOpt('game', '아크 노바', '아크 노바 (Ark Nova)')" class="px-4 py-3 cursor-pointer text-slate-200 hover:bg-slate-700">아크 노바 (Ark Nova)</div>
                            <div onclick="Boako.League.selectChallengeOpt('game', '윙스팬', '윙스팬 (Wingspan)')" class="px-4 py-3 cursor-pointer text-slate-200 hover:bg-slate-700">윙스팬 (Wingspan)</div>
                            <div onclick="Boako.League.selectChallengeOpt('game', '쿼리도', '쿼리도 (Quoridor)')" class="px-4 py-3 cursor-pointer text-slate-200 hover:bg-slate-700">쿼리도 (Quoridor)</div>
                        </div>
                    </div>

                    <div>
                        <label class="block mb-1.5">매운 도발 구절</label>
                        <textarea id="challenge-msg" rows="3" class="w-full bg-white border border-slate-200 rounded-xl p-2.5 outline-none focus:border-violet-500" placeholder="상대의 사기를 무너뜨릴 한마디를 적어보세요."></textarea>
                    </div>
                </div>
                <button onclick="Boako.League.registerChallenge()" class="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-black text-xs py-3 rounded-xl shadow-lg transition-all">🔥 도전장 릴리즈</button>
            </div>
            <div class="lg:col-span-2 bg-slate-50 border border-slate-200/80 rounded-2xl p-5">
                <h5 class="font-black text-slate-800 text-sm border-b border-slate-200/60 pb-2.5 mb-4 flex items-center gap-2">
                    <i data-lucide="flame" class="w-4 h-4 text-orange-500 animate-pulse"></i> 실시간 격투 챌린지 피드
                </h5>
                <div id="challenge-list" class="space-y-4"></div>
            </div>
        </div>
    `;
};

Boako.League.renderChallenges = function() {
    const container = document.getElementById('challenge-list');
    if (!container) return;
    container.innerHTML = '';

    Boako.League.State.challenges.forEach(p => {
        const card = document.createElement('div');
        card.className = `p-4.5 rounded-2xl border ${p.accepted ? 'bg-slate-100/70 border-emerald-300' : 'bg-white border-slate-200'} transition-all`;
        card.innerHTML = `
            <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-1.5">
                    <span class="text-xs font-black text-violet-700 px-2 py-0.5 rounded-lg bg-violet-50">${p.attacker}</span>
                    <span class="text-xs font-bold text-slate-400">vs</span>
                    <span class="text-xs font-black text-rose-600 px-2 py-0.5 rounded-lg bg-rose-50">${p.defender}</span>
                </div>
                <span class="text-[10px] font-black bg-amber-100 border border-amber-200 text-amber-700 px-2 py-0.5 rounded-md">종목: ${p.game}</span>
            </div>
            <p class="text-sm font-semibold text-slate-600 bg-slate-50/50 p-3 rounded-xl border border-slate-100 mb-3 italic">"${p.message}"</p>
            <div class="flex items-center justify-between">
                <span class="text-[9px] text-slate-400 font-bold">도전 ID: #${p.id}</span>
                ${p.accepted 
                    ? `<span class="text-xs text-emerald-600 font-extrabold flex items-center gap-1"><i data-lucide="check" class="w-4 h-4"></i> 피의 혈투 매치 수락됨</span>` 
                    : `<button onclick="Boako.League.acceptChallenge(${p.id})" class="bg-violet-600 hover:bg-violet-700 text-white font-black text-[11px] px-3.5 py-1.5 rounded-lg shadow-sm">결투 대폭 수락</button>`
                }
            </div>
        `;
        container.appendChild(card);
    });
};

Boako.League.registerChallenge = function() {
    const p = Boako.League.State.challengeParams;
    const attacker = p.attacker;
    const defender = p.defender;
    const game = p.game;
    const message = document.getElementById('challenge-msg').value || "정정당당히 필드에서 무꿇을 선사하겠습니다.";
    
    if (attacker === defender) return;
    Boako.League.State.challenges.unshift({
        id: Boako.League.State.challenges.length + 1,
        attacker,
        defender,
        game,
        message,
        accepted: false
    });
    document.getElementById('challenge-msg').value = '';
    Boako.League.renderChallenges();
};

Boako.League.acceptChallenge = function(id) {
    const target = Boako.League.State.challenges.find(p => p.id === id);
    if (target) {
        target.accepted = true;
        Boako.League.renderChallenges();
    }
};

// ==========================================
// 👑 탭 3: 챔피언 콘텐츠
// ==========================================
Boako.League.getChampionHTML = function() {
    return `
        <div class="space-y-4">
            <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                <h5 class="font-black text-slate-800 text-sm flex items-center gap-2">
                    <i data-lucide="trophy" class="w-4 h-4 text-amber-500"></i> 실시간 시즌 인기 게임 및 종목별 MVP 챔피언
                </h5>
                <div class="relative w-full max-w-xs">
                    <input onkeyup="Boako.League.filterChampions()" id="champion-search" type="text" class="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3.5 pr-10 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-violet-500 focus:bg-white" placeholder="게임 혹은 플레이어 검색...">
                    <i data-lucide="search" class="absolute right-3.5 top-2 w-4 h-4 text-slate-400"></i>
                </div>
            </div>
            <div class="border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-sm overflow-x-auto">
                <table class="w-full text-left text-xs min-w-[600px]">
                    <thead class="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                        <tr>
                            <th class="p-4 text-center">인기 순위</th>
                            <th class="p-4">게임 종목</th>
                            <th class="p-4">챔피언</th>
                            <th class="p-4">소속 팀</th>
                            <th class="p-4 text-right">획득 RP</th>
                        </tr>
                    </thead>
                    <tbody id="champion-tbody" class="divide-y divide-slate-100 font-semibold text-slate-700">
                        <tr>
                            <td colspan="6" class="p-10 text-center text-slate-400 font-bold">
                                🔄 v_game_popularity_mvp 뷰 데이터 동기화 중...
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
};

Boako.League.fetchAndRenderChampions = async function() {
    const tbody = document.getElementById('champion-tbody');
    if (!tbody) return;
    try {
        if (!Boako.db) {
            tbody.innerHTML = `<tr><td colspan="6" class="p-10 text-center text-slate-400 font-bold">⚠️ Supabase 인스턴스가 발견되지 않았습니다.</td></tr>`;
            return;
        }
        const { data, error } = await Boako.db.from('v_game_popularity_mvp').select('*').limit(10); 
        if (error) throw error;
        Boako.League.State.champions = data || [];
        Boako.League.drawChampionRows(Boako.League.State.champions);
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-10 text-center text-red-400 font-bold">❌ 가상 뷰 연동 실패</td></tr>`;
    }
};

Boako.League.drawChampionRows = function(dataList) {
    const tbody = document.getElementById('champion-tbody');
    if (!tbody) return; 
    tbody.innerHTML = '';
    
    if (dataList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center text-slate-400 font-bold">이번 시즌 집계된 데이터가 없습니다.</td></tr>`;
        return;
    }
    
    let rowsHtml = '';
    dataList.forEach((row, i) => {
        const gameRank = i + 1;
        const gameName = row.game_name || '미정 종목';
        const mvpName = row.mvp_nickname || '집계 중';
        const mvpTeam = row.mvp_team_name || '무소속';
        const totalRp = row.mvp_total_rp || 0;
        const totalPlays = row.total_records_count || 0;
        const uniquePlayers = row.total_unique_players || 0;

       rowsHtml += `
    <tr class="hover:bg-slate-50/50 transition-colors">
        <td class="p-4 text-center font-black text-violet-600"><span class="bg-violet-50 px-2.5 py-1 rounded-lg border border-violet-100 text-xs">TOP ${gameRank}</span></td>
        
        <td class="p-4 font-black text-slate-800 text-sm">
            <div>${gameName}</div>
            <div class="text-[10px] text-slate-400 font-bold mt-0.5 flex items-center gap-1.5">
                <span class="text-violet-600">🔥 총 ${totalPlays}회 플레이</span>
                <span class="w-0.5 h-2 bg-slate-200"></span>
                <span class="text-blue-600">👥 ${uniquePlayers}명 참여</span>
            </div>
        </td>
        
       <td class="p-4">
            <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center shrink-0">
                    <img src="https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/CHAMPION.png" 
                         alt="CHAMPION BADGE" 
                         class="w-full h-full object-contain">
                </div>
                <span class="font-extrabold text-slate-900">${mvpName}</span>
            </div>
        </td>
        
       <td class="p-4 text-slate-500 font-bold relative group/handler">
            <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center shadow-sm shrink-0 relative cursor-pointer">
                    <img src="${row.mvp_team_logo || 'https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challenge.png'}" 
                         alt="TEAM LOGO" 
                         class="w-full h-full object-contain rounded-full">
                </div>
                <span class="cursor-pointer">${mvpTeam}</span>

                <div class="invisible opacity-0 group-hover/handler:visible group-hover/handler:opacity-100 fixed -translate-x-1/2 -translate-y-full mb-2 w-32 h-32 p-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-[9999] transition-all duration-200 pointer-events-none flex items-center justify-center"
                     style="top: var(--tooltip-top, auto); left: var(--tooltip-left, auto);">
                    <img src="${row.mvp_team_logo || 'https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challenge.png'}" 
                         alt="LARGE TEAM LOGO" 
                         class="w-full h-full object-contain">
                    <div class="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-white border-r border-b border-slate-200 rotate-45"></div>
                </div>
            </div>
        </td>
        
        <td class="p-4 text-right font-black text-amber-500 text-sm">${totalRp.toLocaleString()} RP</td>
    </tr>
`;
    });
    
    tbody.innerHTML = rowsHtml;
    
    tbody.querySelectorAll('tr').forEach(tr => {
        const handler = tr.querySelector('.group\\/handler');
        if (!handler) return;
        handler.addEventListener('mousemove', (e) => {
            const tooltip = handler.querySelector('.fixed');
            if (tooltip) {
                tooltip.style.setProperty('--tooltip-top', `${e.clientY - 10}px`);
                tooltip.style.setProperty('--tooltip-left', `${e.clientX}px`);
            }
        });
    });
};

Boako.League.filterChampions = function() {
    const query = document.getElementById('champion-search')?.value.toLowerCase() || "";
    const filtered = Boako.League.State.champions.filter(c => {
        const game = (c.game_name || '').toLowerCase();
        const name = (c.mvp_nickname || '').toLowerCase(); 
        return game.includes(query) || name.includes(query);
    });
    Boako.League.drawChampionRows(filtered);
};

// ==========================================
// 🏅 탭 4: 킹 오브 리그 (토너먼트 껍데기 보존 구역)
// ==========================================
Boako.League.getKingOfLeagueHTML = function() {
    return `
        <div class="space-y-6">
            <div class="text-center py-4 border-b border-slate-100">
                <span class="bg-violet-100 text-violet-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">Playoff Brackets</span>
                <h4 class="font-black text-slate-800 text-lg mt-2">정규 오프라인 토너먼트 대진표</h4>
                <p class="text-xs text-slate-400 font-bold mt-1">공식 경기 기록이 축적되어 실시간 트리가 연계 갱신됩니다.</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 items-center max-w-3xl mx-auto pt-4">
                <div class="space-y-8">
                    <div class="bg-slate-50 border border-slate-200/80 p-4 rounded-2xl space-y-2">
                        <div class="text-[10px] text-violet-600 font-extrabold uppercase tracking-wide">준결승 A그룹</div>
                        <div class="flex items-center justify-between p-1.5 bg-violet-50 text-violet-800 rounded-lg px-3 text-xs font-black border border-violet-100"><span>💙 Team Arch</span><span>3</span></div>
                        <div class="flex items-center justify-between p-1.5 text-slate-400 px-3 text-xs font-bold"><span>❤️ Team Odin</span><span>1</span></div>
                    </div>
                    <div class="bg-slate-50 border border-slate-200/80 p-4 rounded-2xl space-y-2">
                        <div class="text-[10px] text-violet-600 font-extrabold uppercase tracking-wide">준결승 B그룹</div>
                        <div class="flex items-center justify-between p-1.5 text-slate-400 px-3 text-xs font-bold"><span>💚 Team Green</span><span>0</span></div>
                        <div class="flex items-center justify-between p-1.5 bg-violet-50 text-violet-800 rounded-lg px-3 text-xs font-black border border-violet-100"><span>💛 Team Gold</span><span>3</span></div>
                    </div>
                </div>
                <div class="flex flex-col justify-around h-full py-8 text-center text-xs text-slate-400 font-bold hidden md:flex">
                    <div class="flex items-center justify-center gap-1.5 bg-slate-100/80 border border-slate-200 p-2 rounded-xl"><span>Arch 승전</span> <i data-lucide="arrow-right" class="w-4 h-4 text-violet-500"></i></div>
                    <div class="flex items-center justify-center gap-1.5 bg-slate-100/80 border border-slate-200 p-2 rounded-xl"><span>Gold 승전</span> <i data-lucide="arrow-right" class="w-4 h-4 text-violet-500"></i></div>
                </div>
                <div class="bg-gradient-to-br from-amber-500/5 to-orange-500/5 border border-amber-300 p-5 rounded-3xl text-center space-y-3.5 relative overflow-hidden">
                    <div class="text-[11px] font-black text-amber-700 tracking-wider flex items-center justify-center gap-1"><span>🏆</span> GRAND CHAMPIONSHIP</div>
                    <div class="bg-violet-600 text-white p-2.5 rounded-xl text-xs font-black flex justify-between shadow-sm"><span>💙 Team Arch</span><span class="bg-violet-800 text-[10px] px-1.5 rounded">수성 세력</span></div>
                    <div class="p-0.5 text-slate-400 font-black text-xs">VS</div>
                    <div class="bg-amber-500 text-slate-950 p-2.5 rounded-xl text-xs font-black flex justify-between"><span>💛 Team Gold</span><span class="bg-amber-600 text-[10px] text-slate-950 px-1.5 rounded">도전 세력</span></div>
                    <button onclick="if(typeof sfx !== 'undefined') sfx.playBingo();" class="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs py-2.5 rounded-xl transition-all shadow-md mt-2">대진 상황 예측</button>
                </div>
            </div>
        </div>
    `;
};
