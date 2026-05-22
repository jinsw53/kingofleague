/**
 * 🎯 [LEAGUE] 실시간 리그 콘텐츠 전당 (상단 수평 레이아웃 및 거대 배너 완결본)
 * 관리 책임자: 소장님 MASTER
 */

Boako.League = Boako.League || {};

// 💡 1. 리그 전용 로컬 상태 관리 (명칭 일치 및 오염 방지)
Boako.League.State = {
    currentTab: 'bingo',
    selectedTeam: 'blue',
    bingoBoard: Array(25).fill(null),
    // ⚔️ challenge 가문 명칭 정돈 완료
    challenges: [
        { id: 1, attacker: '블루 타이거', defender: '레드 피닉스', game: '스플렌더', message: '스플렌더 3라운드 안에 귀족 카드 다 털고 챔피언 사수하겠습니다.', accepted: false },
        { id: 2, attacker: '그린 드래곤', defender: '골드 세이버', game: '아크 노바', message: '대칭 배치 동물원의 참맛을 확실히 교육해 드립니다.', accepted: true }
    ],
    champions: [], 
    boardGames25: [
        "스플렌더", "아크 노바", "윙스팬", "쿼리도", "티켓 투 라이드", 
        "카르카손", "캐스케디아", "센추리", "아발론", "한밤의 늑대인간", 
        "라스베가스", "다빈치코드", "달무티", "젝스님트", "스컬", 
        "루미큐브", "테라포밍", "코드네임", "카탄", "패치워크", 
        "러브레터", "딕싯", "가이아", "오를레앙", "하모니즈"
    ]
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

// 💡 3. 서브 탭 제어 및 동적 사출 컨트롤러 (수평 라인 안에서 배너 이미지만 샥샥 교체)
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

    // 🎯 버튼을 누르면 좌측 확장 구역의 'league-header-main-img' 요소를 찾아 배너를 실시간 변환합니다.
  const mainImg = document.getElementById('league-header-main-img');
    if (mainImg) {
        // 🎯 [완전 고정] 2:1 비율 상자 안에서 찌그러짐 없이 완벽하게 축소되도록 contain 유지
        mainImg.style.objectFit = "contain"; 

        if (tabId === 'bingo') {
            mainImg.src = "https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/teambingo.png";
        } else if (tabId === 'challenge') {
            mainImg.src = "https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challenge.png";
        } else if (tabId === 'champion') {
            mainImg.src = "https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/CHAMPION.png";
        } else if (tabId === 'king_of_league') {
            // 🎯 [주소 싱크 완료] 소장님이 세팅하신 찐 수파베이스 주소 그대로 유지
            mainImg.src = "https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/king_of_league.png";
        }
    }

    const container = document.getElementById('league-view-container');
    if (!container) return;

    if (tabId === 'bingo') {
        container.innerHTML = Boako.League.getBingoHTML();
        Boako.League.renderBingoBoard();
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

// ==========================================
// 🎲 탭 1: 5x5 팀 빙고전 오리지널 순정 로직
// ==========================================
Boako.League.getBingoHTML = function() {
    return `
        <div class="space-y-6">
            <div class="p-5 sm:p-6 bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h3 class="font-black text-slate-800 text-base">팀 빙고 실시간 영토전</h3>
                    <p class="text-xs text-slate-500 font-bold mt-1">우리 팀 소유의 타일을 늘려서 가로/세로/대각선 5칸 연결을 완성하세요!</p>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="Boako.League.randomizeBoard()" class="bg-violet-600 hover:bg-violet-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow transition-colors">무작위 영토 부여</button>
                    <button onclick="Boako.League.clearBoard()" class="bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold text-xs px-4 py-2.5 rounded-xl transition-colors">초기화</button>
                </div>
            </div>

            <div class="flex flex-wrap items-center justify-center gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200/60">
                <span class="text-xs font-black text-slate-400 mr-2 uppercase tracking-wider">가문 색상 설정:</span>
                <button onclick="Boako.League.selectTeam('blue')" id="team-sel-blue" class="px-4 py-2 text-xs font-bold rounded-xl transition-all">💙 블루 타이거</button>
                <button onclick="Boako.League.selectTeam('red')" id="team-sel-red" class="px-4 py-2 text-xs font-bold rounded-xl transition-all">❤️ 레드 피닉스</button>
                <button onclick="Boako.League.selectTeam('emerald')" id="team-sel-emerald" class="px-4 py-2 text-xs font-bold rounded-xl transition-all">💚 그린 드래곤</button>
                <button onclick="Boako.League.selectTeam('amber')" id="team-sel-amber" class="px-4 py-2 text-xs font-bold rounded-xl transition-all">💛 골드 세이버</button>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div class="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
                    <div class="grid grid-cols-5 gap-2" id="bingo-grid"></div>
                </div>
                <div class="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-4">
                    <h5 class="font-black text-slate-800 text-sm border-b border-violet-100 pb-2.5 flex items-center gap-2">
                        <i data-lucide="award" class="w-4 h-4 text-amber-500"></i> 가문별 실시간 영토 점유 현황
                    </h5>
                    <div class="space-y-2 text-xs">
                        <div class="flex justify-between items-center bg-blue-50/50 border border-blue-100 p-3 rounded-xl">
                            <span class="font-black text-blue-700">💙 블루 타이거</span>
                            <span class="font-bold text-slate-600">영토 <span id="stat-blue-tiles" class="text-blue-600 font-extrabold text-sm">0</span>칸 / 빙고 <span id="stat-blue-lines" class="text-amber-500 font-extrabold text-sm">0</span>줄</span>
                        </div>
                        <div class="flex justify-between items-center bg-rose-50/50 border border-rose-100 p-3 rounded-xl">
                            <span class="font-black text-rose-700">❤️ 레드 피닉스</span>
                            <span class="font-bold text-slate-600">영토 <span id="stat-red-tiles" class="text-rose-600 font-extrabold text-sm">0</span>칸 / 빙고 <span id="stat-red-lines" class="text-amber-500 font-extrabold text-sm">0</span>줄</span>
                        </div>
                        <div class="flex justify-between items-center bg-emerald-50/50 border border-emerald-100 p-3 rounded-xl">
                            <span class="font-black text-emerald-700">💚 그린 드래곤</span>
                            <span class="font-bold text-slate-600">영토 <span id="stat-emerald-tiles" class="text-emerald-600 font-extrabold text-sm">0</span>칸 / 빙고 <span id="stat-emerald-lines" class="text-amber-500 font-extrabold text-sm">0</span>줄</span>
                        </div>
                        <div class="flex justify-between items-center bg-amber-50/50 border border-amber-100 p-3 rounded-xl">
                            <span class="font-black text-amber-800">💛 골드 세이버</span>
                            <span class="font-bold text-slate-600">영토 <span id="stat-amber-tiles" class="text-amber-700 font-extrabold text-sm">0</span>칸 / 빙고 <span id="stat-amber-lines" class="text-amber-500 font-extrabold text-sm">0</span>줄</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
};

Boako.League.selectTeam = function(teamId) {
    if (typeof sfx !== 'undefined') sfx.playClick();
    Boako.League.State.selectedTeam = teamId;
    const teams = ['blue', 'red', 'emerald', 'amber'];
    const classConfig = {
        blue: "bg-blue-600 text-white shadow-md",
        red: "bg-red-600 text-white shadow-md",
        emerald: "bg-emerald-600 text-white shadow-md",
        amber: "bg-amber-500 text-slate-900 shadow-md font-extrabold"
    };
    teams.forEach(t => {
        const btn = document.getElementById(`team-sel-${t}`);
        if (btn) btn.className = (t === teamId) ? `px-4 py-2 text-xs font-bold rounded-xl transition-all ${classConfig[t]}` : "px-4 py-2 text-xs font-bold rounded-xl transition-all text-slate-500 hover:bg-slate-100";
    });
};

Boako.League.renderBingoBoard = function() {
    const grid = document.getElementById('bingo-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const teamStyles = { blue: 'bg-blue-600 text-white border-blue-400 shadow-inner scale-[0.97]', red: 'bg-red-600 text-white border-red-400 shadow-inner scale-[0.97]', emerald: 'bg-emerald-600 text-white border-emerald-400 shadow-inner scale-[0.97]', amber: 'bg-amber-500 text-slate-950 border-amber-300 font-extrabold shadow-inner scale-[0.97]' };
    const winCells = Boako.League.calculateWinningCells();
    Boako.League.State.bingoBoard.forEach((owner, idx) => {
        const cell = document.createElement('button');
        const isWinner = winCells.includes(idx);
        cell.className = `h-20 rounded-2xl border flex flex-col items-center justify-center p-1.5 transition-all text-center relative overflow-hidden group ${owner ? `${teamStyles[owner]} ${isWinner ? 'bingo-won-pulse border-2' : ''}` : 'bg-slate-50 border-slate-200/70 hover:border-violet-500 hover:bg-slate-100/50'}`;
        cell.onclick = () => Boako.League.toggleTile(idx);
        const flag = owner ? {blue:'💙', red:'❤️', emerald:'💚', amber:'💛'}[owner] : '';
        cell.innerHTML = `<span class="text-[9px] font-black tracking-wider text-slate-400 group-hover:text-violet-600 transition-colors uppercase">TILE ${idx+1} ${flag}</span><span class="text-xs font-black truncate w-full tracking-tight mt-1">${Boako.League.State.boardGames25[idx]}</span>${isWinner ? '<span class="absolute bottom-1 right-1.5 text-xs text-amber-400">★</span>' : ''}`;
        grid.appendChild(cell);
    });
    Boako.League.selectTeam(Boako.League.State.selectedTeam);
    Boako.League.updateStats();
};

Boako.League.toggleTile = function(index) {
    if (typeof sfx !== 'undefined') sfx.playClick();
    if (Boako.League.State.bingoBoard[index] === Boako.League.State.selectedTeam) Boako.League.State.bingoBoard[index] = null;
    else Boako.League.State.bingoBoard[index] = Boako.League.State.selectedTeam;
    Boako.League.renderBingoBoard();
};

Boako.League.calculateWinningCells = function() {
    const size = 5; const winningSet = new Set(); const board = Boako.League.State.bingoBoard;
    for (let r = 0; r < size; r++) { let base = board[r * size]; if (base) { let match = true; for (let c = 1; c < size; c++) if (board[r * size + c] !== base) match = false; if (match) for (let c = 0; c < size; c++) winningSet.add(r * size + c); } }
    for (let c = 0; c < size; c++) { let base = board[c]; if (base) { let match = true; for (let r = 1; r < size; r++) if (board[r * size + c] !== base) match = false; if (match) for (let r = 0; r < size; r++) winningSet.add(r * size + c); } }
    let baseDiag1 = board[0]; if (baseDiag1) { let match = true; for (let i = 1; i < size; i++) if (board[i * size + i] !== baseDiag1) match = false; if (match) for (let i = 0; i < size; i++) winningSet.add(i * size + i); }
    let baseDiag2 = board[size - 1]; if (baseDiag2) { let match = true; for (let i = 1; i < size; i++) if (board[i * size + (size - 1 - i)] !== baseDiag2) match = false; if (match) for (let i = 0; i < size; i++) winningSet.add(i * size + (size - 1 - i)); }
    return Array.from(winningSet);
};

Boako.League.countLinesForTeam = function(team) {
    const size = 5; let lines = 0; const board = Boako.League.State.bingoBoard;
    for (let r = 0; r < size; r++) if (Array(size).fill(0).every((_, c) => board[r * size + c] === team)) lines++;
    for (let c = 0; c < size; c++) if (Array(size).fill(0).every((_, r) => board[r * size + c] === team)) lines++;
    if (Array(size).fill(0).every((_, i) => board[i * size + i] === team)) lines++; if (Array(size).fill(0).every((_, i) => board[i * size + (size - 1 - i)] === team)) lines++;
    return lines;
};

Boako.League.updateStats = function() {
    const counts = { blue: 0, red: 0, emerald: 0, amber: 0 }; Boako.League.State.bingoBoard.forEach(owner => { if(owner) counts[owner]++; });
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    setVal('stat-blue-tiles', counts.blue); setVal('stat-blue-lines', Boako.League.countLinesForTeam('blue'));
    setVal('stat-red-tiles', counts.red); setVal('stat-red-lines', Boako.League.countLinesForTeam('red'));
    setVal('stat-emerald-tiles', counts.emerald); setVal('stat-emerald-lines', Boako.League.countLinesForTeam('emerald'));
    setVal('stat-amber-tiles', counts.amber); setVal('stat-amber-lines', Boako.League.countLinesForTeam('amber'));
};

Boako.League.randomizeBoard = function() {
    const options = [null, 'blue', 'red', 'emerald', 'amber', null]; Boako.League.State.bingoBoard = Boako.League.State.bingoBoard.map(() => options[Math.floor(Math.random() * options.length)]);
    Boako.League.renderBingoBoard();
};

Boako.League.clearBoard = function() {
    Boako.League.State.bingoBoard = Array(25).fill(null); Boako.League.renderBingoBoard();
};

// ==========================================
// 🔥 탭 2: 야너나 매치룸 (Challenge 핵심 비즈니스단)
// ==========================================
Boako.League.getChallengeHTML = function() {
    return `
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div class="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-4 h-fit">
                <h5 class="font-black text-slate-800 text-sm border-b border-slate-200/60 pb-2 flex items-center gap-2">
                    <i data-lucide="pencil" class="w-4 h-4 text-violet-600"></i> 결투 혈투장 작성
                </h5>
                <div class="space-y-3 text-xs font-bold text-slate-600">
                    <div>
                        <label class="block mb-1.5">도전 가문</label>
                        <select id="challenge-attacker" class="w-full bg-white border border-slate-200 rounded-xl p-2.5 outline-none focus:border-violet-500">
                            <option value="블루 타이거">💙 블루 타이거</option>
                            <option value="레드 피닉스">❤️ 레드 피닉스</option>
                            <option value="그린 드래곤">💚 그린 드래곤</option>
                            <option value="골드 세이버">💛 골드 세이버</option>
                        </select>
                    </div>
                    <div>
                        <label class="block mb-1.5">적출 대상 가문</label>
                        <select id="challenge-defender" class="w-full bg-white border border-slate-200 rounded-xl p-2.5 outline-none focus:border-violet-500">
                            <option value="레드 피닉스">❤️ 레드 피닉스</option>
                            <option value="블루 타이거">💙 블루 타이거</option>
                            <option value="그린 드래곤">💚 그린 드래곤</option>
                            <option value="골드 세이버">💛 골드 세이버</option>
                        </select>
                    </div>
                    <div>
                        <label class="block mb-1.5">종목 보드게임</label>
                        <select id="challenge-game" class="w-full bg-white border border-slate-200 rounded-xl p-2.5 outline-none focus:border-violet-500">
                            <option value="스플렌더">스플렌더 (Splendor)</option>
                            <option value="아크 노바">아크 노바 (Ark Nova)</option>
                            <option value="윙스팬">윙스팬 (Wingspan)</option>
                            <option value="쿼리도">쿼리도 (Quoridor)</option>
                        </select>
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
    const attacker = document.getElementById('challenge-attacker').value;
    const defender = document.getElementById('challenge-defender').value;
    const game = document.getElementById('challenge-game').value;
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
// 👑 탭 3: 챔피언 콘텐츠 (수파베이스 리얼 뷰 조인 구역)
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

/* ====================================================================
 * 👑 [정밀 매핑] 챔피언 데이터 테이블 행(Row) 생성 엔진
 * ==================================================================== */
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
        
        // 🎯 [핵심 변경] 소장님이 하사하신 진짜 컬럼 족보 정밀 매핑
        const mvpName = row.mvp_nickname || '집계 중';
        const mvpTeam = row.mvp_team_name || '무소속';
        const totalRp = row.mvp_total_rp || 0;
        
        // 📊 플레이 현황: total_records_count(판수) / total_unique_players(명수)
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
                <div class="w-7 h-7 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center font-bold text-amber-600 text-xs">👑</div>
                <span class="font-extrabold text-slate-900">${mvpName}</span>
            </div>
        </td>
        
        <td class="p-4 text-slate-500 font-bold">${mvpTeam}</td>
        
        <td class="p-4 text-right font-black text-amber-500 text-sm">${totalRp.toLocaleString()} RP</td>
    </tr>
`;
    });
    tbody.innerHTML = rowsHtml;
};

Boako.League.filterChampions = function() {
    const query = document.getElementById('champion-search')?.value.toLowerCase() || "";
    const filtered = Boako.League.State.champions.filter(c => {
        const game = (c.game_name || '').toLowerCase();
        // 🎯 원래 player_name이던 검색 타겟을 소장님 족보인 mvp_nickname으로 정밀 세척
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
