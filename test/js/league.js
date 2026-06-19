/*** 🎯 [LEAGUE] 실시간 리그 콘텐츠 전당 (완결본 - 빙고/챔피언/토너먼트 보존 + 챌린지 DB 완벽 연동)
 * 관리 책임자: 소장님 MASTER */

Boako.League = Boako.League || {};

// ====================================================================
// 💡 1. 리그 전용 로컬 상태 관리 (통합본)
// ====================================================================
Boako.League.State = {
    // [빙고 & 챔피언 상태]
    currentTab: 'bingo',
    bingoBoard: Array(25).fill(null),
    boardGames25: Array(25).fill("지정 미정"),
    boardLogos25: Array(25).fill(null),
    bingoTeamLogos25: Array(25).fill(null),
    missionDifficulties: Array(25).fill("EASY"),
    teamBingoScores: [],
    champions: [],
    
    // [빙고 드롭다운 상태]
    currentBingoSeason: 'live',
    bingoSeasonOptions: [],

    // [🌟 챌린지 DB 연동용 상태 추가]
    currentActiveSeason: null,
    availableGames: [], 
    challengeSeasons: [],
    selectedChallengeSeason: null,
    challenges: [],
    
    challengeParams: {
        game: '결투 종목을 선택하세요',
        gameLogoUrl: '',
        schedule: '',
        message: '',
        roster: [
            { name: '', isMercenary: false },
            { name: '', isMercenary: false },
            { name: '', isMercenary: false },
            { name: '', isMercenary: false }
        ]
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

// ====================================================================
// 💡 2. 메인 UI 사출 엔진 및 탭 제어
// ====================================================================
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
        // 🔥 챌린지 탭 진입 시 DB 동기화
        container.innerHTML = `<div class="text-center py-20 font-black text-slate-400 animate-pulse">데이터 동기화 중...</div>`;
        await Boako.League.initChallengeData();
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
// 🔥 탭 2: 챌린지 전용 초기화 및 DB 연동 로직
// ====================================================================
// 💡 2. 챌린지 데이터 동기화 (에러 안 나는 완결본)
Boako.League.initChallengeData = async function() {
    try {
        if (!Boako.db) throw new Error("Supabase 서버 연결 실패");

        // 게임 목록 가져오기 (이미지 별칭 포함)
        const { data: games, error: gameErr } = await Boako.db.from('games').select('game_name, game_logo_url:image_url');
        if (gameErr) throw gameErr;
        Boako.League.State.availableGames = games || [];

        const now = new Date().toISOString(); // 현재 KST 시간 기준

        // 1. 현재 진행 중인 시즌 단건 조회 (시작일이 지났고 종료일이 안 지난 것)
        const { data: currentSeason } = await Boako.db.from('seasons')
            .select('season_no, title')
            .lte('start_date', now)
            .gte('end_date', now)
            .single();

        // 2. 챌린지 테이블에 기록이 있는 과거 시즌 번호들만 추출
        const { data: pastChallenges } = await Boako.db.from('challenges').select('season_no');
        const activeSeasonNos = [...new Set((pastChallenges || []).map(c => c.season_no))];

        // 3. 시작일이 미래인 시즌을 '제외한' 모든 시즌 조회 (미래 시즌 차단)
        const { data: allValidSeasons } = await Boako.db.from('seasons')
            .select('season_no, title')
            .lte('start_date', now) 
            .order('season_no', { ascending: false });

        // 4. 현재 시즌 무조건 포함 + 과거 시즌은 챌린지 기록이 있는 것만 남기기
        let filteredSeasons = [];
        if (allValidSeasons) {
            filteredSeasons = allValidSeasons.filter(s => 
                (currentSeason && s.season_no === currentSeason.season_no) || 
                activeSeasonNos.includes(s.season_no)
            );
        }

        // 상태값 업데이트
        Boako.League.State.challengeSeasons = filteredSeasons;
        Boako.League.State.currentActiveSeason = currentSeason ? currentSeason.title : "현재 진행 중인 시즌 없음";
        Boako.League.State.selectedChallengeSeason = currentSeason ? currentSeason.season_no : (filteredSeasons[0]?.season_no || 1);

        // 해당 시즌 데이터 로드
        await Boako.League.loadChallengesForSeason(Boako.League.State.selectedChallengeSeason);
        
        // 화면 렌더링
        const container = document.getElementById('league-view-container');
        if (container) {
            container.innerHTML = Boako.League.getChallengeHTML();
            Boako.League.renderChallenges();
        }

    // 👇 아까 실수로 날아갔던 catch 부분이 여기 있습니다.
    } catch (e) {
        console.error("도전장 데이터 초기화 실패:", e);
        Boako.League.renderErrorUI();
    }
};

Boako.League.loadChallengesForSeason = async function(seasonNo) {
    if (!seasonNo || !Boako.db) return;
    try {
        const { data: challenges, error } = await Boako.db
            .from('challenges')
            .select('*')
            .eq('season_no', seasonNo)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        Boako.League.State.challenges = challenges || [];
    } catch (err) {
        console.error("챌린지 목록 로드 실패:", err);
        Boako.League.State.challenges = [];
    }
};

Boako.League.changeChallengeSeason = async function(seasonNo) {
    Boako.League.State.selectedChallengeSeason = seasonNo;
    Boako.League.toggleDropdown('challenge-season-filter');
    
    const listContainer = document.getElementById('challenge-list');
    if (listContainer) listContainer.innerHTML = `<div class="text-center py-10 font-black text-violet-500 animate-pulse">데이터를 불러오는 중...</div>`;
    
    await Boako.League.loadChallengesForSeason(seasonNo);
    
    const container = document.getElementById('league-view-container');
    if (container) {
        container.innerHTML = Boako.League.getChallengeHTML();
        Boako.League.renderChallenges();
    }
};

Boako.League.renderErrorUI = function() {
    const container = document.getElementById('league-view-container');
    if (!container) return;
    container.innerHTML = `
        <div class="flex flex-col items-center justify-center py-20 text-center bg-white border border-slate-200 rounded-2xl shadow-sm">
            <div class="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mb-4 border border-rose-100">
                <i data-lucide="alert-triangle" class="w-8 h-8 text-rose-500"></i>
            </div>
            <h3 class="font-black text-slate-800 text-lg mb-2">서버 연결 오류</h3>
            <p class="text-sm text-slate-500 font-bold">현재 서버 연결에 문제가 발생하여 데이터를 불러올 수 없습니다.<br>잠시 후 다시 시도해 주세요.</p>
            <button onclick="Boako.League.initChallengeData()" class="mt-6 bg-slate-800 text-white font-black text-xs px-6 py-3 rounded-xl hover:bg-slate-900 transition-all shadow-md hover:-translate-y-0.5">
                재연결 시도
            </button>
        </div>
    `;
    if (window.lucide) window.lucide.createIcons();
};

Boako.League.selectChallengeOpt = function(gameName, logoUrl) {
    Boako.League.State.challengeParams.game = gameName;
    Boako.League.State.challengeParams.gameLogoUrl = logoUrl;
    const labelElem = document.getElementById('challenge-game-label');
    if (labelElem) {
        labelElem.innerText = gameName;
        labelElem.classList.remove('text-slate-400');
        labelElem.classList.add('text-slate-800');
    }
    Boako.League.toggleDropdown('challenge-game');
};

Boako.League.getChallengeHTML = function() {
    const p = Boako.League.State.challengeParams;
    // 현재 로그인한 유저의 닉네임과 팀 멤버 목록의 role을 직접 대조합니다.
const myName = Boako.state?.user?.full_name; // 접속 유저 닉네임 (경로 확인 필요)
const myMemberInfo = Boako.state?.team?.members?.find(m => m.player_name === myName);
const isTeamLeader = myMemberInfo ? (myMemberInfo.role === 'LEADER') : false; 
    
    const gameOptionsHtml = Boako.League.State.availableGames.length > 0 
        ? Boako.League.State.availableGames.map(g => `
            <div onclick="Boako.League.selectChallengeOpt('${g.game_name}', '${g.game_logo_url || ''}')" 
                 class="group px-4 py-3 cursor-pointer text-slate-600 font-extrabold text-xs transition-all duration-200 hover:bg-gradient-to-r hover:from-violet-50 hover:to-indigo-50 hover:text-violet-700 border-b border-slate-100/50 last:border-0 flex items-center gap-3">
                <img src="${g.game_logo_url || 'https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challenge.png'}" class="w-6 h-6 object-contain rounded drop-shadow-sm grayscale group-hover:grayscale-0 transition-all" alt="logo">
                <span class="relative z-10">${g.game_name}</span>
            </div>
          `).join('')
        : `<div class="px-4 py-4 text-slate-400 text-xs font-bold text-center">등록된 종목이 없습니다.</div>`;

    const seasonFilterOptionsHtml = Boako.League.State.challengeSeasons.map(s => `
        <div onclick="Boako.League.changeChallengeSeason(${s.season_no})" class="group px-4 py-3 cursor-pointer text-slate-600 font-extrabold text-xs transition-all duration-200 hover:bg-violet-50 hover:text-violet-700 flex items-center gap-2">
            <div class="w-1.5 h-1.5 rounded-full ${Boako.League.State.selectedChallengeSeason === s.season_no ? 'bg-violet-500' : 'bg-transparent'}"></div>
            시즌 ${s.season_no}
        </div>
    `).join('');

    const createFormHtml = isTeamLeader ? `
        <div class="space-y-4 text-xs font-bold text-slate-600 relative">
            <div class="relative z-30">
                <label class="block mb-1.5 text-slate-700">종목 보드게임</label>
                <button onclick="Boako.League.toggleDropdown('challenge-game')" class="w-full bg-white px-4 py-3.5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between text-xs font-black hover:border-violet-400 hover:shadow-md transition-all duration-200 group">
                    <span id="challenge-game-label" class="${p.game === '결투 종목을 선택하세요' ? 'text-slate-400' : 'text-slate-800'} transition-colors">${p.game}</span>
                    <i data-lucide="chevron-down" class="w-4 h-4 text-slate-400 group-hover:text-violet-500 transition-colors"></i>
                </button>
                <div id="challenge-game-overlay" onclick="Boako.League.toggleDropdown('challenge-game')" class="hidden fixed inset-0 z-40 bg-transparent"></div>
                <div id="challenge-game-menu" class="hidden absolute top-full left-0 mt-2 w-full bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_15px_40px_-10px_rgba(0,0,0,0.15)] border border-white/60 overflow-hidden z-50 transform transition-all">
                    <div class="max-h-60 overflow-y-auto custom-scrollbar p-1">${gameOptionsHtml}</div>
                </div>
            </div>

            <div class="relative z-20">
                <label class="block mb-1.5 text-slate-700">결투 일정 (KST)</label>
                <input type="datetime-local" id="challenge-schedule" class="w-full bg-white px-4 py-3 rounded-xl shadow-sm border border-slate-200 font-black text-slate-700 outline-none focus:border-violet-500 hover:border-violet-300 transition-colors">
            </div>

            <div class="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm relative z-10">
                <div class="flex items-center justify-between border-b border-slate-100 pb-2">
                    <label class="block text-violet-700 font-black">출전 로스터 (4인)</label>
                    <span class="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md">용병 허용</span>
                </div>
                ${[1, 2, 3, 4].map(num => `
                    <div class="flex items-center gap-2.5 group">
                        <span class="w-6 h-6 rounded-full bg-slate-100 text-slate-400 font-black flex items-center justify-center text-[10px] group-hover:bg-violet-100 group-hover:text-violet-600 transition-colors">${num}</span>
                        <input type="text" id="roster-${num}-name" placeholder="출전자 닉네임" class="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-violet-500 focus:bg-white transition-all">
                        <label class="flex items-center gap-1.5 cursor-pointer shrink-0 bg-slate-50 hover:bg-slate-100 px-2.5 py-2 rounded-lg border border-slate-200 transition-colors">
                            <input type="checkbox" id="roster-${num}-mercenary" class="w-3.5 h-3.5 text-violet-600 rounded border-slate-300 focus:ring-violet-500 cursor-pointer">
                            <span class="text-[10px] font-bold text-slate-500">용병</span>
                        </label>
                    </div>
                `).join('')}
            </div>

            <div class="relative z-0">
                <label class="block mb-1.5 text-slate-700">오픈 도발 구절</label>
                <textarea id="challenge-msg" rows="2" class="w-full bg-white border border-slate-200 rounded-xl p-3 outline-none focus:border-violet-500 focus:shadow-[0_0_0_3px_rgba(139,92,246,0.1)] transition-all font-semibold text-slate-700 resize-none" placeholder="이 판에 들어올 배짱 있는 팀을 찾습니다."></textarea>
            </div>
        </div>
        <button onclick="Boako.League.registerChallenge()" class="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-black text-xs py-3.5 rounded-xl shadow-lg shadow-violet-500/30 transition-all flex items-center justify-center gap-2 mt-5 transform hover:-translate-y-0.5">
            🔥 광장에 도전장 던지기 <span class="text-violet-200 font-medium">(토큰 1개 소모)</span>
        </button>
    ` : `
        <div class="flex flex-col items-center justify-center py-16 text-center bg-white border border-slate-200 rounded-2xl shadow-sm">
            <div class="w-14 h-14 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mb-4"><i data-lucide="lock" class="w-6 h-6 text-slate-300"></i></div>
            <h6 class="font-black text-slate-700 text-sm mb-1.5">도전장 발행 권한이 없습니다.</h6>
            <p class="text-xs text-slate-500 font-bold px-6 leading-relaxed">오직 소속 팀의 <span class="text-violet-600 font-black">'팀장'</span>만이 팀 토큰을 소모하여<br>새로운 결투 판을 열 수 있습니다.</p>
        </div>
    `;

    return `
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div class="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 shadow-sm h-fit">
                <h5 class="font-black text-slate-800 text-sm border-b border-slate-200/60 pb-3 mb-4 flex items-center gap-2">
                    <i data-lucide="megaphone" class="w-4 h-4 text-violet-600"></i> 공개 도전장 발행소
                </h5>
                ${createFormHtml}
            </div>
            <div class="lg:col-span-2 bg-slate-50 border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col max-h-[850px]">
                <div class="flex items-center justify-between border-b border-slate-200/60 pb-3 mb-4 shrink-0">
                    <h5 class="font-black text-slate-800 text-sm flex items-center gap-2"><i data-lucide="flame" class="w-4 h-4 text-orange-500 animate-pulse"></i> 격투 광장 보드</h5>
                    <div class="relative w-28 z-30">
                        <button onclick="Boako.League.toggleDropdown('challenge-season-filter')" class="w-full bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 flex items-center justify-between text-xs font-black text-violet-700 hover:border-violet-400 transition-colors">
                            <span>시즌 ${Boako.League.State.selectedChallengeSeason || '-'}</span>
                            <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-slate-400"></i>
                        </button>
                        <div id="challenge-season-filter-overlay" onclick="Boako.League.toggleDropdown('challenge-season-filter')" class="hidden fixed inset-0 z-40 bg-transparent"></div>
                        <div id="challenge-season-filter-menu" class="hidden absolute top-full right-0 mt-1 w-32 bg-white/95 backdrop-blur-xl rounded-xl shadow-lg border border-slate-200 overflow-hidden z-50">
                            <div class="max-h-48 overflow-y-auto custom-scrollbar p-1">${seasonFilterOptionsHtml || '<div class="p-3 text-xs text-slate-400 text-center">시즌 없음</div>'}</div>
                        </div>
                    </div>
                </div>
                <div id="challenge-list" class="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1 pb-4"></div>
            </div>
        </div>
    `;
};

Boako.League.renderChallenges = function() {
    const container = document.getElementById('challenge-list');
    if (!container) return;
    container.innerHTML = '';

    if (Boako.League.State.challenges.length === 0) {
        container.innerHTML = `<div class="text-center py-16 text-slate-400 font-bold border-2 border-dashed border-slate-200 rounded-2xl bg-white/50">선택된 시즌에 등록된 도전장이 없습니다.</div>`;
        return;
    }

    Boako.League.State.challenges.forEach(p => {
        let statusBadge = ''; let cardStyle = '';
        if (p.status === 'FINISHED') {
            statusBadge = `<span class="bg-slate-700 text-white text-[10px] px-2 py-0.5 rounded shadow-sm font-black flex items-center gap-1"><i data-lucide="flag" class="w-3 h-3"></i> 종료됨</span>`;
            cardStyle = 'bg-slate-100 border-slate-200 opacity-70 grayscale-[30%]';
        } else if (p.status === 'ACCEPTED') {
            statusBadge = `<span class="bg-emerald-500 text-white text-[10px] px-2 py-0.5 rounded shadow-sm font-black flex items-center gap-1"><i data-lucide="swords" class="w-3 h-3"></i> 매치 성사</span>`;
            cardStyle = 'bg-emerald-50/50 border-emerald-200 shadow-sm';
        } else {
            statusBadge = `<span class="bg-orange-100 text-orange-600 border border-orange-200 text-[10px] px-2 py-0.5 rounded shadow-sm font-black flex items-center gap-1 animate-pulse"><i data-lucide="loader-2" class="w-3 h-3"></i> 대기 중</span>`;
            cardStyle = 'bg-white border-violet-100 shadow-sm hover:shadow-md hover:border-violet-300';
        }

        const card = document.createElement('div');
        card.className = `p-4 rounded-2xl border ${cardStyle} transition-all duration-300 relative flex gap-4`;
        const logoUrl = p.game_logo_url || 'https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challenge.png';
        let scheduleText = '일정 미정';
        if (p.schedule) {
            const dateObj = new Date(p.schedule);
            scheduleText = `${dateObj.getMonth()+1}/${dateObj.getDate()} ${dateObj.getHours().toString().padStart(2,'0')}:${dateObj.getMinutes().toString().padStart(2,'0')}`;
        }

        let mercCount = 0; let regularCount = 0;
        for(let i=1; i<=4; i++) {
            if (p[`attacker_${i}`]) {
                if(p[`is_attacker_${i}_mercenary`]) mercCount++; else regularCount++;
            }
        }

        card.innerHTML = `
            <div class="w-20 h-24 bg-white rounded-xl border border-slate-200 shadow-inner flex flex-col items-center justify-center shrink-0 overflow-hidden relative">
                <img src="${logoUrl}" class="w-14 h-14 object-contain drop-shadow-md z-10" alt="${p.game_name}">
                <div class="absolute bottom-0 w-full bg-slate-800 text-white text-center text-[8px] font-black py-1 tracking-wider uppercase truncate px-1">${p.game_name}</div>
            </div>
            <div class="flex-1 flex flex-col min-w-0">
                <div class="flex items-start justify-between mb-2">
                    <div class="truncate">
                        <div class="flex items-center gap-2 mb-1">
                            ${statusBadge}
                            <span class="text-[9px] text-slate-400 font-bold"><i data-lucide="clock" class="w-3 h-3 inline"></i> ${scheduleText}</span>
                        </div>
                        <div class="flex items-center gap-1.5 mt-1.5">
                            <span class="text-xs font-black text-slate-800 truncate">${p.attacker_team_name}</span>
                            ${p.status === 'ACCEPTED' || p.status === 'FINISHED' ? `<span class="text-[10px] text-rose-500 font-bold">VS</span> <span class="text-xs font-black text-slate-800 truncate">${p.defender_team_name || '참전팀'}</span>` : ``}
                        </div>
                    </div>
                </div>
                <p class="text-xs font-bold text-slate-600 bg-white p-2.5 rounded-lg border border-slate-100/80 italic line-clamp-2 leading-relaxed shadow-sm">"${p.message || '도발 문구가 없습니다.'}"</p>
                <div class="flex items-center justify-between mt-auto pt-3">
                    <div class="flex gap-1.5">
                        <span class="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-extrabold border border-slate-200">정규 ${regularCount}인</span>
                        ${mercCount > 0 ? `<span class="text-[9px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-extrabold border border-indigo-200">용병 ${mercCount}인</span>` : ''}
                    </div>
                    ${p.status === 'PENDING' 
                        ? `<div class="flex gap-1.5 relative z-20">
                               <button onclick="Boako.League.acceptChallenge(${p.id}, false)" class="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-black text-[10px] px-2.5 py-1.5 rounded-lg shadow-sm">1배율 참전</button>
                               <button onclick="Boako.League.acceptChallenge(${p.id}, true)" class="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 text-white font-black text-[10px] px-2.5 py-1.5 rounded-lg shadow-[0_3px_8px_-2px_rgba(239,68,68,0.4)] hover:-translate-y-0.5 transition-all">🔥 더블</button>
                           </div>` 
                        : (p.status === 'ACCEPTED' ? `<span class="text-[10px] font-black text-emerald-600">경기 대기중</span>` : `<span class="text-[10px] font-black text-slate-500">결과 집계 완료</span>`)
                    }
                </div>
            </div>
        `;
        container.appendChild(card);
    });
    if (window.lucide) window.lucide.createIcons();
};

Boako.League.registerChallenge = async function() {
    const p = Boako.League.State.challengeParams;
    const game = p.game;
    const scheduleStr = document.getElementById('challenge-schedule').value;
    const message = document.getElementById('challenge-msg').value || "이 판을 접수할 배짱 있는 팀을 찾습니다.";
    
    if (game === '결투 종목을 선택하세요') { alert("종목을 먼저 선택해주세요."); return; }

    const rosterData = {}; let totalCount = 0;
    for(let i=1; i<=4; i++) {
        const isMerc = document.getElementById(`roster-${i}-mercenary`)?.checked || false;
        const name = document.getElementById(`roster-${i}-name`)?.value.trim();
        if(name) {
            rosterData[`attacker_${i}`] = name;
            rosterData[`is_attacker_${i}_mercenary`] = isMerc;
            totalCount++;
        }
    }

    if (totalCount === 0) { alert("최소 1명 이상의 출전자를 입력해주세요."); return; }

    try {
        const payload = {
            season_no: Boako.League.State.selectedChallengeSeason,
            attacker_team_id: Boako.state?.team?.info?.id, 
            attacker_team_name: Boako.state?.team?.info?.team_name || "테스트 팀",
            attacker_team_logo_url: Boako.state?.team?.info?.logo_url,
            game_name: game,
            game_logo_url: p.gameLogoUrl,
            game_mode: `${totalCount}v${totalCount}`,
            schedule: scheduleStr ? new Date(scheduleStr).toISOString() : null,
            message: message,
            status: 'PENDING',
            ...rosterData
        };

        if (Boako.db) {
            const { error } = await Boako.db.from('challenges').insert([payload]);
            if (error) throw error;
        }

        alert("도전장이 발행되었습니다!");
        document.getElementById('challenge-msg').value = '';
        await Boako.League.loadChallengesForSeason(Boako.League.State.selectedChallengeSeason);
        Boako.League.renderChallenges();
    } catch (err) {
        console.error("도전장 발행 에러:", err);
        alert("발행 중 오류가 발생했습니다.");
    }
};

Boako.League.acceptChallenge = function(id, isDouble) {
    const confirmMsg = isDouble ? "🔥 토큰 1개를 소모하여 '더블' 배율로 참전하시겠습니까?" : "토큰 소모 없이 일반 배율로 참전하시겠습니까?";
    if(confirm(confirmMsg)) {
        alert("방어팀 로스터 제출 및 참전 처리 로직 연동 대기중");
    }
};

// ====================================================================
// 🎲 탭 1: BTL 영토 빙고전 (원본 유지)
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
                    <div class="bg-white/80 border border-slate-200 p-2.5 rounded-xl flex items-center gap-1.5"><span class="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded-md font-black">EASY</span><span>팀원 전원 충족</span></div>
                    <div class="bg-white/80 border border-slate-200 p-2.5 rounded-xl flex items-center gap-1.5"><span class="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-md font-black">NORMAL</span><span>팀원 75% 이상</span></div>
                    <div class="bg-white/80 border border-slate-200 p-2.5 rounded-xl flex items-center gap-1.5"><span class="bg-rose-100 text-rose-700 text-[10px] px-1.5 py-0.5 rounded-md font-black">HARD</span><span>팀원 50% 이상</span></div>
                    <div class="bg-amber-500/10 border border-amber-400/30 p-2.5 rounded-xl flex items-center gap-1.5 animate-pulse"><span class="bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[9px] px-1.5 py-0.5 rounded-md font-black">🔥 CENTER</span><span class="text-amber-800 font-black">중앙 페널티: 전원</span></div>
                </div>
                <p class="text-[10px] text-slate-400 font-medium pt-1">🎯 기본 규칙: 차지한 칸마다 리그 승점 <span class="text-indigo-600 font-bold">1 점</span>을 획득하며, 빙고줄 완성 시 스코어보드 보너스가 연산됩니다.</p>
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div class="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm"><div class="grid grid-cols-5 gap-2" id="bingo-grid"></div></div>
                <div class="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-4">
                    <h5 class="font-black text-slate-800 text-sm border-b border-violet-100 pb-2.5 flex items-center gap-2"><i data-lucide="award" class="w-4 h-4 text-amber-500"></i> 빙고 스코어 보드</h5>
                    <div id="team-stat-rows-container" class="space-y-2 text-xs"><div class="text-center py-4 text-slate-400 font-bold">집계 데이터를 계산 중...</div></div>
                </div>
            </div>
        </div>
    `;
};

Boako.League.selectBingoSeason = function(val) { Boako.League.toggleDropdown('bingo-season'); if (Boako.League.State.currentBingoSeason !== val) { Boako.League.State.currentBingoSeason = val; Boako.League.loadBingoBoardData(); } };

Boako.League.renderBingoSeasonDropdown = function() {
    const container = document.getElementById('bingo-season-dropdown-container'); if (!container) return;
    let currentText = Boako.League.State.currentBingoSeason === 'live' ? `🔴 실시간 시즌 (라이브)` : `🕒 시즌 ${Boako.League.State.currentBingoSeason} 아카이브`;
    container.innerHTML = `
        <div class="relative w-full z-50">
            <button onclick="Boako.League.toggleDropdown('bingo-season')" class="w-full bg-white px-4 py-2.5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between gap-2 text-xs font-black text-slate-700 hover:border-violet-400 hover:shadow-md transition-all duration-200 group">
                <span class="truncate transition-colors">${currentText}</span>
                <i data-lucide="chevron-down" class="w-4 h-4 text-slate-400 group-hover:text-violet-500 transition-colors shrink-0"></i>
            </button>
            <div id="bingo-season-overlay" onclick="Boako.League.toggleDropdown('bingo-season')" class="hidden fixed inset-0 z-40 bg-transparent"></div>
            <div id="bingo-season-menu" class="hidden absolute top-full right-0 mt-2 w-[220px] bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_15px_40px_-10px_rgba(0,0,0,0.15)] border border-white/60 overflow-hidden z-50 transform transition-all p-1">
                <div onclick="Boako.League.selectBingoSeason('live')" class="group px-4 py-3 cursor-pointer rounded-xl font-extrabold text-xs transition-all duration-200 flex items-center gap-2 ${Boako.League.State.currentBingoSeason === 'live' ? 'bg-violet-50 text-violet-700' : 'text-slate-600 hover:bg-slate-50'}">
                    <div class="w-1.5 h-1.5 rounded-full ${Boako.League.State.currentBingoSeason === 'live' ? 'bg-red-500 animate-pulse' : 'bg-transparent'}"></div> 🔴 실시간 시즌
                </div>
                ${Boako.League.State.bingoSeasonOptions.map(sNo => `<div onclick="Boako.League.selectBingoSeason('${sNo}')" class="group px-4 py-3 cursor-pointer rounded-xl font-extrabold text-xs transition-all duration-200 mt-1 flex items-center gap-2 ${Boako.League.State.currentBingoSeason === String(sNo) ? 'bg-violet-50 text-violet-700' : 'text-slate-600 hover:bg-slate-50'}"><div class="w-1.5 h-1.5 rounded-full ${Boako.League.State.currentBingoSeason === String(sNo) ? 'bg-violet-500' : 'bg-transparent'}"></div> 🕒 시즌 ${sNo} 아카이브</div>`).join('')}
            </div>
        </div>
    `;
    if(window.lucide) lucide.createIcons();
};

Boako.League.loadBingoBoardData = async function() {
    const grid = document.getElementById('bingo-grid');
    if (grid && grid.innerHTML.includes("데이터를 불러오는 중")) { } else if (grid) { grid.innerHTML = `<div class="col-span-5 text-center py-10 font-bold text-slate-400">🌐 데이터를 배달하는 중...</div>`; }
    try {
        if (!Boako.db) throw new Error("Supabase 비가동 상태");
        const { data: rawSeasons, error: sNoErr } = await Boako.db.from('bingo_team_scores_history').select('season_no');
        if (sNoErr) throw sNoErr;
        const uniqueSeasons = [...new Set((rawSeasons || []).map(r => parseInt(r.season_no)))].filter(n => !isNaN(n)).sort((a, b) => b - a);
        Boako.League.State.bingoSeasonOptions = uniqueSeasons;
        Boako.League.renderBingoSeasonDropdown();
        const selectedSeason = Boako.League.State.currentBingoSeason; let boardData = null; let scoreData = null;
        if (selectedSeason === 'live') {
            const { data: bData, error: bError } = await Boako.db.from('v_bingo_board_live_scoring').select('*').order('coordinate_id', { ascending: true }); if (bError) throw bError; boardData = bData;
            const { data: sData, error: sError } = await Boako.db.from('v_bingo_team_total_scores').select('*').order('bingo_total_score', { ascending: false }); if (sError) throw sError; scoreData = sData;
        } else {
            const seasonNo = parseInt(selectedSeason);
            const { data: bData, error: bError } = await Boako.db.from('bingo_board_history').select('*').eq('season_no', seasonNo).order('coordinate_id', { ascending: true }); if (bError) throw bError; boardData = bData;
            const { data: sData, error: sError } = await Boako.db.from('bingo_team_scores_history').select('*').eq('season_no', seasonNo).order('bingo_total_score', { ascending: false }); if (sError) throw sError; scoreData = sData;
        }
        const initializedBoard = Array(25).fill(null); const initializedGames = Array(25).fill("미정 종목"); const initializedGameLogos = Array(25).fill(null); const initializedTeamLogos = Array(25).fill(null); const initializedDiffs = Array(25).fill("EASY");
        if (boardData && boardData.length > 0) {
            boardData.forEach(row => { const idx = parseInt(row.coordinate_id) - 1; if (idx >= 0 && idx < 25) { initializedBoard[idx] = row.occupying_team_name || null; initializedGames[idx] = row.game_name || "지정 미정"; initializedGameLogos[idx] = row.game_logo_url || null; initializedTeamLogos[idx] = row.occupying_team_logo_url || null; if (row.mission_difficulty) initializedDiffs[idx] = row.mission_difficulty.trim().toUpperCase(); } });
        }
        Boako.League.State.bingoBoard = initializedBoard; Boako.League.State.boardGames25 = initializedGames; Boako.League.State.boardLogos25 = initializedGameLogos; Boako.League.State.bingoTeamLogos25 = initializedTeamLogos; Boako.League.State.missionDifficulties = initializedDiffs; Boako.League.State.teamBingoScores = scoreData || [];
        Boako.League.renderBingoBoard();
    } catch (err) { console.error("지능형 시즌 트래커 오류:", err); if (grid) grid.innerHTML = `<div class="col-span-5 text-center py-10 font-black text-rose-500">❌ 연산 장치 오류 (${err.message})</div>`; }
};

Boako.League.renderBingoBoard = function() {
    const grid = document.getElementById('bingo-grid'); if (!grid) return; grid.innerHTML = '';
    const winCells = Boako.League.calculateWinningCells(); const myTeamName = Boako.state.team?.info?.team_name; const difficulties = Boako.League.State.missionDifficulties || Array(25).fill("EASY");
    let globalTooltip = document.getElementById('btl-global-tooltip');
    if (!globalTooltip) { globalTooltip = document.createElement('div'); globalTooltip.id = 'btl-global-tooltip'; globalTooltip.className = 'fixed w-48 p-4 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[99999] pointer-events-none flex flex-col items-center justify-center transition-opacity duration-200'; globalTooltip.style.display = 'none'; globalTooltip.style.opacity = '0'; globalTooltip.style.transform = 'translate(-50%, -100%)'; document.body.appendChild(globalTooltip); }
    Boako.League.State.bingoBoard.forEach((ownerTeam, idx) => {
        const cell = document.createElement('div'); const isWinner = winCells.includes(idx); const isMyTeam = ownerTeam && ownerTeam === myTeamName; const diffStatus = difficulties[idx] || "EASY"; const gameName = Boako.League.State.boardGames25[idx] || "지정 미정"; const gameLogoUrl = Boako.League.State.boardLogos25[idx];
        let bgClass = "bg-slate-50 border-slate-200/60";
        if (ownerTeam) { if (isMyTeam) { bgClass = "bg-gradient-to-br from-violet-600 to-indigo-600 text-white border-violet-400 bingo-won-pulse border-2 scale-[0.97] shadow-md"; if (!isWinner) bgClass = "bg-gradient-to-br from-violet-50 to-indigo-50 border-violet-300 text-violet-950 font-black scale-[0.97] shadow-inner border"; } else { bgClass = isWinner ? "bg-slate-700 text-slate-100 border-slate-500 scale-[0.97] opacity-80" : "bg-slate-100 border-slate-200 text-slate-700 font-bold scale-[0.97]"; } }
        if (diffStatus === 'HARD_CENTER_PENALTY') bgClass += " fire-border-glow border-orange-500 z-20 scale-[0.98]";
        cell.className = `h-24 rounded-2xl border flex flex-col items-center justify-center transition-all text-center relative overflow-hidden group cursor-pointer ${bgClass}`;
        const gameLogoOpacity = ownerTeam ? "opacity-20 grayscale transition-all duration-300 group-hover:opacity-10" : "opacity-100 drop-shadow-md";
        const gameImageHtml = gameLogoUrl ? `<div class="absolute inset-0 flex items-center justify-center pointer-events-none z-10 pb-3"><img src="${gameLogoUrl}" alt="${gameName}" class="w-[65%] h-auto max-h-full object-contain ${gameLogoOpacity}"></div>` : `<div class="absolute inset-0 flex items-center justify-center pointer-events-none text-3xl pb-3 z-10 ${gameLogoOpacity}">🎲</div>`;
        let massiveOverlayHtml = ''; if (ownerTeam) { const teamLogoUrl = Boako.League.State.bingoTeamLogos25[idx] || 'https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challenge.png'; massiveOverlayHtml = `<div class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/40 backdrop-blur-[2px] transition-all pb-2 pointer-events-none"><img src="${teamLogoUrl}" alt="${ownerTeam}" class="w-14 h-14 object-contain drop-shadow-xl transform group-hover:scale-110 transition-transform duration-300"></div>`; }
        let diffBadgeHtml = ''; if (diffStatus === 'HARD_CENTER_PENALTY') { diffBadgeHtml = `<span class="absolute top-1 right-1 z-30 bg-gradient-to-r from-orange-500 to-red-500 text-white font-black text-[7px] px-1.5 py-0.5 rounded shadow-sm pointer-events-none">🔥 CENTER</span>`; } else { const diffColors = { EASY: "bg-emerald-500/90 text-white", NORMAL: "bg-blue-500/90 text-white", HARD: "bg-rose-500/90 text-white" }; diffBadgeHtml = `<span class="absolute top-1 right-1 z-30 ${diffColors[diffStatus] || 'bg-slate-500'} font-black text-[7px] px-1 py-0.5 rounded shadow-sm pointer-events-none">${diffStatus}</span>`; }
        const crownHtml = isWinner ? `<span class="absolute top-1 ${diffStatus === 'HARD_CENTER_PENALTY' ? 'right-12' : 'right-8'} text-xs text-amber-400 animate-bounce z-30 pointer-events-none">👑</span>` : '';
        const gameLabelHtml = `<div class="absolute bottom-1.5 left-0 w-full px-1.5 z-30 pointer-events-none"><div class="w-full px-1 bg-white/90 backdrop-blur-md py-0.5 rounded-sm border border-slate-200/80 shadow-sm flex items-center justify-center min-h-[18px]"><span class="text-[8px] font-black text-slate-800 tracking-tight leading-tight line-clamp-1 truncate">${gameName}</span></div></div>`;
        cell.innerHTML = `${gameImageHtml}${massiveOverlayHtml}${diffBadgeHtml}${crownHtml}${gameLabelHtml}`;
        cell.addEventListener('mouseenter', () => { globalTooltip.innerHTML = `${gameLogoUrl ? `<img src="${gameLogoUrl}" class="w-20 h-20 object-contain mb-3 drop-shadow-md" alt="Game Logo">` : `<div class="text-4xl mb-2">🎲</div>`}<div class="text-xs font-black text-slate-800 text-center w-full break-keep">${gameName}</div><div class="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-3 h-3 bg-white border-r border-b border-slate-200 rotate-45"></div>`; globalTooltip.style.display = 'flex'; setTimeout(() => { globalTooltip.style.opacity = '1'; }, 10); });
        cell.addEventListener('mousemove', (e) => { globalTooltip.style.top = `${e.clientY - 15}px`; globalTooltip.style.left = `${e.clientX}px`; });
        cell.addEventListener('mouseleave', () => { globalTooltip.style.opacity = '0'; setTimeout(() => { if (globalTooltip.style.opacity === '0') globalTooltip.style.display = 'none'; }, 200); });
        grid.appendChild(cell);
    });
    Boako.League.updateStats();
};

