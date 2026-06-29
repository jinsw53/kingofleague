/*** * 🎯 [LEAGUE] 실시간 리그 콘텐츠 전당 (완결본 - 빙고/챔피언/토너먼트 보존 + 챌린지 다중종목/달력 완벽 연동)
 * 🛠️ 2026 최신화 패치: 용병 프사 보안 에러 픽스, 라인업 함수 누락 해결, 프로필&챌린지 실시간 다중 감지(Realtime) 적용, UI 용어 변경(도전/응전/Opponent)
 * 관리 책임자: 소장님 MASTER 
 */

Boako.League = Boako.League || {};

// ====================================================================
// 💡 1. 리그 전용 로컬 상태 관리
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

    // [🌟 챌린지 다중 종목 및 DB 연동용 상태]
    currentActiveSeason: null,
    availableGames: [], 
    challengeSeasons: [],
    selectedChallengeSeason: null,
    challenges: [],
    
    // 모달 작성 시 상태 관리
    selectedProposedGames: [], // [{name: '종목명', logo: 'url', mode: '4v4'}, ...]
    selectedSchedules: [],     // ['2026-06-21 20:00', ...]
    
    // 로스터 상태 관리
    currentRosterSlots: [null, null, null, null], 
    rosterTeamMembers: [],
    rosterMercenaries: [],
    isMercenaryTab: false
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

