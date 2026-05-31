/**
 * [RIVAL SYSTEM] 기록 기반 자동 매칭 라이벌 탐색기 (아코디언 VS 레이아웃 버전)
 */
Boako.Rival = {
    init: (containerId) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        const html = `
            <div class="main-banner" style="background: linear-gradient(135deg, #f43f5e 0%, #be123c 100%);">
                <h1>⚔️ 라이벌 탐색기</h1>
                <p>내가 즐겨하는 종목을 클릭해 영혼의 맞수를 확인하세요.</p>
                <p>라이벌 매치를 진행하시면 포인트를 획득할 수 있습니다.</p>
            </div>

            <section class="section-card">
                <div class="card-header flex justify-between items-center">
                    <span>🔍 나의 주력 종목 TOP 10</span>
                </div>
                
                <div class="card-body" style="background: #f8fafc; min-height: 400px; padding: 25px;">
                    <div class="flex gap-2 mb-6">
                        <div class="relative flex-1">
                            <i data-lucide="search" class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"></i>
                            <input type="text" id="rival-search-input" placeholder="다른 종목 검색 (예: 쿼리도)" class="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl text-sm font-bold transition-all shadow-sm">
                        </div>
                        <button onclick="Boako.Rival.searchRivals()" class="bg-slate-800 text-white px-6 rounded-xl font-bold text-sm hover:bg-slate-700 transition-colors shadow-sm">검색</button>
                    </div>

                    <div id="rival-list-container" class="space-y-3">
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

        document.getElementById('rival-search-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') Boako.Rival.searchRivals();
        });

        // 로드 시 자동 검색
        Boako.Rival.searchRivals();
    },

    searchRivals: async () => {
        const container = document.getElementById('rival-list-container');
        const searchInput = document.getElementById('rival-search-input');
        const searchWord = searchInput ? searchInput.value.trim() : '';
        const myNickname = Boako.state.user.nickname;
        
        container.innerHTML = `<div class="text-center py-10 text-slate-400 font-bold"><i data-lucide="loader-2" class="w-8 h-8 animate-spin mx-auto mb-2"></i>분석 중...</div>`;

        try {
            if (searchWord) {
                // 🌟 수정 적용 완료: 무소속 기록도 찾을 수 있도록 활동 내역 뷰 참조
                const { count, error: countErr } = await Boako.db
                    .from('v_boako_activity_history')
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
                        </div>`;
                    return;
                }
            }

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
                    </div>`;
                return;
            }

            let listHtml = '';
            data.forEach((match, index) => {
                const isPerfectMatch = match.count_diff === 0;
                const matchBadge = isPerfectMatch 
                    ? `<span class="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black shadow-sm absolute -top-2 -right-2 border-2 border-white">🔥 맞수</span>`
                    : '';

                const logoSrc = match.game_logo_url || 'https://via.placeholder.com/150?text=GAME';
                const profileSrc = match.rival_profile_url ? match.rival_profile_url.replace('http://', 'https://') : null;
                
                // 🌟 수정 적용 완료: 내 프로필 주소를 프론트엔드가 아닌 DB(match 객체)에서 정확하게 꺼내옵니다.
                const myProfileUrl = match.my_profile_url ? match.my_profile_url.replace('http://', 'https://') : null;
                const myProfileInitial = myNickname.charAt(0);

                listHtml += `
                    <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden transition-all duration-200">
                        
                        <div onclick="Boako.Rival.toggleDetail(${index})" class="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors group">
                            <div class="font-black text-slate-800 flex items-center gap-3">
                                <span class="text-slate-300 font-bold w-4 text-center">${index + 1}</span>
                                <div class="w-8 h-8 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shadow-sm shrink-0">
                                    <img src="${logoSrc}" class="w-full h-full object-cover" onerror="this.src='https://via.placeholder.com/150?text=GAME'">
                                </div>
                                <span class="text-[15px] group-hover:text-red-600 transition-colors">${match.game_name}</span>
                            </div>
                            <div class="flex items-center gap-3">
                                <span class="text-[11px] font-black bg-slate-100 text-slate-500 px-3 py-1.5 rounded-lg border border-slate-200">내 기록: ${match.my_record_count}회</span>
                                <i data-lucide="chevron-down" id="rival-icon-${index}" class="w-5 h-5 text-slate-400 transition-transform duration-300"></i>
                            </div>
                        </div>

                        <div id="rival-detail-${index}" class="hidden border-t border-slate-100 bg-gradient-to-b from-slate-50 to-white">
                            <div class="p-8 flex flex-col items-center">
                                
                                <div class="flex flex-col items-center mb-8">
                                    <div class="w-20 h-20 rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-md mb-3 transform -rotate-3">
                                        <img src="${logoSrc}" class="w-full h-full object-cover" onerror="this.src='https://via.placeholder.com/150?text=GAME'">
                                    </div>
                                    <h3 class="font-black text-2xl text-slate-800 tracking-tight">${match.game_name}</h3>
                                    <p class="text-xs text-slate-400 font-bold mt-1">기록 차이: ${isPerfectMatch ? '0회 (완벽한 동급)' : match.count_diff + '회'}</p>
                                </div>

                                <div class="flex items-center justify-center gap-8 w-full max-w-sm mb-8">
                                    
                                    <div class="flex flex-col items-center gap-2 flex-1">
                                        <div class="w-16 h-16 rounded-full bg-slate-200 border-4 border-slate-100 flex items-center justify-center text-slate-500 font-black text-xl shadow-lg relative overflow-visible">
                                            ${myProfileUrl ? `<img src="${myProfileUrl}" class="w-full h-full object-cover rounded-full">` : myProfileInitial}
                                        </div>
                                        <div class="text-sm font-black text-slate-800">${myNickname} (${match.my_record_count}회)</div>
                                    </div>
                                    
                                    <div class="text-3xl font-black text-red-500 italic drop-shadow-md pb-6 shrink-0">VS</div>
                                    
                                    <div class="flex flex-col items-center gap-2 flex-1">
                                        <div class="w-16 h-16 rounded-full bg-slate-200 border-4 ${isPerfectMatch ? 'border-red-400' : 'border-slate-100'} flex items-center justify-center text-slate-500 font-black text-xl shadow-lg relative overflow-visible">
                                            ${profileSrc ? `<img src="${profileSrc}" class="w-full h-full object-cover rounded-full">` : match.rival_nickname.charAt(0)}
                                            ${matchBadge}
                                        </div>
                                        <div class="text-sm font-black text-slate-800">${match.rival_nickname} (${match.rival_record_count}회)</div>
                                    </div>
                                </div>

                                <button onclick="Boako.Rival.executeChallenge('${match.rival_id}', '${match.game_name}')" class="w-full max-w-xs bg-slate-900 hover:bg-red-600 text-white text-[15px] font-black px-6 py-3.5 rounded-xl transition-all hover:scale-105 hover:shadow-lg flex justify-center items-center gap-2">
                                    <i data-lucide="swords" class="w-5 h-5"></i> 매치 도전장 발송
                                </button>

                            </div>
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

    // 3. 아코디언 토글 (열고 닫기) 애니메이션
    toggleDetail: (index) => {
        const detailDiv = document.getElementById(`rival-detail-${index}`);
        const icon = document.getElementById(`rival-icon-${index}`);
        
        if (detailDiv.classList.contains('hidden')) {
            // 다른 열려있는 탭을 전부 닫음 (깔끔한 UI를 위해)
            document.querySelectorAll('[id^="rival-detail-"]').forEach(el => el.classList.add('hidden'));
            document.querySelectorAll('[id^="rival-icon-"]').forEach(el => el.style.transform = 'rotate(0deg)');

            // 선택한 탭 열기
            detailDiv.classList.remove('hidden');
            icon.style.transform = 'rotate(180deg)';
        } else {
            // 이미 열려있으면 닫기
            detailDiv.classList.add('hidden');
            icon.style.transform = 'rotate(0deg)';
        }
    },

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

            Boako.Util.toast("🎉 매치 도전장이 성공적으로 발송되었습니다!");

        } catch (err) {
            console.error(err);
            Boako.Util.toast("❌ 발송 실패: 이미 진행 중인 매치가 있거나 오류가 발생했습니다.");
        }
    }
};
