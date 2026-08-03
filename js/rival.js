/**
 * [RIVAL SYSTEM] 기록 기반 자동 매칭 라이벌 탐색기 (아코디언 VS 레이아웃 버전)
 * 🌟 라이벌전 도전장 발송(제안) 성공 시 오늘의 주사위 시도 (팀 리그 외 활동, 하루 1회)
 * 🌟 [신규] 탭 2개로 구성: "🔍 라이벌 찾기"(기존 기능) / "📣 응원하기"(예정된 라이벌전 승자 예측 투표).
 *    응원하러 왔다가 자연스럽게 "나도 라이벌전 해볼까?" 유입되도록 같은 화면 안에 배치.
 *    응원 투표는 매치 당사자 제외, 로그인 유저만, 매치당 1표, 마감은 match_schedules.scheduled_time.
 *    결과 확정(complete_rival_match) 시 적중/미적중 모두 포인트 지급(잃는 사람 없음).
 */
Boako.Rival = {
    State: {
        currentTab: 'find' // 'find' | 'cheer'
    },

    init: (containerId) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        const html = `
            <div class="main-banner" style="background: linear-gradient(135deg, #f43f5e 0%, #be123c 100%);">
                <h1>⚔️ 라이벌 탐색기</h1>
                <p>내가 즐겨하는 종목을 클릭해 영혼의 맞수를 확인하세요.</p>
                <p>라이벌 매치를 진행하시면 포인트를 획득할 수 있습니다.</p>
            </div>

            <div class="flex gap-2 mb-4">
                <button id="rival-tab-btn-find" onclick="Boako.Rival.switchTab('find')" class="flex-1 py-3 rounded-xl font-black text-sm transition-all">🔍 라이벌 찾기</button>
                <button id="rival-tab-btn-cheer" onclick="Boako.Rival.switchTab('cheer')" class="flex-1 py-3 rounded-xl font-black text-sm transition-all">📣 응원하기</button>
            </div>

            <div id="rival-tab-content"></div>
        `;

        container.innerHTML = html;
        Boako.Rival.switchTab('find');
    },

    switchTab: (tab) => {
        Boako.Rival.State.currentTab = tab;

        const findBtn = document.getElementById('rival-tab-btn-find');
        const cheerBtn = document.getElementById('rival-tab-btn-cheer');
        if (findBtn && cheerBtn) {
            const activeCls = 'bg-slate-900 text-white shadow-sm';
            const inactiveCls = 'bg-slate-100 text-slate-500';
            findBtn.className = `flex-1 py-3 rounded-xl font-black text-sm transition-all ${tab === 'find' ? activeCls : inactiveCls}`;
            cheerBtn.className = `flex-1 py-3 rounded-xl font-black text-sm transition-all ${tab === 'cheer' ? activeCls : inactiveCls}`;
        }

        if (tab === 'find') {
            Boako.Rival.renderFindTab();
        } else {
            Boako.Rival.renderCheerTab();
        }
    },

    // 🌟 [신규] 기존 "라이벌 찾기" 화면을 별도 함수로 분리 (탭 전환 시 재사용)
    renderFindTab: () => {
        const content = document.getElementById('rival-tab-content');
        if (!content) return;

        content.innerHTML = `
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

        if (typeof lucide !== 'undefined') lucide.createIcons();

        document.getElementById('rival-search-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') Boako.Rival.searchRivals();
        });

        Boako.Rival.searchRivals();
    },

    // 🌟 [신규] "응원하기" 탭: 예정된 라이벌전 목록 + 승자 예측 투표 UI
    renderCheerTab: async () => {
        const content = document.getElementById('rival-tab-content');
        if (!content) return;

        content.innerHTML = `
            <section class="section-card">
                <div class="card-header flex justify-between items-center">
                    <span>📣 응원하고 참여 포인트 받기</span>
                </div>
                <div class="card-body" style="background: #f8fafc; min-height: 300px; padding: 25px;">
                    <p class="text-xs text-slate-500 font-bold mb-4">예정된 라이벌전에서 승리를 예측하고 응원하세요! 결과가 확정되면 적중 여부와 관계없이 전원 참여 포인트가 지급됩니다.</p>
                    <div id="rival-cheer-list" class="flex flex-col gap-3">
                        <div class="text-center py-10 text-slate-400 font-bold text-sm flex flex-col items-center gap-2">
                            <i data-lucide="loader-2" class="w-8 h-8 animate-spin"></i>
                            예정된 라이벌전을 불러오는 중...
                        </div>
                    </div>
                </div>
            </section>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();

        await Boako.Rival.loadCheerMatches();
    },

    loadCheerMatches: async () => {
        const listEl = document.getElementById('rival-cheer-list');
        if (!listEl) return;

        try {
            const nowIso = new Date().toISOString();

            const { data: schedules, error: schErr } = await Boako.db
                .from('match_schedules')
                .select('schedule_id, game_name, scheduled_time, reference_id')
                .eq('source_type', 'RIVAL')
                .gt('scheduled_time', nowIso)
                .order('scheduled_time', { ascending: true });
            if (schErr) throw schErr;

            if (!schedules || schedules.length === 0) {
                listEl.innerHTML = `<div class="text-center py-10 text-slate-400 font-bold text-sm bg-white rounded-xl border border-slate-200">현재 예정된 라이벌전이 없습니다.</div>`;
                return;
            }

            const matchIds = [...new Set(schedules.map(s => s.reference_id).filter(Boolean))];

            const { data: matches } = await Boako.db
                .from('rival_matches')
                .select('match_id, status, challenger_id, defender_id')
                .in('match_id', matchIds)
                .eq('status', 'UPCOMING');

            const matchMap = Object.fromEntries((matches || []).map(m => [m.match_id, m]));

            const playerIds = [...new Set((matches || []).flatMap(m => [m.challenger_id, m.defender_id]))];
            let nameMap = {};
            if (playerIds.length > 0) {
                const { data: profiles } = await Boako.db.from('profiles').select('id, full_name').in('id', playerIds);
                nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]));
            }

            let myVoteMap = {};
            if (Boako.state.user && matchIds.length > 0) {
                const { data: myVotes } = await Boako.db
                    .from('rival_match_votes')
                    .select('match_id, predicted_winner_id')
                    .eq('voter_id', Boako.state.user.id)
                    .in('match_id', matchIds);
                myVoteMap = Object.fromEntries((myVotes || []).map(v => [v.match_id, v.predicted_winner_id]));
            }

            const cards = schedules
                .filter(s => s.reference_id && matchMap[s.reference_id])
                .map(s => {
                    const m = matchMap[s.reference_id];
                    const challengerName = nameMap[m.challenger_id] || '선수1';
                    const defenderName = nameMap[m.defender_id] || '선수2';
                    const isParticipant = Boako.state.user && (Boako.state.user.id === m.challenger_id || Boako.state.user.id === m.defender_id);
                    const myPick = myVoteMap[s.reference_id] || null;
                    const dt = new Date(s.scheduled_time).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

                    let actionHtml;
                    if (!Boako.state.user) {
                        actionHtml = `<div class="text-center text-xs font-bold text-slate-400 py-2">로그인 후 응원에 참여할 수 있어요</div>`;
                    } else if (isParticipant) {
                        actionHtml = `<div class="text-center text-xs font-bold text-slate-400 py-2">당사자는 응원 참여가 불가해요</div>`;
                    } else if (myPick) {
                        const pickedName = myPick === m.challenger_id ? challengerName : defenderName;
                        actionHtml = `
                            <div class="text-center text-xs font-black text-emerald-600 bg-emerald-50 border border-emerald-200 py-2.5 rounded-lg">
                                ✅ ${pickedName} 님 응원 완료! (결과 발표 시 참여 포인트 지급)
                            </div>
                        `;
                    } else {
                        actionHtml = `
                            <div class="flex gap-2">
                                <button onclick="Boako.Rival.castVote('${s.reference_id}', '${m.challenger_id}', this)" class="flex-1 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 text-xs font-black py-2.5 rounded-lg transition-colors">📣 ${challengerName} 응원</button>
                                <button onclick="Boako.Rival.castVote('${s.reference_id}', '${m.defender_id}', this)" class="flex-1 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 text-xs font-black py-2.5 rounded-lg transition-colors">📣 ${defenderName} 응원</button>
                            </div>
                        `;
                    }

                    return `
                        <div class="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-[11px] font-black bg-red-500 text-white px-2 py-1 rounded-md">⚡ 라이벌전</span>
                                <span class="text-[11px] text-slate-400 font-bold">⏰ ${dt}</span>
                            </div>
                            <div class="text-center font-black text-slate-800 text-base mb-1">${s.game_name}</div>
                            <div class="text-center text-sm font-bold text-slate-500 mb-3">${challengerName} VS ${defenderName}</div>
                            ${actionHtml}
                        </div>
                    `;
                });

            listEl.innerHTML = cards.length > 0
                ? cards.join('')
                : `<div class="text-center py-10 text-slate-400 font-bold text-sm bg-white rounded-xl border border-slate-200">현재 예정된 라이벌전이 없습니다.</div>`;

        } catch (err) {
            console.error("응원하기 목록 로드 오류:", err);
            listEl.innerHTML = `<div class="text-center py-10 text-red-500 font-bold text-sm bg-red-50 rounded-xl">목록을 불러오지 못했습니다.</div>`;
        }
    },

    // 🌟 [신규] 승자 예측 투표(응원) 등록. 결과 확정 전까지는 포인트가 지급되지 않고,
    // 매치 완료 시(complete_rival_match) 적중/미적중 여부에 따라 자동으로 지급됨.
    castVote: async (matchId, predictedWinnerId, btnEl) => {
        if (!Boako.state.user) { Boako.Util.toast('로그인 후 이용해주세요.'); return; }
        const wrap = btnEl?.closest('div');
        if (wrap) wrap.querySelectorAll('button').forEach(b => b.disabled = true);

        try {
            const { error } = await Boako.db.rpc('fn_cast_rival_vote', {
                p_match_id: matchId,
                p_predicted_winner_id: predictedWinnerId
            });
            if (error) throw error;

            if (window.sfx) window.sfx.click();
            Boako.Util.toast('📣 응원 참여 완료! 결과 발표 시 포인트가 지급됩니다.');
            await Boako.Rival.loadCheerMatches();
        } catch (err) {
            Boako.Util.toast('❌ ' + (err.message || '투표에 실패했습니다.'));
            if (wrap) wrap.querySelectorAll('button').forEach(b => b.disabled = false);
        }
    },

    searchRivals: async () => {
        const container = document.getElementById('rival-list-container');
        const searchInput = document.getElementById('rival-search-input');
        const searchWord = searchInput ? searchInput.value.trim() : '';
        const myNickname = Boako.state.user.nickname;
        
        container.innerHTML = `<div class="text-center py-10 text-slate-400 font-bold"><i data-lucide="loader-2" class="w-8 h-8 animate-spin mx-auto mb-2"></i>분석 중...</div>`;

        try {
            if (searchWord) {
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

                const logoSrc = match.game_logo_url || 'https://placehold.co/150x150?text=GAME';
                
                // 🌟 혼합 콘텐츠 에러(Mixed Content) 해결: http를 강제로 https로 변환
                const profileSrc = match.rival_profile_url ? match.rival_profile_url.replace('http://', 'https://') : null;
                const myProfileUrl = match.my_profile_url ? match.my_profile_url.replace('http://', 'https://') : null;
                const myProfileInitial = myNickname.charAt(0);

                listHtml += `
                    <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden transition-all duration-200">
                        
                        <div onclick="Boako.Rival.toggleDetail(${index})" class="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors group">
                            <div class="font-black text-slate-800 flex items-center gap-3">
                                <span class="text-slate-300 font-bold w-4 text-center">${index + 1}</span>
                                
                                <div class="w-10 h-8 shrink-0 flex items-center justify-center bg-transparent">
                                    <img src="${Boako.Util.cdn(logoSrc)}" class="w-full h-full object-contain drop-shadow-sm" onerror="this.src='https://placehold.co/150x150?text=GAME'">
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
                                    
                                    <div class="w-24 h-20 mb-3 transform -rotate-3 flex items-center justify-center">
                                        <img src="${Boako.Util.cdn(logoSrc)}" class="w-full h-full object-contain drop-shadow-md" onerror="this.src='https://placehold.co/150x150?text=GAME'">
                                    </div>
                                    
                                    <h3 class="font-black text-2xl text-slate-800 tracking-tight">${match.game_name}</h3>
                                    <p class="text-xs text-slate-400 font-bold mt-1">기록 차이: ${isPerfectMatch ? '0회 (완벽한 동급)' : match.count_diff + '회'}</p>
                                </div>

                                <div class="flex items-center justify-center gap-8 w-full max-w-sm mb-8">
                                    <div class="flex flex-col items-center gap-2 flex-1">
                                        <div class="w-16 h-16 rounded-full bg-slate-200 border-4 border-slate-100 flex items-center justify-center text-slate-500 font-black text-xl shadow-lg relative overflow-visible">
                                            ${myProfileUrl ? `<img src="${Boako.Util.cdn(myProfileUrl)}" class="w-full h-full object-cover rounded-full">` : myProfileInitial}
                                        </div>
                                        <div class="text-sm font-black text-slate-800">${myNickname} (${match.my_record_count}회)</div>
                                    </div>
                                    
                                    <div class="text-3xl font-black text-red-500 italic drop-shadow-md pb-6 shrink-0">VS</div>
                                    
                                    <div class="flex flex-col items-center gap-2 flex-1">
                                        <div class="w-16 h-16 rounded-full bg-slate-200 border-4 ${isPerfectMatch ? 'border-red-400' : 'border-slate-100'} flex items-center justify-center text-slate-500 font-black text-xl shadow-lg relative overflow-visible">
                                            ${profileSrc ? `<img src="${Boako.Util.cdn(profileSrc)}" class="w-full h-full object-cover rounded-full">` : match.rival_nickname.charAt(0)}
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

    toggleDetail: (index) => {
        const detailDiv = document.getElementById(`rival-detail-${index}`);
        const icon = document.getElementById(`rival-icon-${index}`);
        
        if (detailDiv.classList.contains('hidden')) {
            document.querySelectorAll('[id^="rival-detail-"]').forEach(el => el.classList.add('hidden'));
            document.querySelectorAll('[id^="rival-icon-"]').forEach(el => el.style.transform = 'rotate(0deg)');

            detailDiv.classList.remove('hidden');
            icon.style.transform = 'rotate(180deg)';
        } else {
            detailDiv.classList.add('hidden');
            icon.style.transform = 'rotate(0deg)';
        }
    },

    executeChallenge: async (defenderId, gameName) => {
        if (!confirm(`[${gameName}] 종목으로 라이벌 매치 도전장을 보내시겠습니까?`)) return;

        try {
            const { error } = await Boako.db.rpc('send_rival_challenge', {
                p_defender_id: defenderId,
                p_game_name: gameName
            });
            if (error) throw error;

            if (window.sfx) window.sfx.rosterLock();
            Boako.Util.toast("🎉 매치 도전장이 성공적으로 발송되었습니다!");

            // 🌟 팀 리그 외 활동(라이벌전 제안) 성공 시 오늘의 주사위 시도 (하루 1회, 이미 굴렸으면 조용히 무시)
            Boako.Util.tryRollDailyDice();

        } catch (err) {
            console.error(err);
            Boako.Util.toast("❌ 발송 실패: " + (err.message || "이미 진행 중인 매치가 있거나 오류가 발생했습니다."));
        }
    }
};
