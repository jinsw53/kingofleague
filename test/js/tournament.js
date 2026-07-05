/**
 * [TOURNAMENT] 보아코 토너먼트 공지 + 개최 요청 게시판
 */
Boako.Tournament = {
    State: {
        currentTab: 'ANNOUNCEMENT', // 'ANNOUNCEMENT' | 'REQUEST'
        posts: []
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
        const { data, error } = await Boako.db
            .from('tournament_posts')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('토너먼트 게시물 로드 실패:', error);
            Boako.Tournament.State.posts = [];
        } else {
            Boako.Tournament.State.posts = data || [];
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

        if (p.type === 'ANNOUNCEMENT') {
            return `
                <div class="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer" onclick="window.open('${p.source_url}', '_blank')">
                    <div class="flex justify-between items-start mb-2">
                        <h3 class="font-black text-slate-800 text-sm">${p.title}</h3>
                        <span class="text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full shrink-0 ml-2">🔗 바로가기</span>
                    </div>
                    ${p.game_name ? `<div class="text-xs text-slate-500 font-bold mb-1">🎲 ${p.game_name}</div>` : ''}
                    <div class="text-xs text-slate-400 font-bold mb-2">📅 ${dateStr} ${p.max_participants ? `· 최대 ${p.max_participants}명` : ''}</div>
                    <p class="text-xs text-slate-600 whitespace-pre-wrap">${p.content || ''}</p>
                </div>
            `;
        }

        const isFulfilled = p.status === 'FULFILLED';
        return `
            <div class="bg-white border ${isFulfilled ? 'border-slate-200 opacity-70' : 'border-amber-200'} rounded-xl p-4">
                <div class="flex justify-between items-start mb-2">
                    <h3 class="font-black text-slate-800 text-sm">${p.title}</h3>
                    <span class="text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ml-2 ${isFulfilled ? 'text-slate-400 bg-slate-100' : 'text-amber-600 bg-amber-50'}">
                        ${isFulfilled ? '✅ 개설 완료' : '🙋 대기 중'}
                    </span>
                </div>
                ${p.game_name ? `<div class="text-xs text-slate-500 font-bold mb-1">🎲 ${p.game_name}</div>` : ''}
                <div class="text-xs text-slate-400 font-bold mb-2">📅 ${dateStr} ${p.max_participants ? `· 최대 ${p.max_participants}명` : ''}</div>
                <p class="text-xs text-slate-600 whitespace-pre-wrap mb-3">${p.content || ''}</p>
                ${isFulfilled
                    ? `<a href="${p.source_url}" target="_blank" class="text-xs font-bold text-violet-600">🔗 개설된 토너먼트 바로가기</a>`
                    : `<button onclick="Boako.Tournament.openFulfillModal(${p.id}, '${p.title.replace(/'/g, "\\'")}')" class="w-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-black py-2 rounded-lg transition-colors">🎯 제가 개설해드릴게요 (+100P)</button>`
                }
            </div>
        `;
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
                        <div class="mb-3">
                            <label class="text-xs font-bold text-slate-600 block mb-1">종목(게임명)</label>
                            <input type="text" id="tourney-input-game" placeholder="예: 스플렌더" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
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
                        ` : ''}
                        ${isAnnouncement ? `
                        <div class="mb-4">
                            <label class="text-xs font-bold text-slate-600 block mb-1">실제 개설한 토너먼트 링크 (필수)</label>
                            <input type="url" id="tourney-input-url" required placeholder="https://boardgamearena.com/tournament?id=..." class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
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
        const gameName = document.getElementById('tourney-input-game').value.trim() || null;
        const content = document.getElementById('tourney-input-content').value.trim() || null;
        const dateVal = document.getElementById('tourney-input-date').value;
        const scheduledDate = dateVal ? new Date(dateVal).toISOString() : null;
        const maxInput = document.getElementById('tourney-input-max');
        const maxParticipants = maxInput && maxInput.value ? parseInt(maxInput.value) : null;

        try {
            if (type === 'ANNOUNCEMENT') {
                const sourceUrl = document.getElementById('tourney-input-url').value.trim();
                const { error } = await Boako.db.rpc('create_tournament_announcement', {
                    p_title: title, p_game_name: gameName, p_content: content,
                    p_scheduled_date: scheduledDate, p_max_participants: maxParticipants, p_source_url: sourceUrl
                });
                if (error) throw error;
                if (window.sfx) window.sfx.battleStart();
                Boako.Util.toast('🏆 개최 공지가 등록되었습니다! (+50P)');
            } else {
                const { error } = await Boako.db.rpc('create_tournament_request', {
                    p_title: title, p_game_name: gameName, p_content: content,
                    p_scheduled_date: scheduledDate, p_max_participants: maxParticipants
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

    openFulfillModal: (postId, title) => {
        const modalHtml = `
            <div id="tourney-fulfill-modal-overlay" class="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
                <div class="bg-white rounded-2xl w-full max-w-sm p-6">
                    <h3 class="font-black text-lg mb-2">🎯 개최 완료 등록</h3>
                    <p class="text-xs text-slate-500 font-bold mb-4">"${title}" 요청을 대신 개설해주셔서 감사합니다! 실제로 만든 토너먼트 링크를 입력해주세요.</p>
                    <form onsubmit="Boako.Tournament.submitFulfill(event, ${postId})">
                        <input type="url" id="tourney-fulfill-url" required placeholder="https://boardgamearena.com/tournament?id=..." class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4">
                        <div class="flex gap-2">
                            <button type="button" onclick="document.getElementById('tourney-fulfill-modal-overlay').remove()" class="flex-1 bg-slate-100 text-slate-600 font-bold py-3 rounded-xl">취소</button>
                            <button type="submit" class="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-black py-3 rounded-xl transition-colors">등록 (+100P)</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.getElementById('tourney-modal-root').innerHTML = modalHtml;
    },

    submitFulfill: async (e, postId) => {
        e.preventDefault();
        const url = document.getElementById('tourney-fulfill-url').value.trim();

        try {
            const { error } = await Boako.db.rpc('fulfill_tournament_request', { p_post_id: postId, p_source_url: url });
            if (error) throw error;

            if (window.sfx) window.sfx.battleStart();
            Boako.Util.toast('🎉 개최 완료 처리되었습니다! (+100P)');
            document.getElementById('tourney-fulfill-modal-overlay').remove();
            await Boako.Tournament.loadPosts();
        } catch (err) {
            console.error(err);
            Boako.Util.toast('❌ ' + (err.message || '처리에 실패했습니다.'));
        }
    }
};