if (!document.getElementById('bingo-fire-border-style')) {
    const styleId = document.createElement('style'); styleId.id = 'bingo-fire-border-style'; styleId.innerHTML = `@keyframes fireBorderGlow { 0% { border-color: #f97316; box-shadow: 0 0 6px #ea580c, inset 0 0 4px rgba(234, 88, 12, 0.2); } 50% { border-color: #ef4444; box-shadow: 0 0 14px #dc2626, inset 0 0 8px rgba(220, 38, 38, 0.4); } 100% { border-color: #f59e0b; box-shadow: 0 0 6px #d97706, inset 0 0 5px rgba(217, 119, 6, 0.3); } } .fire-border-glow { animation: fireBorderGlow 1.4s infinite ease-in-out alternate !important; border-width: 2px !important; }`; document.head.appendChild(styleId);
}

Boako.League.calculateWinningCells = function() {
    const size = 5; const winningSet = new Set(); const board = Boako.League.State.bingoBoard;
    for (let r = 0; r < size; r++) { let base = board[r * size]; if (base) { let match = true; for (let c = 1; c < size; c++) if (board[r * size + c] !== base) match = false; if (match) for (let c = 0; c < size; c++) winningSet.add(r * size + c); } }
    for (let c = 0; c < size; c++) { let base = board[c]; if (base) { let match = true; for (let r = 1; r < size; r++) if (board[r * size + c] !== base) match = false; if (match) for (let r = 0; r < size; r++) winningSet.add(r * size + c); } }
    let baseDiag1 = board[0]; if (baseDiag1) { let match = true; for (let i = 1; i < size; i++) if (board[i * size + i] !== baseDiag1) match = false; if (match) for (let i = 0; i < size; i++) winningSet.add(i * size + i); }
    let baseDiag2 = board[size - 1]; if (baseDiag2) { let match = true; for (let i = 1; i < size; i++) if (board[i * size + (size - 1 - i)] !== baseDiag2) match = false; if (match) for (let i = 0; i < size; i++) winningSet.add(i * size + (size - 1 - i)); }
    return Array.from(winningSet);
};

