/**
 * [RIVAL SYSTEM] 기록 기반 자동 매칭 라이벌 탐색기 (페이지 뷰 버전)
 */
Boako.Rival = {
    // 1. 초기화 및 뼈대 UI 렌더링 (Boako.View에서 호출됨!)
    init: (containerId) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        // 모달창이 아닌, 꽉 찬 메인 페이지 UI로 구성
        const html = `
            <div class="main-banner" style="background: linear-gradient(135deg, #f43f5e 0%, #be123c 100%);">
                <h1>⚔️ 라이벌 탐색기</h1>
                <p>나와 기록 횟수가 가장 비슷한 영혼의 맞수를 찾아보세요.</p>
            </div>

            <section class="section-card">
                <div class="card-header flex justify-between items-center">
                    <span>🔍 종목별 맞수 찾기</span>
                </div>
                
                <div class="card-body" style="background: #f8fafc; min-height: 400px;">
                    <div class="flex gap-2 mb-6">
                        <div class="relative flex-1">
                            <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"></i>
                            <input type="text" id="rival-search-input" placeholder="특정 종목 검색 (예: 아크 노바)" class="w-full pl-9 pr-4 py-3 bg-white border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl text-sm font-bold transition-all shadow-sm">
                        </div>
                        <button onclick="Boako.Rival.searchRivals()" class="bg-slate-800 text-white px-6 rounded-xl font-bold text-sm hover:bg-slate-700 transition-colors shadow-sm">검색</button>
                    </div>

                    <div id="rival-list-container" class="space-y-4">
                        <div class="text-center py-10 text-slate-400 font-bold text-sm flex flex-col items-center gap-2">
                            <i data-lucide="loader-2" class="w-8 h-8 animate-spin"></i>
                            전적을 분석하여 라이벌을 찾고 있습니다...
                        </div>
                    </div>
                </div>
            </section>
        `;
        
        container.innerHTML = html;
        if(typeof lucide !== 'undefined') lucide.createIcons();

        // 엔터키 검색 이벤트 연동
        document.getElementById('rival-search-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') Boako.Rival.searchRivals();
        });

        // 페이지가 열리자마자 바로 상위 10개 추천 라이벌 검색 시작
        Boako.Rival.searchRivals();
    },

    // 2. 검색 및 리스트 그리기 로직
    searchRivals: async () => {
        const container = document.getElementById('rival-list-container');
        const searchInput = document.getElementById('rival-search-input');
        const searchWord = searchInput ? searchInput.value.trim() : '';
        const myNickname = Boako.state.user.nickname;
        
        container.innerHTML = `<div class="text-center py-10 text-slate-400 font-bold"><i data-lucide="loader-2" class="w-8 h-8 animate-spin mx-auto mb-2"></i>분석 중...</div>`;
        if(typeof lucide !== 'undefined') lucide.createIcons();

        try {
            // [검증] 검색어가 있을 때 내 기록 유무 확인
            if (searchWord) {
                const { count, error: countErr } = await Boako.db
                    .from('v_boako_total_records')
                    .select('*', { count: 'exact', head: true })
                    .eq('nickname', myNickname)
                    .ilike('game_name', `%${searchWord}%`);

                if (countErr) throw countErr;

                if (count === 0) {
                    container.innerHTML = `
                        <div class="bg-red-50 border border-red-200 rounded-xl p-8 text-center flex flex-col items-center justify-center shadow-sm">
                            <span class="text-4xl mb-3">🚷</span>
                            <h4 class="font-black text-red-600 text-lg mb-1">매칭 불가</h4>
                            <p class="text-sm text-red-500 font-bold">[${searchWord}] 게임의 기록은 아직 입력하지 않으셨습니다.</p>
                            <p class="text-xs text-red-400 mt-2">BTLDB나 토너먼트에 먼저 기록을 남겨주세요!</p>
                        </div>
                    `;
                    return;
                }
            }

            // [본 매칭] DB 매칭 함수(RPC) 호출
            const { data, error } = await Boako.db.rpc('get_recommended_rivals', { 
                p_user_id: Boako.state.user.id,
                p_game_name: searchWord ? searchWord : null
            });

            if (error) throw error;

            if (!data || data.length === 0) {
                container.innerHTML = `
                    <div class="bg-white border border-slate-200 rounded-xl p-8 text-center flex flex-col items-center justify-center shadow-sm">
                        <span class="text-4xl mb-3">👻</span>
                        <h4 class="font-black text-slate-600 text-lg mb-1">상대 없음</h4>
                        <p class="text-sm text-slate-500 font-bold">해당 종목을 플레이한 다른 유저가 아직 없습니다.</p>
                    </div>
                `;
                return;
            }

            // [리스트 UI 렌더링]
            let listHtml = '';
            data.forEach((match) => {
                const isPerfectMatch = match.count_diff === 0;
                const matchBadge = isPerfectMatch 
                    ? `<span class="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded font-black shrink-0 shadow-sm">영혼의 맞수 🔥</span>`
                    : `<span class="bg-slate-200 text-slate-600 text-[10px] px-2 py-0.5 rounded font-black shrink-0">기록 차이: ${match.count_diff}회</span>`;

                const logoSrc = match.game_logo_url || 'https://via.placeholder.com/150?text=GAME';
                const profileSrc = match.rival_profile_url;

                listHtml += `
                    <div class="bg-white border border-slate-200 p-5 rounded-xl shadow-sm hover:shadow-md hover:border-red-300 transition-all flex flex-col gap-4">
                        
                        <div class="flex justify-between items-center border-b border-slate-100 pb-3">
                            <div class="font-black text-lg text-slate-800 flex items-center gap-3">
                                <img src="${logoSrc}" class="w-8 h-8 rounded-lg object-cover shadow-sm bg-slate-100" onerror="this.src='https://via.placeholder.com/150?text=GAME'">
                                ${match.game_name}
                            </div>
                            <div class="text-xs font-black bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg border border-indigo-100">
                                내 누적 기록: ${match.my_record_count}회
                            </div>
                        </div>

                        <div class="flex items-center justify-between pl-1">
                            <div class="flex items-center gap-3 min-w-0">
                                <div class="w-11 h-11 rounded-full bg-slate-200 overflow-hidden shrink-0 border border-slate-200 shadow-inner">
                                    ${profileSrc 
                                        ? `<img src="${profileSrc}" class="w-full h-full object-cover" onerror="this.outerHTML='<div class=\\'w-full h-full flex items-center justify-center text-slate-400 font-black\\'>${match.rival_nickname.charAt(0)}</div>'">` 
                                        : `<div class="w-full h-full flex items-center justify-center text-slate-400 font-black">${match.rival_nickname.charAt(0)}</div>`}
                                </div>
                                <div class="min-w-0">
                                    <div class="font-black text-slate-800 text-[15px] flex items-center gap-2">
                                        ${match.rival_nickname} 
                                        ${matchBadge}
                                    </div>
                                    <div class="text-xs text-slate-500 mt-1 font-bold">
                                        상대방 기록: ${match.rival_record_count}회
                                    </div>
                                </div>
                            </div>
                            <button onclick="Boako.Rival.executeChallenge('${match.rival_id}', '${match.game_name}')" class="bg-slate-800 hover:bg-red-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm">
                                <i data-lucide="swords" class="w-4 h-4"></i> 도전하기
                            </button>
                        </div>
                    </div>
                `;
            });
            container.innerHTML = listHtml;
            if(typeof lucide !== 'undefined') lucide.createIcons();

        } catch (err) {
            console.error(err);
            container.innerHTML = `<div class="text-center py-10 text-red-500 font-bold text-sm bg-red-50 rounded-xl">데이터를 불러오는 중 오류가 발생했습니다.</div>`;
        }
    },

    // 3. 도전장 DB 발송
    executeChallenge: async (defenderId, gameName) => {
        if (!confirm(`[${gameName}] 종목으로 라이벌 매치 도전장을 보내시겠습니까?`)) return;

        try {
            const payload = {
                challenger_id: Boako.state.user.id,
                defender_id: defenderId,
                game_name: gameName,
                status: 'PENDING'
            };

            const { error } = await Boako.db.from('rival_matches').insert([payload]);
            if (error) throw error;

            Boako.Util.toast("🎉 도전장이 발송되었습니다! 통신망에서 대화방을 확인하세요.");

        } catch (err) {
            console.error(err);
            Boako.Util.toast("❌ 발송 실패: 이미 진행 중인 매치가 있거나 오류가 발생했습니다.");
        }
    }
};