// 🌟 공용 포매팅 함수 (1v1 -> 1vs1 변환)
Boako.League.formatMode = function(modeStr) {
    return (modeStr || '4v4').replace('v', 'vs');
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
                    <span>🔥 드루와! 챌린지</span>
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
            mainImg.src = "https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challenge%20(1).png";
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
// 💡 3. 챌린지 초기화 및 실시간(Realtime) 다중 구독 활성화
// ====================================================================
Boako.League.initChallengeData = async function() {
    try {
        if (!Boako.db) throw new Error("Supabase 연결 실패");

        const { data: games } = await Boako.db.from('games').select('game_name, game_logo_url:image_url');
        Boako.League.State.availableGames = games || [];

        const now = new Date().toISOString(); 
        const { data: currentSeason } = await Boako.db.from('seasons').select('season_no, title').lte('start_date', now).gte('end_date', now).single();
        const { data: pastChallenges } = await Boako.db.from('challenges').select('season_no');
        const activeSeasonNos = [...new Set((pastChallenges || []).map(c => c.season_no))];
        const { data: allValidSeasons } = await Boako.db.from('seasons').select('season_no, title').lte('start_date', now).order('season_no', { ascending: false });

        Boako.League.State.challengeSeasons = (allValidSeasons || []).filter(s => 
            (currentSeason && s.season_no === currentSeason.season_no) || activeSeasonNos.includes(s.season_no)
        );

        Boako.League.State.selectedChallengeSeason = currentSeason ? currentSeason.season_no : (Boako.League.State.challengeSeasons[0]?.season_no || 1);

        // 최초 데이터 로드 (초기화)
        Boako.League.State.challenges = [];
        await Boako.League.loadChallengesForSeason(Boako.League.State.selectedChallengeSeason);
        
        const container = document.getElementById('league-view-container');
        if (container) {
            container.innerHTML = Boako.League.getChallengeHTML();
            Boako.League.renderChallenges();
        }

        // 🚨 [실시간 리얼타임 부품 꽂기 - 챌린지 & 프로필 통합 채널] 
        if (Boako.League.State.realtimeChannel) {
            Boako.db.removeChannel(Boako.League.State.realtimeChannel);
        }

        Boako.League.State.realtimeChannel = Boako.db
            .channel('league-multi-realtime')
            // ⚔️ 1. 챌린지 테이블 감지
            .on('postgres_changes', { event: '*', schema: 'public', table: 'challenges' }, async (payload) => {
                console.log('🔥 챌린지 변동 감지:', payload);
                await Boako.League.loadChallengesForSeason(Boako.League.State.selectedChallengeSeason);
                Boako.League.renderChallenges();
                
                const currentModal = document.getElementById('roster-modal-backdrop');
                if (currentModal && payload.new.status === 'UPCOMING') {
                    Boako.League.closeRosterModal();
                    if(Boako.Util && Boako.Util.toast) Boako.Util.toast("상대 팀의 로스터 제출로 결전이 확정되었습니다!");
                }
            })
            // 👤 2. 프로필 테이블 감지 (새 용병 합류, 프사 변경 등)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, async (payload) => {
                console.log('👤 프로필 변동 감지:', payload);
                const currentModal = document.getElementById('roster-modal-backdrop');
                if (currentModal) {
                    const challengeNameElem = document.querySelector('#challenge-popup-root .text-lg');
                    if (challengeNameElem) {
                        if(Boako.Util && Boako.Util.toast) Boako.Util.toast("유저 정보(용병/프사 등)가 실시간 갱신되었습니다. 창을 다시 열면 반영됩니다.");
                    }
                }
            })
            .subscribe();

    } catch (e) {
        console.error("초기화 실패:", e);
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
            <button onclick="Boako.League.initChallengeData()" class="mt-6 bg-slate-800 text-white font-black text-xs px-6 py-3 rounded-xl hover:bg-slate-900 transition-all shadow-md">재연결 시도</button>
        </div>
    `;
    if (window.lucide) window.lucide.createIcons();
};

Boako.League.getChallengeHTML = function() {
    const seasonFilterOptionsHtml = Boako.League.State.challengeSeasons.map(s => `
        <div onclick="Boako.League.changeChallengeSeason(${s.season_no})" class="group px-4 py-3 cursor-pointer text-slate-600 font-extrabold text-xs transition-all duration-200 hover:bg-violet-50 hover:text-violet-700 flex items-center gap-2">
            <div class="w-1.5 h-1.5 rounded-full ${Boako.League.State.selectedChallengeSeason === s.season_no ? 'bg-violet-500' : 'bg-transparent'}"></div>
            시즌 ${s.season_no}
        </div>
    `).join('');

    return `
        <div class="flex flex-col max-h-[850px] bg-slate-50 border border-slate-200/80 rounded-2xl p-6 shadow-sm">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-200/60 pb-4 mb-5 shrink-0 gap-4">
                <div class="flex items-center gap-3">
                    <h5 class="font-black text-slate-800 text-base flex items-center gap-2"><i data-lucide="flame" class="w-5 h-5 text-orange-500 animate-pulse"></i> 드루와 광장 보드</h5>
                    <button onclick="Boako.League.showCreateChallengeModal()" class="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-black text-xs px-4 py-2 rounded-xl shadow-md transition-all flex items-center gap-1.5 transform hover:-translate-y-0.5 ml-2">
                        <i data-lucide="plus-circle" class="w-4 h-4"></i> 도전장 발행하기
                    </button>
                </div>
                <button onclick="Boako.League.showChallengeRuleModal()" class="bg-white border border-slate-200 text-slate-600 font-black text-xs px-3 py-2.5 rounded-xl shadow-sm hover:border-violet-400 transition-colors flex items-center gap-1.5">
    📖 규칙
</button>
<div class="relative w-36 z-30">
                    <button onclick="Boako.League.toggleDropdown('challenge-season-filter')" class="w-full bg-white px-3 py-2.5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between text-xs font-black text-violet-700 hover:border-violet-400 transition-colors">
                        <span>시즌 ${Boako.League.State.selectedChallengeSeason || '-'}</span>
                        <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-slate-400"></i>
                    </button>
                    <div id="challenge-season-filter-overlay" onclick="Boako.League.toggleDropdown('challenge-season-filter')" class="hidden fixed inset-0 z-40 bg-transparent"></div>
                    <div id="challenge-season-filter-menu" class="hidden absolute top-full right-0 mt-1 w-full bg-white/95 backdrop-blur-xl rounded-xl shadow-lg border border-slate-200 overflow-hidden z-50">
                        <div class="max-h-48 overflow-y-auto custom-scrollbar p-1">${seasonFilterOptionsHtml || '<div class="p-3 text-xs text-slate-400 text-center">시즌 없음</div>'}</div>
                    </div>
                </div>
            </div>
            
            <div id="challenge-list" class="overflow-y-auto pr-2 custom-scrollbar flex-1 pb-4 flex flex-col gap-4"></div>
        </div>
        <div id="challenge-modal-root"></div>
        <div id="challenge-popup-root"></div>
    `;
};

// ====================================================================
// ⚔️ [라인업/현황 확인 뷰어] 승자연전(KOF) 완벽 대응 및 리얼 스탬프(컬러 동적 변경)
// ====================================================================
Boako.League.viewMatchLineup = async function(challengeId) {
    const p = Boako.League.State.challenges.find(c => c.id === challengeId);
    if (!p) return;

    let profiles = [];
    try {
        if (Boako.db) {
            const { data } = await Boako.db.from('profiles').select('full_name, profile_url');
            profiles = data || [];
        }
    } catch (e) { console.error("프로필 조회 실패", e); }

    const getSecureAvatar = (name) => {
        const url = profiles.find(pr => pr.full_name === name)?.profile_url;
        return url ? url.replace(/^http:\/\//i, 'https://') : null;
    };

    const safeGameLogo = (p.game_logo_url && p.game_logo_url !== 'null') ? p.game_logo_url : 'https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challenge%20(1).png';
    const isCompleted = (p.status === 'COMPLETED');
    
    let matches = {};
    try {
        let resultsObj = p.match_results;
        if (typeof resultsObj === 'string') resultsObj = JSON.parse(resultsObj);
        
        if (resultsObj && resultsObj.matches) {
            if (Array.isArray(resultsObj.matches)) {
                resultsObj.matches.forEach(m => { if (m && m.match_idx) matches[m.match_idx] = m; });
            } else {
                matches = resultsObj.matches;
            }
        }
    } catch(e) { console.warn("매치 데이터 파싱 오류", e); }

    const atkStats = { 1: { wins: 0, state: 'WAITING' }, 2: { wins: 0, state: 'WAITING' }, 3: { wins: 0, state: 'WAITING' }, 4: { wins: 0, state: 'WAITING' } };
    const defStats = { 1: { wins: 0, state: 'WAITING' }, 2: { wins: 0, state: 'WAITING' }, 3: { wins: 0, state: 'WAITING' }, 4: { wins: 0, state: 'WAITING' } };

    let currentAtkIdx = 1;
    let currentDefIdx = 1;

    const matchKeys = Object.keys(matches).map(Number).sort((a, b) => a - b);
    for (const mIdx of matchKeys) {
        const match = matches[mIdx];
        if (currentAtkIdx > 4 || currentDefIdx > 4) break; 
        
        const winnerSide = String(match.winner_side).toUpperCase();
        if (winnerSide === 'ATTACKER') {
            atkStats[currentAtkIdx].wins += 1;
            defStats[currentDefIdx].state = 'DEFEATED';
            currentDefIdx += 1;
        } else if (winnerSide === 'DEFENDER') {
            defStats[currentDefIdx].wins += 1;
            atkStats[currentAtkIdx].state = 'DEFEATED';
            currentAtkIdx += 1;
        }
    }

    const applyCurrentState = (stats, currentIdx) => {
        for (let i = 1; i <= 4; i++) {
            if (stats[i].state === 'DEFEATED') continue;
            if (i < currentIdx) stats[i].state = 'DEFEATED'; 
            else if (i === currentIdx) stats[i].state = isCompleted ? 'SURVIVED' : 'PLAYING';
            else stats[i].state = isCompleted ? 'UNPLAYED' : 'WAITING';
        }
    };
    applyCurrentState(atkStats, currentAtkIdx);
    applyCurrentState(defStats, currentDefIdx);

    const getUIStatus = (statsObj) => {
        if (statsObj.state === 'DEFEATED') {
            return {
                text: statsObj.wins > 0 ? `탈락 (${statsObj.wins}승)` : '탈락',
                lightClass: 'bg-slate-300 opacity-60',
                textClass: 'text-slate-400 font-medium',
                bgClass: 'bg-slate-50/60 border-slate-200 opacity-80'
            };
        } else if (statsObj.state === 'PLAYING') {
            let playingText = statsObj.wins > 1 ? `🔥 ${statsObj.wins}연승 중` : (statsObj.wins === 1 ? '🔥 1승 생존' : '🔥 출전 중');
            return {
                text: playingText,
                lightClass: statsObj.wins > 0 ? 'bg-amber-400 shadow-[0_0_8px_#fbbf24] animate-pulse' : 'bg-blue-400 shadow-[0_0_8px_#60a5fa]',
                textClass: statsObj.wins > 0 ? 'text-amber-600 font-black' : 'text-blue-600 font-bold',
                bgClass: statsObj.wins > 0 ? 'bg-amber-50/40 border-amber-200' : 'bg-blue-50/40 border-blue-200'
            };
        } else if (statsObj.state === 'SURVIVED') {
            return {
                text: statsObj.wins >= 4 ? `👑 올킬 (${statsObj.wins}승)` : `👑 최종 생존 (${statsObj.wins}승)`,
                lightClass: 'bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse',
                textClass: 'text-emerald-600 font-black',
                bgClass: 'bg-emerald-50/40 border-emerald-200/80 shadow-sm'
            };
        } else if (statsObj.state === 'UNPLAYED') {
            return { text: '미출전', lightClass: 'bg-slate-200', textClass: 'text-slate-400 font-medium', bgClass: 'bg-slate-50/30 border-slate-100 opacity-60' };
        } else { 
            return { text: '순서 대기', lightClass: 'bg-slate-300', textClass: 'text-slate-500 font-medium', bgClass: 'bg-white border-slate-200' };
        }
    };

    let minHeightClass = 'min-h-[64px]'; 
    if (p.game_mode === '2v2') minHeightClass = 'min-h-[96px]';
    else if (p.game_mode === '3v3') minHeightClass = 'min-h-[136px]';
    else if (p.game_mode === '4v4') minHeightClass = 'min-h-[176px]';

    const buildEntrySlotHtml = (entryData, isMerc, matchNum, isAttackerSide) => {
        let players = [];
        if (Array.isArray(entryData)) {
            players = entryData;
        } else if (typeof entryData === 'string') {
            try { players = JSON.parse(entryData); } catch(e) { players = [entryData]; }
        }

        if (!players || players.length === 0 || !players[0]) {
            return `<div class="p-3 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 flex items-center justify-center text-slate-300 text-[10px] font-bold ${minHeightClass}">엔트리 미등록</div>`;
        }

        const playersListHtml = players.map(name => {
            const secureAvatar = getSecureAvatar(name);
            const avatarHtml = secureAvatar 
                ? `<img src="${secureAvatar}" class="w-6 h-6 rounded-full object-cover border border-slate-200 shrink-0" referrerpolicy="no-referrer">`
                : `<div class="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-black text-slate-500 border border-slate-300 shrink-0">${name.substring(0, 2)}</div>`;

            return `
                <div class="flex items-center gap-2 min-w-0">
                    ${avatarHtml}
                    <span class="text-xs font-black text-slate-800 truncate leading-none py-0.5" title="${name}">${name}</span>
                </div>
            `;
        }).join('');
        
        const statsObj = isAttackerSide ? atkStats[matchNum] : defStats[matchNum];
        const status = getUIStatus(statsObj);

        return `
            <div class="flex items-center justify-between p-2.5 border rounded-xl shadow-sm transition-all relative z-10 ${status.bgClass} ${minHeightClass}">
                <div class="flex items-center gap-3 min-w-0 flex-1 mr-1">
                    <div class="flex flex-col items-center justify-center shrink-0 border-r border-slate-100 pr-2 min-w-[42px]">
                        <span class="text-[8px] font-bold text-slate-400">ENTRY</span>
                        <span class="text-xs font-black text-slate-500 leading-none mt-0.5">0${matchNum}</span>
                        ${isMerc ? '<span class="text-[10px] mt-1 select-none leading-none">💎</span>' : ''}
                    </div>
                    <div class="flex flex-col min-w-0 flex-1 justify-center gap-2">
                        ${playersListHtml}
                    </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0 pl-2 border-l border-slate-100/50 self-stretch justify-center min-w-[72px]">
                    <div class="flex flex-col items-center justify-center gap-1">
                        <span class="w-1.5 h-1.5 rounded-full ${status.lightClass} shrink-0"></span>
                        <span class="text-[10px] font-black ${status.textClass} break-keep text-center leading-tight">${status.text}</span>
                    </div>
                </div>
            </div>
        `;
    };

    const attackerEntriesHtml = [1, 2, 3, 4].map(i => buildEntrySlotHtml(p[`attacker_entry_${i}`], p[`is_attacker_${i}_mercenary`], i, true)).join('');
    const defenderEntriesHtml = [1, 2, 3, 4].map(i => buildEntrySlotHtml(p[`defender_entry_${i}`], p[`is_defender_${i}_mercenary`], i, false)).join('');

    let atkStyle = ''; let defStyle = ''; let atkStamp = ''; let defStamp = '';
    
    if (isCompleted) {
        const isAtkWinner = (p.final_winner_team_id === p.attacker_team_id);
        const maxStreak = p.final_max_streak || 0;
        
        let stampColorClass = 'border-emerald-500/80 text-emerald-600/90'; 
        if (maxStreak >= 4) stampColorClass = 'border-rose-600/80 text-rose-600/90'; 
        else if (maxStreak === 3) stampColorClass = 'border-orange-500/80 text-orange-600/90'; 
        else if (maxStreak === 2) stampColorClass = 'border-amber-400/90 text-amber-500/90'; 

        const stampHtml = `
            <div class="absolute top-[75px] -right-2 sm:-right-4 rotate-[-14deg] border-[5px] ${stampColorClass} font-black text-2xl sm:text-3xl px-4 py-1 rounded-2xl z-[50] pointer-events-none select-none mix-blend-multiply animate-in zoom-in duration-300 tracking-wider font-mono shadow-sm">
                MAX ${maxStreak}연승
            </div>
        `;
        
        if (isAtkWinner) {
            atkStamp = stampHtml;
            defStyle = 'filter: grayscale(1) opacity(0.5); pointer-events: none;';
        } else {
            defStamp = stampHtml;
            atkStyle = 'filter: grayscale(1) opacity(0.5); pointer-events: none;';
        }
    }

    // 💡 [추가] 모달 하단 버튼 바로 위에 올라갈 스탬프 컴포넌트
    const pointStampHtml = (isCompleted && p.earned_points != null) ? `
        <div class="flex justify-center items-center pb-5 relative select-none pointer-events-none z-30">
            <div class="border-4 border-dashed border-amber-500/80 text-amber-600 font-black text-lg tracking-widest px-6 py-2.5 rounded-2xl transform -rotate-3 mix-blend-multiply bg-amber-50 shadow-sm flex items-center gap-2 animate-in zoom-in duration-300 delay-150">
                <span class="text-xl drop-shadow-sm">🏆</span>
                <span>+ ${p.earned_points.toLocaleString()} LP 정산완료</span>
            </div>
        </div>
    ` : '';

    const modalHtml = `
        <div id="lineup-viewer-backdrop" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9998] flex items-center justify-center p-4" onclick="document.getElementById('challenge-popup-root').innerHTML=''">
            <div class="bg-white rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh] relative" onclick="event.stopPropagation()">
                
                <div class="absolute inset-0 z-0 opacity-10 pointer-events-none flex items-center justify-center select-none overflow-hidden">
                    <img src="${safeGameLogo}" class="w-96 h-96 object-contain">
                </div>
                
                <div class="bg-slate-900/95 backdrop-blur-sm p-5 flex items-center justify-between shrink-0 border-b border-slate-800 relative z-20">
                    <h3 class="font-black text-white text-sm flex items-center gap-2">
                        <i data-lucide="scroll-text" class="w-4 h-4 text-indigo-400"></i> ${isCompleted ? '최종 전적 결과 보드' : '실시간 결전 현황 보드'}
                        <span class="bg-indigo-900 text-indigo-300 text-[9px] px-1.5 py-0.5 rounded border border-indigo-700 ml-2 tracking-wider">승자연전 릴레이</span>
                    </h3>
                    <button onclick="document.getElementById('challenge-popup-root').innerHTML=''" class="text-white/60 hover:text-white transition-colors"><i data-lucide="x" class="w-5 h-5"></i></button>
                </div>

                <div class="p-6 overflow-y-auto custom-scrollbar flex-1 relative bg-transparent">
                    <div class="grid grid-cols-1 md:grid-cols-7 gap-6 items-start relative z-10">
                        <div class="md:col-span-3 space-y-4 relative transition-all duration-500" style="${atkStyle}">
                            ${atkStamp}
                            <div class="bg-white/90 backdrop-blur-sm border border-slate-200 p-4 rounded-2xl flex flex-col items-center text-center shadow-sm">
                                <img src="${p.attacker_team_logo_url || 'https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/default_logo.png'}" class="w-16 h-16 rounded-xl object-contain bg-slate-50 border border-slate-100 p-1 mb-2 shadow-inner">
                                <span class="text-[9px] bg-violet-100 text-violet-700 font-black px-1.5 py-0.5 rounded uppercase tracking-wider mb-1">Challenger</span>
                                <h4 class="font-black text-slate-800 text-sm truncate w-full">${p.attacker_team_name}</h4>
                            </div>
                            <div class="space-y-2.5">
                                ${attackerEntriesHtml}
                            </div>
                        </div>

                        <div class="md:col-span-1 flex flex-col items-center justify-center gap-5 py-4 relative z-10 self-center">
                            <div class="bg-slate-800 text-white font-black text-sm px-3.5 py-1.5 rounded-full border-4 border-white shadow-md select-none tracking-widest">VS</div>
                            <div class="flex flex-col items-center text-center mt-1">
                                <img src="${safeGameLogo}" class="w-12 h-12 object-contain bg-white/95 rounded-2xl p-1.5 shadow-md border border-slate-200 mb-1.5 backdrop-blur-sm">
                                <span class="text-xs font-black text-slate-800 truncate max-w-[90px] block leading-tight bg-white/90 px-1.5 py-0.5 rounded shadow-sm">${p.game_name}</span>
                                <span class="bg-indigo-600 border border-indigo-400 px-2.5 py-0.5 text-[10px] font-black text-white rounded mt-1.5 shadow-sm">${Boako.League.formatMode(p.game_mode)}</span>
                            </div>
                        </div>

                        <div class="md:col-span-3 space-y-4 relative transition-all duration-500" style="${defStyle}">
                            ${defStamp}
                            <div class="bg-white/90 backdrop-blur-sm border border-slate-200 p-4 rounded-2xl flex flex-col items-center text-center shadow-sm">
                                <img src="${p.defender_team_logo_url || 'https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/default_logo.png'}" class="w-16 h-16 rounded-xl object-contain bg-slate-50 border border-slate-100 p-1 mb-2 shadow-inner">
                                <span class="text-[9px] bg-rose-100 text-rose-700 font-black px-1.5 py-0.5 rounded uppercase tracking-wider mb-1">Opponent</span>
                                <h4 class="font-black text-slate-800 text-sm truncate w-full">${p.defender_team_name || '대기 중'}</h4>
                            </div>
                            <div class="space-y-2.5">
                                ${defenderEntriesHtml}
                            </div>
                        </div>
                    </div>
                </div>

                ${pointStampHtml}

                <div class="p-4 border-t border-slate-100 bg-white shrink-0 flex justify-end relative z-20">
                    <button onclick="document.getElementById('challenge-popup-root').innerHTML=''" class="bg-slate-900 hover:bg-black text-white font-black text-xs px-6 py-3 rounded-xl shadow-md transition-all active:scale-[0.98]">
                        확인 완료
                    </button>
                </div>

            </div>
        </div>
    `;

    document.getElementById('challenge-popup-root').innerHTML = modalHtml;
    setTimeout(() => { if (window.lucide) window.lucide.createIcons(); }, 50);
};

Boako.League.renderChallenges = function() {
    const container = document.getElementById('challenge-list');
    if (!container) return; container.innerHTML = '';

    const formatTime = (iso) => {
        if(!iso) return ''; const d = new Date(iso);
        const isZeroTime = d.getHours() === 0 && d.getMinutes() === 0;
        if (isZeroTime) return `${d.getMonth()+1}/${d.getDate()} (시간 상관없음)`;
        return `${d.getMonth()+1}/${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
    };

    const myTeamId = Boako.state?.team?.info?.id;

    Boako.League.State.challenges.forEach(p => {
        const currentStatus = p.status;
        const isMyAttack = (p.attacker_team_id === myTeamId);
        const isMyDefend = (p.defender_team_id === myTeamId);
        
        let gamesHtml = '';
        if (p.proposed_games && Array.isArray(p.proposed_games)) {
            gamesHtml = p.proposed_games.map(g => {
                const safeLogo = (g.logo && g.logo !== 'null') ? g.logo : 'https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challenge%20(1).png';
                return `<div class="flex items-center gap-2 bg-violet-50 border border-violet-100/70 px-2.5 py-1.5 rounded-xl shadow-sm"><img src="${safeLogo}" class="w-5 h-5 object-contain rounded bg-white p-0.5" /><div class="flex flex-col"><span class="text-[11px] font-black text-slate-800 leading-tight">${g.name}</span><span class="text-[9px] font-black text-violet-600 leading-none mt-0.5">${Boako.League.formatMode(g.mode)}</span></div></div>`;
            }).join('');
        }

        let schedulesHtml = '';
        if (p.confirmed_schedule) {
            schedulesHtml = `<span class="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] px-2.5 py-1 rounded-md font-black flex items-center gap-1">📅 확정 일시: ${formatTime(p.confirmed_schedule)}</span>`;
        } else if (p.schedule && Array.isArray(p.schedule) && p.schedule.length > 0) {
            schedulesHtml = p.schedule.map(iso => `<span class="bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] px-2 py-1 rounded-md font-bold tracking-tight">⏱️ ${formatTime(iso)}</span>`).join('');
        }

        let actionHtml = '';
        let statusBadgeHtml = '';

        switch (currentStatus) {
            case 'PENDING': 
                statusBadgeHtml = `<span class="bg-orange-100 text-orange-600 border border-orange-200 text-[10px] px-2 py-1 rounded-md font-black flex items-center gap-1 animate-pulse">⚔️ 대기 중</span>`;
                if (isMyAttack) {
                    actionHtml = `
                        <div class="flex flex-col gap-1.5 w-full">
                            <div class="text-[10px] text-slate-400 font-black text-center">내 팀의 도발글</div>
                            <button onclick="Boako.League.withdrawAttackerToken(${p.id})" class="w-full bg-rose-50 hover:bg-rose-500 text-rose-500 hover:text-white font-black text-[10px] py-2 rounded-lg transition-colors border border-rose-200">도전 취소 (토큰 환불)</button>
                        </div>
                    `;
                } else {
                    actionHtml = `<button onclick="Boako.League.showAcceptPopup(${p.id})" class="w-full bg-slate-900 hover:bg-violet-600 text-white font-black text-xs px-4 py-3.5 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"><i data-lucide="eye" class="w-4 h-4"></i> 정보 확인 및 참전</button>`;
                }
                break;

            case 'NEGOTIATING': 
                statusBadgeHtml = `<span class="bg-amber-100 text-amber-700 border border-amber-200 text-[10px] px-2 py-1 rounded-md font-black flex items-center gap-1"><i data-lucide="zap" class="w-3 h-3 text-amber-500 animate-bounce"></i> 판돈 협상 중</span>`;
                if (isMyAttack) {
                    actionHtml = `
                        <div class="flex flex-col gap-1.5 w-full">
                            <div class="text-[10px] text-amber-600 font-black text-center animate-pulse">상대 더블 베팅 시전!</div>
                            <button onclick="Boako.League.resolveNegotiation(${p.id}, 'CALL')" class="w-full bg-amber-500 hover:bg-amber-600 text-white font-black text-[11px] py-2 rounded-lg shadow-sm transition-all">콜! (더블 대결 승인)</button>
                            <button onclick="Boako.League.resolveNegotiation(${p.id}, 'RUN')" class="w-full bg-rose-50 hover:bg-rose-500 text-rose-500 hover:text-white font-black text-[10px] py-1.5 rounded-lg transition-colors border border-rose-200">앗 쫄? (배팅 철회/환불)</button>
                        </div>
                    `;
                } else if (isMyDefend) {
                    actionHtml = `<div class="text-center w-full"><span class="text-[11px] font-black text-amber-600 block">도전팀의 승인 대기 중</span><span class="text-[9px] font-bold text-slate-400 block mt-0.5">우리 팀이 더블을 불렀습니다</span></div>`;
                } else {
                    actionHtml = `<div class="text-center w-full"><span class="text-[11px] font-black text-slate-400 block">더블 협상 진행 중</span></div>`;
                }
                break;

            case 'ROSTER_WAITING': 
                statusBadgeHtml = `<span class="bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] px-2 py-1 rounded-md font-black flex items-center gap-1">📋 로스터 구성 중</span>`;
                if (isMyAttack || isMyDefend) {
                    const isSubmitted = isMyAttack ? !!p.attacker_1 : !!p.defender_1;
                    
                    if (isSubmitted) {
                        actionHtml = `
                            <button disabled class="w-full bg-slate-100 border border-slate-200 text-slate-400 font-black text-xs px-4 py-3.5 rounded-xl cursor-not-allowed flex items-center justify-center gap-1.5 shadow-inner">
                                <i data-lucide="check-circle" class="w-4 h-4 text-slate-400"></i> 엔트리 제출 완료
                            </button>
                        `;
                    } else {
                        actionHtml = `<button onclick="Boako.League.showRosterModal(${p.id})" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-4 py-3.5 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"><i data-lucide="users" class="w-4 h-4"></i> 엔트리/용병 등록</button>`;
                    }
                } else {
                    actionHtml = `<div class="text-center w-full"><span class="text-[11px] font-black text-slate-400 block">양 팀 로스터 제출 대기</span></div>`;
                }
                break;

            case 'UPCOMING': 
            case 'IN_PROGRESS': 
                if (currentStatus === 'IN_PROGRESS') {
                    statusBadgeHtml = `<span class="bg-blue-100 text-blue-700 border border-blue-200 text-[10px] px-2 py-1 rounded-md font-black flex items-center gap-1 animate-pulse"><i data-lucide="play" class="w-3 h-3 text-blue-500"></i> 결전 진행 중</span>`;
                } else {
                    statusBadgeHtml = `<span class="bg-purple-100 text-purple-700 border border-purple-200 text-[10px] px-2 py-1 rounded-md font-black flex items-center gap-1"><i data-lucide="swords" class="w-3 h-3 text-purple-500"></i> 결전 임박</span>`;
                }
                actionHtml = `<button onclick="Boako.League.viewMatchLineup(${p.id})" class="w-full bg-white hover:bg-slate-50 text-slate-800 font-black text-xs px-4 py-3.5 rounded-xl shadow-sm border border-slate-200 transition-all flex items-center justify-center gap-1.5"><i data-lucide="scroll-text" class="w-4 h-4"></i> 라인업/전적 확인</button>`;
                break;

            case 'RESULT_PENDING': 
                statusBadgeHtml = `<span class="bg-rose-100 text-rose-700 border border-rose-200 text-[10px] px-2 py-1 rounded-md font-black flex items-center gap-1 animate-pulse">⏱️ 결과 대기 중</span>`;
                if (isMyAttack || isMyDefend) {
                    actionHtml = `<button onclick="Boako.League.showResultInputModal(${p.id})" class="w-full bg-rose-600 hover:bg-rose-700 text-white font-black text-xs px-4 py-3.5 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"><i data-lucide="trophy" class="w-4 h-4"></i> 경기 승패 스코어 입력</button>`;
                } else {
                    actionHtml = `<div class="text-center w-full"><span class="text-[11px] font-black text-slate-400 block">스코어 검증 중</span></div>`;
                }
                break;

            case 'COMPLETED': 
                statusBadgeHtml = `<span class="bg-emerald-600 text-white text-[10px] px-2 py-1 rounded-md font-black flex items-center gap-1">🏆 종료 완료</span>`;
                
                // 💡 [수정] 점수 스탬프를 카드 우측 버튼 구역 위에 배치하도록 변경
                let rightStampHtml = '';
                if (p.earned_points != null) {
                    rightStampHtml = `
                        <div class="mb-3 border-2 border-dashed border-amber-500/80 text-amber-600 font-black text-xs px-3 py-2 rounded-xl transform rotate-[-4deg] mix-blend-multiply bg-amber-50 shadow-sm flex items-center justify-center gap-1.5 w-full text-center">
                            <span class="text-[14px]">🏆</span> +${p.earned_points.toLocaleString()} LP
                        </div>
                    `;
                }

                actionHtml = `
                    <div class="flex flex-col w-full items-center">
                        ${rightStampHtml}
                        <button onclick="Boako.League.viewMatchLineup(${p.id})" class="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-black text-xs px-4 py-3.5 rounded-xl shadow-sm border border-emerald-200 transition-all flex items-center justify-center gap-1.5">
                            <i data-lucide="trophy" class="w-4 h-4"></i> 최종 전적 결과 보기
                        </button>
                    </div>
                `;
                break;

            case 'CANCELED':
                statusBadgeHtml = `<span class="bg-slate-200 text-slate-500 text-[10px] px-2 py-1 rounded-md font-black">❌ 취소됨</span>`;
                actionHtml = `<div class="text-center w-full"><span class="text-[11px] font-black text-slate-400 block">파기된 도전장</span></div>`;
                break;
        }

        const isPendingState = currentStatus === 'PENDING';

        let leftVisualHtml = '';
        if (isPendingState) {
            leftVisualHtml = `<div class="w-20 h-20 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-2xl flex flex-col items-center justify-center text-white shadow-md shrink-0"><i data-lucide="swords" class="w-7 h-7 mb-1 animate-pulse"></i><span class="text-[9px] font-black tracking-widest uppercase opacity-80">OPEN</span></div>`;
        } else if (currentStatus === 'NEGOTIATING') {
            const safeGameLogo = (p.game_logo_url && p.game_logo_url !== 'null') ? p.game_logo_url : 'https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challenge%20(1).png';
            leftVisualHtml = `
                <div class="w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-600 border border-amber-400 rounded-2xl flex flex-col items-center justify-center p-1.5 shrink-0 relative overflow-hidden shadow-lg shadow-amber-500/30">
                    <div class="absolute inset-0 bg-white/20 animate-pulse"></div>
                    <img src="${safeGameLogo}" class="max-w-full max-h-full object-contain relative z-10 drop-shadow-md bg-white rounded-xl p-1" />
                    <div class="absolute bottom-0 inset-x-0 bg-amber-900 text-white text-[8px] font-black py-0.5 text-center truncate z-20">더블 배팅!</div>
                </div>
            `;
        } else {
            const safeGameLogo = (p.game_logo_url && p.game_logo_url !== 'null') ? p.game_logo_url : 'https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challenge%20(1).png';
            leftVisualHtml = `<div class="w-20 h-20 bg-white border border-slate-200 rounded-2xl flex flex-col items-center justify-center p-2 shrink-0 relative overflow-hidden shadow-sm"><img src="${safeGameLogo}" class="max-w-full max-h-full object-contain" /><div class="absolute bottom-0 inset-x-0 bg-slate-800 text-white text-[8px] font-black py-0.5 text-center truncate">${Boako.League.formatMode(p.game_mode)}</div></div>`;
        }

        const card = document.createElement('div');
        card.className = `p-5 rounded-3xl border ${currentStatus === 'CANCELED' ? 'bg-slate-100/50 border-slate-200 opacity-50' : currentStatus === 'NEGOTIATING' ? 'bg-amber-50/30 border-amber-300' : 'bg-white border-slate-200'} transition-all shadow-sm flex flex-col md:flex-row gap-5 md:items-center relative group`;
        
        card.innerHTML = `
            ${leftVisualHtml}
            <div class="flex-1 flex flex-col min-w-0 gap-3">
                <div class="flex items-center gap-2">
                    ${statusBadgeHtml}
                    <div class="flex items-center gap-1">
                        ${p.is_attacker_token_used ? `<span class="bg-amber-50 text-amber-600 border border-amber-200 text-[9px] font-black px-1.5 py-0.5 rounded">도전팀 <img src="https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challengetoken.png" class="w-3 h-3 inline-block"></span>` : ''}
                        ${p.is_defender_token_used ? `<span class="bg-orange-50 text-orange-600 border border-orange-200 text-[9px] font-black px-1.5 py-0.5 rounded">응전팀 <img src="https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challengetoken.png" class="w-3 h-3 inline-block"></span>` : ''}
                    </div>
                </div>
                
                <div>
                    <label class="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">${isPendingState ? '🎯 대항 제안 종목 후보' : '⚔️ 확정 경기 종목'}</label>
                    <div class="flex flex-wrap gap-1.5">
                        ${isPendingState 
                            ? gamesHtml 
                            : `<div class="flex items-center gap-2 bg-slate-800 text-white px-3 py-1.5 rounded-xl shadow-sm"><img src="${(p.game_logo_url && p.game_logo_url !== 'null') ? p.game_logo_url : 'https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challenge%20(1).png'}" class="w-4 h-4 object-contain rounded bg-white p-0.5" /><span class="text-xs font-black">${p.game_name}</span><span class="text-[9px] font-black text-slate-400 border-l border-slate-600 pl-2 ml-1">${Boako.League.formatMode(p.game_mode)}</span></div>`
                        }
                    </div>
                </div>
                
                <div>
                    <label class="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">${isPendingState ? '🕒 조율 가능한 후보 일정 목록' : '📅 확정 대결 일시'}</label>
                    <div class="flex flex-wrap gap-1">
                        ${isPendingState 
                            ? schedulesHtml 
                            : `<span class="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] px-3 py-1.5 rounded-lg font-black flex items-center gap-1 shadow-sm">📅 ${formatTime(p.confirmed_schedule)}</span>`
                        }
                    </div>
                </div>
                
                <div class="flex flex-col gap-1 pt-1.5 border-t border-slate-100">
                    ${p.defender_team_name ? `<div class="text-xs font-black text-slate-800 flex items-center gap-1"><span class="text-violet-600">${p.attacker_team_name}</span><span class="text-rose-500 text-[10px] italic mx-0.5">VS</span><span class="text-slate-800">${p.defender_team_name}</span></div>` : `<div class="text-xs font-black text-slate-400"><span class="text-slate-600">${p.attacker_team_name}</span> 팀의 전면 도발</div>`}
                    <p class="text-xs font-bold text-slate-500 italic">"${p.message}"</p>
                </div>
            </div>
            <div class="flex items-center justify-end md:flex-col md:justify-center shrink-0 border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-5 min-w-[150px]">
                ${actionHtml}
            </div>
        `;
        container.appendChild(card);
    });
    
    setTimeout(() => { if (window.lucide) window.lucide.createIcons(); }, 50);
};

