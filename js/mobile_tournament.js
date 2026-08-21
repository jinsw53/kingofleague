/**
 * [MOBILE TOURNAMENT] 모바일 전용 — 토너먼트(개최 공지/개최 요청/추천 투표) 화면
 * 🌟 [신규] PC js/tournament.js의 모든 기능(loadPosts/renderCard/openWriteModal/submitPost/
 *    Vote.loadPreview/Vote.loadGrid/Vote.vote)과 완전히 동일한 데이터 조회·RPC 호출을 그대로
 *    재사용하되, 화면 마크업만 모바일 전용(세로 카드 목록 + 풀스크린 작성 폼)으로 새로 작성.
 *    "모바일이라 이 기능은 빠짐"이 없도록 PC와 기능 100% 동등하게 맞추는 것이 목표.
 * 🌟 DEFAULT_LOGO_FALLBACK — PC tournament.js 맨 아래 전역 상수와 동일한 값을 그대로 복사해서 사용.
 * 🌟 Boako.Util.tryRollDailyDice()/showDiceRollOverlay()는 자기 완결형 오버레이라 PC와 완전히 동일하게 재사용.
 */
window.Boako = window.Boako || {};
Boako.MobileTournament = {

    DEFAULT_LOGO_FALLBACK: 'https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challenge%20(1).png',

    State: {
        currentTab: 'ANNOUNCEMENT', // 'ANNOUNCEMENT' | 'REQUEST' | 'VOTE'
        posts: [],
        gameLogoMap: {},
        gameBgaUrlMap: {},
        realtimeChannel: null,
        selectedGameName: null // 작성 모달에서 게임 검색으로 고른 게임명
    },

    render: async (container) => {
        Boako.MobileTournament.State.currentTab = 'ANNOUNCEMENT'; // 재진입 시 항상 공지 탭부터 (PC와 동일 원칙)
        container.innerHTML = `<div style="padding:40px 0; text-align:center; color:#94a3b8; font-weight:700; font-size:13px;">불러오는 중...</div>`;
        await Boako.MobileTournament.loadPosts(container);
        Boako.MobileTournament.subscribeRealtime(container);
    },

    subscribeRealtime: (container) => {
        if (Boako.MobileTournament.State.realtimeChannel) return;
        Boako.MobileTournament.State.realtimeChannel = Boako.db
            .channel('mobile-tournament-posts-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_posts' }, () => {
                if (Boako.MobileTournament.State.currentTab !== 'VOTE') Boako.MobileTournament.loadPosts(container);
            })
            .subscribe();
    },

    loadPosts: async (container) => {
        try {
            const nowIso = new Date().toISOString();
            const { data, error } = await Boako.db
                .from('tournament_posts')
                .select('*')
                .or(`scheduled_date.is.null,scheduled_date.gte.${nowIso}`)
                .order('scheduled_date', { ascending: true, nullsFirst: false })
                .order('created_at', { ascending: false });
            if (error) throw error;
            Boako.MobileTournament.State.posts = data || [];

            const gameNames = [...new Set(Boako.MobileTournament.State.posts.map(p => p.game_name).filter(Boolean))];
            if (gameNames.length > 0) {
                const { data: gamesData } = await Boako.db.from('games').select('game_name, image_url, bga_url').in('game_name', gameNames);
                Boako.MobileTournament.State.gameLogoMap = Object.fromEntries((gamesData || []).map(g => [g.game_name, g.image_url]));
                Boako.MobileTournament.State.gameBgaUrlMap = Object.fromEntries((gamesData || []).map(g => [g.game_name, g.bga_url]));
            } else {
                Boako.MobileTournament.State.gameLogoMap = {};
                Boako.MobileTournament.State.gameBgaUrlMap = {};
            }

            Boako.MobileTournament.draw(container);
        } catch (e) {
            console.error('모바일 토너먼트 로드 실패:', e);
            container.innerHTML = `<div style="padding:40px 16px; text-align:center; color:#ef4444; font-weight:700; font-size:13px;">불러오지 못했습니다.</div>`;
        }
    },

    switchTab: (tab, container) => {
        Boako.MobileTournament.State.currentTab = tab;
        Boako.MobileTournament.draw(container);
    },

    draw: (container) => {
        const { currentTab, posts } = Boako.MobileTournament.State;
        const requestOpenCount = posts.filter(p => p.type === 'REQUEST' && p.status === 'OPEN').length;

        const tabBtn = (tab, label) => {
            const isActive = currentTab === tab;
            return `
                <button onclick="Boako.MobileTournament.switchTab('${tab}', document.getElementById('mobile-content-area'))" style="flex:1; position:relative; padding:9px 0; border-radius:9px; font-size:11.5px; font-weight:900; background:${isActive ? '#1e293b' : '#f1f5f9'}; color:${isActive ? '#fff' : '#64748b'};">
                    ${label}
                    ${tab === 'REQUEST' && requestOpenCount > 0 ? `<span style="position:absolute; top:-5px; right:2px; background:#ef4444; color:#fff; font-size:10px; font-weight:900; min-width:16px; height:16px; border-radius:999px; display:inline-flex; align-items:center; justify-content:center; padding:0 3px;">${requestOpenCount}</span>` : ''}
                </button>
            `;
        };

        const writeBtnHtml = currentTab !== 'VOTE'
            ? `<button onclick="Boako.MobileTournament.openWriteModal()" style="width:100%; background:#7c3aed; color:#fff; font-weight:900; font-size:12.5px; padding:10px; border-radius:10px; margin-bottom:10px;">+ ${currentTab === 'ANNOUNCEMENT' ? '공지하기' : '요청하기'}</button>`
            : '';

        container.innerHTML = `
            <div style="display:flex; gap:6px; margin-bottom:10px;">
                ${tabBtn('ANNOUNCEMENT', '📢 개최 공지')}
                ${tabBtn('REQUEST', '🙋 개최 요청')}
                ${tabBtn('VOTE', '🗳️ 추천하기')}
            </div>
            ${writeBtnHtml}
            <div id="mobile-tourney-content"></div>
            <div id="mobile-tourney-modal-root"></div>
        `;

        if (currentTab === 'VOTE') {
            Boako.MobileTournament.Vote.init();
        } else {
            Boako.MobileTournament.renderList();
        }
    },

    renderList: () => {
        const wrap = document.getElementById('mobile-tourney-content');
        if (!wrap) return;
        const { currentTab, posts } = Boako.MobileTournament.State;
        const filtered = posts.filter(p => p.type === currentTab);

        wrap.innerHTML = filtered.length === 0
            ? `<div style="padding:32px 16px; text-align:center; color:#94a3b8; font-weight:700; font-size:13px; border:1px dashed #e2e8f0; border-radius:12px; background:#fff;">${currentTab === 'ANNOUNCEMENT' ? '아직 개최 공지가 없습니다.' : '아직 개최 요청이 없습니다.'}</div>`
            : `<div style="display:flex; flex-direction:column; gap:10px;">${filtered.map(p => Boako.MobileTournament.renderCard(p)).join('')}</div>`;
    },

    renderCard: (p) => {
        const dateStr = p.scheduled_date
            ? new Date(p.scheduled_date).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            : '일정 미정';
        const gameLogo = Boako.MobileTournament.State.gameLogoMap[p.game_name] || Boako.MobileTournament.DEFAULT_LOGO_FALLBACK;

        if (p.type === 'ANNOUNCEMENT') {
            return `
                <div onclick="window.open('${p.source_url}', '_blank')" style="background:#fff; border:1px solid #e2e8f0; border-radius:14px; padding:14px; cursor:pointer;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="${Boako.Util.cdn(gameLogo)}" style="width:44px; height:44px; border-radius:10px; object-fit:contain; background:#f8fafc; border:1px solid #f1f5f9; padding:4px; flex-shrink:0;">
                        <div style="flex:1; min-width:0;">
                            <div style="font-size:14px; font-weight:900; color:#6d28d9;">📅 ${dateStr}</div>
                            <div style="font-size:11px; color:#94a3b8; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${Boako.MobileTournament.escapeHtml(p.title)}</div>
                        </div>
                        <span style="font-size:11px; font-weight:900; color:#7c3aed; background:#f5f3ff; padding:3px 8px; border-radius:999px; flex-shrink:0;">🔗</span>
                    </div>
                    ${p.max_participants ? `<div style="font-size:11px; color:#94a3b8; font-weight:700; margin-top:8px;">👥 최대 ${p.max_participants}명</div>` : ''}
                </div>
            `;
        }

        const isFulfilled = p.status === 'FULFILLED';
        const gameBgaUrl = Boako.MobileTournament.State.gameBgaUrlMap[p.game_name];
        return `
            <div style="background:#fff; border:1px solid ${isFulfilled ? '#e2e8f0' : '#fde68a'}; opacity:${isFulfilled ? '0.7' : '1'}; border-radius:14px; padding:14px;">
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                    <img src="${Boako.Util.cdn(gameLogo)}" style="width:44px; height:44px; border-radius:10px; object-fit:contain; background:#f8fafc; border:1px solid #f1f5f9; padding:4px; flex-shrink:0;">
                    <div style="flex:1; min-width:0;">
                        <div style="font-size:14px; font-weight:900; color:#b45309;">📅 ${dateStr}</div>
                        <div style="font-size:11px; color:#94a3b8; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${Boako.MobileTournament.escapeHtml(p.title)}</div>
                    </div>
                    <span style="font-size:10.5px; font-weight:900; padding:3px 8px; border-radius:999px; flex-shrink:0; ${isFulfilled ? 'color:#94a3b8; background:#f1f5f9;' : 'color:#d97706; background:#fffbeb;'}">
                        ${isFulfilled ? '✅ 완료' : '🙋 대기'}
                    </span>
                </div>
                ${p.content ? `<div style="background:rgba(251,191,36,0.08); border:1px solid #fde68a; border-radius:10px; padding:10px; margin-bottom:10px;"><p style="font-size:12.5px; color:#334155; white-space:pre-wrap; line-height:1.55;">${Boako.MobileTournament.escapeHtml(p.content)}</p></div>` : ''}
                ${p.max_participants ? `<div style="font-size:11px; color:#94a3b8; font-weight:700;">👥 희망 인원 ${p.max_participants}명</div>` : ''}
                ${!isFulfilled
                    ? (gameBgaUrl
                        ? `<a href="${gameBgaUrl}" target="_blank" style="display:block; text-align:center; margin-top:10px; font-size:11.5px; font-weight:900; color:#d97706; background:#fffbeb; border-radius:10px; padding:9px;">🎮 이 게임 아레나 페이지 열기</a>`
                        : `<div style="text-align:center; margin-top:10px; font-size:10.5px; color:#94a3b8; font-weight:700;">🎯 아레나에서 개최 후 확장으로 등록 시 자동 매칭됩니다</div>`)
                    : `<a href="${p.source_url}" target="_blank" style="display:block; text-align:center; margin-top:10px; font-size:11.5px; font-weight:700; color:#7c3aed;">🔗 개설된 토너먼트 바로가기</a>`}
            </div>
        `;
    },

    // ========== 🌟 [신규] 작성 모달 (공지/요청) — PC openWriteModal/searchGames/selectGame/submitPost 로직 그대로 ==========
    openWriteModal: () => {
        const isAnnouncement = Boako.MobileTournament.State.currentTab === 'ANNOUNCEMENT';
        Boako.MobileTournament.State.selectedGameName = null;
        const modalHtml = `
            <div id="mobile-tourney-write-modal" style="position:fixed; inset:0; z-index:9999; background:#fff; overflow-y:auto; padding:20px 16px; padding-top:calc(20px + env(safe-area-inset-top)); padding-bottom:calc(30px + env(safe-area-inset-bottom));">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
                    <div style="font-size:16px; font-weight:900;">${isAnnouncement ? '📢 개최 공지 작성' : '🙋 개최 요청 작성'}</div>
                    <button onclick="document.getElementById('mobile-tourney-write-modal').remove()" style="font-size:22px; color:#94a3b8;">×</button>
                </div>
                <div style="background:#f5f3ff; border:1px solid #ddd6fe; border-radius:10px; padding:10px; margin-bottom:14px; font-size:11px; font-weight:700; color:#6d28d9;">
                    ⚠️ 제목엔 영문 "boako"(대소문자 무관)가 꼭 들어가야 해요. 최대 참가 인원은 32명까지만 가능해요.
                </div>
                <form onsubmit="Boako.MobileTournament.submitPost(event, '${isAnnouncement ? 'ANNOUNCEMENT' : 'REQUEST'}')">
                    <div style="margin-bottom:12px;">
                        <label style="font-size:12px; font-weight:700; color:#475569; display:block; margin-bottom:5px;">제목 (boako 포함 필수)</label>
                        <input type="text" id="mobile-tourney-input-title" required placeholder="예: BOAKO 스플렌더 토너먼트" style="width:100%; border:1px solid #e2e8f0; border-radius:10px; padding:11px; font-size:14px;">
                    </div>
                    <div style="margin-bottom:12px; position:relative;">
                        <label style="font-size:12px; font-weight:700; color:#475569; display:block; margin-bottom:5px;">종목(게임) 검색</label>
                        <input type="text" id="mobile-tourney-input-game-search" autocomplete="off" placeholder="게임명을 입력해 검색하세요" oninput="Boako.MobileTournament.searchGames(this.value)" style="width:100%; border:1px solid #e2e8f0; border-radius:10px; padding:11px; font-size:14px;">
                        <div id="mobile-tourney-game-search-results" class="hidden" style="position:absolute; z-index:10; left:0; right:0; background:#fff; border:1px solid #e2e8f0; border-radius:10px; box-shadow:0 8px 20px rgba(0,0,0,0.1); margin-top:4px; max-height:200px; overflow-y:auto;"></div>
                    </div>
                    <div style="margin-bottom:12px;">
                        <label style="font-size:12px; font-weight:700; color:#475569; display:block; margin-bottom:5px;">설명</label>
                        <textarea id="mobile-tourney-input-content" rows="3" placeholder="대회 규칙, 참가 조건 등을 적어주세요" style="width:100%; border:1px solid #e2e8f0; border-radius:10px; padding:11px; font-size:14px;"></textarea>
                    </div>
                    <div style="margin-bottom:12px;">
                        <label style="font-size:12px; font-weight:700; color:#475569; display:block; margin-bottom:5px;">예정 일시 (선택)</label>
                        <input type="datetime-local" id="mobile-tourney-input-date" style="width:100%; border:1px solid #e2e8f0; border-radius:10px; padding:11px; font-size:14px;">
                    </div>
                    ${!isAnnouncement ? `
                    <div style="margin-bottom:12px;">
                        <label style="font-size:12px; font-weight:700; color:#475569; display:block; margin-bottom:5px;">희망 최대 참가 인원 (32명 이하)</label>
                        <input type="number" id="mobile-tourney-input-max" min="1" max="32" placeholder="예: 16" style="width:100%; border:1px solid #e2e8f0; border-radius:10px; padding:11px; font-size:14px;">
                    </div>
                    <div style="margin-bottom:16px; display:flex; align-items:center; gap:8px;">
                        <input type="checkbox" id="mobile-tourney-input-convert" checked style="width:18px; height:18px;">
                        <label for="mobile-tourney-input-convert" style="font-size:12px; font-weight:700; color:#475569;">개설 완료되면 "개최 공지" 게시판에도 공개하기</label>
                    </div>
                    ` : ''}
                    ${isAnnouncement ? `
                    <div style="margin-bottom:16px;">
                        <label style="font-size:12px; font-weight:700; color:#475569; display:block; margin-bottom:5px;">실제 개설한 토너먼트 링크 (필수)</label>
                        <input type="url" id="mobile-tourney-input-url" required placeholder="https://boardgamearena.com/tournament?id=..." style="width:100%; border:1px solid #e2e8f0; border-radius:10px; padding:11px; font-size:14px;">
                        <p style="font-size:10.5px; color:#94a3b8; font-weight:700; margin-top:5px;">⚠️ boardgamearena.com 도메인의 실제 토너먼트 링크만 등록 가능합니다.</p>
                    </div>
                    ` : ''}
                    <button type="submit" style="width:100%; background:#7c3aed; color:#fff; font-weight:900; font-size:14px; padding:14px; border-radius:12px;">
                        ${isAnnouncement ? '개최 공지 올리기 (+50P)' : '개최 요청 올리기'}
                    </button>
                </form>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    searchGames: async (query) => {
        const resultsBox = document.getElementById('mobile-tourney-game-search-results');
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
            resultsBox.innerHTML = `<div style="padding:10px; font-size:12px; color:#94a3b8; font-weight:700;">검색 결과가 없습니다.</div>`;
            resultsBox.classList.remove('hidden');
            return;
        }
        resultsBox.innerHTML = data.map(g => `
            <div onclick="Boako.MobileTournament.selectGame('${g.game_name.replace(/'/g, "\\'")}')" style="display:flex; align-items:center; gap:8px; padding:9px 10px;">
                <img src="${Boako.Util.cdn(g.image_url || Boako.MobileTournament.DEFAULT_LOGO_FALLBACK)}" style="width:24px; height:24px; border-radius:6px; object-fit:contain; background:#f8fafc; border:1px solid #f1f5f9;">
                <span style="font-size:12.5px; font-weight:700; color:#334155;">${Boako.MobileTournament.escapeHtml(g.game_name)}</span>
            </div>
        `).join('');
        resultsBox.classList.remove('hidden');
    },

    selectGame: (name) => {
        const input = document.getElementById('mobile-tourney-input-game-search');
        if (!input) return;
        input.value = name;
        const resultsBox = document.getElementById('mobile-tourney-game-search-results');
        if (resultsBox) resultsBox.classList.add('hidden');
    },

    submitPost: async (e, type) => {
        e.preventDefault();
        const title = document.getElementById('mobile-tourney-input-title').value.trim();
        const gameName = document.getElementById('mobile-tourney-input-game-search').value.trim() || null;
        const content = document.getElementById('mobile-tourney-input-content').value.trim() || null;
        const dateVal = document.getElementById('mobile-tourney-input-date').value;
        const scheduledDate = dateVal ? new Date(dateVal).toISOString() : null;
        const maxInput = document.getElementById('mobile-tourney-input-max');
        const maxParticipants = maxInput && maxInput.value ? parseInt(maxInput.value) : null;

        try {
            if (type === 'ANNOUNCEMENT') {
                const sourceUrl = document.getElementById('mobile-tourney-input-url').value.trim();
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
                const convertInput = document.getElementById('mobile-tourney-input-convert');
                const convertToAnnouncement = convertInput ? convertInput.checked : true;
                const { error } = await Boako.db.rpc('create_tournament_request', {
                    p_title: title, p_game_name: gameName, p_content: content,
                    p_scheduled_date: scheduledDate, p_max_participants: maxParticipants,
                    p_convert_to_announcement: convertToAnnouncement
                });
                if (error) throw error;
                Boako.Util.toast('🙋 개최 요청이 등록되었습니다!');
                Boako.Util.tryRollDailyDice(); // 🌟 PC와 동일 — 팀 리그 외 활동 하루 1회 주사위
            }

            document.getElementById('mobile-tourney-write-modal')?.remove();
            await Boako.MobileTournament.loadPosts(document.getElementById('mobile-content-area'));
        } catch (err) {
            console.error(err);
            Boako.Util.toast('❌ ' + (err.message || '등록에 실패했습니다.'));
        }
    },

    escapeHtml: (str) => {
        const div = document.createElement('div');
        div.innerText = str || '';
        return div.innerHTML;
    }
};

// ========== 🌟 [신규] 추천(투표) 탭 — PC Boako.Tournament.Vote와 완전히 동일한 RPC 재사용 ==========
Boako.MobileTournament.Vote = {
    searchDebounceTimer: null,

    init: async () => {
        const root = document.getElementById('mobile-tourney-content');
        if (!root) return;
        root.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:14px;">
                <div id="mobile-tourney-vote-preview-weekly"><div style="text-align:center; padding:20px 0; color:#94a3b8; font-weight:700; font-size:12.5px;">예상치 계산 중...</div></div>
                <div id="mobile-tourney-vote-preview-monthly"><div style="text-align:center; padding:20px 0; color:#94a3b8; font-weight:700; font-size:12.5px;">예상치 계산 중...</div></div>
            </div>
            <div style="background:#fff; border:1px solid #e2e8f0; border-radius:14px; padding:12px;">
                <input type="text" id="mobile-tourney-vote-search" placeholder="게임 이름으로 검색해서 투표하세요" autocomplete="off" oninput="Boako.MobileTournament.Vote.onSearchInput(this.value)" style="width:100%; border:1px solid #e2e8f0; border-radius:10px; padding:10px 12px; font-size:13.5px; font-weight:700; margin-bottom:12px;">
                <div id="mobile-tourney-vote-grid" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px;">
                    <div style="grid-column:1/-1; text-align:center; padding:24px 0; color:#94a3b8; font-weight:700; font-size:12.5px;">불러오는 중...</div>
                </div>
            </div>
        `;
        await Boako.MobileTournament.Vote.loadPreview();
        await Boako.MobileTournament.Vote.loadGrid('');
    },

    loadPreview: async () => {
        await Promise.all([
            Boako.MobileTournament.Vote.loadPreviewFor('WEEKLY', 'mobile-tourney-vote-preview-weekly', '🏅 다음 정기(주간) 예상', 'from-violet-600 to-indigo-700'),
            Boako.MobileTournament.Vote.loadPreviewFor('MONTHLY', 'mobile-tourney-vote-preview-monthly', '🧩 다음 월간(한달한판) 예상', 'from-indigo-600 to-blue-700')
        ]);
    },

    loadPreviewFor: async (track, containerId, label, gradientClass) => {
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
            previewBox.innerHTML = `<div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px; padding:16px; text-align:center; color:#94a3b8; font-weight:700; font-size:12.5px;">${label}: 예상 후보가 부족합니다.</div>`;
            return;
        }

        const dateLabel = nextSlot
            ? new Date(nextSlot.scheduled_date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }) + ` (${nextSlot.round_no}회차)`
            : '다음 회차';
        const maxProb = Math.max(...candidates.map(c => Number(c.probability)));

        previewBox.innerHTML = `
            <div class="bg-gradient-to-br ${gradientClass}" style="border-radius:16px; padding:14px; color:#fff;">
                <div style="font-size:10.5px; font-weight:900; opacity:0.8; margin-bottom:8px;">${label} · ${dateLabel}</div>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    ${candidates.map((c, idx) => {
                        const pct = Math.round(Number(c.probability) * 1000) / 10;
                        const barWidth = maxProb > 0 ? Math.round((Number(c.probability) / maxProb) * 100) : 0;
                        return `
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span style="font-size:11px; font-weight:900; opacity:0.7; width:14px;">${idx + 1}</span>
                            <img src="${Boako.Util.cdn(c.image_url) || Boako.MobileTournament.DEFAULT_LOGO_FALLBACK}" style="width:26px; height:26px; border-radius:8px; object-fit:contain; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); padding:2px; flex-shrink:0;">
                            <div style="flex:1; min-width:0;">
                                <div style="display:flex; justify-content:space-between; font-size:11px; font-weight:700; margin-bottom:3px;">
                                    <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${Boako.MobileTournament.escapeHtml(c.game_name)}</span>
                                    <span style="opacity:0.8; margin-left:6px;">${pct}%</span>
                                </div>
                                <div style="height:5px; background:rgba(255,255,255,0.2); border-radius:999px; overflow:hidden;"><div style="height:100%; background:#fff; border-radius:999px; width:${barWidth}%;"></div></div>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
                <div style="font-size:9.5px; font-weight:700; opacity:0.7; margin-top:10px;">⚠️ 확정 아님 · 매일 바뀔 수 있어요. 아래에서 투표하면 순위를 뒤집을 수 있습니다!</div>
            </div>
        `;
    },

    onSearchInput: (value) => {
        clearTimeout(Boako.MobileTournament.Vote.searchDebounceTimer);
        Boako.MobileTournament.Vote.searchDebounceTimer = setTimeout(() => {
            Boako.MobileTournament.Vote.loadGrid(value.trim());
        }, 250);
    },

    loadGrid: async (search) => {
        const grid = document.getElementById('mobile-tourney-vote-grid');
        if (!grid) return;

        if (!Boako.state.user) {
            grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:24px 0; color:#94a3b8; font-weight:700; font-size:12.5px;">🔒 투표하려면 로그인이 필요합니다.</div>`;
            return;
        }

        const { data, error } = await Boako.db.rpc('fn_get_tournament_vote_candidates', { p_search: search || null });

        if (error) {
            grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:24px 0; color:#ef4444; font-weight:700; font-size:12.5px;">목록을 불러오지 못했습니다.</div>`;
            return;
        }
        if (!data || data.length === 0) {
            const emptyMsg = search
                ? `"${Boako.MobileTournament.escapeHtml(search)}"는 지금 투표할 수 없어요.<br><span style="font-weight:600; color:#cbd5e1;">베타/알파/협력 게임이거나, 쿨다운 중이거나, 이미 확정됐거나, 월간 게임인데 실제 플레이 기록이 부족할 수 있어요.</span>`
                : `지금 투표 가능한 후보가 없습니다.<br><span style="font-weight:600; color:#cbd5e1;">쿨다운 중이거나 이미 확정된 게임을 빼면 남는 후보가 없는 상태예요.</span>`;
            grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:24px 0; color:#94a3b8; font-weight:700; font-size:11.5px; line-height:1.6;">${emptyMsg}</div>`;
            return;
        }

        const sorted = [...data].sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0));
        const displayLimit = search ? 60 : 20;

        grid.innerHTML = sorted.slice(0, displayLimit).map(g => `
            <div onclick="Boako.MobileTournament.Vote.vote('${g.game_id}', this)" style="position:relative; display:flex; flex-direction:column; align-items:center; gap:5px; padding:10px 6px; border-radius:12px; border:1.5px solid #e2e8f0; background:#fff;">
                ${g.vote_count > 0 ? `<span style="position:absolute; top:-5px; right:-5px; background:#7c3aed; color:#fff; font-size:9px; font-weight:900; width:18px; height:18px; border-radius:999px; display:flex; align-items:center; justify-content:center;">${g.vote_count}</span>` : ''}
                <img src="${Boako.Util.cdn(g.image_url) || Boako.MobileTournament.DEFAULT_LOGO_FALLBACK}" style="width:40px; height:40px; border-radius:10px; object-fit:contain; background:#f8fafc; border:1px solid #f1f5f9; padding:3px;">
                <span style="font-size:10.5px; font-weight:900; color:#334155; text-align:center; line-height:1.25;">${Boako.MobileTournament.escapeHtml(g.game_name)}</span>
                <span style="font-size:9px; font-weight:700; color:${g.playtime > 30 ? '#818cf8' : '#a78bfa'};">${g.playtime > 30 ? '🧩 월간' : '🏅 정기'} · ${g.playtime}분</span>
            </div>
        `).join('');
    },

    vote: async (gameId, cardEl) => {
        try {
            const { data, error } = await Boako.db.rpc('fn_vote_tournament_game', { p_game_id: gameId });
            if (error) throw error;

            if (window.sfx) window.sfx.click();
            Boako.Util.toast(`🗳️ "${data.game_name}"에 투표했어요!`);

            if (cardEl) {
                cardEl.style.transition = 'opacity 0.2s, transform 0.2s';
                cardEl.style.opacity = '0';
                cardEl.style.transform = 'scale(0.9)';
                setTimeout(() => cardEl.remove(), 200);
            }
            await Boako.MobileTournament.Vote.loadPreview();
        } catch (err) {
            console.error(err);
            Boako.Util.toast('❌ ' + (err.message || '투표에 실패했습니다.'));
        }
    }
};
