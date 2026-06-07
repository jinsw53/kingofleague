/**
 * [MATCH] 대항전 메인 대시보드 관리
 */
Boako.Match = {
    // 🌟 1. 대시보드 초기화 (상단 UI 군더더기 제거 및 로고 영역 추가)
    init: async (containerId) => {
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

    // (switchTab 함수는 그대로 유지)
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

    // 🌟 3. 데이터 로드 (시즌 로고 처리 추가)
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
                
                // 날짜 대신 시즌 로고 렌더링
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

            // 💡 이 부분이 수정되었습니다! 함수 이름을 명확히 적어주었습니다.
            Boako.Match.renderBanTab(displayGames, isFinalized);
            Boako.Match.renderEntryTab(displayGames, isFinalized);

        } catch (err) {
            console.error("대항전 데이터 로드 에러:", err);
            document.getElementById('match-ban-content').innerHTML = `
                <div class="bg-red-50 text-red-500 p-6 rounded-xl font-bold border border-red-200 text-center">
                    🚨 데이터를 불러오는 중 오류가 발생했습니다.<br><span class="text-sm font-normal">${err.message}</span>
                </div>
            `;
        }
    },

    // 🌟 4. [탭 1] 밴 결과 렌더링 (SURVIVED 삭제, 텍스트 넘침 방지)
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
                    
                    <!-- 💡 SURVIVED 배지 삭제, BANNED만 남김 -->
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
                    
                    <!-- 💡 하단 텍스트 수정 (글씨 넘침 방지) -->
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

  // 🌟 5. [탭 2] 게임별 매치업 (클릭 시 엔트리 작전판 오픈 기능 추가)
    renderEntryTab: (games, isFinalized, entries) => {
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
            // 💡 해당 종목의 확정된 엔트리만 필터링
            const gameEntries = entries.filter(e => e.game_name === game.game_name);
            
            html += `
                <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    
                    <!-- 💡 헤더 영역 (로고/제목 클릭 시 작전판 열림) -->
                    <div class="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div class="flex items-center gap-3 cursor-pointer group" onclick="Boako.Team.openEntryForm()">
                            <div class="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm p-1 group-hover:scale-110 transition-transform duration-300">
                                ${game.game_logo_url ? `<img src="${game.game_logo_url}" class="w-full h-full object-contain">` : '🎲'}
                            </div>
                            <div>
                                <h3 class="font-black text-white text-lg group-hover:text-indigo-300 transition-colors">${game.game_name}</h3>
                                <span class="text-slate-300 text-xs font-bold">본선 출전 엔트리</span>
                            </div>
                        </div>
                        
                        <div class="flex items-center gap-2">
                            <!-- 💡 확정 전(블라인드)일 때 헤더에도 엔트리 작성 버튼 노출 -->
                            ${gameEntries.length === 0 ? `
                                <button onclick="Boako.Team.openEntryForm()" class="bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-black hover:bg-emerald-600 transition-colors shadow-sm flex items-center gap-2">
                                    📝 작전판 열기
                                </button>
                            ` : ''}
                            <button onclick="Boako.Util.toast('해당 종목 선수들의 소통 채널이 열립니다.')" class="bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-black hover:bg-indigo-600 transition-colors shadow-sm flex items-center gap-2">
                                💬 소통 채널
                            </button>
                        </div>
                    </div>

                    <div class="p-6 bg-slate-50/50">
                        ${gameEntries.length > 0 ? `
                            <!-- 크론 정산 후: 확정된 엔트리 명단 공개 -->
                            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                ${gameEntries.map(entry => `
                                    <div class="bg-white border-2 border-indigo-100 rounded-xl p-4 text-center shadow-sm relative overflow-hidden">
                                        <span class="text-indigo-600 font-black text-sm mb-2 block relative z-10">${entry.team_name}</span>
                                        <div class="text-slate-700 font-bold text-sm bg-slate-50 py-3 rounded-lg border border-slate-200 relative z-10">
                                            ${entry.player_name}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : `
                            <!-- 💡 크론 정산 전: 블라인드 박스 전체를 클릭 가능하게 변경 -->
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
    }
};