// ====================================================================
// 💡 공격팀 배팅 철회 (토큰 회수) 및 협상 결정
// ====================================================================
Boako.League.resolveNegotiation = async function(challengeId, decision) {
    const msg = decision === 'CALL' ? "더블 배팅을 수락하고 매칭을 확정하시겠습니까?" : "배팅을 철회하시겠습니까? 소모된 토큰이 환불되며 매칭이 취소됩니다.";
    if (!confirm(msg)) return;

    try {
        if (!Boako.db) throw new Error("DB 연결 오류");
        const { error } = await Boako.db.rpc('resolve_negotiation', {
            p_challenge_id: challengeId,
            p_decision: decision
        });
        if (error) throw error;
        
        alert(decision === 'CALL' ? "판돈이 확정되었습니다! 로스터를 구성해 주세요." : "철회가 완료되어 토큰이 환불되었습니다.");
        await Boako.League.loadChallengesForSeason(Boako.League.State.selectedChallengeSeason);
        Boako.League.renderChallenges();
    } catch (err) {
        alert("처리 실패: " + err.message);
    }
};

Boako.League.withdrawAttackerToken = async function(challengeId) {
    if (!confirm("정말 배팅을 철회하시겠습니까? 소모된 토큰 1개를 돌려받지만, 비겁하다는 소리를 들을 수 있습니다.")) return;

    try {
        if (!Boako.db) throw new Error("DB 연결 오류");
        const { error } = await Boako.db.rpc('withdraw_attacker_token', { p_challenge_id: challengeId });
        if (error) throw error;

        alert("배팅 철회가 완료되었습니다. 토큰 1개가 환불되었습니다.");
        await Boako.League.loadChallengesForSeason(Boako.League.State.selectedChallengeSeason);
        Boako.League.renderChallenges();
    } catch (err) {
        alert("철회 실패: " + err.message);
    }
};