Boako.League.countLinesForTeam = function(teamName) {
    const size = 5; let lines = 0; const board = Boako.League.State.bingoBoard;
    for (let r = 0; r < size; r++) if (Array(size).fill(0).every((_, c) => board[r * size + c] === teamName)) lines++;
    for (let c = 0; c < size; c++) if (Array(size).fill(0).every((_, r) => board[r * size + c] === teamName)) lines++;
    if (Array(size).fill(0).every((_, i) => board[i * size + i] === teamName)) lines++; if (Array(size).fill(0).every((_, i) => board[i * size + (size - 1 - i)] === teamName)) lines++;
    return lines;
};

Boako.League.updateStats = function() {
    const statContainer = document.getElementById('team-stat-rows-container'); if (!statContainer) return;
    const scoreData = Boako.League.State.teamBingoScores || [];
    if (scoreData.length === 0) { statContainer.innerHTML = `<div class="text-center py-6 text-slate-400 font-bold border border-dashed border-slate-200 rounded-xl">🏳️ 현재 빙고를 완성한 팀이 없습니다.</div>`; return; }
    let html = '';
    scoreData.forEach(row => {
        const teamName = row.team_name; const basicSlots = row.basic_slots_score || 0; const totalLines = row.bingo_lines_count || 0; const totalScore = row.bingo_total_score || 0;
        let teamLogoUrl = row.team_logo_url || row.logo_url;
        if (!teamLogoUrl) { const boardIdx = Boako.League.State.bingoBoard.indexOf(teamName); if (boardIdx !== -1) teamLogoUrl = Boako.League.State.bingoTeamLogos25[boardIdx]; }
        teamLogoUrl = teamLogoUrl || 'https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challenge.png';
        let badgesHtml = '';
        for (let i = 1; i <= 5; i++) if (row[`is_row_${i}_completed`] === true) badgesHtml += `<span class="bg-blue-50 text-blue-700 border border-blue-200 text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-sm">↔️ 가로 ${i}열</span>`;
        for (let i = 1; i <= 5; i++) if (row[`is_col_${i}_completed`] === true) badgesHtml += `<span class="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-sm">↕️ 세로 ${i}행</span>`;
        if (row.is_diagonal_down_completed === true) badgesHtml += `<span class="bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-sm">↘️ 대각선 우하</span>`;
        if (row.is_diagonal_up_completed === true) badgesHtml += `<span class="bg-violet-50 text-violet-700 border border-violet-200 text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-sm">↗️ 대각선 우상</span>`;
        if (!badgesHtml) badgesHtml = `<span class="text-slate-400 font-medium text-[10px] italic">현재 빙고 조합 연산 중...</span>`;
        html += `
            <div class="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-sm space-y-3 transition-all hover:border-slate-300">
                <div class="flex justify-between items-center"><span class="font-black text-slate-800 text-xs flex items-center gap-1.5"><img src="${teamLogoUrl}" class="w-4 h-4 object-contain rounded-full shadow-sm bg-slate-50 border border-slate-100"> ${teamName}</span><div class="text-right"><span class="text-[10px] text-slate-400 font-bold">총점</span> <span class="text-indigo-600 font-black text-sm ml-0.5">${totalScore} XP</span></div></div>
                <div class="grid grid-cols-2 gap-2 text-center bg-slate-50 p-2 rounded-xl text-[10px] font-bold text-slate-500 border border-slate-100"><div>점유 영토 <span class="text-slate-800 font-black">${basicSlots}칸</span></div><div class="border-l border-slate-200">완성 라인 <span class="text-amber-500 font-black">${totalLines}줄</span></div></div>
                <div class="flex flex-wrap gap-1 pt-1 border-t border-dashed border-slate-100">${badgesHtml}</div>
            </div>
        `;
    });
    statContainer.innerHTML = html;
};

