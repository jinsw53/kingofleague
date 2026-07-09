/**
 * [TOURNAMENT] 보아코 토너먼트 공지 + 개최 요청 게시판
 */
Boako.Tournament = {
    State: {
        currentTab: 'ANNOUNCEMENT', // 'ANNOUNCEMENT' | 'REQUEST'
        posts: [],
        gameLogoMap: {},
        realtimeChannel: null
    },

    init: async (containerId) => {
        const root = document.getElementById(containerId);
        if (!root) return;

        root.innerHTML = `
            <div class="main-banner" style="background:linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%);">
                <h1>🏆 보아코 토너먼트</h1>
                <p>대회를 열고, 함께하고, 개설을 도와주세요.</p>
            </div>

            <section class="section-card">
                <div class="card-header flex justify-between items-center">
                    <div class="flex gap-2">
                        <button id="tourney-tab-btn-ANNOUNCEMENT" class="tourney-tab-btn bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all" onclick="Boako.Tournament.switchTab('ANNOUNCEMENT')">📢 개최 공지</button>
                        <button id="tourney-tab-btn-REQUEST" class="tourney-tab-btn bg-slate-100 text-slate-500 px-4 py-2 rounded-lg text-sm font-bold transition-all relative" onclick="Boako.Tournament.switchTab('REQUEST')">
                            🙋 개최 요청
                            <span id="tourney-request-badge" class="hidden absolute -top-2 -right-2 bg-rose-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">0</span>
                        </button>
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
        if (writeBtn) {
            writeBtn.textContent = tab === 'ANNOUNCEMENT' ? '+ 공지하기' : '+ 요청하기';
        }

        Boako.Tournament.renderList();
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

        // 🌟 카드에 표시할 게임 로고 조회 (games 테이블과 별도 조인)
        const gameNames = [...new Set(Boako.Tournament.State.posts.map(p => p.game_name).filter(Boolean))];
        if (gameNames.length > 0) {
            const { data: gamesData } = await Boako.db.from('games').select('game_name, image_url').in('game_name', gameNames);
            Boako.Tournament.State.gameLogoMap = Object.fromEntries((gamesData || []).map(g => [g.game_name, g.image_url]));
        } else {
            Boako.Tournament.State.gameLogoMap = {};
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
                    ? `<div class="text-center mt-3 text-[11px] text-slate-400 font-bold">🎯 아레나에서 토너먼트 개최 후, 크롬 확장으로 등록 시 자동으로 매칭됩니다</div>`
                    : `<a href="${p.source_url}" target="_blank" class="block text-center mt-3 text-xs font-bold text-violet-600">🔗 개설된 토너먼트 바로가기</a>`}
            </div>
        `;
    },

    // 🌟 게임 검색 (games 테이블 자동완성)
    searchGames: async (query) => {
        const resultsBox = document.getElementById('tourney-game-search-results');
        if (!resultsBox) return;
        if (!query || query.trim().length === 0) {
            resultsBox.classList.add('hidden');
            resultsBox.innerHTML = '';
            return;
        }

        const { data } = await Boako.db.from('games').select('game_name, image_url').ilike('game_name', `%${query.trim()}%`).limit(8);

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
            }

            document.getElementById('tourney-write-modal-overlay').remove();
            await Boako.Tournament.loadPosts();
        } catch (err) {
            console.error(err);
            Boako.Util.toast('❌ ' + (err.message || '등록에 실패했습니다.'));
        }
    },

    };

// 게임 로고를 못 찾았을 때 대체용 (사이트 전체에서 공용으로 쓰는 기본 로고 URL로 바꿔주세요)
const DEFAULT_LOGO_FALLBACK = 'https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challenge%20(1).png';