// ====================================================================
// 💡 4. 도전장 모달 (종목 검색, 드롭다운, 달력, 제출 통합)
// ====================================================================
Boako.League.showCreateChallengeModal = function() {
    const isTeamLeader = (Boako.state.team?.type === 'LEADER');
    if (!isTeamLeader) {
        alert("오직 소속 팀의 '팀장'만이 팀 토큰을 소모하여 새로운 결투 판을 열 수 있습니다.");
        return;
    }

    Boako.League.State.selectedProposedGames = [];
    Boako.League.State.selectedSchedules = [];

    const modalHtml = `
        <div id="create-challenge-backdrop" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9998] flex items-center justify-center p-4" onclick="Boako.League.closeCreateChallengeModal()">
            <div class="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]" onclick="event.stopPropagation()">
                
                <div class="bg-gradient-to-r from-violet-600 to-indigo-600 p-5 flex items-center justify-between shrink-0">
                    <h3 class="font-black text-white text-base flex items-center gap-2"><i data-lucide="megaphone" class="w-4 h-4 text-violet-200"></i> 공개 결투 모집소</h3>
                    <button onclick="Boako.League.closeCreateChallengeModal()" class="text-white/70 hover:text-white transition-colors"><i data-lucide="x" class="w-5 h-5"></i></button>
                </div>

                <div class="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                    <div class="relative z-30">
                        <label class="block mb-2 text-xs font-black text-slate-700">🎯 결투 제안 종목 <span class="text-[10px] text-violet-500 font-bold">(최대 3개)</span></label>
                        <div id="selected-games-container" class="flex flex-col mb-2"></div>
                        <div class="relative">
                            <input type="text" id="game-search-input" placeholder="종목을 검색하세요..." class="w-full bg-slate-50 px-4 py-3 rounded-xl shadow-inner border border-slate-200 outline-none focus:border-violet-500 focus:bg-white transition-all text-xs font-bold text-slate-700" autocomplete="off" />
                            <ul id="game-autocomplete-list" class="absolute z-50 w-full bg-white border border-slate-200 rounded-xl max-h-48 overflow-y-auto hidden shadow-xl mt-1 custom-scrollbar"></ul>
                        </div>
                    </div>

                    <div class="relative z-20">
                        <label class="block mb-2 text-xs font-black text-slate-700">🕒 결투 제안 일정 <span class="text-[10px] text-violet-500 font-bold">(다중 선택 가능)</span></label>
                        <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 shadow-inner flex flex-col gap-2">
                            <div id="selected-schedules-container" class="flex flex-wrap gap-1.5">
                                <span class="text-xs text-slate-400 font-bold p-1">선택된 일정이 없습니다. 달력을 열어 추가해주세요.</span>
                            </div>
                            <button type="button" onclick="Boako.League.Calendar.open()" class="mt-2 w-full bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-black text-xs py-2.5 rounded-lg transition-colors border border-indigo-200 flex items-center justify-center gap-1.5 shadow-sm">
                                📅 달력 열고 후보 시간 찍기
                            </button>
                        </div>
                    </div>

                    <div class="relative z-0">
                        <label class="block mb-2 text-xs font-black text-slate-700">🔥 오픈 도발 구절</label>
                        <textarea id="challenge-msg" rows="3" class="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-violet-500 focus:bg-white shadow-inner transition-all text-xs font-semibold text-slate-700 resize-none" placeholder="조건 맞으면 드루와!"></textarea>
                    </div>
                </div>

                <div class="p-5 border-t border-slate-100 bg-slate-50 shrink-0">
                    <button onclick="Boako.League.registerChallenge()" class="w-full bg-slate-900 hover:bg-black text-white font-black text-sm py-3.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2">
                        ⚔️ 광장에 공개 모집하기 <span class="text-slate-400 font-medium text-xs">(토큰 1개 소모)</span>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('challenge-modal-root').innerHTML = modalHtml;
    setTimeout(() => { if (window.lucide) window.lucide.createIcons(); }, 50);
    Boako.League.initGameSearch();
};

Boako.League.closeCreateChallengeModal = function() {
    document.getElementById('challenge-modal-root').innerHTML = '';
};

// [종목 검색 및 추가 렌더링 로직]
Boako.League.initGameSearch = function() {
    const searchInput = document.getElementById('game-search-input');
    const autocompleteList = document.getElementById('game-autocomplete-list');
    if (!searchInput || !autocompleteList) return;

    Boako.League.State.selectedProposedGames = []; // 초기화

    searchInput.addEventListener('input', (e) => {
        const keyword = e.target.value.trim().toLowerCase();
        if (!keyword || Boako.League.State.selectedProposedGames.length >= 3) {
            autocompleteList.classList.add('hidden');
            return;
        }

        const matchedGames = Boako.League.State.availableGames
            .filter(g => g.game_name.toLowerCase().includes(keyword))
            .slice(0, 10);

        if (matchedGames.length > 0) {
            autocompleteList.innerHTML = matchedGames.map(g => {
                const safeLogo = (g.game_logo_url && g.game_logo_url !== 'null') ? g.game_logo_url : 'https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challenge%20(1).png';
                return `
                <li class="p-3 hover:bg-violet-50 cursor-pointer flex items-center gap-3 border-b border-slate-100 last:border-0"
                    onmousedown="event.preventDefault(); Boako.League.addProposedGame('${g.game_name.replace(/'/g, "\\'")}', '${safeLogo}')">
                    <img src="${safeLogo}" class="w-6 h-6 object-contain rounded drop-shadow-sm bg-white" />
                    <span class="font-bold text-slate-700 text-xs">${g.game_name}</span>
                </li>
            `}).join('');
            autocompleteList.classList.remove('hidden');
        } else {
            autocompleteList.innerHTML = `<li class="p-3 text-slate-400 text-xs font-bold text-center">검색 결과가 없습니다.</li>`;
            autocompleteList.classList.remove('hidden');
        }
    });

    searchInput.addEventListener('blur', () => { setTimeout(() => autocompleteList.classList.add('hidden'), 150); });
    searchInput.addEventListener('focus', () => { if(searchInput.value.trim() && autocompleteList.innerHTML !== '') autocompleteList.classList.remove('hidden'); });
};

Boako.League.addProposedGame = function(name, logo) {
    if (Boako.League.State.selectedProposedGames.length >= 3) {
        alert("최대 3개까지만 선택할 수 있습니다."); return;
    }
    if (Boako.League.State.selectedProposedGames.find(g => g.name === name)) {
        alert("이미 추가된 종목입니다."); return;
    }
    
    Boako.League.State.selectedProposedGames.push({ name: name, logo: logo, mode: '4v4' });
    Boako.League.renderSelectedGames();

    const searchInput = document.getElementById('game-search-input');
    const autocompleteList = document.getElementById('game-autocomplete-list');
    if (searchInput) searchInput.value = '';
    if (autocompleteList) autocompleteList.classList.add('hidden');
};

Boako.League.removeProposedGame = function(idx) {
    Boako.League.State.selectedProposedGames.splice(idx, 1);
    Boako.League.renderSelectedGames();
};

Boako.League.renderSelectedGames = function() {
    const container = document.getElementById('selected-games-container');
    const searchInput = document.getElementById('game-search-input');
    if(!container) return;

    container.innerHTML = Boako.League.State.selectedProposedGames.map((g, idx) => {
        const safeLogo = (g.logo && g.logo !== 'null') ? g.logo : 'https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challenge%20(1).png';
        return `
        <div class="flex items-center justify-between bg-white border border-violet-100 px-3 py-2 rounded-xl shadow-sm mb-2 transition-all hover:border-violet-300 group">
            <div class="flex items-center gap-2.5">
                <div class="w-7 h-7 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-center p-1 shadow-inner">
                    <img src="${safeLogo}" class="max-w-full max-h-full object-contain drop-shadow-sm" />
                </div>
                <span class="text-xs font-black text-slate-800">${g.name}</span>
            </div>
            <div class="flex items-center gap-2">
                <div class="relative">
                    <select class="appearance-none bg-violet-50 border border-violet-200 hover:border-violet-400 hover:bg-white rounded-lg text-[10px] pl-2.5 pr-6 py-1.5 font-black text-violet-700 outline-none cursor-pointer shadow-sm focus:ring-2 focus:ring-violet-200 transition-all" onchange="Boako.League.State.selectedProposedGames[${idx}].mode = this.value">
                        <option value="4v4" ${g.mode==='4v4'?'selected':''}>4vs4</option>
                        <option value="3v3" ${g.mode==='3v3'?'selected':''}>3vs3</option>
                        <option value="2v2" ${g.mode==='2v2'?'selected':''}>2vs2</option>
                        <option value="1v1" ${g.mode==='1v1'?'selected':''}>1vs1</option>
                    </select>
                    <i data-lucide="chevron-down" class="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-violet-500 pointer-events-none transition-transform group-hover:translate-y(-40%)"></i>
                </div>
                <button type="button" class="w-6 h-6 flex items-center justify-center rounded-md bg-rose-50 text-rose-400 hover:bg-rose-500 hover:text-white transition-colors" onclick="Boako.League.removeProposedGame(${idx})">
                    <i data-lucide="x" class="w-3 h-3 font-black"></i>
                </button>
            </div>
        </div>
    `}).join('');

    setTimeout(() => { if (window.lucide) window.lucide.createIcons(); }, 50);

    if (searchInput) {
        if (Boako.League.State.selectedProposedGames.length >= 3) {
            searchInput.placeholder = "최대 3개 선택 완료";
            searchInput.disabled = true;
            searchInput.classList.add('bg-slate-100', 'cursor-not-allowed', 'opacity-60');
        } else {
            searchInput.placeholder = "종목을 검색하세요...";
            searchInput.disabled = false;
            searchInput.classList.remove('bg-slate-100', 'cursor-not-allowed', 'opacity-60');
        }
    }
};

// [달력 캘린더 모듈]
Boako.League.Calendar = {
    calYear: new Date().getFullYear(),
    calMonth: new Date().getMonth() + 1,
    tempSchedules: [],
    currentFixedTime: '20:00',

    open: () => {
        Boako.League.Calendar.tempSchedules = [...Boako.League.State.selectedSchedules];
        Boako.League.Calendar.calYear = new Date().getFullYear();
        Boako.League.Calendar.calMonth = new Date().getMonth() + 1;
        Boako.League.Calendar.currentFixedTime = '20:00';

        const modalHtml = `
            <div id="league-calendar-modal" class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
                <div class="bg-white rounded-3xl w-80 shadow-2xl overflow-hidden flex flex-col relative">
                    <div class="bg-indigo-600 text-white p-4 flex justify-between items-center shadow-md z-10">
                        <button type="button" onclick="Boako.League.Calendar.changeMonth(-1)" class="p-1 hover:bg-white/20 rounded-lg transition-colors">◀</button>
                        <h3 id="cal-month-title" class="font-black text-sm tracking-widest"></h3>
                        <button type="button" onclick="Boako.League.Calendar.changeMonth(1)" class="p-1 hover:bg-white/20 rounded-lg transition-colors">▶</button>
                    </div>
                    <button type="button" onclick="Boako.League.Calendar.close()" class="absolute top-3 right-3 text-white/50 hover:text-white font-black text-xl z-20">×</button>

                    <div class="bg-indigo-50 p-3 border-b border-indigo-100 flex items-center gap-2">
                        <span class="text-[10px] font-black text-indigo-800 shrink-0">⏰ 고정 시간</span>
                        <select id="poll-fixed-time-select" onchange="Boako.League.Calendar.changeFixedTime(this.value)" class="flex-1 bg-white border border-indigo-200 text-indigo-900 text-xs font-bold rounded-lg px-2 py-1.5 focus:outline-none">
                            <option value="시간 상관없음">☀️ 시간 상관없음</option>
                            ${Array.from({length: 24}, (_, i) => {
                                const time = String(i).padStart(2, '0') + ':00';
                                const ampm = i < 12 ? '오전' : '오후';
                                const h = i === 0 ? 12 : (i > 12 ? i - 12 : i);
                                return `<option value="${time}" ${time === '20:00' ? 'selected' : ''}>${time} (${ampm} ${h}시)</option>`;
                            }).join('')}
                        </select>
                    </div>

                    <div class="grid grid-cols-7 text-center text-[10px] font-black text-slate-400 bg-white pt-3 pb-1">
                        <div class="text-red-400">일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div class="text-blue-400">토</div>
                    </div>
                    <div id="cal-days-grid" class="grid grid-cols-7 gap-1.5 p-3 bg-white mb-2"></div>

                    <div class="p-3 bg-white border-t border-slate-100">
                        <button type="button" id="poll-submit-btn" onclick="Boako.League.Calendar.submit()" class="w-full bg-slate-200 text-slate-500 text-xs font-black py-3 rounded-xl transition-all shadow-sm cursor-not-allowed" disabled>
                            날짜를 클릭하여 선택하세요
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        Boako.League.Calendar.renderGrid();
    },
    close: () => { document.getElementById('league-calendar-modal')?.remove(); },
    changeMonth: (delta) => {
        let m = Boako.League.Calendar.calMonth + delta; let y = Boako.League.Calendar.calYear;
        if (m > 12) { m = 1; y++; } if (m < 1) { m = 12; y--; }
        Boako.League.Calendar.calYear = y; Boako.League.Calendar.calMonth = m;
        Boako.League.Calendar.renderGrid();
    },
    changeFixedTime: (val) => { Boako.League.Calendar.currentFixedTime = val; },
    renderGrid: () => {
        const year = Boako.League.Calendar.calYear;
        const month = Boako.League.Calendar.calMonth;
        document.getElementById('cal-month-title').innerText = `${year}년 ${month}월`;
        const firstDay = new Date(year, month - 1, 1).getDay();
        const lastDate = new Date(year, month, 0).getDate();
        const today = new Date(); today.setHours(0,0,0,0);
        
        let gridHtml = '';
        for (let i = 0; i < firstDay; i++) gridHtml += `<div class="p-2"></div>`;

        for (let day = 1; day <= lastDate; day++) {
            const currentCellDate = new Date(year, month - 1, day);
            const isPast = currentCellDate < today;
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayTimes = Boako.League.Calendar.tempSchedules.filter(t => t.startsWith(dateStr));
            const isSelected = dayTimes.length > 0;
            
            let cellClass = "w-full aspect-square flex flex-col items-center justify-center rounded-xl transition-all relative ";
            let innerHtml = `<span class="text-xs font-bold">${day}</span>`;
            
            if (isPast) { cellClass += "text-slate-300 cursor-not-allowed bg-slate-50/50"; }
            else if (isSelected) {
                cellClass += "bg-indigo-600 text-white shadow-md transform scale-105 cursor-pointer ring-2 ring-indigo-200 ring-offset-1";
                const timeVal = dayTimes[0].split(' ')[1];
                const displayTime = timeVal === '시간' || timeVal === '상관없음' ? '☀️' : timeVal;
                innerHtml += `<span class="text-[8px] font-mono mt-0.5 opacity-90">${displayTime}</span>`;
            } else { cellClass += "text-slate-700 bg-slate-50 hover:bg-indigo-100 hover:text-indigo-700 cursor-pointer border border-slate-100"; }
            gridHtml += `<div ${isPast ? '' : `onclick="Boako.League.Calendar.toggleDate('${dateStr}')"`} class="${cellClass}">${innerHtml}</div>`;
        }
        document.getElementById('cal-days-grid').innerHTML = gridHtml;
        Boako.League.Calendar.updateSubmitBtn();
    },
    toggleDate: (dateStr) => {
        const combined = `${dateStr} ${Boako.League.Calendar.currentFixedTime}`;
        const idx = Boako.League.Calendar.tempSchedules.indexOf(combined);
        if (idx > -1) Boako.League.Calendar.tempSchedules.splice(idx, 1);
        else {
            Boako.League.Calendar.tempSchedules = Boako.League.Calendar.tempSchedules.filter(t => !t.startsWith(dateStr));
            Boako.League.Calendar.tempSchedules.push(combined);
        }
        Boako.League.Calendar.renderGrid();
    },
    updateSubmitBtn: () => {
        const btn = document.getElementById('poll-submit-btn');
        const count = Boako.League.Calendar.tempSchedules.length;
        if (count > 0) {
            btn.disabled = false;
            btn.className = "w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black py-3 rounded-xl transition-all shadow-md active:scale-95 flex justify-center items-center gap-2";
            btn.innerHTML = `<span class="bg-white text-indigo-700 px-1.5 py-0.5 rounded-md text-[10px] leading-none">${count}</span> 개 후보 등록하기`;
        } else {
            btn.disabled = true;
            btn.className = "w-full bg-slate-200 text-slate-500 text-xs font-black py-3 rounded-xl transition-all shadow-sm cursor-not-allowed";
            btn.innerHTML = "날짜를 클릭하여 선택하세요";
        }
    },
    submit: () => {
        Boako.League.State.selectedSchedules = [...Boako.League.Calendar.tempSchedules];
        Boako.League.renderSelectedSchedules();
        Boako.League.Calendar.close();
    }
};

