/**
 * [TOURNAMENT] 보아코 토너먼트 공지 + 개최 요청 게시판
 * 🌟 개최 요청(REQUEST) 등록 성공 시 오늘의 주사위 시도 (팀 리그 외 활동, 하루 1회)
 * 🌟 [버그수정] init() 재진입 시 State.currentTab을 항상 'ANNOUNCEMENT'로 리셋.
 *    이전에 REQUEST 탭을 봤던 세션이면 State가 유지되어 버튼 표기(항상 공지가 활성으로 그려짐)와
 *    실제 렌더링 필터링(currentTab 기준)이 어긋나는 문제가 있었음.
 * 🌟 [신규] "🗳️ 추천하기" 탭 — 정기(주간)/월간(스위스) 두 트랙의 다음 회차 예상치를
 *    나란히 보여주고, 아래엔 통합 카드그리드로 투표. 유저는 트랙을 신경 쓸 필요 없음 —
 *    게임 스펙(플레이타임 등)으로 서버가 자동으로 어느 트랙 표인지 판정함.
 *    검색 없을 땐 20개, 검색해서 좁혀지면 60개까지 표시.
 * 🌟 [수정] 개최공지/요청 작성 시 게임 검색에서 베타/알파/협력 게임 제외 — 어차피 서버(RPC)에서
 *    막히지만, 애초에 검색결과에 안 보이게 해서 UX를 개선함.
 * 🌟 [신규] 개최 요청(REQUEST) 카드 — 아직 미개최 상태일 때, 그 게임의 실제 BGA 페이지(games.bga_url)로
 *    바로 갈 수 있는 링크 추가. 요청 보고 바로 가서 열 수 있게.
 */