// ====================================================================
// 👑 탭 3: 챔피언 콘텐츠 (원본 유지)
// ====================================================================
Boako.League.getChampionHTML = function() {
    return `
        <div class="space-y-4">
            <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                <h5 class="font-black text-slate-800 text-sm flex items-center gap-2"><i data-lucide="trophy" class="w-4 h-4 text-amber-500"></i> 실시간 시즌 인기 게임 및 종목별 MVP 챔피언</h5>
                <div class="relative w-full max-w-xs">
                    <input onkeyup="Boako.League.filterChampions()" id="champion-search" type="text" class="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3.5 pr-10 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-violet-500 focus:bg-white" placeholder="게임 혹은 플레이어 검색...">
                    <i data-lucide="search" class="absolute right-3.5 top-2 w-4 h-4 text-slate-400"></i>
                </div>
            </div>
            <div class="border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-sm overflow-x-auto">
                <table class="w-full text-left text-xs min-w-[600px]">
                    <thead class="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                        <tr><th class="p-4 text-center">인기 순위</th><th class="p-4">게임 종목</th><th class="p-4">챔피언</th><th class="p-4">소속 팀</th><th class="p-4 text-right">획득 RP</th></tr>
                    </thead>
                    <tbody id="champion-tbody" class="divide-y divide-slate-100 font-semibold text-slate-700">
                        <tr><td colspan="6" class="p-10 text-center text-slate-400 font-bold">🔄 v_game_popularity_mvp 뷰 데이터 동기화 중...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
};

Boako.League.fetchAndRenderChampions = async function() {
    const tbody = document.getElementById('champion-tbody'); if (!tbody) return;
    try {
        if (!Boako.db) { tbody.innerHTML = `<tr><td colspan="6" class="p-10 text-center text-slate-400 font-bold">⚠️ Supabase 인스턴스가 발견되지 않았습니다.</td></tr>`; return; }
        const { data, error } = await Boako.db.from('v_game_popularity_mvp').select('*').limit(10); if (error) throw error;
        Boako.League.State.champions = data || []; Boako.League.drawChampionRows(Boako.League.State.champions);
    } catch (err) { tbody.innerHTML = `<tr><td colspan="6" class="p-10 text-center text-red-400 font-bold">❌ 가상 뷰 연동 실패</td></tr>`; }
};

Boako.League.drawChampionRows = function(dataList) {
    const tbody = document.getElementById('champion-tbody'); if (!tbody) return; tbody.innerHTML = '';
    if (dataList.length === 0) { tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center text-slate-400 font-bold">이번 시즌 집계된 데이터가 없습니다.</td></tr>`; return; }
    let rowsHtml = '';
    dataList.forEach((row, i) => {
        const gameRank = i + 1; const gameName = row.game_name || '미정 종목'; const mvpName = row.mvp_nickname || '집계 중'; const mvpTeam = row.mvp_team_name || '무소속'; const totalRp = row.mvp_total_rp || 0; const totalPlays = row.total_records_count || 0; const uniquePlayers = row.total_unique_players || 0;
       rowsHtml += `
    <tr class="hover:bg-slate-50/50 transition-colors">
        <td class="p-4 text-center font-black text-violet-600"><span class="bg-violet-50 px-2.5 py-1 rounded-lg border border-violet-100 text-xs">TOP ${gameRank}</span></td>
        <td class="p-4 font-black text-slate-800 text-sm"><div>${gameName}</div><div class="text-[10px] text-slate-400 font-bold mt-0.5 flex items-center gap-1.5"><span class="text-violet-600">🔥 총 ${totalPlays}회 플레이</span><span class="w-0.5 h-2 bg-slate-200"></span><span class="text-blue-600">👥 ${uniquePlayers}명 참여</span></div></td>
       <td class="p-4"><div class="flex items-center gap-2"><div class="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center shrink-0"><img src="https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/CHAMPION.png" alt="CHAMPION BADGE" class="w-full h-full object-contain"></div><span class="font-extrabold text-slate-900">${mvpName}</span></div></td>
       <td class="p-4 text-slate-500 font-bold relative group/handler">
            <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center shadow-sm shrink-0 relative cursor-pointer"><img src="${row.mvp_team_logo || 'https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challenge.png'}" alt="TEAM LOGO" class="w-full h-full object-contain rounded-full"></div>
                <span class="cursor-pointer">${mvpTeam}</span>
                <div class="invisible opacity-0 group-hover/handler:visible group-hover/handler:opacity-100 fixed -translate-x-1/2 -translate-y-full mb-2 w-32 h-32 p-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-[9999] transition-all duration-200 pointer-events-none flex items-center justify-center" style="top: var(--tooltip-top, auto); left: var(--tooltip-left, auto);">
                    <img src="${row.mvp_team_logo || 'https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challenge.png'}" alt="LARGE TEAM LOGO" class="w-full h-full object-contain">
                    <div class="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-white border-r border-b border-slate-200 rotate-45"></div>
                </div>
            </div>
        </td>
        <td class="p-4 text-right font-black text-amber-500 text-sm">${totalRp.toLocaleString()} RP</td>
    </tr>
`;
    });
    tbody.innerHTML = rowsHtml;
    tbody.querySelectorAll('tr').forEach(tr => { const handler = tr.querySelector('.group\\/handler'); if (!handler) return; handler.addEventListener('mousemove', (e) => { const tooltip = handler.querySelector('.fixed'); if (tooltip) { tooltip.style.setProperty('--tooltip-top', `${e.clientY - 10}px`); tooltip.style.setProperty('--tooltip-left', `${e.clientX}px`); } }); });
};

Boako.League.filterChampions = function() {
    const query = document.getElementById('champion-search')?.value.toLowerCase() || "";
    const filtered = Boako.League.State.champions.filter(c => { const game = (c.game_name || '').toLowerCase(); const name = (c.mvp_nickname || '').toLowerCase(); return game.includes(query) || name.includes(query); });
    Boako.League.drawChampionRows(filtered);
};

// ====================================================================
// 🏅 탭 4: 킹 오브 리그 (원본 유지)
// ====================================================================
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