Boako.League.renderSelectedSchedules = function() {
    const container = document.getElementById('selected-schedules-container');
    if(!container) return;
    if(Boako.League.State.selectedSchedules.length === 0) {
        container.innerHTML = `<span class="text-xs text-slate-400 font-bold p-1">선택된 일정이 없습니다. 달력을 열어 추가해주세요.</span>`;
        return;
    }
    container.innerHTML = Boako.League.State.selectedSchedules.map((time, idx) => `
        <div class="bg-indigo-50 border border-indigo-200 text-indigo-800 text-[11px] font-black px-2.5 py-1 rounded-md flex items-center gap-1 shadow-sm">
            ${time}
            <button type="button" class="text-indigo-400 hover:text-red-500 font-bold ml-1.5" onclick="Boako.League.removeSchedule(${idx})">✕</button>
        </div>
    `).join('');
};

Boako.League.removeSchedule = function(idx) {
    Boako.League.State.selectedSchedules.splice(idx, 1);
    Boako.League.renderSelectedSchedules();
};

// [도전장 최종 발행]
Boako.League.registerChallenge = async function() {
    const games = Boako.League.State.selectedProposedGames;
    const rawSchedules = Boako.League.State.selectedSchedules || [];
    const message = document.getElementById('challenge-msg').value || "조건 맞으면 드루와!";
    
    if (games.length === 0) return alert("최소 1개의 종목을 선택하세요.");
    if (rawSchedules.length === 0) return alert("달력을 열어 조율 가능한 후보 일정을 1개 이상 등록해주세요.");
    
    let scheduleArray = rawSchedules.map(str => {
        let [datePart, timePart] = str.split(' ');
        if (timePart === '시간' || timePart === '상관없음') timePart = '00:00'; 
        return new Date(`${datePart}T${timePart}:00+09:00`).toISOString();
    });

    try {
        const payload = {
            p_season_no: Boako.League.State.selectedChallengeSeason,
            p_attacker_team_id: Boako.state?.team?.info?.id, 
            p_attacker_team_name: Boako.state?.team?.info?.team_name || "테스트 팀",
            p_attacker_team_logo_url: Boako.state?.team?.info?.logo_url,
            p_proposed_games: games, 
            p_schedule: scheduleArray, 
            p_message: message
        };

        if (Boako.db) {
            const { error } = await Boako.db.rpc('create_challenge', payload);
            if (error) throw error;
        }

        alert("모집글이 광장에 발행되었습니다!");
        Boako.League.closeCreateChallengeModal();
        await Boako.League.loadChallengesForSeason(Boako.League.State.selectedChallengeSeason);
        Boako.League.renderChallenges();
    } catch (err) { alert("발행 오류 발생"); console.error(err); }
};