Boako.Tournament = {
    State: {
        currentTab: 'ANNOUNCEMENT', // 'ANNOUNCEMENT' | 'REQUEST'
        posts: [],
        gameLogoMap: {},
        gameBgaUrlMap: {},
        realtimeChannel: null
    },

    init: async (containerId) => {
        const root = document.getElementById(containerId);
        if (!root) return;

        // 🌟 [버그수정] State는 페이지 재진입시에도 유지되는 전역 객체라, 이전에 REQUEST 탭을 봤었으면
        // currentTab이 그대로 남아있어서 버튼 표기(항상 ANNOUNCEMENT가 활성으로 그려짐)와 실제 필터링이 어긋남.
        // 매번 새로 진입할 때는 무조건 ANNOUNCEMENT부터 시작하도록 명시적으로 리셋.
        Boako.Tournament.State.currentTab = 'ANNOUNCEMENT';

        root.innerHTML = `
            <div class="main-banner" style="background:linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%);">
                <h1>🏆 보아코 토너먼트</h1>
                <p>대회를 열고, 함께하고, 개설을 도와주세요.</p>
            </div>

            <section class="section-card">
                <div class="card-header flex justify-between items-center flex-wrap gap-2">
                    <div class="flex gap-2">
                        <button id="tourney-tab-btn-ANNOUNCEMENT" class="tourney-tab-btn bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all" onclick="Boako.Tournament.switchTab('ANNOUNCEMENT')">📢 개최 공지</button>
                        <button id="tourney-tab-btn-REQUEST" class="tourney-tab-btn bg-slate-100 text-slate-500 px-4 py-2 rounded-lg text-sm font-bold transition-all relative" onclick="Boako.Tournament.switchTab('REQUEST')">
                            🙋 개최 요청
                            <span id="tourney-request-badge" class="hidden absolute -top-2 -right-2 bg-rose-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">0</span>
                        </button>
                        <button id="tourney-tab-btn-VOTE" class="tourney-tab-btn bg-slate-100 text-slate-500 px-4 py-2 rounded-lg text-sm font-bold transition-all" onclick="Boako.Tournament.switchTab('VOTE')">🗳️ 추천하기</button>
                    </div>
                    <button id="tourney-write-btn" class="bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-violet-700 transition-colors" onclick="Boako.Tournament.openWriteModal()">+ 공지하기</button>
                </div>

                <div class="card-body" style="background:#f8fafc; padding:20px;">
                    <div id="tourney-guide-box" class="bg-violet-50 border border-violet-200 rounded-xl p-4 mb-5 text-xs font-bold text-violet-700 leading-relaxed">
                        📋 <b>토너먼트 개설 규칙</b><br>
                        1. 토너먼트 이름에는 반드시 영문 "boako"(대소문자 무관)가 포함되어야 합니다. (기록 추적을 위해 필수)<br>
                        2. 원활한 진행을 위해, 최대 참가 인원은 <b>32명</b>까지만 가능해요.
                    </div>
                    <div id="tourney-list-container" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="col-span-full text-center py-16 text-slate-400 font-bold">불러오는 중...</div>
                    </div>
                    <div id="tourney-vote-container" class="hidden"></div>
                </div>
            </section>

            <div id="tourney-modal-root"></div>
        `;

        await Boako.Tournament.loadPosts();
        Boako.Tournament.subscribeRealtime();
    },

    // 🌟 실시간 구독 — 양쪽 탭 다 실시간 반영
    subscribeRealtime: () => {
        if (Boako.Tournament.State.realtimeChannel) return; // 이미 구독 중이면 중복 방지
        Boako.Tournament.State.realtimeChannel = Boako.db
            .channel('tournament-posts-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_posts' }, () => {
                Boako.Tournament.loadPosts();
            })
            .subscribe();
    },

    switchTab: (tab) => {
        Boako.Tournament.State.currentTab = tab;
        document.querySelectorAll('.tourney-tab-btn').forEach(btn => {
            btn.classList.remove('bg-slate-800', 'text-white');
            btn.classList.add('bg-slate-100', 'text-slate-500');
        });
        const activeBtn = document.getElementById(`tourney-tab-btn-${tab}`);
        if (activeBtn) {
            activeBtn.classList.remove('bg-slate-100', 'text-slate-500');
            activeBtn.classList.add('bg-slate-800', 'text-white');
        }

        const writeBtn = document.getElementById('tourney-write-btn');
        const guideBox = document.getElementById('tourney-guide-box');
        const listContainer = document.getElementById('tourney-list-container');
        const voteContainer = document.getElementById('tourney-vote-container');

        if (tab === 'VOTE') {
            if (writeBtn) writeBtn.classList.add('hidden');
            if (guideBox) guideBox.classList.add('hidden');
            if (listContainer) listContainer.classList.add('hidden');
            if (voteContainer) voteContainer.classList.remove('hidden');
            Boako.Tournament.Vote.init();
        } else {
            if (writeBtn) {
                writeBtn.classList.remove('hidden');
                writeBtn.textContent = tab === 'ANNOUNCEMENT' ? '+ 공지하기' : '+ 요청하기';
            }
            if (guideBox) guideBox.classList.remove('hidden');
            if (listContainer) listContainer.classList.remove('hidden');
            if (voteContainer) voteContainer.classList.add('hidden');
            Boako.Tournament.renderList();
        }
    },

    loadPosts: async () => {
        const nowIso = new Date().toISOString();
        const { data, error } = await Boako.db
            .from('tournament_posts')
            .select('*')
            .or(`scheduled_date.is.null,scheduled_date.gte.${nowIso}`)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('토너먼트 게시물 로드 실패:', error);
            Boako.Tournament.State.posts = [];
        } else {
            Boako.Tournament.State.posts = data || [];
        }

        // 🌟 카드에 표시할 게임 로고 + BGA 페이지 URL 조회 (games 테이블과 별도 조인)
        const gameNames = [...new Set(Boako.Tournament.State.posts.map(p => p.game_name).filter(Boolean))];
        if (gameNames.length > 0) {
            const { data: gamesData } = await Boako.db.from('games').select('game_name, image_url, bga_url').in('game_name', gameNames);
            Boako.Tournament.State.gameLogoMap = Object.fromEntries((gamesData || []).map(g => [g.game_name, g.image_url]));
            Boako.Tournament.State.gameBgaUrlMap = Object.fromEntries((gamesData || []).map(g => [g.game_name, g.bga_url]));
        } else {
            Boako.Tournament.State.gameLogoMap = {};
            Boako.Tournament.State.gameBgaUrlMap = {};
        }

        const openRequestCount = Boako.Tournament.State.posts.filter(p => p.type === 'REQUEST' && p.status === 'OPEN').length;
        const badge = document.getElementById('tourney-request-badge');
        if (badge) {
            if (openRequestCount > 0) {
                badge.textContent = openRequestCount;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }

        Boako.Tournament.renderList();
    },

    renderList: () => {
        const container = document.getElementById('tourney-list-container');
        if (!container) return;

        const posts = Boako.Tournament.State.posts.filter(p => p.type === Boako.Tournament.State.currentTab);

        if (posts.length === 0) {
            container.innerHTML = `<div class="col-span-full text-center py-16 text-slate-400 font-bold border border-dashed border-slate-300 rounded-xl bg-white">
                ${Boako.Tournament.State.currentTab === 'ANNOUNCEMENT' ? '아직 개최 공지가 없습니다.' : '아직 개최 요청이 없습니다.'}
            </div>`;
            return;
        }

        container.innerHTML = posts.map(p => Boako.Tournament.renderCard(p)).join('');
    },

    renderCard: (p) => {
        const dateStr = p.scheduled_date
            ? new Date(p.scheduled_date).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            : '일정 미정';
        const gameLogo = Boako.Tournament.State.gameLogoMap[p.game_name] || DEFAULT_LOGO_FALLBACK;

        if (p.type === 'ANNOUNCEMENT') {
            return `
                <div class="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer" onclick="window.open('${p.source_url}', '_blank')">
                    <div class="flex items-center gap-3">
                        <div class="flex flex-col items-center shrink-0" style="width:52px;">
                            <img src="${Boako.Util.cdn(gameLogo)}" class="w-12 h-12 rounded-lg object-contain bg-slate-50 border border-slate-100 p-1">
                            <div class="text-[9px] font-bold text-slate-500 text-center mt-1 truncate w-full">${p.game_name || '종목 미정'}</div>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="text-base font-black text-violet-700">📅 ${dateStr}</div>
                            <div class="text-[11px] text-slate-400 truncate">${p.title}</div>
                        </div>
                        <span class="text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full shrink-0">🔗</span>
                    </div>
                    ${p.max_participants ? `<div class="text-[11px] text-slate-400 font-bold mt-2">👥 최대 ${p.max_participants}명</div>` : ''}
                </div>
            `;
        }

        // REQUEST 카드 — 내용(요청사항)을 더 신경써서 눈에 띄게
        const isFulfilled = p.status === 'FULFILLED';
        const gameBgaUrl = Boako.Tournament.State.gameBgaUrlMap[p.game_name];
        return `
            <div class="bg-white border ${isFulfilled ? 'border-slate-200 opacity-70' : 'border-amber-200'} rounded-xl p-4">
                <div class="flex items-center gap-3 mb-3">
                    <div class="flex flex-col items-center shrink-0" style="width:52px;">
                        <img src="${Boako.Util.cdn(gameLogo)}" class="w-12 h-12 rounded-lg object-contain bg-slate-50 border border-slate-100 p-1">
                        <div class="text-[9px] font-bold text-slate-500 text-center mt-1 truncate w-full">${p.game_name || '종목 미정'}</div>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="text-base font-black text-amber-700">📅 ${dateStr}</div>
                        <div class="text-[11px] text-slate-400 truncate">${p.title}</div>
                    </div>
                    <span class="text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${isFulfilled ? 'text-slate-400 bg-slate-100' : 'text-amber-600 bg-amber-50'}">
                        ${isFulfilled ? '✅ 완료' : '🙋 대기'}
                    </span>
                </div>
                ${p.content ? `<div class="bg-amber-50/60 border border-amber-100 rounded-lg p-3 mb-3"><p class="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">${p.content}</p></div>` : ''}
                <div class="flex items-center justify-between">
                    ${p.max_participants ? `<span class="text-[11px] text-slate-400 font-bold">👥 희망 인원 ${p.max_participants}명</span>` : '<span></span>'}
                </div>
                ${!isFulfilled
                    ? (gameBgaUrl
                        ? `<a href="${gameBgaUrl}" target="_blank" class="block text-center mt-3 text-xs font-black text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg py-2 transition-colors">🎮 이 게임 아레나 페이지 열기 → 개최 후 크롬 확장으로 등록 시 자동 매칭</a>`
                        : `<div class="text-center mt-3 text-[11px] text-slate-400 font-bold">🎯 아레나에서 토너먼트 개최 후, 크롬 확장으로 등록 시 자동으로 매칭됩니다</div>`)
                    : `<a href="${p.source_url}" target="_blank" class="block text-center mt-3 text-xs font-bold text-violet-600">🔗 개설된 토너먼트 바로가기</a>`}
            </div>
        `;
    },

    // 🌟 게임 검색 (games 테이블 자동완성) — 베타/알파/협력 게임은 검색결과에서 아예 제외
    searchGames: async (query) => {
        const resultsBox = document.getElementById('tourney-game-search-results');
        if (!resultsBox) return;
        if (!query || query.trim().length === 0) {
            resultsBox.classList.add('hidden');
            resultsBox.innerHTML = '';
            return;
        }

        const { data } = await Boako.db.from('games').select('game_name, image_url')
            .ilike('game_name', `%${query.trim()}%`)
            .eq('game_status', 'NORMAL')
            .eq('is_cooperative', false)
            .limit(8);

        if (!data || data.length === 0) {
            resultsBox.innerHTML = `<div class="p-3 text-xs text-slate-400 font-bold">검색 결과가 없습니다.</div>`;
            resultsBox.classList.remove('hidden');
            return;
        }

        resultsBox.innerHTML = data.map(g => `
            <div class="flex items-center gap-2 p-2 hover:bg-violet-50 cursor-pointer transition-colors" onclick="Boako.Tournament.selectGame('${g.game_name.replace(/'/g, "\\'")}', '${(g.image_url || '').replace(/'/g, "\\'")}')">
                <img src="${Boako.Util.cdn(g.image_url || DEFAULT_LOGO_FALLBACK)}" class="w-6 h-6 rounded object-contain bg-slate-50 border border-slate-100">
                <span class="text-xs font-bold text-slate-700">${g.game_name}</span>
            </div>
        `).join('');
        resultsBox.classList.remove('hidden');
    },

    selectGame: (name, logo) => {
        const input = document.getElementById('tourney-input-game-search');
        if (!input) return;
        input.value = name;
        input.dataset.logo = logo;
        const resultsBox = document.getElementById('tourney-game-search-results');
        if (resultsBox) resultsBox.classList.add('hidden');
    },

    openWriteModal: () => {
        const isAnnouncement = Boako.Tournament.State.currentTab === 'ANNOUNCEMENT';
        const modalHtml = `
            <div id="tourney-write-modal-overlay" class="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
                <div class="bg-white rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="font-black text-lg">${isAnnouncement ? '📢 개최 공지 작성' : '🙋 개최 요청 작성'}</h3>
                        <button onclick="document.getElementById('tourney-write-modal-overlay').remove()" class="text-slate-400 font-black text-xl">×</button>
                    </div>

                    <div class="bg-violet-50 border border-violet-200 rounded-lg p-3 mb-4 text-[11px] font-bold text-violet-700">
                        ⚠️ 제목엔 영문 "boako"(대소문자 무관)가 꼭 들어가야 해요. 원활한 진행을 위해 최대 참가 인원은 32명까지만 가능해요.
                    </div>

                    <form onsubmit="Boako.Tournament.submitPost(event, '${isAnnouncement ? 'ANNOUNCEMENT' : 'REQUEST'}')">
                        <div class="mb-3">
                            <label class="text-xs font-bold text-slate-600 block mb-1">제목 (boako 포함 필수)</label>
                            <input type="text" id="tourney-input-title" required placeholder="예: BOAKO 스플렌더 토너먼트" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                        </div>
                        <div class="mb-3 relative">
                            <label class="text-xs font-bold text-slate-600 block mb-1">종목(게임) 검색</label>
                            <input type="text" id="tourney-input-game-search" autocomplete="off" placeholder="게임명을 입력해 검색하세요" oninput="Boako.Tournament.searchGames(this.value)" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                            <div id="tourney-game-search-results" class="hidden absolute z-10 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto"></div>
                        </div>
                        <div class="mb-3">
                            <label class="text-xs font-bold text-slate-600 block mb-1">설명</label>
                            <textarea id="tourney-input-content" rows="3" placeholder="대회 규칙, 참가 조건 등을 적어주세요" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"></textarea>
                        </div>
                        <div class="mb-3">
                            <label class="text-xs font-bold text-slate-600 block mb-1">예정 일시 (선택)</label>
                            <input type="datetime-local" id="tourney-input-date" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                        </div>
                        ${!isAnnouncement ? `
                        <div class="mb-3">
                            <label class="text-xs font-bold text-slate-600 block mb-1">희망 최대 참가 인원 (32명 이하)</label>
                            <input type="number" id="tourney-input-max" min="1" max="32" placeholder="예: 16" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                        </div>
                        <div class="mb-4 flex items-center gap-2">
                            <input type="checkbox" id="tourney-input-convert" checked class="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500">
                            <label for="tourney-input-convert" class="text-xs font-bold text-slate-600">개설 완료되면 "개최 공지" 게시판에도 공개하기</label>
                        </div>
                        ` : ''}
                        ${isAnnouncement ? `
                        <div class="mb-4">
                            <label class="text-xs font-bold text-slate-600 block mb-1">실제 개설한 토너먼트 링크 (필수)</label>
                            <input type="url" id="tourney-input-url" required placeholder="https://boardgamearena.com/tournament?id=..." class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                            <p class="text-[10px] text-slate-400 font-bold mt-1">⚠️ boardgamearena.com 도메인의 실제 토너먼트 링크만 등록 가능합니다.</p>
                        </div>
                        ` : ''}
                        <button type="submit" class="w-full bg-violet-600 hover:bg-violet-700 text-white font-black py-3 rounded-xl transition-colors">
                            ${isAnnouncement ? '개최 공지 올리기 (+50P)' : '개최 요청 올리기'}
                        </button>
                    </form>
                </div>
            </div>
        `;
        document.getElementById('tourney-modal-root').innerHTML = modalHtml;
    },

    submitPost: async (e, type) => {
        e.preventDefault();

        const title = document.getElementById('tourney-input-title').value.trim();
        const gameName = document.getElementById('tourney-input-game-search').value.trim() || null;
        const content = document.getElementById('tourney-input-content').value.trim() || null;
        const dateVal = document.getElementById('tourney-input-date').value;
        const scheduledDate = dateVal ? new Date(dateVal).toISOString() : null;
        const maxInput = document.getElementById('tourney-input-max');
        const maxParticipants = maxInput && maxInput.value ? parseInt(maxInput.value) : null;

        try {
            if (type === 'ANNOUNCEMENT') {
                const sourceUrl = document.getElementById('tourney-input-url').value.trim();
                if (!/^https?:\/\/(www\.)?boardgamearena\.com\//i.test(sourceUrl)) {
                    Boako.Util.toast('❌ 보드게임아레나(BGA)에서 실제로 개설한 토너먼트 링크를 입력해주세요.');
                    return;
                }
                const { error } = await Boako.db.rpc('create_tournament_announcement', {
                    p_title: title, p_game_name: gameName, p_content: content,
                    p_scheduled_date: scheduledDate, p_max_participants: maxParticipants, p_source_url: sourceUrl
                });
                if (error) throw error;
                if (window.sfx) window.sfx.battleStart();
                Boako.Util.toast('🏆 개최 공지가 등록되었습니다! (+50P)');
            } else {
                const convertInput = document.getElementById('tourney-input-convert');
                const convertToAnnouncement = convertInput ? convertInput.checked : true;
                const { error } = await Boako.db.rpc('create_tournament_request', {
                    p_title: title, p_game_name: gameName, p_content: content,
                    p_scheduled_date: scheduledDate, p_max_participants: maxParticipants,
                    p_convert_to_announcement: convertToAnnouncement
                });
                if (error) throw error;
                Boako.Util.toast('🙋 개최 요청이 등록되었습니다!');

                // 🌟 팀 리그 외 활동(토너먼트 개최 신청) 성공 시 오늘의 주사위 시도 (하루 1회, 이미 굴렸으면 조용히 무시)
                Boako.Util.tryRollDailyDice();
            }

            document.getElementById('tourney-write-modal-overlay').remove();
            await Boako.Tournament.loadPosts();
        } catch (err) {
            console.error(err);
            Boako.Util.toast('❌ ' + (err.message || '등록에 실패했습니다.'));
        }
    },

    };

