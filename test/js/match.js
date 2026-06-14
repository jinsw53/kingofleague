/**
 * [MATCH] 대항전 메인 대시보드 관리
 */
Boako.Match = {
    // 🌟 [최신화] 스타일 및 확대용 포탈 자동 주입
    injectStylesAndPortal: () => {
        if (document.getElementById('boako-match-styles')) return;
        const style = document.createElement('style');
        style.id = 'boako-match-styles';
        // tournament-thumbnail에서 :hover 영역을 삭제했습니다 (JS로 처리)
        style.innerHTML = `
            .tournament-thumbnail {
                width: 50px; height: 50px; object-fit: cover;
                border-radius: 8px; cursor: zoom-in;
                border: 2px solid #e2e8f0;
                transition: border-color 0.2s;
            }
            .tournament-thumbnail:hover {
                border-color: #6366f1;
            }
            /* 🌟 [신규] 화면 최상단에 뜰 절대 짤리지 않는 이미지 포탈 스타일 */
            #boako-magnifier-overlay {
                position: fixed; inset: 0;
                z-index: 100000; /* 어떤 UI보다 위에 둠 */
                display: none;
                pointer-events: none; /* 마우스 이벤트가 아래로 통과하게 함 (부드러운 퇴장용) */
                justify-content: center; align-items: center;
                transition: opacity 0.2s; opacity: 0;
            }
            #boako-magnifier-overlay.active {
                display: flex; opacity: 1;
            }
            #boako-magnifier-image {
                max-width: 80vw; max-height: 80vh; /* 화면 크기의 80%를 넘지 않게 조절 */
                border-radius: 16px;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);
                transform: scale(0.9);
                transition: transform 0.3s ease-out;
            }
            #boako-magnifier-overlay.active #boako-magnifier-image {
                transform: scale(1);
            }
        `;
        document.head.appendChild(style);

        // [신규] 포탈용 DOM 구조 생성 (HTML 하단에 부착)
        if (!document.getElementById('boako-magnifier-overlay')) {
            const overlayHtml = `
                <div id="boako-magnifier-overlay">
                    <img id="boako-magnifier-image" src="" alt="확대됨">
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', overlayHtml);
        }
    },

    // 🌟 [신규] JS 이미지 확대 실행/해제 함수
    magnify: (url, isShow) => {
        const overlay = document.getElementById('boako-magnifier-overlay');
        const img = document.getElementById('boako-magnifier-image');
        if (!overlay || !img) return;

        if (isShow) {
            img.src = url;
            overlay.classList.add('active');
        } else {
            overlay.classList.remove('active');
            // 부드럽게 사라진 후 주소 지우기 (다음 번 로딩 대기 현상 방지)
            setTimeout(() => { if(!overlay.classList.contains('active')) img.src = ''; }, 200);
        }
    },

    init: async (containerId) => {
        Boako.Match.injectStylesAndPortal(); // 스타일 및 포탈 초기화
        const targetId = containerId || 'main-content';
        const container = document.getElementById(targetId); 
        
        if (!container) {
            console.error(`렌더링할 컨테이너(#${targetId})를 찾을 수 없습니다.`);
            return;
        }

        container.innerHTML = `
            <div class="max-w-5xl mx-auto p-4 space-y-6" style="animation: fadeIn 0.3s ease-out;">
                
                <div class="bg-slate-900 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
                    <div class="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-indigo-500 rounded-full blur-[80px] opacity-40 pointer-events-none"></div>
                    <div class="absolute bottom-0 left-0 -ml-12 -mb-12 w-48 h-48 bg-blue-600 rounded-full blur-[80px] opacity-30 pointer-events-none"></div>
                    
                    <div class="relative z-10 flex flex-col md:flex-row justify-between md:items-end gap-4">
                        <div>
                            <h1 class="text-3xl md:text-4xl font-black mb-3" id="match-season-title">대항전 데이터 로딩 중...</h1>
                            <div id="match-season-logo-area" class="h-10 flex items-center">
                                <span class="text-white/50 text-sm font-bold border border-white/20 px-3 py-1 rounded-lg animate-pulse">로고 데이터 대기 중...</span>
                            </div>
                        </div>
                        
                        <div class="flex items-center gap-2 text-xs font-black bg-black/30 p-2 rounded-2xl backdrop-blur-md border border-white/10">
                            <span class="px-4 py-2 rounded-xl bg-blue-600 text-white shadow-lg transition-colors" id="status-ban">🚫 밴픽 진행</span>
                            <span class="text-slate-600">▶</span>
                            <span class="px-4 py-2 rounded-xl text-slate-400 transition-colors" id="status-entry">⚔️ 엔트리 제출</span>
                            <span class="text-slate-600">▶</span>
                            <span class="px-4 py-2 rounded-xl text-slate-400 transition-colors" id="status-play">🏆 본선 경기</span>
                        </div>
                    </div>
                </div>

                <div class="flex gap-1 border-b-2 border-slate-100 pb-px overflow-x-auto custom-scrollbar">
                    <button onclick="Boako.Match.switchTab('tab-ban')" id="btn-tab-ban" class="whitespace-nowrap px-6 py-3 text-sm font-black border-b-4 border-indigo-600 text-indigo-600 transition-colors">🚫 밴(Ban) 결과</button>
                    <button onclick="Boako.Match.switchTab('tab-entry')" id="btn-tab-entry" class="whitespace-nowrap px-6 py-3 text-sm font-black border-b-4 border-transparent text-slate-400 hover:text-slate-700 transition-colors">⚔️ 게임별 매치업</button>
                    <button onclick="Boako.Match.switchTab('tab-score')" id="btn-tab-score" class="whitespace-nowrap px-6 py-3 text-sm font-black border-b-4 border-transparent text-slate-400 hover:text-slate-700 transition-colors">📊 스코어보드</button>
                </div>

                <div id="tab-ban" class="space-y-4"><div id="match-ban-content"></div></div>
                <div id="tab-entry" class="hidden space-y-4"><div id="match-entry-content"></div></div>
                <div id="tab-score" class="hidden space-y-4">
                    <div class="bg-white p-12 rounded-3xl text-center border border-slate-200 shadow-sm">
                        <span class="text-6xl block mb-4 drop-shadow-md">🏆</span>
                        <h3 class="text-xl font-black text-slate-800">스코어보드 집계 중</h3>
                        <p class="text-sm text-slate-500 font-bold mt-2">본선 경기가 시작되면 각 팀의 실시간 승점이 기록됩니다.</p>
                    </div>
                </div>

            </div>
        `;

        await Boako.Match.loadData();
    },

    // 🌟 2. 탭 전환
    switchTab: (tabId) => {
        ['tab-ban', 'tab-entry', 'tab-score'].forEach(id => {
            document.getElementById(id).classList.add('hidden');
            const btn = document.getElementById(`btn-${id}`);
            btn.classList.remove('border-indigo-600', 'text-indigo-600');
            btn.classList.add('border-transparent', 'text-slate-400');
        });
        
        document.getElementById(tabId).classList.remove('hidden');
        const activeBtn = document.getElementById(`btn-${tabId}`);
        activeBtn.classList.remove('border-transparent', 'text-slate-400');
        activeBtn.classList.add('border-indigo-600', 'text-indigo-600');
    },

    // 🌟 3. 데이터 로드
    loadData: async () => {
        try {
            const { data: currentSeason } = await Boako.db.from('seasons')
                .select('*')
                .lte('start_date', new Date().toISOString())
                .gte('end_date', new Date().toISOString())
                .maybeSingle();
            
            let seasonNo = currentSeason ? currentSeason.season_no : 1;
            
            if (currentSeason) {
                document.getElementById('match-season-title').innerText = currentSeason.title || `시즌 ${seasonNo} 대항전`;
                
                const logoArea = document.getElementById('match-season-logo-area');
                if (currentSeason.logo_url) {
                    logoArea.innerHTML = `<img src="${currentSeason.logo_url}" class="h-10 object-contain drop-shadow-md">`;
                } else {
                    logoArea.innerHTML = `<span class="text-white/50 text-sm font-bold border border-white/20 px-3 py-1 rounded-lg">시즌 로고 대기 중</span>`;
                }
            }

            const { data: allGames, error: gamesErr } = await Boako.db
                .from('grandprix_games')
                .select('*')
                .eq('season_no', seasonNo)
                .order('selection_rank', { ascending: true });
            
            if (gamesErr) throw gamesErr;

            const isFinalized = allGames.some(g => g.status === 'FINAL');
            let displayGames = [];

            if (isFinalized) {
                displayGames = allGames;
                document.getElementById('status-ban').classList.replace('bg-blue-600', 'bg-slate-700');
                document.getElementById('status-ban').classList.replace('text-white', 'text-slate-400');
                document.getElementById('status-entry').classList.replace('text-slate-400', 'bg-blue-600');
                document.getElementById('status-entry').classList.add('text-white', 'shadow-lg');
            } else {
                displayGames = allGames.filter(g => g.status === 'CANDIDATE').slice(0, 10);
            }

            let confirmedEntries = [];
            if (isFinalized) {
                const { data: entriesData, error: entriesErr } = await Boako.db
                    .from('grandprix_entries')
                    .select('*, teams(logo_url)') 
                    .eq('season_no', seasonNo)
                    .eq('is_finalized', true);
                
                if (entriesErr) console.error("엔트리 로드 에러:", entriesErr);
                else confirmedEntries = entriesData || [];
            }

            Boako.Match.renderBanTab(displayGames, isFinalized);
            Boako.Match.renderEntryTab(displayGames, isFinalized, confirmedEntries);

        } catch (err) {
            console.error("대항전 데이터 로드 에러:", err);
            document.getElementById('match-ban-content').innerHTML = `
                <div class="bg-red-50 text-red-500 p-6 rounded-xl font-bold border border-red-200 text-center">
                    🚨 데이터를 불러오는 중 오류가 발생했습니다.<br><span class="text-sm font-normal">${err.message}</span>
                </div>
            `;
        }
    },

    // 🌟 4. [탭 1] 밴 결과 렌더링
    renderBanTab: (games, isFinalized) => {
        const content = document.getElementById('match-ban-content');
        content.className = "w-full block"; 

        if (!games.length) {
            content.innerHTML = `<div class="text-center py-12 text-slate-400 font-bold">등록된 대회 종목이 없습니다.</div>`;
            return;
        }

        let html = '';
        
        if (!isFinalized) {
            html += `
                <div class="mb-6 bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex justify-between items-center shadow-sm w-full">
                    <div>
                        <h4 class="text-indigo-700 font-black text-sm">⏳ 현재 밴(Ban) 투표가 치열하게 진행 중입니다!</h4>
                        <p class="text-indigo-500 text-xs font-bold mt-1">투표하러 가기 버튼을 클릭하여 우리 팀 투표소로 이동하세요.</p>
                    </div>
                    <span class="text-2xl animate-pulse">🗳️</span>
                </div>
            `;
        }

        html += `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 w-full">`;
        
        games.forEach(game => {
            const isBanned = isFinalized && game.status !== 'FINAL';
            const isCandidate = !isFinalized;

            let cardClass = isBanned 
                ? 'bg-slate-100 border-2 border-red-500/50 shadow-none' 
                : 'bg-white border border-slate-200 hover:border-indigo-400 hover:shadow-lg hover:-translate-y-1';

            const textClass = isBanned ? 'text-slate-400 line-through decoration-red-500/50' : 'text-slate-800';
            const imgClass = isBanned ? 'grayscale opacity-30' : 'drop-shadow-sm';

            const clickEvent = isCandidate 
                ? `onclick="Boako.View.render('team').then(() => setTimeout(() => Boako.View.switchTeamTab('record'), 100))"` 
                : '';

            html += `
                <div class="rounded-2xl p-5 flex flex-col items-center justify-between text-center transition-all duration-200 relative ${cardClass}">
                    
                    ${isBanned ? `
                        <div class="absolute top-3 right-3 bg-red-600 text-white text-[10px] font-black px-2.5 py-1 rounded-md shadow-sm z-10 rotate-12">BANNED</div>
                    ` : ''}
                    
                    <div class="w-20 h-20 mb-4 flex items-center justify-center relative">
                        ${game.game_logo_url 
                            ? `<img src="${game.game_logo_url}" class="max-h-full max-w-full object-contain ${imgClass}">` 
                            : `<span class="text-5xl ${imgClass}">🎲</span>`
                        }
                    </div>
                    
                    <h4 class="font-black text-sm break-keep mb-3 ${textClass}">${game.game_name}</h4>
                    
                    ${isBanned ? `
                        <div class="text-[11px] font-bold text-red-500 bg-red-50 px-2 py-1.5 rounded-lg w-full truncate border border-red-100">
                            밴 확정 종목
                        </div>
                    ` : isCandidate ? `
                        <button ${clickEvent} class="text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-2 py-1.5 rounded-lg w-full shadow-sm transition-colors cursor-pointer active:scale-95">
                            👉 투표하러 가기
                        </button>
                    ` : `
                        <div class="text-[11px] font-bold text-slate-400 bg-slate-50 px-2 py-1.5 rounded-lg w-full border border-slate-100">
                            본선 진출 종목
                        </div>
                    `}
                </div>
            `;
        });
        html += `</div>`;
        content.innerHTML = html;
    },

    // 🌟 5. [탭 2] 게임별 매치업
    renderEntryTab: (games, isFinalized, entries = []) => {
        const content = document.getElementById('match-entry-content');
        content.className = "w-full block";
        
        if (!isFinalized) {
            content.innerHTML = `
                <div class="bg-slate-50 border border-slate-200 p-10 rounded-2xl text-center">
                    <span class="text-4xl block mb-3 animate-bounce">⏳</span>
                    <h3 class="text-slate-600 font-black">아직 밴(Ban) 투표가 진행 중입니다.</h3>
                    <p class="text-sm font-bold text-slate-400 mt-2">투표가 종료되고 본선 종목이 확정되면 대진표가 공개됩니다.</p>
                </div>`;
            return;
        }

        const survivingGames = games.filter(g => g.status === 'FINAL');

        if (!survivingGames.length) {
            content.innerHTML = `<div class="bg-slate-50 border border-slate-200 p-10 rounded-2xl text-center"><span class="text-4xl block mb-3">☠️</span><h3 class="text-slate-600 font-black">모든 종목이 밴 당했습니다. (진행 불가)</h3></div>`;
            return;
        }

        let html = `<div class="space-y-6">`;
        
        survivingGames.forEach(game => {
            const gameEntries = entries.filter(e => e.game_name === game.game_name);
            
            // 엔트리가 비어있을 때(제출 기간)만 true, 마감되어 데이터가 있으면 false
            const isEntryOpen = gameEntries.length === 0;
            
            html += `
                <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    
                    <div class="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        
                        <div class="flex items-center gap-4 ${isEntryOpen ? 'cursor-pointer group' : ''}" ${isEntryOpen ? `onclick="Boako.Team.openEntryForm()"` : ''}>
                            
                            <div class="w-14 h-14 shrink-0 rounded-xl bg-white flex items-center justify-center shadow-sm p-1 ${isEntryOpen ? 'group-hover:scale-110 transition-transform duration-300' : ''}">
                                ${game.game_logo_url ? `<img src="${game.game_logo_url}" class="w-full h-full object-contain">` : '<span class="text-2xl">🎲</span>'}
                            </div>
                            
                            <div class="flex flex-col justify-center">
                                <h3 class="font-black text-white text-lg ${isEntryOpen ? 'group-hover:text-indigo-300 transition-colors' : ''} mb-1">${game.game_name}</h3>
                                <div class="flex items-center gap-2">
                                    ${!isEntryOpen ? `
                                        <span class="px-2 py-0.5 bg-indigo-500/30 text-indigo-100 text-[10px] font-bold rounded border border-indigo-400/30">${game.tournament_format || '룰셋 미정'}</span>
                                    ` : `
                                        <span class="px-2 py-0.5 bg-slate-600 text-slate-300 text-[10px] font-bold rounded border border-slate-500">방식 미공개 (엔트리 대기)</span>
                                    `}
                                    <span class="text-slate-300 text-[10px] font-bold border-l border-slate-500 pl-2" title="${game.description || ''}">엔트리 ${game.entry_count || 0}명</span>
                                </div>
                            </div>

                            ${!isEntryOpen && game.tournament_format_logo ? `
                                <div class="ml-2 pl-4 border-l border-slate-600 flex items-center shrink-0">
                                    <img src="${game.tournament_format_logo}" 
                                         class="h-10 w-auto object-contain drop-shadow-md opacity-90 tournament-thumbnail" 
                                         title="크게 보려면 마우스를 올리세요"
                                         onmouseover="Boako.Match.magnify('${game.tournament_format_logo}', true)"
                                         onmouseout="Boako.Match.magnify('', false)">
                                </div>
                            ` : ''}
                        </div>
                        
                        <div class="flex items-center gap-2 w-full md:w-auto justify-end">
                            ${isEntryOpen ? `
                                <button onclick="Boako.Team.openEntryForm()" class="bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-black hover:bg-emerald-600 transition-colors shadow-sm flex items-center gap-2">
                                    📝 작전판 열기
                                </button>
                            ` : ''}
                            
                            <button onclick="Boako.Match.Chat.open(${game.season_no}, '${game.game_name}', ${game.entry_count || 0}, '${game.tournament_format || 'SWISS'}')" class="bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-black hover:bg-indigo-600 transition-colors shadow-sm flex items-center gap-2">
                                💬 소통 채널
                            </button>
                        </div>
                    </div>

                    <div class="p-6 bg-slate-50/50">
                        ${gameEntries.length > 0 ? `
                            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                ${gameEntries.map(entry => `
                                    <div class="bg-white border-2 border-indigo-100 rounded-xl p-4 text-center shadow-sm relative overflow-hidden flex flex-col items-center">
                                        <div class="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 overflow-hidden shadow-sm flex items-center justify-center mb-2 z-10">
                                            ${entry.teams?.logo_url ? `<img src="${entry.teams.logo_url}" class="w-full h-full object-cover">` : '<span class="text-xl">🏴</span>'}
                                        </div>
                                        <span class="text-indigo-600 font-black text-sm mb-2 block relative z-10">${entry.team_name}</span>
                                        <div class="text-slate-700 font-bold text-sm bg-slate-50 py-3 rounded-lg border border-slate-200 relative z-10 w-full">
                                            ${entry.player_name}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : `
                            <div onclick="Boako.Team.openEntryForm()" class="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed border-indigo-200 rounded-xl bg-indigo-50/50 cursor-pointer hover:bg-indigo-100/50 hover:border-indigo-400 transition-all group">
                                <span class="text-4xl mb-3 group-hover:scale-125 transition-transform duration-300">🔒</span>
                                <h4 class="text-indigo-700 font-black text-sm">엔트리 제출 및 블라인드 진행 중</h4>
                                <p class="text-slate-500 font-bold text-xs mt-1 mb-4">상대방의 꼼수를 막기 위해, 제출 마감일 전까지 모든 엔트리는 비공개됩니다.</p>
                                <span class="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-md group-hover:bg-indigo-700 transition-colors group-active:scale-95">
                                    👇 여기를 클릭하여 우리 팀 엔트리 작성하기
                                </span>
                            </div>
                        `}
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
        content.innerHTML = html;
    },

 // 🌟 6. [전역 모듈] 종목별 소통 채널 (원클릭 다중 투표 + 일괄 제출 시스템)
    Chat: {
        channel: null,
        currentSeason: null,
        currentGame: null,
        currentEntryCount: 0,
        currentFormat: 'SWISS',

        open: async (seasonNo, gameName, entryCount = 0, format = 'SWISS') => {
            Boako.Match.Chat.currentSeason = seasonNo;
            Boako.Match.Chat.currentGame = gameName;
            Boako.Match.Chat.currentEntryCount = entryCount;
            Boako.Match.Chat.currentFormat = format;
            const roomId = `${seasonNo}_${gameName}`;

            const existingModal = document.getElementById('match-chat-modal');
            if (existingModal) existingModal.remove();

            const modalHtml = `
                <div id="match-chat-modal" class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div class="bg-slate-50 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col h-[80vh] overflow-hidden">
                        
                        <div class="bg-indigo-600 px-5 py-4 flex justify-between items-center text-white shrink-0 shadow-md z-10">
                            <div>
                                <h2 class="text-lg font-black flex items-center gap-2">💬 [${gameName}] 소통 채널</h2>
                                <div class="flex items-center gap-2 mt-1">
                                    <p class="text-indigo-200 text-xs font-bold">참여자 전원 일치 일정 투표</p>
                                    <span class="bg-indigo-800 text-indigo-100 text-[10px] font-black px-1.5 py-0.5 rounded">엔트리 ${entryCount}명 (${format})</span>
                                </div>
                            </div>
                            <div class="flex items-center gap-2">
                                <button onclick="Boako.Match.Chat.openPollModal()" class="text-xs bg-white text-indigo-600 px-3 py-1.5 rounded-lg font-black hover:bg-indigo-50 shadow-sm transition-colors">
                                    📅 일정 조율/투표
                                </button>
                                <button onclick="Boako.Match.Chat.close()" class="text-white hover:text-indigo-200 transition-colors p-1">
                                    <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                </button>
                            </div>
                        </div>

                        <div id="match-chat-messages" class="flex-1 p-4 overflow-y-auto flex flex-col gap-4 bg-slate-100 custom-scrollbar">
                            <div class="text-center text-slate-400 text-xs font-bold py-4">채팅 기록을 불러오는 중... ⏳</div>
                        </div>

                        <div class="p-3 bg-white border-t border-slate-200 shrink-0 flex gap-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                            <input type="text" id="match-chat-input" placeholder="메시지를 입력하세요 (엔터 전송)" class="flex-1 px-4 py-2.5 bg-slate-100 border border-transparent rounded-xl text-sm font-bold focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all" onkeypress="if(event.key === 'Enter') Boako.Match.Chat.send()">
                            <button onclick="Boako.Match.Chat.send()" class="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-black text-sm hover:bg-indigo-700 active:scale-95 transition-all shadow-sm">전송</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);

            // 🌟 1. 데이터 로드
            await Boako.Match.Chat.loadMessagesAndPolls();

            // 🌟 2. 첫 방문 튜토리얼 체크 (profiles 테이블 연동)
            await Boako.Match.Chat.checkAndShowTutorial();

            // 🌟 3. 리얼타임 구독
            if (Boako.Match.Chat.channel) Boako.db.removeChannel(Boako.Match.Chat.channel);

            Boako.Match.Chat.channel = Boako.db.channel(`match-chat-${roomId}`)
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'grandprix_match_chats', filter: `room_id=eq.${roomId}` }, (payload) => {
                    if (String(payload.new.sender_id) !== String(Boako.state.user.id)) {
                        payload.new.profiles = { full_name: payload.new.sender_name_override || "참여자" };
                        Boako.Match.Chat.renderMessage(payload.new);
                        Boako.Match.Chat.scrollToBottom();
                    }
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_polls', filter: `target_id=eq.${roomId}` }, (payload) => {
                    Boako.Match.Chat.loadMessagesAndPolls();
                    if (payload.eventType === 'UPDATE') {
                        const oldStatus = payload.old?.status;
                        const newStatus = payload.new?.status;
                        if (oldStatus !== 'PROPOSED' && newStatus === 'PROPOSED') Boako.Util.toast("🎯 교집합 일정이 방금 발견되었습니다!");
                        else if (oldStatus !== 'CONFIRMED' && newStatus === 'CONFIRMED') Boako.Util.toast("🏁 방금 일정이 최종 확정되었습니다!");
                    }
                })
                .subscribe();
            
            setTimeout(() => document.getElementById('match-chat-input').focus(), 100);
        },

        close: () => {
            const modal = document.getElementById('match-chat-modal');
            if (modal) modal.remove();
            const calModal = document.getElementById('poll-calendar-modal');
            if (calModal) calModal.remove();
            if (Boako.Match.Chat.channel) {
                Boako.db.removeChannel(Boako.Match.Chat.channel);
                Boako.Match.Chat.channel = null;
            }
        },

        // 🌟 [신규] 튜토리얼 노출 로직 (JSONB 활용)
        checkAndShowTutorial: async () => {
            try {
                // 내 프로필에서 tutorial_status 조회 (user id 컬럼명이 다르면 맞게 수정 필요)
                const { data: profile } = await Boako.db.from('profiles').select('tutorial_status').eq('id', Boako.state.user.id).single();
                const status = profile?.tutorial_status || {};
                
                // match_chat_tutorial 키가 없거나 false면 튜토리얼 띄우기
                if (!status.match_chat_tutorial) {
                    Boako.Match.Chat.showTutorialModal();
                }
            } catch (err) {
                console.error("튜토리얼 상태 확인 중 에러:", err);
            }
        },

        showTutorialModal: () => {
            const html = `
                <div id="match-tutorial-overlay" class="fixed inset-0 z-[10001] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in zoom-in-95 duration-300">
                    <div class="bg-white rounded-3xl p-6 w-[90%] max-w-sm shadow-2xl relative">
                        <div class="absolute -top-8 left-1/2 -translate-x-1/2 text-5xl drop-shadow-md">💡</div>
                        <h3 class="text-xl font-black text-indigo-900 text-center mt-6 mb-3">일정 조율 가이드</h3>
                        
                        <div class="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-xs text-indigo-800 font-bold space-y-2 mb-5">
                            <p class="flex items-start gap-1"><span class="shrink-0">📅</span> 달력에서 편한 날짜를 전부 클릭하세요.</p>
                            <p class="flex items-start gap-1"><span class="shrink-0">📤</span> 여러 개의 일정을 일괄 제출할 수 있습니다.</p>
                            <p class="flex items-start gap-1"><span class="shrink-0">🎯</span> 시스템이 참가자 전원의 교집합을 자동 스캔합니다.</p>
                            <div class="bg-white p-2 rounded-lg mt-2 text-[11px] text-slate-600 shadow-sm border border-slate-100">
                                🚨 교집합 일정은 <b>과반수 수락 시 12시간 뒤</b>에 자동 확정되니 유의해주세요!
                            </div>
                        </div>

                        <button onclick="Boako.Match.Chat.closeTutorial()" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 rounded-xl transition-all shadow-md active:scale-95">
                            확인했습니다 (다시 보지 않기)
                        </button>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
        },

        closeTutorial: async () => {
            const overlay = document.getElementById('match-tutorial-overlay');
            if (overlay) overlay.remove();

            try {
                // 기존 상태 가져오기
                const { data: profile } = await Boako.db.from('profiles').select('tutorial_status').eq('id', Boako.state.user.id).single();
                let currentStatus = profile?.tutorial_status || {};
                
                // 해당 기능 튜토리얼 완료 처리
                currentStatus.match_chat_tutorial = true;

                // 업데이트 (JSONB 객체를 통째로 덮어씌움)
                await Boako.db.from('profiles').update({ tutorial_status: currentStatus }).eq('id', Boako.state.user.id);
            } catch (err) {
                console.error("튜토리얼 상태 저장 실패:", err);
            }
        },

        loadMessagesAndPolls: async () => {
            const roomId = `${Boako.Match.Chat.currentSeason}_${Boako.Match.Chat.currentGame}`;
            try {
                const { data: chats } = await Boako.db.from('grandprix_match_chats')
                    .select('*, profiles(full_name)')
                    .eq('room_id', roomId)
                    .order('created_at', { ascending: false }).limit(40);

                const { data: polls } = await Boako.db.from('schedule_polls')
                    .select('*')
                    .eq('target_id', roomId)
                    .order('created_at', { ascending: true });

                const container = document.getElementById('match-chat-messages');
                container.innerHTML = '';

                // 🌟 [상시 안내 배너] 채팅창 최상단에 고정
                const bannerHtml = `
                    <div class="bg-gradient-to-r from-indigo-50 to-white border border-indigo-100 rounded-xl p-3 flex items-start gap-2 shadow-sm shrink-0 mb-2">
                        <span class="text-xl drop-shadow-sm">📢</span>
                        <div>
                            <h4 class="text-indigo-800 font-black text-xs mb-0.5">상시 안내</h4>
                            <p class="text-[10px] text-slate-500 font-bold leading-tight break-keep">달력 탭을 열어 편한 시간을 클릭하세요. 시스템이 최적의 교집합 시간을 찾아 자동으로 조율을 진행합니다.</p>
                        </div>
                    </div>
                `;
                container.insertAdjacentHTML('beforeend', bannerHtml);

                let totalTimeline = [];
                if (chats) chats.forEach(c => totalTimeline.push({ type: 'CHAT', time: new Date(c.created_at), data: c }));

                // 여러 개의 투표함 방지 동기화 로직
                if (polls) {
                    const activePolls = polls.filter(p => p.status === 'OPEN' || p.status === 'PROPOSED');
                    const latestActiveId = activePolls.length > 0 ? activePolls[activePolls.length - 1].poll_id : null;

                    polls.forEach(p => {
                        if (p.status === 'CONFIRMED' || p.poll_id === latestActiveId) {
                            totalTimeline.push({ type: 'POLL', time: new Date(p.created_at), data: p });
                        }
                    });
                }

                totalTimeline.sort((a, b) => a.time - b.time);

                if (totalTimeline.length > 0) {
                    totalTimeline.forEach(item => {
                        if (item.type === 'CHAT') Boako.Match.Chat.renderMessage(item.data);
                        else Boako.Match.Chat.renderPollCard(item.data);
                    });
                    Boako.Match.Chat.scrollToBottom();
                } else {
                    container.insertAdjacentHTML('beforeend', `<div class="text-center text-slate-400 text-xs font-bold py-8">아직 대화 기록이 없습니다. 일정을 제안해 보세요!</div>`);
                }
            } catch (err) { console.error("데이터 로드 실패:", err); }
        },

        send: async () => {
            const input = document.getElementById('match-chat-input');
            const content = input.value.trim();
            if (!content) return;
            input.value = '';

            const roomId = `${Boako.Match.Chat.currentSeason}_${Boako.Match.Chat.currentGame}`;
            const payload = {
                season_no: Boako.Match.Chat.currentSeason,
                game_name: Boako.Match.Chat.currentGame,
                sender_id: Boako.state.user.id,
                team_name: Boako.state.team?.info?.team_name || null,
                content: content,
                room_id: roomId
            };

            const tempMsg = { ...payload, profiles: { full_name: Boako.state.user.nickname } };
            Boako.Match.Chat.renderMessage(tempMsg);
            Boako.Match.Chat.scrollToBottom();

            await Boako.db.from('grandprix_match_chats').insert([payload]);
        },

        calYear: new Date().getFullYear(),
        calMonth: new Date().getMonth() + 1,
        selectedTimesState: [], 
        currentFixedTime: '20:00', 

       openPollModal: () => {
            const existing = document.getElementById('poll-calendar-modal');
            if (existing) existing.remove();

            Boako.Match.Chat.calYear = new Date().getFullYear();
            Boako.Match.Chat.calMonth = new Date().getMonth() + 1;
            Boako.Match.Chat.selectedTimesState = [];
            Boako.Match.Chat.currentFixedTime = '20:00';

            const modalHtml = `
                <div id="poll-calendar-modal" class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
                    <div class="bg-white rounded-3xl w-80 shadow-2xl overflow-hidden flex flex-col relative">
                        
                        <div class="bg-indigo-600 text-white p-4 flex justify-between items-center shadow-md z-10">
                            <button onclick="Boako.Match.Chat.changeMonth(-1)" class="p-1 hover:bg-white/20 rounded-lg transition-colors">◀</button>
                            <h3 id="cal-month-title" class="font-black text-sm tracking-widest"></h3>
                            <button onclick="Boako.Match.Chat.changeMonth(1)" class="p-1 hover:bg-white/20 rounded-lg transition-colors">▶</button>
                        </div>
                        <button onclick="document.getElementById('poll-calendar-modal').remove()" class="absolute top-3 right-3 text-white/50 hover:text-white font-black text-xl z-20">×</button>

                        <div class="bg-indigo-50 p-3 border-b border-indigo-100 flex items-center gap-2">
                            <span class="text-[10px] font-black text-indigo-800 shrink-0">⏰ 고정 시간</span>
                            <select id="poll-fixed-time-select" onchange="Boako.Match.Chat.changeFixedTime(this.value)" class="flex-1 bg-white border border-indigo-200 text-indigo-900 text-xs font-bold rounded-lg px-2 py-1.5 focus:outline-none">
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
                            <button id="poll-submit-btn" onclick="Boako.Match.Chat.submitPollData()" class="w-full bg-slate-200 text-slate-500 text-xs font-black py-3 rounded-xl transition-all shadow-sm cursor-not-allowed" disabled>
                                날짜를 클릭하여 선택하세요
                            </button>
                        </div>

                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            Boako.Match.Chat.renderCalendarGrid();
        },

        changeFixedTime: (val) => {
            Boako.Match.Chat.currentFixedTime = val;
            Boako.Util.toast(`⏰ 클릭 시 적용될 시간이 ${val}로 변경되었습니다.`, 1000);
        },

        changeMonth: (delta) => {
            let m = Boako.Match.Chat.calMonth + delta;
            let y = Boako.Match.Chat.calYear;
            if (m > 12) { m = 1; y++; }
            if (m < 1) { m = 12; y--; }
            Boako.Match.Chat.calYear = y;
            Boako.Match.Chat.calMonth = m;
            Boako.Match.Chat.renderCalendarGrid();
        },

        renderCalendarGrid: () => {
            const year = Boako.Match.Chat.calYear;
            const month = Boako.Match.Chat.calMonth;
            document.getElementById('cal-month-title').innerText = `${year}년 ${month}월`;

            const firstDay = new Date(year, month - 1, 1).getDay();
            const lastDate = new Date(year, month, 0).getDate();
            const today = new Date();
            today.setHours(0,0,0,0);
            
            let gridHtml = '';
            
            for (let i = 0; i < firstDay; i++) {
                gridHtml += `<div class="p-2"></div>`;
            }

            for (let day = 1; day <= lastDate; day++) {
                const currentCellDate = new Date(year, month - 1, day);
                const isPast = currentCellDate < today;
                const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                
                const dayTimes = Boako.Match.Chat.selectedTimesState.filter(t => t.startsWith(dateStr));
                const isSelected = dayTimes.length > 0;
                
                let cellClass = "w-full aspect-square flex flex-col items-center justify-center rounded-xl transition-all relative ";
                let innerHtml = `<span class="text-xs font-bold">${day}</span>`;
                
                if (isPast) {
                    cellClass += "text-slate-300 cursor-not-allowed bg-slate-50/50";
                } else if (isSelected) {
                    cellClass += "bg-indigo-600 text-white shadow-md transform scale-105 cursor-pointer ring-2 ring-indigo-200 ring-offset-1";
                    const timeVal = dayTimes[0].split(' ')[1];
                    const displayTime = timeVal === '상관없음' ? '☀️' : timeVal;
                    innerHtml += `<span class="text-[8px] font-mono mt-0.5 opacity-90">${displayTime}</span>`;
                } else {
                    cellClass += "text-slate-700 bg-slate-50 hover:bg-indigo-100 hover:text-indigo-700 cursor-pointer border border-slate-100";
                }

                gridHtml += `<div onclick="${isPast ? '' : `Boako.Match.Chat.toggleDate('${dateStr}')`}" class="${cellClass}">${innerHtml}</div>`;
            }

            document.getElementById('cal-days-grid').innerHTML = gridHtml;
            Boako.Match.Chat.updateSubmitButton();
        },

        toggleDate: (dateStr) => {
            const timeStr = Boako.Match.Chat.currentFixedTime;
            const combined = `${dateStr} ${timeStr}`;
            
            const idx = Boako.Match.Chat.selectedTimesState.indexOf(combined);
            if (idx > -1) {
                Boako.Match.Chat.selectedTimesState.splice(idx, 1);
            } else {
                Boako.Match.Chat.selectedTimesState = Boako.Match.Chat.selectedTimesState.filter(t => !t.startsWith(dateStr));
                Boako.Match.Chat.selectedTimesState.push(combined);
            }
            
            Boako.Match.Chat.renderCalendarGrid();
        },

        updateSubmitButton: () => {
            const btn = document.getElementById('poll-submit-btn');
            const count = Boako.Match.Chat.selectedTimesState.length;
            
            if (count > 0) {
                btn.disabled = false;
                btn.className = "w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black py-3 rounded-xl transition-all shadow-md active:scale-95 flex justify-center items-center gap-2";
                btn.innerHTML = `<span class="bg-white text-indigo-700 px-1.5 py-0.5 rounded-md text-[10px] leading-none">${count}</span> 개 일정 일괄 제출하기`;
            } else {
                btn.disabled = true;
                btn.className = "w-full bg-slate-200 text-slate-500 text-xs font-black py-3 rounded-xl transition-all shadow-sm cursor-not-allowed";
                btn.innerHTML = "달력의 날짜를 클릭하여 선택하세요";
            }
        },

        submitPollData: async () => {
            const myTimes = Boako.Match.Chat.selectedTimesState;
            if (myTimes.length === 0) return;

            const roomId = `${Boako.Match.Chat.currentSeason}_${Boako.Match.Chat.currentGame}`;
            const myId = String(Boako.state.user.id);

            const { data: existingPolls } = await Boako.db.from('schedule_polls')
                .select('*')
                .eq('target_id', roomId)
                .in('status', ['OPEN', 'PROPOSED'])
                .order('created_at', { ascending: false })
                .limit(1);

            const existingPoll = existingPolls && existingPolls.length > 0 ? existingPolls[0] : null;

            if (!existingPoll) {
                const initialVotes = {};
                initialVotes[myId] = myTimes;

                const insertPayload = {
                    target_id: roomId,
                    target_type: 'MATCH_CHANNEL',
                    game_name: Boako.Match.Chat.currentGame,
                    mode: Boako.Match.Chat.currentFormat || 'SWISS', 
                    proposer_id: myId,
                    votes: initialVotes,
                    status: 'OPEN'
                };
                await Boako.db.from('schedule_polls').insert([insertPayload]);
            } else {
                const currentVotes = existingPoll.votes || {};
                currentVotes[myId] = myTimes;

                const voters = Object.keys(currentVotes);
                let perfectMatchTime = null;
                
                const majorityCount = Math.floor(Boako.Match.Chat.currentEntryCount / 2) + 1;

                if (voters.length >= majorityCount) {
                    const allUniqueSubmissions = new Set();
                    voters.forEach(v => currentVotes[v].forEach(t => allUniqueSubmissions.add(t)));

                    // 💡 [동기화 픽스 2] 가능한 교집합 날짜가 13일, 20일 여러 개일 경우, 무조건 빠른 날짜(오름차순)부터 검사하여 싱크 어긋남 방지
                    const sortedCandidates = Array.from(allUniqueSubmissions).sort();

                    for (const candidate of sortedCandidates) {
                        const [candDate, candTime] = candidate.split(' '); 
                        
                        let allAccept = true;
                        
                        for (const voter of voters) {
                            const myChoices = currentVotes[voter] || [];
                            
                            let accepts = myChoices.includes(candidate);
                            
                            if (!accepts && candTime !== '시간 상관없음') {
                                if (myChoices.includes(`${candDate} 시간 상관없음`)) {
                                    accepts = true;
                                }
                            }
                            
                            if (!accepts) {
                                allAccept = false;
                                break;
                            }
                        }

                        if (allAccept) {
                            perfectMatchTime = candidate;
                            break; // 가장 빠른 교집합 날짜를 찾는 즉시 반복 종료!
                        }
                    }
                }

                const updatePayload = { votes: currentVotes };
                
                if (perfectMatchTime) {
                    updatePayload.proposed_time = perfectMatchTime;
                    updatePayload.status = 'PROPOSED';
                } else {
                    updatePayload.proposed_time = null;
                    updatePayload.status = 'OPEN';
                    updatePayload.confirmations = [];
                }

                await Boako.db.from('schedule_polls').update(updatePayload).eq('poll_id', existingPoll.poll_id);
            }

            document.getElementById('poll-calendar-modal').remove();
            Boako.Util.toast(`📅 ${myTimes.length}개의 후보 일정이 성공적으로 제출되었습니다!`);
            await Boako.Match.Chat.loadMessagesAndPolls();
        },

        renderPollCard: (poll) => {
            const container = document.getElementById('match-chat-messages');
            if (!container) return;

            const myId = String(Boako.state.user.id);
            const votersCount = Object.keys(poll.votes || {}).length;
            const status = poll.status;

            let cardInnerHtml = '';

            if (status === 'OPEN') {
                cardInnerHtml = `
                    <div class="font-black text-indigo-900 text-xs mb-1 flex items-center gap-1">📊 일정 조율 투표 진행 중</div>
                    <p class="text-[11px] text-slate-500 font-bold mb-3">전체 ${Boako.Match.Chat.currentEntryCount}명 중 ${votersCount}명이 일정을 제출했습니다.</p>
                    <div class="text-xs text-center bg-indigo-600 text-white p-2 rounded-xl font-black shadow-sm cursor-pointer hover:bg-indigo-700 active:scale-95 transition-all" onclick="Boako.Match.Chat.openPollModal()">
                        나도 달력으로 시간 찍기
                    </div>
                `;
            } else if (status === 'PROPOSED') {
                const confirmedUsers = poll.confirmations || [];
                // 💡 [핵심 버그 수정] String 타입 강제 변환 후 includes 체크로 타입 충돌 방지
                const isAcceptedByMe = confirmedUsers.some(id => String(id) === myId);
                
                const majorityCount = Math.floor(Boako.Match.Chat.currentEntryCount / 2) + 1;
                const confirmedCount = confirmedUsers.length;
                const isMajorityReached = confirmedCount >= majorityCount;
                
                const proposedTime = new Date(poll.created_at).getTime(); 
                const hoursPassed = (new Date().getTime() - proposedTime) / (1000 * 60 * 60);
                const TIME_LIMIT_HOURS = 12;

                // 🌟 [수정 완료] 함수명(forceConfirmPoll) 누락 해결 1
                if (isMajorityReached && hoursPassed >= TIME_LIMIT_HOURS) {
                    Boako.Match.Chat.forceConfirmPoll(poll.poll_id, poll.proposed_time, poll.proposer_id);
                    return;
                }

                let statusHtml = '';
                if (isMajorityReached) {
                    statusHtml = `
                        <div class="bg-amber-50 border border-amber-200 text-amber-700 p-2.5 rounded-xl text-[11px] font-black mb-3">
                            🔥 과반수 수락 완료! (${confirmedCount}/${Boako.Match.Chat.currentEntryCount}명)<br>
                            <span class="font-bold text-amber-600 mt-0.5 block">남은 인원의 응답이 없어도 ${TIME_LIMIT_HOURS}시간 뒤 자동 확정됩니다.</span>
                        </div>
                    `;
                } else {
                    statusHtml = `
                        <div class="bg-slate-50 border border-slate-200 text-slate-600 p-2.5 rounded-xl text-[11px] font-black mb-3 flex justify-between items-center">
                            <span>수락 진행도: ${confirmedCount} / ${Boako.Match.Chat.currentEntryCount}명</span>
                            <span class="text-indigo-600">과반수(${majorityCount}명) 필요</span>
                        </div>
                    `;
                }

                let btnHtml = '';
                if (!isAcceptedByMe) {
                    btnHtml = `
                        <div class="flex flex-col gap-2 w-full">
                            <button onclick="Boako.Match.Chat.acceptProposedTime('${poll.poll_id}')" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black py-2.5 rounded-xl shadow-sm transition-all active:scale-95">
                                🟢 이 시간으로 수락하기
                            </button>
                            <button onclick="Boako.Match.Chat.rejectProposedTime('${poll.poll_id}')" class="w-full bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-black py-2 rounded-xl shadow-sm transition-all active:scale-95">
                                🔴 거절하고 내 일정 재조율하기
                            </button>
                        </div>
                    `;
                } else {
                    btnHtml = `
                        <div class="flex flex-col gap-2 w-full">
                            <div class="text-xs text-center bg-slate-100 text-slate-400 py-2.5 rounded-xl font-bold border border-slate-200">
                                ✅ 나는 수락 완료 (다른 팀원 대기 중)
                            </div>
                            <button onclick="Boako.Match.Chat.rejectProposedTime('${poll.poll_id}')" class="w-full bg-slate-100 hover:bg-slate-200 text-slate-500 text-[11px] font-bold py-1.5 rounded-lg transition-all active:scale-95">
                                ↩️ 수락 취소 및 일정 변경
                            </button>
                        </div>
                    `;
                }

                cardInnerHtml = `
                    <div class="font-black text-emerald-800 text-xs mb-1 flex items-center gap-1">🎯 교집합 일정 제안됨!</div>
                    <p class="text-[11px] text-slate-500 font-bold mb-3">가장 유력한 최적의 시간입니다. 수락을 눌러주세요.</p>
                    <div class="text-sm font-black text-indigo-900 bg-white p-3 rounded-xl border border-indigo-200 text-center shadow-inner mb-3">
                        ${poll.proposed_time}
                    </div>
                    ${statusHtml}
                    ${btnHtml}
                `;
            } else if (status === 'CONFIRMED') {
                cardInnerHtml = `
                    <div class="font-black text-slate-700 text-xs mb-1 flex items-center gap-1">🏁 일정 최종 확정!</div>
                    <div class="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-100 p-2.5 rounded-xl text-center shadow-sm">
                        🎉 확정 일정: ${poll.confirmed_time}<br>
                        <span class="text-[10px] text-slate-400 font-bold mt-1 block">(대항전 스케줄러 자동 이관 완료)</span>
                    </div>
                `;
            }

            const wrapperHtml = `
                <div class="flex justify-center my-2 animate-in zoom-in-95 duration-200">
                    <div class="bg-gradient-to-b from-indigo-50 to-white border-2 border-indigo-200/60 rounded-2xl p-4 w-72 shadow-md">
                        ${cardInnerHtml}
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', wrapperHtml);
        },

        acceptProposedTime: async (pollId) => {
            if (!confirm("이 제안된 시간을 최종 일정으로 수락하시겠습니까?")) return;

            const myId = String(Boako.state.user.id);
            
            // 💡 [버그 수정] 통신 지연 방지를 위해 DB에서 최신 데이터를 명확히 다시 불러옵니다.
            const { data: poll } = await Boako.db.from('schedule_polls').select('*').eq('poll_id', pollId).single();
            if (!poll) return;

            let currentConfirmations = poll.confirmations || [];
            if (!currentConfirmations.some(id => String(id) === myId)) {
                currentConfirmations.push(myId);
            }

            const totalExpectedVoters = Boako.Match.Chat.currentEntryCount;

            // 🌟 [수정 완료] 함수명(forceConfirmPoll) 누락 해결 2
            if (currentConfirmations.length >= totalExpectedVoters) {
                await Boako.Match.Chat.forceConfirmPoll(pollId, poll.proposed_time, poll.proposer_id);
            } else {
                await Boako.db.from('schedule_polls').update({ confirmations: currentConfirmations }).eq('poll_id', pollId);
                Boako.Util.toast("🟢 수락 처리가 기록되었습니다.");
                // 💡 즉시 렌더링 호출을 통해 내가 버튼을 누르자마자 '✅ 수락 완료' 상태로 화면을 바꿉니다.
                await Boako.Match.Chat.loadMessagesAndPolls();
            }
        },

        rejectProposedTime: async (pollId) => {
            if (!confirm("이 제안을 거절하고 일정을 다시 조율하시겠습니까?\n거절 시 기존 교집합 제안이 취소되고 재투표가 진행됩니다.")) return;

            const myId = String(Boako.state.user.id);
            const { data: poll } = await Boako.db.from('schedule_polls').select('*').eq('poll_id', pollId).single();
            if (!poll) return;

            let currentConfirmations = (poll.confirmations || []).filter(id => String(id) !== myId);
            let currentVotes = poll.votes || {};
            currentVotes[myId] = []; 

            const updatePayload = {
                votes: currentVotes,
                confirmations: currentConfirmations,
                proposed_time: null,
                status: 'OPEN'
            };

            await Boako.db.from('schedule_polls').update(updatePayload).eq('poll_id', pollId);
            Boako.Util.toast("🔴 거절 처리되었습니다. 새로운 시간대를 선택해 주세요.");
            
            await Boako.Match.Chat.loadMessagesAndPolls();
            Boako.Match.Chat.openPollModal();
        },

       // 🌟 [수정됨] 백엔드 함수(RPC) 연동으로 극도로 간결해진 확정 로직
        forceConfirmPoll: async (pollId, confirmedTime, proposerId) => {
            try {
                // 1. 프론트엔드에서는 복잡한 로직 없이, 백엔드에 만들어둔 함수만 호출!
                const { error } = await Boako.db.rpc('confirm_match_schedule', {
                    p_poll_id: pollId,
                    p_confirmed_time: confirmedTime,
                    p_proposer_id: proposerId,
                    p_season_no: Boako.Match.Chat.currentSeason,
                    p_game_name: Boako.Match.Chat.currentGame
                });

                if (error) throw error;
                
                Boako.Util.toast("🎉 참가자 전원의 일정이 공식 캘린더에 성공적으로 등재되었습니다!");
                await Boako.Match.Chat.loadMessagesAndPolls();

            } catch (err) {
                console.error("일정 확정 (RPC) 에러:", err);
                alert("일정 테이블 이관 중 오류가 발생했습니다: " + err.message);
            }
        },

        renderMessage: (msg) => {
            const container = document.getElementById('match-chat-messages');
            if (!container) return;

            const isMe = String(msg.sender_id) === String(Boako.state.user.id);
            const senderName = msg.profiles?.full_name || msg.sender_name_override || "참여자";
            const teamBadge = msg.team_name ? `<span class="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] mr-1 font-black shadow-sm">[${msg.team_name}]</span>` : '';

            const html = isMe ? `
                <div class="flex flex-col items-end gap-1 animate-in slide-in-from-right-2 duration-200">
                    <div class="bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[75%] text-sm shadow-md break-words font-medium">
                        ${msg.content.replace(/\n/g, '<br>')}
                    </div>
                </div>
            ` : `
                <div class="flex flex-col items-start gap-1 animate-in slide-in-from-left-2 duration-200">
                    <span class="text-[11px] font-bold text-slate-600 flex items-center ml-1">
                        ${teamBadge} ${senderName}
                    </span>
                    <div class="bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[75%] text-sm shadow-md break-words font-medium">
                        ${msg.content.replace(/\n/g, '<br>')}
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', html);
        },

        scrollToBottom: () => {
            const el = document.getElementById('match-chat-messages');
            if (el) el.scrollTop = el.scrollHeight;
        }
    }
};