// ====================================================================
// 💡 5. 참전 수락 팝업 로직
// ====================================================================
Boako.League.showAcceptPopup = function(challengeId) {
    const p = Boako.League.State.challenges.find(c => c.id === challengeId);
    if (!p) return;
    
    // 포매팅 적용
    const gamesOptions = (p.proposed_games || []).map((g, i) => `<option value="${i}">${g.name} (${Boako.League.formatMode(g.mode)})</option>`).join('');
    
    let schedulesOptions = '<option value="">선택 불가 (일정 없음)</option>';
    if (p.schedule && p.schedule.length > 0) {
        schedulesOptions = p.schedule.map((d) => {
            const dt = new Date(d);
            const isZeroTime = dt.getHours() === 0 && dt.getMinutes() === 0;
            const display = isZeroTime ? `${dt.getMonth()+1}월 ${dt.getDate()}일 (시간 상관없음)` : `${dt.getMonth()+1}월 ${dt.getDate()}일 ${dt.getHours()}:${String(dt.getMinutes()).padStart(2,'0')}`;
            return `<option value="${d}">${display}</option>`;
        }).join('');
    }
    
    const safeTeamLogo = (p.attacker_team_logo_url && p.attacker_team_logo_url !== 'null') ? p.attacker_team_logo_url : 'https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/default_logo.png';

    const popupHtml = `
        <div id="challenge-modal-backdrop" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9998] flex items-center justify-center p-4" onclick="document.getElementById('challenge-popup-root').innerHTML=''">
            <div class="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200" onclick="event.stopPropagation()">
                <div class="bg-gradient-to-br from-violet-600 to-indigo-700 p-6 text-center relative">
                    <button onclick="document.getElementById('challenge-popup-root').innerHTML=''" class="absolute top-4 right-4 text-white/60 hover:text-white"><i data-lucide="x" class="w-5 h-5"></i></button>
                    <div class="w-20 h-20 mx-auto bg-white rounded-2xl shadow-lg p-1.5 mb-3 border-2 border-white/50"><img src="${safeTeamLogo}" class="w-full h-full object-cover rounded-xl" /></div>
                    <h3 class="text-xl font-black text-white">${p.attacker_team_name}</h3>
                </div>
                
                <div class="p-6 space-y-5">
                    <div>
                        <label class="block text-xs font-black text-slate-700 mb-1.5">🎯 맞붙을 종목 선택</label>
                        <select id="popup-selected-game" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-violet-500 cursor-pointer shadow-inner">${gamesOptions}</select>
                    </div>
                    <div>
                        <label class="block text-xs font-black text-slate-700 mb-1.5">🕒 최종 확정 일정 선택</label>
                        <select id="popup-confirmed-schedule" class="w-full bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2.5 text-xs font-black text-indigo-800 outline-none focus:border-indigo-500 cursor-pointer shadow-inner">${schedulesOptions}</select>
                    </div>
                    
                    <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
                        <div>
                            <span class="block text-xs font-black text-amber-800">🔥 묻고 더블로 가!</span>
                            <span class="block text-[10px] font-bold text-amber-600 mt-0.5">우리 팀도 토큰을 걸어 판돈을 키웁니다.</span>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="popup-use-token" class="sr-only peer">
                            <div class="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500 shadow-inner"></div>
                        </label>
                    </div>

                    <button onclick="Boako.League.confirmAcceptChallenge(${p.id})" class="w-full bg-slate-900 hover:bg-black text-white font-black text-sm py-3.5 rounded-xl shadow-lg transition-all">
                        ⚔️ 조건 확정 및 참전하기
                    </button>
                </div>
            </div>
        </div>
    `;
    document.getElementById('challenge-popup-root').innerHTML = popupHtml;
    setTimeout(() => { if (window.lucide) window.lucide.createIcons(); }, 50);
};

Boako.League.confirmAcceptChallenge = async function(challengeId) {
    const p = Boako.League.State.challenges.find(c => c.id === challengeId);
    const selectedGameIndex = document.getElementById('popup-selected-game').value;
    const confirmedTime = document.getElementById('popup-confirmed-schedule').value;
    const useToken = document.getElementById('popup-use-token').checked; 
    
    if (!confirmedTime) return alert("최종 확정 일정을 입력해 주세요.");
    const selectedGame = p.proposed_games[selectedGameIndex];

    try {
        const payload = {
            p_challenge_id: challengeId,
            p_defender_team_id: Boako.state?.team?.info?.id,
            p_defender_team_name: Boako.state?.team?.info?.team_name,
            p_game_name: selectedGame.name,
            p_game_logo_url: selectedGame.logo,
            p_game_mode: selectedGame.mode || '4v4',
            p_confirmed_schedule: new Date(confirmedTime).toISOString(),
            p_use_token: useToken
        };

        if (Boako.db) {
            const { error } = await Boako.db.rpc('accept_challenge', payload);
            if (error) {
                if(error.message.includes("토큰이 부족")) return alert("보유한 챌린지 토큰이 부족하여 더블 배팅을 할 수 없습니다.");
                throw error;
            }
        }

        alert("매칭이 성사되었습니다!");
        document.getElementById('challenge-popup-root').innerHTML = ''; 
    } catch (err) { alert("처리 중 오류가 발생했습니다: " + err.message); console.error(err); }
};

// ====================================================================
// 💡 5.5. 결전 로스터(엔트리) 구성 및 지능형 오더 제출 모달
// ====================================================================

