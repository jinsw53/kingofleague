/**
 * [MATCH] 대항전 메인 대시보드 관리
 */
Boako.Match = {
    // 🌟 1. 대시보드 초기화 (view.js에서 넘겨주는 containerId를 받아서 처리)
    init: async (containerId) => {
        // 넘겨받은 ID가 있으면 쓰고, 없으면 기본값 적용
        const targetId = containerId || 'main-content';
        const container = document.getElementById(targetId); 
        
        if (!container) {
            console.error(`렌더링할 컨테이너(#${targetId})를 찾을 수 없습니다.`);
            return;
        }

        // HTML 레이아웃 (탭 메뉴, 전광판) 렌더링
        container.innerHTML = `
            <div class="max-w-5xl mx-auto p-4 space-y-6" style="animation: fadeIn 0.3s ease-out;">
                
                <!-- 👑 상단 전광판 (Hero Section) -->
                <div class="bg-slate-900 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
                    <div class="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-indigo-500 rounded-full blur-[80px] opacity-40 pointer-events-none"></div>
                    <div class="absolute bottom-0 left-0 -ml-12 -mb-12 w-48 h-48 bg-blue-600 rounded-full blur-[80px] opacity-30 pointer-events-none"></div>
                    
                    <div class="relative z-10 flex flex-col md:flex-row justify-between md:items-end gap-4">
                        <div>
                            <span class="inline-block px-3 py-1 bg-white/10 text-blue-200 text-xs font-black rounded-lg mb-3 tracking-wider backdrop-blur-sm">GRAND PRIX</span>
                            <h1 class="text-3xl md:text-4xl font-black mb-2" id="match-season-title">대항전 데이터 로딩 중...</h1>
                            <p class="text-slate-400 font-bold text-sm" id="match-season-date">일정 정보 불러오는 중</p>
                        </div>
                        
                        <!-- 직관적인 진행 상태 타임라인 -->
                        <div class="flex items-center gap-2 text-xs font-black bg-black/30 p-2 rounded-2xl backdrop-blur-md border border-white/10">
                            <span class="px-4 py-2 rounded-xl bg-blue-600 text-white shadow-lg" id="status-ban">🚫 밴픽 진행</span>
                            <span class="text-slate-600">▶</span>
                            <span class="px-4 py-2 rounded-xl text-slate-400" id="status-entry">⚔️ 엔트리 제출</span>
                            <span class="text-slate-600">▶</span>
                            <span class="px-4 py-2 rounded-xl text-slate-400" id="status-play">🏆 본선 경기</span>
                        </div>
                    </div>
                </div>

                <!-- 🗂️ 탭 네비게이션 -->
                <div class="flex gap-1 border-b-2 border-slate-100 pb-px overflow-x-auto custom-scrollbar">
                    <button onclick="Boako.Match.switchTab('tab-ban')" id="btn-tab-ban" class="whitespace-nowrap px-6 py-3 text-sm font-black border-b-4 border-indigo-600 text-indigo-600 transition-colors">🚫 밴(Ban) 결과</button>
                    <button onclick="Boako.Match.switchTab('tab-entry')" id="btn-tab-entry" class="whitespace-nowrap px-6 py-3 text-sm font-black border-b-4 border-transparent text-slate-400 hover:text-slate-700 transition-colors">⚔️ 게임별 매치업</button>
                    <button onclick="Boako.Match.switchTab('tab-score')" id="btn-tab-score" class="whitespace-nowrap px-6 py-3 text-sm font-black border-b-4 border-transparent text-slate-400 hover:text-slate-700 transition-colors">📊 스코어보드</button>
                </div>

                <!-- 📺 탭 1: 밴 결과 컨텐츠 -->
                <div id="tab-ban" class="space-y-4">
                    <div id="match-ban-content" class="min-h-[300px] flex items-center justify-center text-slate-400 font-bold">
                        <span class="animate-pulse">데이터 베이스 통신 중... ⏳</span>
                    </div>
                </div>

                <!-- 📺 탭 2: 매치업 & 엔트리 컨텐츠 -->
                <div id="tab-entry" class="hidden space-y-4">
                    <div id="match-entry-content" class="min-h-[300px] flex items-center justify-center text-slate-400 font-bold">
                        <span class="animate-pulse">대진표 구성 중... ⏳</span>
                    </div>
                </div>

                <!-- 📺 탭 3: 스코어보드 컨텐츠 -->
                <div id="tab-score" class="hidden space-y-4">
                    <div class="bg-white p-12 rounded-3xl text-center border border-slate-200 shadow-sm">
                        <span class="text-6xl block mb-4 drop-shadow-md">🏆</span>
                        <h3 class="text-xl font-black text-slate-800">스코어보드 집계 중</h3>
                        <p class="text-sm text-slate-500 font-bold mt-2">본선 경기가 시작되면 각 팀의 실시간 승점이 기록됩니다.</p>
                    </div>
                </div>

            </div>
        `;

        // 레이아웃을 그린 직후 DB 데이터 로드 실행
        await Boako.Match.loadData();
    },

    // 🌟 2. 탭 전환 로직
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

    // 🌟 3. 데이터 로드 (투표 내역 테이블 조회 완전 삭제, 비밀 룰 적용)
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
                document.getElementById('match-season-date').innerText = `📅 ${currentSeason.start_date} ~ ${currentSeason.end_date}`;
            }

            // 이번 시즌의 전체 종목 '한 번만' 싹 다 불러오기
            const { data: allGames, error: gamesErr } = await Boako.db
                .from('grandprix_games')
                .select('*')
                .eq('season_no', seasonNo)
                .order('selection_rank', { ascending: true });
            
            if (gamesErr) throw gamesErr;

            // 정산이 끝났는지(FINAL 상태인 녀석이 하나라도 있는지) 확인
            const isFinalized = allGames.some(g => g.status === 'FINAL');
            let displayGames = [];

            if (isFinalized) {
                // ✅ [정산 완료] 전체 종목을 넘김 (렌더링 함수에서 status로 밴 여부 구분)
                displayGames = allGames;
                
                // 전광판 상태 업데이트 (엔트리 단계로 전환)
                document.getElementById('status-ban').classList.replace('bg-blue-600', 'bg-slate-700');
                document.getElementById('status-ban').classList.replace('text-white', 'text-slate-400');
                document.getElementById('status-entry').classList.replace('text-slate-400', 'bg-blue-600');
                document.getElementById('status-entry').classList.add('text-white', 'shadow-lg');
            } else {
                // ⏳ [정산 전] CANDIDATE 상태인 녀석들만 10개 커트해서 넘김
                displayGames = allGames.filter(g => g.status === 'CANDIDATE').slice(0, 10);
            }

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

    // 🌟 4. [탭 1] 밴 결과 렌더링
    renderBanTab: (games, isFinalized) => {
        const content = document.getElementById('match-ban-content');
        if (!games.length) {
            content.innerHTML = `<div class="text-center py-12 text-slate-400 font-bold">등록된 대회 종목이 없습니다.</div>`;
            return;
        }

        let html = `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">`;
        
        games.forEach(game => {
            const isBanned = isFinalized && game.status !== 'FINAL';

            const cardClass = isBanned 
                ? 'bg-slate-100 border-2 border-red-500/50 shadow-none' 
                : 'bg-white border border-slate-200 hover:border-indigo-400 hover:shadow-lg hover:-translate-y-1';
            
            const textClass = isBanned ? 'text-slate-400 line-through decoration-red-500/50' : 'text-slate-800';
            const imgClass = isBanned ? 'grayscale opacity-30' : 'drop-shadow-sm';

            html += `
                <div class="rounded-2xl p-5 flex flex-col items-center justify-between text-center transition-all duration-200 relative ${cardClass}">
                    
                    ${isBanned ? `
                        <div class="absolute top-3 right-3 bg-red-600 text-white text-[10px] font-black px-2.5 py-1 rounded-md shadow-sm z-10 rotate-12">
                            BANNED
                        </div>
                    ` : `
                        <div class="absolute top-3 right-3 bg-emerald-100 text-emerald-600 text-[10px] font-black px-2.5 py-1 rounded-md shadow-sm z-10">
                            ${isFinalized ? 'SURVIVED' : 'CANDIDATE'}
                        </div>
                    `}
                    
                    <div class="w-20 h-20 mb-4 flex items-center justify-center relative">
                        ${game.game_logo_url 
                            ? `<img src="${game.game_logo_url}" class="max-h-full max-w-full object-contain ${imgClass}">` 
                            : `<span class="text-5xl ${imgClass}">🎲</span>`
                        }
                    </div>
                    
                    <h4 class="font-black text-sm break-keep mb-2 ${textClass}">${game.game_name}</h4>
                    
                    ${isBanned ? `
                        <div class="text-[11px] font-bold text-red-500 bg-red-50 px-2 py-1 rounded-lg w-full truncate border border-red-100">
                            밴(Ban) 확정 종목
                        </div>
                    ` : `
                        <div class="text-[11px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg w-full border border-slate-100">
                            ${isFinalized ? '본선 진출 종목' : '밴 투표 후보'}
                        </div>
                    `}
                </div>
            `;
        });
        html += `</div>`;
        content.innerHTML = html;
    },

    // 🌟 5. [탭 2] 게임별 매치업
    renderEntryTab: (games, isFinalized) => {
        const content = document.getElementById('match-entry-content');
        
        // 정산 전이면 엔트리 탭 차단
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
            html += `
                <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    
                    <div class="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm p-1">
                                ${game.game_logo_url ? `<img src="${game.game_logo_url}" class="w-full h-full object-contain">` : '🎲'}
                            </div>
                            <div>
                                <h3 class="font-black text-white text-lg">${game.game_name}</h3>
                                <span class="text-slate-300 text-xs font-bold">본선 매치업</span>
                            </div>
                        </div>
                        
                        <button onclick="Boako.Util.toast('해당 종목 선수들의 소통 채널이 열립니다.')" class="bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-black hover:bg-indigo-600 transition-colors shadow-sm flex items-center gap-2">
                            💬 출전자 소통 / 일정 조율
                        </button>
                    </div>

                    <div class="p-6">
                        <div class="flex flex-col md:flex-row items-stretch justify-center gap-4 md:gap-8 relative">
                            <div class="hidden md:flex absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-red-500 text-white font-black italic rounded-full items-center justify-center border-4 border-white shadow-sm z-10">VS</div>

                            <div class="flex-1 bg-blue-50/50 border-2 border-blue-100 rounded-2xl p-5 text-center relative overflow-hidden">
                                <span class="text-blue-600 font-black text-sm mb-3 block">HOME TEAM</span>
                                <div class="text-slate-400 font-bold text-sm bg-white py-4 rounded-xl border border-slate-200 shadow-inner">아직 엔트리가 제출되지 않았습니다.</div>
                            </div>
                            
                            <div class="md:hidden flex justify-center py-2"><span class="bg-red-500 text-white font-black italic px-3 py-1 rounded-full text-xs">VS</span></div>

                            <div class="flex-1 bg-red-50/50 border-2 border-red-100 rounded-2xl p-5 text-center relative overflow-hidden">
                                <span class="text-red-600 font-black text-sm mb-3 block">AWAY TEAM</span>
                                <div class="text-slate-400 font-bold text-sm bg-white py-4 rounded-xl border border-slate-200 shadow-inner">아직 엔트리가 제출되지 않았습니다.</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
        content.innerHTML = html;
    }
};