// 🌟 [신규] 추천(투표) 탭 — 주간/월간 예상치 프리뷰 2개 + 통합 검색형 카드그리드 투표
// 유저는 트랙(주간/월간)을 신경 쓸 필요 없음 — 게임 자체 스펙(플레이타임 등)으로 서버가 자동 판정.
Boako.Tournament.Vote = {
    searchDebounceTimer: null,

    init: async () => {
        const root = document.getElementById('tourney-vote-container');
        if (!root) return;
        root.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                <div id="tourney-vote-preview-weekly"><div class="text-center py-8 text-slate-400 font-bold text-sm">예상치 계산 중...</div></div>
                <div id="tourney-vote-preview-monthly"><div class="text-center py-8 text-slate-400 font-bold text-sm">예상치 계산 중...</div></div>
            </div>
            <div class="bg-white border border-slate-200 rounded-xl p-4">
                <div class="relative mb-4">
                    <input type="text" id="tourney-vote-search" placeholder="게임 이름으로 검색해서 투표하세요 (정기·월간 통합)" autocomplete="off"
                        class="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 text-sm font-bold focus:outline-none focus:border-violet-500"
                        oninput="Boako.Tournament.Vote.onSearchInput(this.value)">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
                </div>
                <div id="tourney-vote-grid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    <div class="col-span-full text-center py-10 text-slate-400 font-bold">불러오는 중...</div>
                </div>
            </div>
        `;

        await Boako.Tournament.Vote.loadPreview();
        await Boako.Tournament.Vote.loadGrid('');
    },

    // 🌟 주간/월간 각각의 다음 회차 예상치 — 확정이 아니라 "지금 시점 기준 예상"임을 명확히 안내
    loadPreview: async () => {
        await Promise.all([
            Boako.Tournament.Vote.loadPreviewFor('WEEKLY', 'tourney-vote-preview-weekly', '🏅 다음 정기(주간) 예상', 'violet'),
            Boako.Tournament.Vote.loadPreviewFor('MONTHLY', 'tourney-vote-preview-monthly', '🧩 다음 월간(스위스) 예상', 'indigo')
        ]);
    },

    loadPreviewFor: async (track, containerId, label, colorName) => {
        const previewBox = document.getElementById(containerId);
        if (!previewBox) return;

        const { data: nextSlot } = await Boako.db
            .from('tournament_rotation_slots')
            .select('round_no, scheduled_date')
            .eq('status', 'PENDING')
            .eq('track', track)
            .order('scheduled_date', { ascending: true })
            .limit(1)
            .maybeSingle();

        const { data: candidates, error } = await Boako.db.rpc('fn_get_tournament_rotation_preview', { p_limit: 4, p_track: track });

        if (error || !candidates || candidates.length === 0) {
            previewBox.innerHTML = `<div class="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-center text-slate-400 font-bold text-sm">${label}: 예상치를 불러오지 못했습니다.</div>`;
            return;
        }

        const dateLabel = nextSlot
            ? new Date(nextSlot.scheduled_date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }) + ` (${nextSlot.round_no}회차)`
            : '다음 회차';

        const maxProb = Math.max(...candidates.map(c => Number(c.probability)));
        const gradientClass = colorName === 'violet' ? 'from-violet-600 to-indigo-700' : 'from-indigo-600 to-blue-700';

        previewBox.innerHTML = `
            <div class="bg-gradient-to-br ${gradientClass} rounded-2xl p-5 text-white shadow-lg h-full">
                <div class="text-[11px] font-black opacity-80 mb-1">${label} · ${dateLabel}</div>
                <div class="flex flex-col gap-2 mt-3">
                    ${candidates.map((c, idx) => {
                        const pct = Math.round(Number(c.probability) * 1000) / 10;
                        const barWidth = maxProb > 0 ? Math.round((Number(c.probability) / maxProb) * 100) : 0;
                        return `
                        <div class="flex items-center gap-3">
                            <span class="text-xs font-black w-4 opacity-70">${idx + 1}</span>
                            <img src="${Boako.Util.cdn(c.image_url) || DEFAULT_LOGO_FALLBACK}" class="w-8 h-8 rounded-lg object-contain bg-white/10 border border-white/20 p-0.5 shrink-0">
                            <div class="flex-1 min-w-0">
                                <div class="flex justify-between items-center text-xs font-bold mb-1">
                                    <span class="truncate">${c.game_name}</span>
                                    <span class="opacity-80 shrink-0 ml-2">${pct}%</span>
                                </div>
                                <div class="h-1.5 bg-white/20 rounded-full overflow-hidden">
                                    <div class="h-full bg-white rounded-full" style="width:${barWidth}%;"></div>
                                </div>
                            </div>
                        </div>
                    `;}).join('')}
                </div>
                <div class="text-[10px] font-bold opacity-70 mt-4">⚠️ 확정 아님 · 매일 바뀔 수 있어요. 아래에서 투표하면 순위를 뒤집을 수 있습니다!</div>
            </div>
        `;
    },

    onSearchInput: (value) => {
        clearTimeout(Boako.Tournament.Vote.searchDebounceTimer);
        Boako.Tournament.Vote.searchDebounceTimer = setTimeout(() => {
            Boako.Tournament.Vote.loadGrid(value.trim());
        }, 250);
    },

    // 🌟 [수정] 트랙 구분 없이 통합 조회 — 주간 후보(30분 이하)와 월간 후보(30분 초과)가 같이 나옴
    loadGrid: async (search) => {
        const grid = document.getElementById('tourney-vote-grid');
        if (!grid) return;

        if (!Boako.state.user) {
            grid.innerHTML = `<div class="col-span-full text-center py-10 text-slate-400 font-bold text-sm">🔒 투표하려면 로그인이 필요합니다.</div>`;
            return;
        }

        const { data, error } = await Boako.db.rpc('fn_get_tournament_vote_candidates', { p_search: search || null });

        if (error) {
            grid.innerHTML = `<div class="col-span-full text-center py-10 text-rose-400 font-bold text-sm">목록을 불러오지 못했습니다.</div>`;
            return;
        }
        if (!data || data.length === 0) {
            grid.innerHTML = `<div class="col-span-full text-center py-10 text-slate-400 font-bold text-sm">검색 결과가 없습니다.</div>`;
            return;
        }

        // 표가 많이 쌓인 순으로 정렬해서 보여주면 "지금 뜨는 게임"이 눈에 잘 띔
        const sorted = [...data].sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0));
        // 🌟 검색 없을 땐 너무 많이 쏟아지지 않게 20개로 제한, 검색해서 좁혀진 경우엔 60개까지
        const displayLimit = search ? 60 : 20;

        grid.innerHTML = sorted.slice(0, displayLimit).map(g => `
            <div onclick="Boako.Tournament.Vote.vote('${g.game_id}', this)" class="relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 border-slate-200 bg-white hover:border-violet-400 hover:shadow-md cursor-pointer transition-all">
                ${g.vote_count > 0 ? `<span class="absolute -top-1.5 -right-1.5 bg-violet-600 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-sm">${g.vote_count}</span>` : ''}
                <img src="${Boako.Util.cdn(g.image_url) || DEFAULT_LOGO_FALLBACK}" class="w-12 h-12 rounded-lg object-contain bg-slate-50 border border-slate-100 p-1">
                <span class="text-[11px] font-black text-slate-700 text-center leading-tight">${g.game_name}</span>
                <span class="text-[9px] font-bold ${g.playtime > 30 ? 'text-indigo-400' : 'text-violet-400'}">${g.playtime > 30 ? '🧩 월간' : '🏅 정기'} · ${g.playtime}분</span>
            </div>
        `).join('');
    },

    // 🌟 [수정] track 파라미터 불필요 — 서버가 게임 스펙 보고 자동으로 어느 트랙 표인지 판정해서 처리함
    vote: async (gameId, cardEl) => {
        try {
            const { data, error } = await Boako.db.rpc('fn_vote_tournament_game', { p_game_id: gameId });
            if (error) throw error;

            if (window.sfx) window.sfx.click();
            Boako.Util.toast(`🗳️ "${data.game_name}"에 투표했어요!`);

            // 카드는 바로 화면에서 제거 (본인 화면에서만 사라지는 것 — 다른 유저 화면엔 계속 보임)
            if (cardEl) {
                cardEl.style.transition = 'opacity 0.2s, transform 0.2s';
                cardEl.style.opacity = '0';
                cardEl.style.transform = 'scale(0.9)';
                setTimeout(() => cardEl.remove(), 200);
            }

            await Boako.Tournament.Vote.loadPreview();
        } catch (err) {
            console.error(err);
            Boako.Util.toast('❌ ' + (err.message || '투표에 실패했습니다.'));
        }
    }
};

// 게임 로고를 못 찾았을 때 대체용 (사이트 전체에서 공용으로 쓰는 기본 로고 URL로 바꿔주세요)
const DEFAULT_LOGO_FALLBACK = 'https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challenge%20(1).png';