// 1. 모달 렌더링 함수 (검색바 HTML 추가)
Boako.League.showRosterModal = async function(challengeId) {
    const p = Boako.League.State.challenges.find(c => c.id === challengeId);
    if (!p) return;

    const myTeamId = Boako.state?.team?.info?.id;
    if (!myTeamId) return alert("소속된 팀 정보가 없습니다.");

    Boako.League.State.currentRosterSlots = [null, null, null, null];
    Boako.League.State.isMercenaryTab = false;

    try {
        const { data: myTeamRel, error: tmErr } = await Boako.db
            .from('team_members')
            .select('player_name')
            .eq('team_id', myTeamId)
            .eq('is_active', true);
        if (tmErr) throw tmErr;
        const myTeamPlayerNames = (myTeamRel || []).map(row => row.player_name);

        const { data: allActiveMembers, error: allErr } = await Boako.db
            .from('team_members')
            .select('player_name')
            .eq('is_active', true);
        if (allErr) throw allErr;
        const assignedPlayerNames = (allActiveMembers || []).map(row => row.player_name);

        // 3. 프로필 전체 조회 부분
        const { data: allProfiles, error: pErr } = await Boako.db
            .from('profiles')
            .select('id, full_name, profile_url'); 
            
        if (pErr) throw pErr;

        // 🚨 [추가] 상대팀이 이미 데려간 명단 추출 (양다리 방지용)
        const isMyAttack = (p.attacker_team_id === myTeamId);
        const opposingRosterNames = [];
        if (isMyAttack) {
            if (p.defender_1) opposingRosterNames.push(p.defender_1);
            if (p.defender_2) opposingRosterNames.push(p.defender_2);
            if (p.defender_3) opposingRosterNames.push(p.defender_3);
            if (p.defender_4) opposingRosterNames.push(p.defender_4);
        } else {
            if (p.attacker_1) opposingRosterNames.push(p.attacker_1);
            if (p.attacker_2) opposingRosterNames.push(p.attacker_2);
            if (p.attacker_3) opposingRosterNames.push(p.attacker_3);
            if (p.attacker_4) opposingRosterNames.push(p.attacker_4);
        }

        // 팀원 매핑 시 avatar 데이터 포함
        Boako.League.State.rosterTeamMembers = allProfiles
            .filter(p => myTeamPlayerNames.includes(p.full_name))
            .map(p => ({ id: p.id, nickname: p.full_name, avatar: p.profile_url })); 

        // 용병 매핑 (🚨 상대팀 명단 필터링 추가)
        Boako.League.State.rosterMercenaries = allProfiles
            .filter(p => !assignedPlayerNames.includes(p.full_name))
            .filter(p => !opposingRosterNames.includes(p.full_name)) // 🌟 여기서 양다리 완벽 차단
            .map(p => ({ id: p.id, nickname: p.full_name, avatar: p.profile_url }));

    } catch (err) {
        console.error("로스터 데이터 바인딩 실패:", err);
        return alert(`DB 조회 실패: ${err.message}`);
    }

    const safeGameLogo = (p.game_logo_url && p.game_logo_url !== 'null') ? p.game_logo_url : 'https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challenge%20(1).png';
    const gameMode = p.game_mode || '4v4'; 
    const displayGameMode = Boako.League.formatMode(gameMode);

    const modalHtml = `
        <div id="roster-modal-backdrop" class="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[9998] flex items-center justify-center p-4" onclick="Boako.League.closeRosterModal()">
            <div class="bg-slate-50 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col md:flex-row max-h-[90vh]" onclick="event.stopPropagation()">
                
                <div class="w-full md:w-5/12 bg-white flex flex-col border-r border-slate-200">
                    <div class="p-5 border-b border-slate-100 flex items-center justify-between">
                        <h3 class="font-black text-slate-800 flex items-center gap-2"><i data-lucide="users" class="w-5 h-5 text-indigo-600"></i> 선수 명단</h3>
                        <button onclick="Boako.League.closeRosterModal()" class="md:hidden text-slate-400"><i data-lucide="x" class="w-5 h-5"></i></button>
                    </div>
                    
                    <div class="flex p-3 gap-2 bg-slate-50/50">
                        <button id="btn-tab-team" onclick="Boako.League.switchRosterTab(false)" class="flex-1 py-2 text-xs font-black rounded-lg transition-all bg-indigo-600 text-white shadow-sm">소속 팀원</button>
                        <button id="btn-tab-merc" onclick="Boako.League.switchRosterTab(true)" class="flex-1 py-2 text-xs font-black rounded-lg transition-all bg-white text-slate-500 border border-slate-200 hover:bg-slate-100">자유 용병</button>
                    </div>

                    <div class="px-3 pb-3 border-b border-slate-100 bg-slate-50/50 shrink-0">
                        <div class="relative">
                            <input type="text" id="roster-search-input" oninput="Boako.League.renderRosterList()" placeholder="닉네임으로 검색..." class="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-inner transition-all">
                            <i data-lucide="search" class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"></i>
                        </div>
                    </div>
                    
                    <div class="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2" id="roster-list-container"></div>
                </div>

                <div class="w-full md:w-7/12 flex flex-col">
                    <div class="p-5 bg-gradient-to-r from-indigo-900 to-slate-900 text-white flex justify-between items-start">
                        <div>
                            <div class="text-[10px] font-black text-indigo-300 mb-1 tracking-widest uppercase">Challenge Order</div>
                            <div class="font-black text-lg flex items-center gap-2">
                                <img src="${safeGameLogo}" class="w-6 h-6 object-contain bg-white rounded p-0.5">
                                ${p.game_name} <span class="bg-indigo-600 border border-indigo-400 px-2 py-0.5 text-xs rounded-md ml-1">${displayGameMode}</span>
                            </div>
                        </div>
                        <button onclick="Boako.League.closeRosterModal()" class="hidden md:block text-white/50 hover:text-white"><i data-lucide="x" class="w-6 h-6"></i></button>
                    </div>

                    <div class="p-5 flex-1 overflow-y-auto custom-scrollbar">
                        <div class="mb-5">
                            <label class="block text-xs font-black text-slate-700 mb-2">1. 출전 슬롯 (순서대로 채우세요)</label>
                            <div class="grid grid-cols-4 gap-2" id="roster-slots-container"></div>
                            <p class="text-[10px] text-slate-400 mt-2 font-bold text-center">선수를 클릭하여 슬롯에서 제거할 수 있습니다.</p>
                        </div>

                        <div class="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 shadow-inner">
                            <label class="block text-xs font-black text-indigo-900 mb-3 flex items-center gap-1.5"><i data-lucide="eye" class="w-4 h-4"></i> 2. 실시간 조 편성 프리뷰 (DB 연동 기준)</label>
                            <div class="space-y-2" id="roster-preview-container"></div>
                        </div>
                    </div>

                    <div class="p-5 bg-white border-t border-slate-200">
                        <button onclick="Boako.League.submitFinalRoster(${challengeId}, '${gameMode}')" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm py-4 rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                            <i data-lucide="send" class="w-4 h-4"></i> 최종 로스터 확정 및 제출
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('challenge-popup-root').innerHTML = modalHtml;
    setTimeout(() => { if (window.lucide) window.lucide.createIcons(); }, 50);
    
    Boako.League.renderRosterList();
    Boako.League.renderRosterSlots(gameMode);
};

// 2. 탭 전환 함수 (전환 시 검색바 초기화 추가)
Boako.League.switchRosterTab = function(isMerc) {
    Boako.League.State.isMercenaryTab = isMerc;
    document.getElementById('btn-tab-team').className = `flex-1 py-2 text-xs font-black rounded-lg transition-all ${!isMerc ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'}`;
    document.getElementById('btn-tab-merc').className = `flex-1 py-2 text-xs font-black rounded-lg transition-all ${isMerc ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'}`;
    
    // 🚨 탭 전환 시 검색어 비우기
    const searchInput = document.getElementById('roster-search-input');
    if (searchInput) searchInput.value = '';
    
    Boako.League.renderRosterList();
};

// 3. 리스트 렌더링 함수 (입력값에 따른 실시간 필터링 추가)
Boako.League.renderRosterList = function() {
    const container = document.getElementById('roster-list-container');
    const searchInput = document.getElementById('roster-search-input');
    const keyword = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const isMerc = Boako.League.State.isMercenaryTab;
    let list = isMerc ? Boako.League.State.rosterMercenaries : Boako.League.State.rosterTeamMembers;

    if (keyword) {
        list = list.filter(m => m.nickname.toLowerCase().includes(keyword));
    }

    if (list.length === 0) {
        container.innerHTML = `<div class="text-center text-xs font-bold text-slate-400 py-10">${keyword ? '검색된 인원이 없습니다.' : '조회된 인원이 없습니다.'}</div>`;
        return;
    }

    container.innerHTML = list.map(m => {
        const isSelected = Boako.League.State.currentRosterSlots.some(slot => slot && slot.id === m.id);
        const btnClass = isSelected 
            ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-50" 
            : "bg-white border-slate-200 text-slate-700 hover:border-indigo-400 hover:shadow-sm cursor-pointer";

        // 🚨 HTTP -> HTTPS 변환 로직 추가
        const secureAvatar = m.avatar ? m.avatar.replace(/^http:\/\//i, 'https://') : null;

        const avatarHtml = secureAvatar 
            ? `<img src="${secureAvatar}" class="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-inner" referrerpolicy="no-referrer">`
            : `<div class="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-black ${isMerc ? 'text-amber-600' : 'text-indigo-600'}">${m.nickname.substring(0,2)}</div>`;

        return `
            <div onclick="Boako.League.addPlayerToSlot('${m.id}', '${m.nickname.replace(/'/g, "\\'")}', ${isMerc})" class="p-3 border rounded-xl flex justify-between items-center transition-all ${btnClass}">
                <div class="flex items-center gap-2">
                    ${avatarHtml}
                    <span class="font-black text-xs">${m.nickname}</span>
                </div>
                ${isMerc ? '<span class="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-black">용병</span>' : ''}
            </div>
        `;
    }).join('');
};

Boako.League.addPlayerToSlot = function(id, nickname, isMerc) {
    if (Boako.League.State.currentRosterSlots.some(s => s && s.id === id)) return;

    const emptyIndex = Boako.League.State.currentRosterSlots.findIndex(s => s === null);
    if (emptyIndex === -1) {
        if(Boako.Util && Boako.Util.toast) Boako.Util.toast("4개의 슬롯이 모두 가득 찼습니다.");
        else alert("4개의 슬롯이 모두 가득 찼습니다.");
        return;
    }

    Boako.League.State.currentRosterSlots[emptyIndex] = { id, nickname, isMerc };
    
    const modeBadge = document.querySelector('#challenge-popup-root span.bg-indigo-600');
    const gameMode = modeBadge ? modeBadge.innerText.replace('vs', 'v').trim() : '4v4';

    Boako.League.renderRosterList(); 
    Boako.League.renderRosterSlots(gameMode);
};

Boako.League.removePlayerFromSlot = function(index) {
    Boako.League.State.currentRosterSlots[index] = null;
    
    const modeBadge = document.querySelector('#challenge-popup-root span.bg-indigo-600');
    const gameMode = modeBadge ? modeBadge.innerText.replace('vs', 'v').trim() : '4v4';

    Boako.League.renderRosterList();
    Boako.League.renderRosterSlots(gameMode);
};

Boako.League.renderRosterSlots = function(gameMode) {
    const slotsContainer = document.getElementById('roster-slots-container');
    const previewContainer = document.getElementById('roster-preview-container');
    if (!slotsContainer || !previewContainer) return;

    slotsContainer.innerHTML = Boako.League.State.currentRosterSlots.map((slot, idx) => {
        if (slot) {
            return `
                <div onclick="Boako.League.removePlayerFromSlot(${idx})" class="aspect-square bg-indigo-600 rounded-xl border-2 border-indigo-400 flex flex-col items-center justify-center cursor-pointer shadow-md transform hover:scale-105 transition-all group relative">
                    <span class="absolute top-1 left-1.5 text-[9px] font-black text-indigo-300">P${idx+1}</span>
                    <div class="font-black text-white text-xs truncate w-full text-center px-1">${slot.nickname}</div>
                    ${slot.isMerc ? '<span class="absolute -top-2 -right-2 text-base drop-shadow-md">💎</span>' : ''}
                    <div class="absolute inset-0 bg-rose-500/90 text-white opacity-0 group-hover:opacity-100 rounded-lg flex items-center justify-center font-black text-xs transition-opacity">제거</div>
                </div>
            `;
        } else {
            return `
                <div class="aspect-square bg-white border border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-300">
                    <span class="text-[9px] font-black mb-1">P${idx+1}</span>
                    <i data-lucide="plus" class="w-5 h-5"></i>
                </div>
            `;
        }
    }).join('');
    
    setTimeout(() => { if (window.lucide) window.lucide.createIcons(); }, 50);

    const slots = Boako.League.State.currentRosterSlots.map(s => s ? s.nickname : '미지정');
    const mercStatus = Boako.League.State.currentRosterSlots.map(s => s ? s.isMerc : false);
    
    let entries = { 1: [], 2: [], 3: [], 4: [] };

    switch (gameMode) {
        case '1v1':
            entries[1] = [0]; entries[2] = [1]; entries[3] = [2]; entries[4] = [3];
            break;
        case '2v2':
            entries[1] = [0, 1]; entries[2] = [2, 3]; entries[3] = [1, 2]; entries[4] = [0, 3];
            break;
        case '3v3':
            entries[1] = [0, 1, 2]; entries[2] = [0, 1, 3]; entries[3] = [0, 2, 3]; entries[4] = [1, 2, 3];
            break;
        case '4v4':
            entries[1] = [0, 1, 2, 3]; entries[2] = [0, 1, 2, 3]; entries[3] = [0, 1, 2, 3]; entries[4] = [0, 1, 2, 3];
            break;
        default:
            entries[1] = []; entries[2] = []; entries[3] = []; entries[4] = [];
    }

    previewContainer.innerHTML = [1, 2, 3, 4].map(matchNum => {
        const teamIndexes = entries[matchNum];
        if (teamIndexes.length === 0) return '';
        
        const namesHtml = teamIndexes.map(idx => {
            const isMerc = mercStatus[idx];
            const name = slots[idx];
            const color = name === '미지정' ? 'text-slate-400' : 'text-indigo-900';
            return `<span class="bg-white border border-indigo-100 shadow-sm px-2 py-1 rounded-md font-black text-xs ${color}">${name} ${isMerc ? '💎' : ''}</span>`;
        }).join('<span class="text-indigo-300 font-bold text-[10px] mx-1">+</span>');

        return `
            <div class="flex items-center gap-3 bg-white/60 p-2 rounded-xl border border-indigo-50">
                <div class="w-10 h-7 bg-indigo-100 rounded-lg text-indigo-700 font-black text-[10px] flex items-center justify-center shrink-0">매치 ${matchNum}</div>
                <div class="flex flex-wrap items-center gap-1">${namesHtml}</div>
            </div>
        `;
    }).join('');
};

Boako.League.closeRosterModal = function() {
    document.getElementById('challenge-popup-root').innerHTML = '';
};

Boako.League.submitFinalRoster = async function(challengeId, gameMode) {
    const slots = Boako.League.State.currentRosterSlots;
    
    if (slots.includes(null)) {
        if(Boako.Util && Boako.Util.toast) return Boako.Util.toast("4명의 선수를 모두 슬롯에 배치해주세요.");
        else return alert("4명의 선수를 모두 슬롯에 배치해주세요.");
    }

    if (!confirm("이 조합과 순서로 로스터를 확정하시겠습니까? (제출 후 수정 불가)")) return;

    try {
        if (!Boako.db) throw new Error("DB 연결 오류");
        
        const payload = {
            p_challenge_id: challengeId,
            p_team_id: Boako.state?.team?.info?.id,
            p_p1: slots[0].nickname, p_m1: slots[0].isMerc,
            p_p2: slots[1].nickname, p_m2: slots[1].isMerc,
            p_p3: slots[2].nickname, p_m3: slots[2].isMerc,
            p_p4: slots[3].nickname, p_m4: slots[3].isMerc
        };

        const { error } = await Boako.db.rpc('submit_challenge_roster', payload);
        if (error) throw error;

        if(Boako.Util && Boako.Util.toast) Boako.Util.toast("🎯 로스터 제출이 완료되었습니다!");
        else alert("🎯 로스터 제출이 완료되었습니다!");
        
        Boako.League.closeRosterModal();
        await Boako.League.loadChallengesForSeason(Boako.League.State.selectedChallengeSeason);
        Boako.League.renderChallenges();
        
    } catch (err) {
        alert("로스터 제출 실패: " + err.message);
        console.error(err);
    }
};

// ====================================================================
// 🎲 6. BTL 영토 빙고전
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
                <p class="text-[10px] text-slate-400 font-medium pt-1">🎯 기본 규칙: 차지한 칸마다 🏆 LP <span class="text-indigo-600 font-bold">1점</span>을 획득하며, 빙고줄 완성 시 스코어보드 보너스가 연산됩니다.</p>
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
    setTimeout(() => { if (window.lucide) window.lucide.createIcons(); }, 50);
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
        let massiveOverlayHtml = ''; if (ownerTeam) { const teamLogoUrl = Boako.League.State.bingoTeamLogos25[idx] || 'https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challenge%20(1).png'; massiveOverlayHtml = `<div class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/40 backdrop-blur-[2px] transition-all pb-2 pointer-events-none"><img src="${teamLogoUrl}" alt="${ownerTeam}" class="w-14 h-14 object-contain drop-shadow-xl transform group-hover:scale-110 transition-transform duration-300"></div>`; }
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
        teamLogoUrl = teamLogoUrl || 'https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challenge%20(1).png';
        let badgesHtml = '';
        for (let i = 1; i <= 5; i++) if (row[`is_row_${i}_completed`] === true) badgesHtml += `<span class="bg-blue-50 text-blue-700 border border-blue-200 text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-sm">↔️ 가로 ${i}열</span>`;
        for (let i = 1; i <= 5; i++) if (row[`is_col_${i}_completed`] === true) badgesHtml += `<span class="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-sm">↕️ 세로 ${i}행</span>`;
        if (row.is_diagonal_down_completed === true) badgesHtml += `<span class="bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-sm">↘️ 대각선 우하</span>`;
        if (row.is_diagonal_up_completed === true) badgesHtml += `<span class="bg-violet-50 text-violet-700 border border-violet-200 text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-sm">↗️ 대각선 우상</span>`;
        if (!badgesHtml) badgesHtml = `<span class="text-slate-400 font-medium text-[10px] italic">현재 빙고 조합 연산 중...</span>`;
        html += `
            <div class="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-sm space-y-3 transition-all hover:border-slate-300">
                <div class="flex justify-between items-center"><span class="font-black text-slate-800 text-xs flex items-center gap-1.5"><img src="${teamLogoUrl}" class="w-4 h-4 object-contain rounded-full shadow-sm bg-slate-50 border border-slate-100"> ${teamName}</span><div class="text-right flex items-center"><span class="text-indigo-600 font-black text-sm ml-0.5"><span class="flex flex-col items-end leading-tight">🏆 ${totalScore} LP<span class="text-slate-400 font-bold">획득</span></span></span></div></div>
                <div class="grid grid-cols-2 gap-2 text-center bg-slate-50 p-2 rounded-xl text-[10px] font-bold text-slate-500 border border-slate-100"><div>점유 영토 <span class="text-slate-800 font-black">${basicSlots}칸</span></div><div class="border-l border-slate-200">완성 라인 <span class="text-amber-500 font-black">${totalLines}줄</span></div></div>
                <div class="flex flex-wrap gap-1 pt-1 border-t border-dashed border-slate-100">${badgesHtml}</div>
            </div>
        `;
    });
    statContainer.innerHTML = html;
};
Boako.League.showChallengeRuleModal = function() {
    const TOKEN_IMG = `<img src="https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challengetoken.png" class="w-4 h-4 inline-block align-middle mx-0.5">`;
    const modalHtml = `
        <div id="challenge-rule-backdrop" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" onclick="Boako.League.closeChallengeRuleModal()">
            <div class="w-full max-w-xl bg-slate-900 rounded-3xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onclick="event.stopPropagation()">
                
                <div class="bg-slate-950 border-b border-slate-800 p-5 flex items-center justify-between shrink-0">
                    <div>
                        <h2 class="text-white font-black text-lg tracking-tight flex items-center gap-2">
                            <span class="text-indigo-500">🏆</span> 드루와! 챌린지 공식 가이드
                        </h2>
                        <p class="text-slate-400 text-[11px] font-bold mt-1">승자연전 결투의 진행 과정과 승점 정산 규칙 가이드</p>
                    </div>
                    <button onclick="Boako.League.closeChallengeRuleModal()" class="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center font-black transition-colors">✕</button>
                </div>

                <div class="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
                    
                    <div class="space-y-3">
                        <label class="block text-xs font-black text-indigo-400 uppercase tracking-widest border-b border-slate-800 pb-2">📋 결투 진행 프로세스</label>
                        
                        <div class="relative border-l-2 border-slate-800 pl-4 space-y-4 ml-2">
                            
                            <div class="relative">
                                <div class="absolute -left-[25px] top-1 w-4 h-4 bg-indigo-600 rounded-full border-4 border-slate-900"></div>
                                <div class="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
                                    <div class="flex items-center gap-2 mb-1">
                                        <span class="bg-indigo-900 text-indigo-300 text-[9px] px-2 py-0.5 rounded font-black tracking-wider">STEP 1</span>
                                        <h4 class="text-white font-black text-sm">도전장 발행 (도전)</h4>
                                    </div>
                                    <p class="text-slate-400 text-xs font-bold leading-relaxed">
                                        도전팀이 ${TOKEN_IMG}<span class="text-amber-400">1개를 소모</span>하여 광장에 도전장을 발행합니다.<br>
                                        희망하는 게임 종목(최대 3개)와 진행 방식, 조율 가능한 일정을 제시합니다.
                                    </p>
                                </div>
                            </div>

                            <div class="relative">
                                <div class="absolute -left-[25px] top-1 w-4 h-4 bg-amber-600 rounded-full border-4 border-slate-900"></div>
                                <div class="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
                                    <div class="flex items-center gap-2 mb-1">
                                        <span class="bg-amber-900 text-amber-300 text-[9px] px-2 py-0.5 rounded font-black tracking-wider">STEP 2</span>
                                        <h4 class="text-white font-black text-sm">협상 및 참전 (응전)</h4>
                                    </div>
                                    <p class="text-slate-400 text-xs font-bold leading-relaxed">
                                        응전팀이 참전하며 최종 종목과 일정을 확정합니다.<br>
                                        응전팀도 ${TOKEN_IMG}<span class="text-amber-400">1개를 소모</span>하여, 승점 보상이 2배가 되는 <span class="text-amber-400">묻고 더블로 가!</span> 옵션을 선택합니다.
                                    </p>
                                </div>
                            </div>

                            <div class="relative">
                                <div class="absolute -left-[25px] top-1 w-4 h-4 bg-emerald-600 rounded-full border-4 border-slate-900"></div>
                                <div class="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
                                    <div class="flex items-center gap-2 mb-1">
                                        <span class="bg-emerald-900 text-emerald-300 text-[9px] px-2 py-0.5 rounded font-black tracking-wider">STEP 3</span>
                                        <h4 class="text-white font-black text-sm">로스터 제출 및 결전</h4>
                                    </div>
                                    <p class="text-slate-400 text-xs font-bold leading-relaxed">
                                        양 팀이 <span class="text-emerald-400">4명의 출전 선수(P1~P4)</span> 명단을 순서대로 제출합니다.<br>
                                        <span class="text-emerald-400">진행 방식</span>에 따라 <span class="text-emerald-400">엔트리가 자동</span>으로 지정됩니다.<br>
                                        승리한 엔트리가 계속해서 다음 상대 엔트리와 맞붙는 <span class="text-emerald-400">승자연전(KOF) 룰</span>로 경기가 진행됩니다.
                                    </p>
                                </div>
                            </div>

                            <div class="relative">
                                <div class="absolute -left-[25px] top-1 w-4 h-4 bg-rose-600 rounded-full border-4 border-slate-900"></div>
                                <div class="bg-rose-900/20 border border-rose-700 rounded-xl p-3">
                                    <div class="flex items-center gap-2 mb-1">
                                        <span class="bg-rose-900 text-rose-300 text-[9px] px-2 py-0.5 rounded font-black tracking-wider">STEP 4</span>
                                        <h4 class="text-white font-black text-sm">최종 승점 정산</h4>
                                    </div>
                                    <p class="text-slate-300 text-xs font-bold leading-relaxed">
                                        모든 결전이 종료되면 최대 연승 기록을 기반으로 <span class="text-rose-400">🏆 LP가 자동으로 정산</span>됩니다.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="space-y-4 pt-4 border-t border-slate-800">
                        <div class="flex items-center justify-between">
                            <label class="block text-xs font-black text-amber-400 uppercase tracking-widest">💰 승점 정산 시뮬레이터</label>
                            <div class="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                                <span class="text-[10px] font-black text-slate-300">묻고 더블로 가! (x2배)</span>
                                <input type="checkbox" id="rule-double-toggle" onchange="Boako.League.calcRuleSimulator()" checked
                                       class="w-8 h-4 bg-slate-900 rounded-full appearance-none cursor-pointer border border-slate-600 checked:bg-amber-600 transition-colors">
                            </div>
                        </div>
                        
                        <p class="text-slate-400 text-[11px] font-bold">최종 승리 시, 기록한 최대 연승에 따라 포인트가 차등 지급됩니다.</p>
                        
                        <div class="grid grid-cols-4 gap-2">
                            <button onclick="Boako.League.setRuleStreak(1)" id="rule-btn-s1" class="rule-streak-btn bg-slate-800 border border-slate-700 text-slate-400 font-black text-xs py-2.5 rounded-xl transition-all">1승</button>
                            <button onclick="Boako.League.setRuleStreak(2)" id="rule-btn-s2" class="rule-streak-btn bg-slate-800 border border-slate-700 text-slate-400 font-black text-xs py-2.5 rounded-xl transition-all">2연승</button>
                            <button onclick="Boako.League.setRuleStreak(3)" id="rule-btn-s3" class="rule-streak-btn bg-slate-800 border border-slate-700 text-slate-400 font-black text-xs py-2.5 rounded-xl transition-all">3연승</button>
                            <button onclick="Boako.League.setRuleStreak(4)" id="rule-btn-s4" class="rule-streak-btn bg-slate-800 border border-slate-700 text-slate-400 font-black text-xs py-2.5 rounded-xl transition-all">4연승 (올킬)</button>
                        </div>

                        <div class="bg-slate-950 border border-slate-800 rounded-2xl p-5 flex flex-col items-center justify-center relative min-h-[100px] shadow-inner">
                            <div id="rule-calc-result" class="text-3xl font-black text-white">🏆 1,600 LP</div>
                            <div id="rule-calc-formula" class="text-[10px] font-bold text-slate-500 mt-1.5 tracking-wide">연승 보상 800LP × 더블 베팅 (2배)</div>
                            <div id="rule-stamp-overlay" class="absolute top-2 right-4 pointer-events-none">
                                <div class="border-[3px] border-solid border-emerald-500 text-emerald-500 font-black text-sm px-3 py-1 rounded-xl tracking-widest bg-slate-950/80">
                                    정산 완료
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    Boako.League._ruleStreak = 4;
    Boako.League.calcRuleSimulator();
};

Boako.League.closeChallengeRuleModal = function() {
    document.getElementById('challenge-rule-backdrop')?.remove();
};

Boako.League.setRuleStreak = function(num) {
    Boako.League._ruleStreak = num;
    Boako.League.calcRuleSimulator();
};

Boako.League.calcRuleSimulator = function() {
    const rules = { 1: 100, 2: 200, 3: 400, 4: 800 };
    const streak = Boako.League._ruleStreak || 1;
    const isDouble = document.getElementById('rule-double-toggle')?.checked;
    const base = rules[streak];
    const final = base * (isDouble ? 2 : 1);

    document.querySelectorAll('.rule-streak-btn').forEach(b => {
        b.className = "rule-streak-btn bg-slate-800 border border-slate-700 text-slate-500 font-black text-xs py-2.5 rounded-xl transition-all";
    });
    const activeBtn = document.getElementById('rule-btn-s' + streak);
    if (activeBtn) activeBtn.className = "rule-streak-btn bg-emerald-600/20 text-emerald-400 font-black text-xs py-2.5 rounded-xl transition-all border border-emerald-500";

    const result = document.getElementById('rule-calc-result');
    const formula = document.getElementById('rule-calc-formula');
    if (result) result.innerText = `🏆 ${final.toLocaleString()} LP`;
    if (formula) formula.innerText = `연승 보상 ${base.toLocaleString()}LP${isDouble ? ' × 더블 베팅 (2배)' : ''}`;
};

// ====================================================================
// 👑 7. 챔피언 콘텐츠
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
                <div class="w-6 h-6 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center shadow-sm shrink-0 relative cursor-pointer"><img src="${row.mvp_team_logo || 'https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challenge%20(1).png'}" alt="TEAM LOGO" class="w-full h-full object-contain rounded-full"></div>
                <span class="cursor-pointer">${mvpTeam}</span>
                <div class="invisible opacity-0 group-hover/handler:visible group-hover/handler:opacity-100 fixed -translate-x-1/2 -translate-y-full mb-2 w-32 h-32 p-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-[9999] transition-all duration-200 pointer-events-none flex items-center justify-center" style="top: var(--tooltip-top, auto); left: var(--tooltip-left, auto);">
                    <img src="${row.mvp_team_logo || 'https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challenge%20(1).png'}" alt="LARGE TEAM LOGO" class="w-full h-full object-contain">
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
// 🏅 8. 킹 오브 리그
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
