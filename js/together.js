/**
 * [TOGETHER] 같이하자 — 실시간 매칭 모집 게시판
 * 참가 버튼 = 즉시 확정(선착순, 승인 단계 없음)
 * 정원 마감 or 예정 시각 도달 시 채팅방 오픈(2명 미만이면 자동 취소)
 * 🌟 모집글 등록 성공 시 오늘의 주사위 시도 (팀 리그 외 활동, 하루 1회)
 */
Boako.Together = {
    State: {
        currentTab: 'BOARD', // 'BOARD'(전체 모집) | 'MINE'(내가 참여 중인 모임) | 'FIND_GAME'(같이할 게임 찾기)
        posts: [],
        participantsMap: {},   // { post_id: [{user_id, full_name, profile_url}, ...] }
        gameLogoMap: {},
        realtimeChannel: null,
        findGameParty: null,
        findGameResults: null
    },

    _rtGroup: null,

    init: async (containerId) => {
        const root = document.getElementById(containerId);
        if (!root) return;

        root.innerHTML = `
            <div class="main-banner" style="background:linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%);">
                <h1>🤝 같이하자</h1>
                <p>지금 같이 놀 사람을 모아보고, 같이할 게임도 찾아보세요. 참가는 선착순, 승인 없이 바로 확정돼요.</p>
            </div>

            <section class="section-card">
                <div class="card-header flex justify-between items-center">
                    <div class="flex gap-2">
                        <button id="together-tab-btn-BOARD" class="together-tab-btn bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all" onclick="Boako.Together.switchTab('BOARD')">📋 전체 모집</button>
                        <button id="together-tab-btn-MINE" class="together-tab-btn bg-slate-100 text-slate-500 px-4 py-2 rounded-lg text-sm font-bold transition-all" onclick="Boako.Together.switchTab('MINE')">🙋 내 모임</button>
                        <button id="together-tab-btn-FIND_GAME" class="together-tab-btn bg-slate-100 text-slate-500 px-4 py-2 rounded-lg text-sm font-bold transition-all" onclick="Boako.Together.switchTab('FIND_GAME')">🎯 같이할 게임 찾기</button>
                    </div>
                    <button class="bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-sky-700 transition-colors" onclick="Boako.Together.openWriteModal()">+ 모집하기</button>
                </div>

                <div class="card-body" style="background:#f8fafc; padding:20px;">
                    <div id="together-list-container" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="col-span-full text-center py-16 text-slate-400 font-bold">불러오는 중...</div>
                    </div>
                    <div id="together-findgame-container" class="hidden"></div>
                </div>
            </section>

            <div id="together-modal-root"></div>
        `;

        await Boako.Together.loadPosts();
        Boako.Together.startRealtime();
    },

    // 🌟 시간 도달까지 반영한 실질 확정/취소 판단 (DB의 fn_together_is_confirmed와 동일 로직)
    // status 컬럼은 인원마감 케이스에서만 실제로 갱신되고, 시간도달 케이스는 여기서 매번 계산해야 함
    isReallyConfirmed: (post) => {
        if (post.status === 'CONFIRMED') return true;
        if (post.status === 'CANCELLED') return false;
        return post.status === 'RECRUITING' && new Date(post.scheduled_date) <= new Date() && post.current_count >= 2;
    },
    isReallyCancelled: (post) => {
        if (post.status === 'CANCELLED') return true;
        if (post.status === 'CONFIRMED') return false;
        return post.status === 'RECRUITING' && new Date(post.scheduled_date) <= new Date() && post.current_count < 2;
    },
    isReallyRecruiting: (post) => {
        return post.status === 'RECRUITING' && new Date(post.scheduled_date) > new Date();
    },

    // 🌟 [리팩토링] 같이하자 화면을 여러 탭에서 열어두면 탭마다 각자 채널을 구독해서 소켓이
    // 늘어나던 문제 방지 — realtime_coordinator.js의 화면 전용 미니 코디네이터(createGroup) 적용.
    // 이 화면은 로그인하면 항상 켜져있는 전역 채널이 아니라 "같이하자 화면을 실제로 열어본 탭"
    // 에서만 필요한 lazy 채널이라, 전역 리더 선출을 그대로 쓰면 안 됨(team.js 팀챗과 동일한 이유).
    startRealtime: () => {
        if (!Boako.Together._rtGroup) {
            Boako.Together._rtGroup = Boako.RealtimeCoordinator.createGroup('together');
            Boako.Together._rtGroup.onRelay('refresh', () => Boako.Together.loadPosts());
            Boako.Together._rtGroup.onBecomeLeader(() => Boako.Together._subscribeAsLeader());
        }
        Boako.Together._rtGroup.start();
    },

    // 🌟 이 탭이 리더일 때만(그리고 아직 구독 안 했을 때만) 실제 채널 구독
    _subscribeAsLeader: () => {
        if (Boako.Together.State.realtimeChannel) return; // 중복 구독 방지
        Boako.Together.State.realtimeChannel = Boako.db
            .channel('together-board-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'together_posts' }, () => Boako.Together._onRemoteChange())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'together_participants' }, () => Boako.Together._onRemoteChange())
            .subscribe();
    },

    // 🌟 리더가 실제 이벤트를 받으면 로컬 갱신 + 팔로워 탭에 중계
    _onRemoteChange: () => {
        Boako.Together.loadPosts();
        Boako.Together._rtGroup.broadcast('refresh', null);
    },

    switchTab: (tab) => {
        Boako.Together.State.currentTab = tab;
        document.querySelectorAll('.together-tab-btn').forEach(btn => {
            btn.classList.remove('bg-slate-800', 'text-white');
            btn.classList.add('bg-slate-100', 'text-slate-500');
        });
        const activeBtn = document.getElementById(`together-tab-btn-${tab}`);
        if (activeBtn) {
            activeBtn.classList.remove('bg-slate-100', 'text-slate-500');
            activeBtn.classList.add('bg-slate-800', 'text-white');
        }

        const listContainer = document.getElementById('together-list-container');
        const findGameContainer = document.getElementById('together-findgame-container');

        if (tab === 'FIND_GAME') {
            listContainer.classList.add('hidden');
            findGameContainer.classList.remove('hidden');
            Boako.Together.initFindGame();
        } else {
            listContainer.classList.remove('hidden');
            findGameContainer.classList.add('hidden');
            Boako.Together.renderList();
        }
    },

    loadPosts: async () => {
        const nowIso = new Date().toISOString();

        // 전체 모집 탭용: 아직 시간이 지나지 않은 글만 (확정/모집중 무관하게 시간 기준으로만 필터)
        const { data: boardPosts, error: boardErr } = await Boako.db
            .from('together_posts')
            .select('*')
            .gte('scheduled_date', nowIso)
            .order('scheduled_date', { ascending: true });

        if (boardErr) console.error('모집글 로드 실패:', boardErr);

        let allPosts = boardPosts || [];

        // 내 모임 탭용: 시간 지났어도 내가 참여 중인 글은 계속 접근 가능해야 하므로 별도 조회
        if (Boako.state.user) {
            const { data: myParticipation } = await Boako.db
                .from('together_participants')
                .select('post_id')
                .eq('user_id', Boako.state.user.id);

            const myPostIds = [...new Set((myParticipation || []).map(r => r.post_id))];
            if (myPostIds.length > 0) {
                const { data: minePosts } = await Boako.db
                    .from('together_posts')
                    .select('*')
                    .in('id', myPostIds)
                    .order('scheduled_date', { ascending: false });

                // board 목록과 합쳐서 중복 제거 (전체 posts 풀로 사용, 탭에서 필터링)
                const existingIds = new Set(allPosts.map(p => p.id));
                (minePosts || []).forEach(p => {
                    if (!existingIds.has(p.id)) allPosts.push(p);
                });
            }
        }

        Boako.Together.State.posts = allPosts;

        // 게임 로고 조회
        const gameNames = [...new Set(allPosts.map(p => p.game_name).filter(Boolean))];
        if (gameNames.length > 0) {
            const { data: gamesData } = await Boako.db.from('games').select('game_name, image_url').in('game_name', gameNames);
            Boako.Together.State.gameLogoMap = Object.fromEntries((gamesData || []).map(g => [g.game_name, g.image_url]));
        } else {
            Boako.Together.State.gameLogoMap = {};
        }

        // 참가자 목록 + 프로필(닉네임/프사) 조회
        const postIds = allPosts.map(p => p.id);
        if (postIds.length > 0) {
            const { data: participantsData } = await Boako.db
                .from('together_participants')
                .select('post_id, user_id')
                .in('post_id', postIds);

            const userIds = [...new Set((participantsData || []).map(r => r.user_id))];
            let profilesMap = {};
            if (userIds.length > 0) {
                const { data: profilesData } = await Boako.db.from('profiles').select('id, full_name, profile_url, custom_avatar_url').in('id', userIds);
                profilesMap = Object.fromEntries((profilesData || []).map(p => [p.id, p]));
            }

            const map = {};
            (participantsData || []).forEach(row => {
                if (!map[row.post_id]) map[row.post_id] = [];
                map[row.post_id].push({ user_id: row.user_id, ...(profilesMap[row.user_id] || {}) });
            });
            Boako.Together.State.participantsMap = map;
        } else {
            Boako.Together.State.participantsMap = {};
        }

        // 🌟 시간도달로 확정 조건(예정시각 경과 + 2명 이상)을 만족했는데
        // 아직 DB엔 RECRUITING으로 남아있는 글이 있으면, 조용히 승격시켜서
        // 트리거가 자동 톡캘린더 등록을 하도록 함 (참가자가 이 페이지를 열 때마다 체크됨)
        const nowMs = Date.now();
        allPosts.forEach(p => {
            if (p.status === 'RECRUITING' && new Date(p.scheduled_date).getTime() <= nowMs && p.current_count >= 2) {
                Boako.db.rpc('fn_finalize_together_status', { p_post_id: p.id }).then(() => {}).catch(() => {});
            }
        });

        Boako.Together.renderList();
    },

    renderList: () => {
        const container = document.getElementById('together-list-container');
        if (!container) return;

        const myId = Boako.state.user?.id;
        let posts = Boako.Together.State.posts;

        if (Boako.Together.State.currentTab === 'BOARD') {
            const nowMs = Date.now();
            posts = posts.filter(p => new Date(p.scheduled_date).getTime() >= nowMs);
        } else {
            // 내 모임: 내가 참여 중인 것만 (시간 지남 무관)
            posts = posts.filter(p => (Boako.Together.State.participantsMap[p.id] || []).some(u => u.user_id === myId));
        }

        posts.sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date));

        if (posts.length === 0) {
            container.innerHTML = `<div class="col-span-full text-center py-16 text-slate-400 font-bold border border-dashed border-slate-300 rounded-xl bg-white">
                ${Boako.Together.State.currentTab === 'BOARD' ? '아직 모집 중인 글이 없습니다.' : '참여 중인 모임이 없습니다.'}
            </div>`;
            return;
        }

        container.innerHTML = posts.map(p => Boako.Together.renderCard(p)).join('');

        // 🌟 카톡 공유 딥링크(?view=together&post=ID)로 들어온 경우 해당 글로 스크롤+하이라이트 (1회만)
        if (window.Boako.__deepLinkPostId) {
            const targetId = window.Boako.__deepLinkPostId;
            window.Boako.__deepLinkPostId = null;
            setTimeout(() => {
                const el = document.getElementById(`together-post-${targetId}`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.classList.add('ring-4', 'ring-sky-400');
                    setTimeout(() => el.classList.remove('ring-4', 'ring-sky-400'), 2000);
                }
            }, 100);
        }
    },

    renderCard: (p) => {
        const myId = Boako.state.user?.id;
        const participants = Boako.Together.State.participantsMap[p.id] || [];
        const isJoined = participants.some(u => u.user_id === myId);
        const isAuthor = p.author_id === myId;

        const confirmed = Boako.Together.isReallyConfirmed(p);
        const cancelled = Boako.Together.isReallyCancelled(p);
        const recruiting = Boako.Together.isReallyRecruiting(p);

        const dateStr = new Date(p.scheduled_date).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const gameLogo = Boako.Together.State.gameLogoMap[p.game_name] || TOGETHER_DEFAULT_LOGO;

        let statusBadge = '';
        if (confirmed) statusBadge = `<span class="text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 text-emerald-600 bg-emerald-50">✅ 확정</span>`;
        else if (cancelled) statusBadge = `<span class="text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 text-slate-400 bg-slate-100">🚫 취소됨(인원미달)</span>`;
        else statusBadge = `<span class="text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 text-sky-600 bg-sky-50">🙋 모집중</span>`;

        const avatarsHtml = participants.slice(0, 6).map(u => `
            <img src="${Boako.Util.cdn(u.custom_avatar_url || u.profile_url || TOGETHER_DEFAULT_AVATAR)}" title="${u.full_name || '익명'}" class="w-6 h-6 rounded-full object-cover border-2 border-white -ml-2 first:ml-0 bg-slate-200">
        `).join('');

        const namesText = participants.map(u => u.full_name || '익명').join(', ');

        let actionHtml = '';
        if (confirmed) {
            actionHtml = `<button class="w-full mt-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black py-2.5 rounded-lg transition-colors" onclick="Boako.Together.goToChat(${p.id})">💬 채팅방 입장</button>`;
        } else if (cancelled) {
            actionHtml = `<div class="text-center mt-3 text-[11px] text-slate-400 font-bold">예정 시각까지 2명 이상 모이지 못해 취소되었습니다</div>`;
        } else if (recruiting) {
            if (isAuthor) {
                actionHtml = `<button class="w-full mt-3 bg-white border border-rose-200 text-rose-500 text-xs font-black py-2.5 rounded-lg hover:bg-rose-50 transition-colors" onclick="Boako.Together.cancelPost(${p.id})">모집 취소</button>`;
            } else if (isJoined) {
                actionHtml = `<button class="w-full mt-3 bg-white border border-slate-200 text-slate-500 text-xs font-black py-2.5 rounded-lg hover:bg-slate-50 transition-colors" onclick="Boako.Together.leavePost(${p.id})">참가 취소</button>`;
            } else if (!Boako.state.user) {
                actionHtml = `<div class="text-center mt-3 text-[11px] text-slate-400 font-bold">참가하려면 로그인이 필요해요</div>`;
            } else {
                actionHtml = `<button class="w-full mt-3 bg-sky-600 hover:bg-sky-700 text-white text-xs font-black py-2.5 rounded-lg transition-colors" onclick="Boako.Together.joinPost(${p.id})">참가하기</button>`;
            }
        }

        const shareBtn = !cancelled ? `<button onclick="Boako.Together.shareToKakao(${p.id})" class="shrink-0 w-7 h-7 rounded-full bg-yellow-50 hover:bg-yellow-100 flex items-center justify-center text-sm transition-colors" title="카톡으로 공유">💬</button>` : '';

        return `
            <div id="together-post-${p.id}" class="bg-white border ${confirmed ? 'border-emerald-200' : cancelled ? 'border-slate-200 opacity-70' : 'border-sky-200'} rounded-xl p-4 transition-shadow">
                <div class="flex items-center gap-3 mb-2">
                    <div class="flex flex-col items-center shrink-0" style="width:52px;">
                        <img src="${Boako.Util.cdn(gameLogo)}" class="w-12 h-12 rounded-lg object-contain bg-slate-50 border border-slate-100 p-1">
                        <div class="text-[9px] font-bold text-slate-500 text-center mt-1 truncate w-full">${p.game_name || '종목 미정'}</div>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="text-base font-black text-sky-700">📅 ${dateStr}</div>
                        <div class="text-[11px] text-slate-400 truncate">${p.title || ''}</div>
                    </div>
                    ${shareBtn}
                    ${statusBadge}
                </div>
                ${p.content ? `<div class="bg-sky-50/60 border border-sky-100 rounded-lg p-3 mb-3"><p class="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">${p.content}</p></div>` : ''}
                <div class="flex items-center justify-between">
                    <div class="flex items-center">${avatarsHtml}</div>
                    <span class="text-[11px] text-slate-500 font-bold">👥 ${p.current_count} / ${p.max_participants}명</span>
                </div>
                ${namesText ? `<div class="text-[10px] text-slate-400 font-bold mt-1 truncate" title="${namesText}">${namesText}</div>` : ''}
                ${actionHtml}
            </div>
        `;
    },

    // ========== 🎯 같이할 게임 찾기 ==========
    initFindGame: async () => {
        const container = document.getElementById('together-findgame-container');
        if (!Boako.state.user) {
            container.innerHTML = `<div class="text-center py-16 text-slate-400 font-bold border border-dashed border-slate-300 rounded-xl bg-white">로그인 후 이용해주세요.</div>`;
            return;
        }
        if (!Boako.Together.State.findGameParty) {
            const { data: myProfile } = await Boako.db.from('profiles').select('id, full_name, profile_url, custom_avatar_url').eq('id', Boako.state.user.id).single();
            Boako.Together.State.findGameParty = [{
                user_id: myProfile.id,
                full_name: myProfile.full_name,
                avatar: myProfile.custom_avatar_url || myProfile.profile_url,
                isSelf: true
            }];
            Boako.Together.State.findGameResults = null;
        }
        Boako.Together.renderFindGame();
    },

    renderFindGame: () => {
        const container = document.getElementById('together-findgame-container');
        const party = Boako.Together.State.findGameParty || [];

        const avatarsHtml = party.map(m => `
            <div class="flex flex-col items-center" style="width:52px;">
                <div class="relative group">
                    <img src="${Boako.Util.cdn(m.avatar || TOGETHER_DEFAULT_AVATAR)}" class="w-11 h-11 rounded-full object-cover bg-slate-100" style="border:2px solid ${m.isSelf ? '#0ea5e9' : '#e2e8f0'};">
                    ${!m.isSelf ? `<div onclick="Boako.Together.removePartyMember('${m.user_id}')" class="hidden group-hover:flex absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-black items-center justify-center cursor-pointer" style="box-shadow:0 0 0 2px #fff;">×</div>` : ''}
                </div>
                <div class="text-[10.5px] font-bold ${m.isSelf ? 'text-sky-700' : 'text-slate-600'} mt-1 truncate" style="max-width:52px;" title="${m.full_name}">${m.full_name}</div>
            </div>
        `).join('');

        container.innerHTML = `
            <div class="bg-white border border-slate-200 rounded-xl p-5 mb-4">
                <div class="text-xs font-bold text-slate-600 mb-3">파티원</div>
                <div class="flex items-start gap-3 flex-wrap">
                    ${avatarsHtml}
                    <div class="flex flex-col items-center" style="width:52px;">
                        <div onclick="Boako.Together.togglePartySearch()" class="w-11 h-11 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-lg font-bold cursor-pointer hover:border-sky-400 hover:text-sky-500 transition-colors">+</div>
                    </div>
                </div>
                <div id="together-party-search-box" class="hidden relative mt-4">
                    <input type="text" id="together-party-search-input" autocomplete="off" placeholder="닉네임으로 파티원 검색" oninput="Boako.Together.searchPartyMember(this.value)" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    <div id="together-party-search-results" class="hidden bg-white border border-slate-200 rounded-l-lg shadow-lg overflow-hidden" style="position:fixed; z-index:9997;"></div>
                </div>
                <button onclick="Boako.Together.runFindGame()" class="w-full mt-4 bg-sky-600 hover:bg-sky-700 text-white text-sm font-black py-2.5 rounded-lg transition-colors">🎯 같이할 게임 찾기</button>
            </div>
            <div id="together-findgame-results"></div>
        `;

        if (Boako.Together.State.findGameResults) Boako.Together.renderFindGameResults();
    },

    togglePartySearch: () => {
        const box = document.getElementById('together-party-search-box');
        box.classList.toggle('hidden');
        if (!box.classList.contains('hidden')) document.getElementById('together-party-search-input').focus();
    },

    // 🌟 파티원 검색 드롭다운은 position:fixed로 띄운다 — .section-card의 overflow:hidden(전역 스타일)
    // 안에 absolute로 두면 카드 경계를 넘어가는 즉시 통째로 잘려 보이는 문제가 있었음. fixed로 두고
    // 입력창 위치를 기준으로 좌표를 직접 계산해서 붙이면 그 어떤 조상 요소의 overflow에도 안 잘림.
    // 열려있는 동안 스크롤/리사이즈해도 입력창을 계속 따라가도록 리스너를 한 번만 붙여둠.
    _partySearchRepositionBound: false,
    _positionPartySearchResults: () => {
        const input = document.getElementById('together-party-search-input');
        const resultsBox = document.getElementById('together-party-search-results');
        if (!input || !resultsBox) return;
        const rect = input.getBoundingClientRect();
        resultsBox.style.top = `${rect.bottom + 4}px`;
        resultsBox.style.left = `${rect.left}px`;
        resultsBox.style.width = `${rect.width}px`;

        if (!Boako.Together._partySearchRepositionBound) {
            Boako.Together._partySearchRepositionBound = true;
            const reposition = () => {
                if (!resultsBox.classList.contains('hidden')) Boako.Together._positionPartySearchResults();
            };
            window.addEventListener('scroll', reposition, true);
            window.addEventListener('resize', reposition);
        }
    },

    searchPartyMember: async (query) => {
        const resultsBox = document.getElementById('together-party-search-results');
        if (!query || query.trim().length === 0) {
            resultsBox.classList.add('hidden');
            resultsBox.innerHTML = '';
            return;
        }
        const existingIds = new Set(Boako.Together.State.findGameParty.map(m => m.user_id));
        const { data } = await Boako.db.from('profiles').select('id, full_name, profile_url, custom_avatar_url').ilike('full_name', `%${query.trim()}%`).limit(8);
        const filtered = (data || []).filter(p => !existingIds.has(p.id));

        if (filtered.length === 0) {
            resultsBox.innerHTML = `<div class="p-3 text-xs text-slate-400 font-bold">검색 결과가 없습니다.</div>`;
            Boako.Together._positionPartySearchResults();
            resultsBox.classList.remove('hidden');
            return;
        }
        resultsBox.innerHTML = `<div class="max-h-48 overflow-y-auto dropdown-scroll">${filtered.map(p => `
            <div class="flex items-center gap-2 p-2 hover:bg-sky-50 cursor-pointer transition-colors" onclick="Boako.Together.addPartyMember('${p.id}', '${p.full_name.replace(/'/g, "\\'")}', '${(p.custom_avatar_url || p.profile_url || '').replace(/'/g, "\\'")}')">
                <img src="${Boako.Util.cdn(p.custom_avatar_url || p.profile_url || TOGETHER_DEFAULT_AVATAR)}" class="w-6 h-6 rounded-full object-cover bg-slate-100">
                <span class="text-xs font-bold text-slate-700">${p.full_name}</span>
            </div>
        `).join('')}</div>`;
        Boako.Together._positionPartySearchResults();
        resultsBox.classList.remove('hidden');
    },

    addPartyMember: (userId, fullName, avatar) => {
        Boako.Together.State.findGameParty.push({ user_id: userId, full_name: fullName, avatar, isSelf: false });
        Boako.Together.State.findGameResults = null;
        document.getElementById('together-party-search-input').value = '';
        document.getElementById('together-party-search-results').classList.add('hidden');
        document.getElementById('together-party-search-box').classList.add('hidden');
        Boako.Together.renderFindGame();
    },

    removePartyMember: (userId) => {
        Boako.Together.State.findGameParty = Boako.Together.State.findGameParty.filter(m => m.user_id !== userId);
        Boako.Together.State.findGameResults = null;
        Boako.Together.renderFindGame();
    },

    runFindGame: async () => {
        const party = Boako.Together.State.findGameParty;
        if (party.length < 2) {
            Boako.Util.toast('파티원을 1명 이상 추가해주세요.');
            return;
        }
        const nicknames = party.map(m => m.full_name);
        const total = nicknames.length;
        const majorityThreshold = Math.ceil(total / 2);

        const { data, error } = await Boako.db.from('v_boako_total_records').select('nickname, game_name').in('nickname', nicknames);
        if (error) {
            console.error(error);
            Boako.Util.toast('❌ 조회에 실패했습니다.');
            return;
        }

        const gameMap = {};
        (data || []).forEach(row => {
            if (!row.game_name) return;
            if (!gameMap[row.game_name]) gameMap[row.game_name] = new Set();
            gameMap[row.game_name].add(row.nickname);
        });

        const intersection = [];
        const majority = [];
        Object.entries(gameMap).forEach(([gameName, players]) => {
            const count = players.size;
            if (count === total) intersection.push({ game_name: gameName, count });
            else if (count >= majorityThreshold) majority.push({ game_name: gameName, count });
        });
        intersection.sort((a, b) => a.game_name.localeCompare(b.game_name));
        majority.sort((a, b) => b.count - a.count || a.game_name.localeCompare(b.game_name));

        const allGameNames = [...intersection, ...majority].map(g => g.game_name);
        let logoMap = {};
        let rangeMap = {};
        let bgaUrlMap = {};
        if (allGameNames.length > 0) {
            const { data: gamesData } = await Boako.db.from('games').select('game_name, image_url, min_players, max_players, bga_url').in('game_name', allGameNames);
            logoMap = Object.fromEntries((gamesData || []).map(g => [g.game_name, g.image_url]));
            rangeMap = Object.fromEntries((gamesData || []).map(g => [g.game_name, { min: g.min_players, max: g.max_players }]));
            bgaUrlMap = Object.fromEntries((gamesData || []).map(g => [g.game_name, g.bga_url]));
        }

        // 🌟 게임의 min_players/max_players가 우리 파티 인원수(total)와 안 맞으면 결과에서 아예 제외.
        // 인원수 정보가 없는 게임(min/max 둘 다 null)은 판단할 수 없으니 그대로 둠.
        const fitsPartySize = (gameName) => {
            const range = rangeMap[gameName];
            if (!range) return true;
            if (range.min != null && total < range.min) return false;
            if (range.max != null && total > range.max) return false;
            return true;
        };
        const filteredIntersection = intersection.filter(g => fitsPartySize(g.game_name));
        const filteredMajority = majority.filter(g => fitsPartySize(g.game_name));

        Boako.Together.State.findGameResults = { total, intersection: filteredIntersection, majority: filteredMajority, logoMap, rangeMap, bgaUrlMap };
        Boako.Together.renderFindGameResults();
    },

    // 🌟 같이할 게임 찾기 결과 카드를 클릭했을 때 — 모집글 작성이 아니라 그 게임의 실제 BGA 페이지를 열어서
    // 바로 플레이하러 갈 수 있게 함. bga_url이 없는 게임은 링크가 없다고 안내만 함.
    openGamePage: (gameName) => {
        const bgaUrl = Boako.Together.State.findGameResults?.bgaUrlMap?.[gameName];
        if (bgaUrl) {
            window.open(bgaUrl, '_blank');
        } else {
            Boako.Util.toast('이 게임의 아레나 링크 정보가 없어요.');
        }
    },

    renderFindGameResults: () => {
        const box = document.getElementById('together-findgame-results');
        if (!box) return;
        const { total, intersection, majority, logoMap, rangeMap } = Boako.Together.State.findGameResults;

        // 🌟 인원수 정보가 있는 게임은 참고용으로 "n~m인용"만 표시 (안 맞는 게임은 이미 위에서 걸러졌으므로 경고 없음)
        const renderPlayerRange = (gameName) => {
            const range = rangeMap[gameName];
            if (!range || (range.min == null && range.max == null)) return '';
            const lo = range.min ?? '?';
            const hi = range.max ?? '?';
            return `<div class="text-[10px] font-bold text-slate-400 mt-0.5">${lo}~${hi}인용</div>`;
        };

        const renderCard = (g) => `
            <div class="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:border-sky-300 transition-colors" onclick="Boako.Together.openGamePage('${g.game_name.replace(/'/g, "\\'")}')">
                <img src="${Boako.Util.cdn(logoMap[g.game_name] || TOGETHER_DEFAULT_LOGO)}" class="w-10 h-10 rounded-lg object-contain bg-slate-50 border border-slate-100 p-1 shrink-0">
                <div class="min-w-0">
                    <div class="text-sm font-black text-slate-800 truncate">${g.game_name}</div>
                    <div class="text-[11px] font-bold text-slate-500">${g.count} / ${total}명 플레이</div>
                    ${renderPlayerRange(g.game_name)}
                </div>
            </div>
        `;

        box.innerHTML = `
            <div class="text-xs font-bold text-teal-700 mb-2">🎯 전원이 해본 게임</div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
                ${intersection.length > 0 ? intersection.map(renderCard).join('') : `<div class="col-span-full text-center py-8 text-slate-400 text-sm font-bold border border-dashed border-slate-200 rounded-xl bg-white">전원이 함께 해본, 지금 인원에 맞는 게임이 없어요.</div>`}
            </div>
            <div class="text-xs font-bold text-sky-700 mb-2">🙋 과반수 이상이 해본 게임</div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                ${majority.length > 0 ? majority.map(renderCard).join('') : `<div class="col-span-full text-center py-8 text-slate-400 text-sm font-bold border border-dashed border-slate-200 rounded-xl bg-white">과반이 해본, 지금 인원에 맞는 게임이 없어요.</div>`}
            </div>
            <div class="mt-4 text-[11px] text-slate-400 text-center">카드를 클릭하면 그 게임의 아레나 페이지로 바로 이동해요</div>
        `;
    },

    // 🌟 게임 검색 자동완성 (tournament.js와 동일 패턴)
    searchGames: async (query) => {
        const resultsBox = document.getElementById('together-game-search-results');
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

        resultsBox.innerHTML = `<div class="max-h-48 overflow-y-auto dropdown-scroll">${data.map(g => `
            <div class="flex items-center gap-2 p-2 hover:bg-sky-50 cursor-pointer transition-colors" onclick="Boako.Together.selectGame('${g.game_name.replace(/'/g, "\\'")}')">
                <img src="${Boako.Util.cdn(g.image_url || TOGETHER_DEFAULT_LOGO)}" class="w-6 h-6 rounded object-contain bg-slate-50 border border-slate-100">
                <span class="text-xs font-bold text-slate-700">${g.game_name}</span>
            </div>
        `).join('')}</div>`;
        resultsBox.classList.remove('hidden');
    },

    selectGame: (name) => {
        const input = document.getElementById('together-input-game-search');
        if (!input) return;
        input.value = name;
        const resultsBox = document.getElementById('together-game-search-results');
        if (resultsBox) resultsBox.classList.add('hidden');
    },

    openWriteModal: (prefillGameName) => {
        if (!Boako.state.user) {
            Boako.Util.toast('로그인 후 이용해주세요.');
            return;
        }

        const modalHtml = `
            <div id="together-write-modal-overlay" class="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
                <div class="bg-white rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="font-black text-lg">🎲 같이 놀 사람 모집하기</h3>
                        <button onclick="document.getElementById('together-write-modal-overlay').remove()" class="text-slate-400 font-black text-xl">×</button>
                    </div>

                    <div class="bg-sky-50 border border-sky-200 rounded-lg p-3 mb-4 text-[11px] font-bold text-sky-700">
                        ⚠️ 참가는 선착순 즉시 확정이에요. 정원이 차거나 정한 시각이 되면(2명 이상일 때만) 채팅방이 열려요.
                    </div>

                    <form onsubmit="Boako.Together.submitPost(event)">
                        <div class="mb-3">
                            <label class="text-xs font-bold text-slate-600 block mb-1">제목</label>
                            <input type="text" id="together-input-title" placeholder="예: 오늘 저녁 스플렌더 같이 하실 분!" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                        </div>
                        <div class="mb-3 relative">
                            <label class="text-xs font-bold text-slate-600 block mb-1">종목(게임) 검색</label>
                            <input type="text" id="together-input-game-search" autocomplete="off" placeholder="게임명을 입력해 검색하세요" oninput="Boako.Together.searchGames(this.value)" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                            <div id="together-game-search-results" class="hidden absolute z-10 left-0 right-0 bg-white border border-slate-200 rounded-l-lg shadow-lg mt-1 overflow-hidden"></div>
                        </div>
                        <div class="mb-3">
                            <label class="text-xs font-bold text-slate-600 block mb-1">설명</label>
                            <textarea id="together-input-content" rows="3" placeholder="원하는 시간대, 실력 조건 등을 적어주세요" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"></textarea>
                        </div>
                        <div class="mb-3">
                            <label class="text-xs font-bold text-slate-600 block mb-1">모임 예정 시각 (필수)</label>
                            <input type="datetime-local" id="together-input-date" required class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                        </div>
                        <div class="mb-4">
                            <label class="text-xs font-bold text-slate-600 block mb-1">최대 인원 (본인 포함, 최소 2명)</label>
                            <input type="number" id="together-input-max" min="2" placeholder="예: 4" required class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                        </div>
                        <button type="submit" class="w-full bg-sky-600 hover:bg-sky-700 text-white font-black py-3 rounded-xl transition-colors">
                            모집 글 올리기
                        </button>
                    </form>
                </div>
            </div>
        `;
        document.getElementById('together-modal-root').innerHTML = modalHtml;
        if (prefillGameName) {
            document.getElementById('together-input-game-search').value = prefillGameName;
        }
    },

    submitPost: async (e) => {
        e.preventDefault();

        const title = document.getElementById('together-input-title').value.trim() || null;
        const gameName = document.getElementById('together-input-game-search').value.trim() || null;
        const content = document.getElementById('together-input-content').value.trim() || null;
        const dateVal = document.getElementById('together-input-date').value;
        const maxVal = parseInt(document.getElementById('together-input-max').value);

        if (!dateVal) {
            Boako.Util.toast('모임 예정 시각을 입력해주세요.');
            return;
        }
        const scheduledDate = new Date(dateVal);
        if (scheduledDate <= new Date()) {
            Boako.Util.toast('모임 시각은 현재보다 이후여야 해요.');
            return;
        }
        if (!maxVal || maxVal < 2) {
            Boako.Util.toast('최대 인원은 2명 이상이어야 해요.');
            return;
        }

        try {
            const { error } = await Boako.db.rpc('fn_create_together_post', {
                p_author_id: Boako.state.user.id,
                p_game_name: gameName,
                p_title: title,
                p_content: content,
                p_max_participants: maxVal,
                p_scheduled_date: scheduledDate.toISOString()
            });
            if (error) throw error;

            if (window.sfx) window.sfx.success();
            Boako.Util.toast('🎲 모집 글이 등록되었습니다! (+10P)');
            document.getElementById('together-write-modal-overlay').remove();
            await Boako.Together.loadPosts();

            // 🌟 팀 리그 외 활동(같이하자 모집글 등록) 성공 시 오늘의 주사위 시도 (하루 1회, 이미 굴렸으면 조용히 무시)
            Boako.Util.tryRollDailyDice();
        } catch (err) {
            console.error(err);
            Boako.Util.toast('❌ ' + (err.message || '등록에 실패했습니다.'));
        }
    },

    joinPost: async (postId) => {
        if (!Boako.state.user) {
            Boako.Util.toast('로그인 후 이용해주세요.');
            return;
        }
        try {
            const { error } = await Boako.db.rpc('fn_join_together_post', {
                p_post_id: postId,
                p_user_id: Boako.state.user.id
            });
            if (error) throw error;

            if (window.sfx) window.sfx.success();
            Boako.Util.toast('🙋 참가 완료! (+5P)');
            await Boako.Together.loadPosts();
        } catch (err) {
            console.error(err);
            Boako.Util.toast('❌ ' + (err.message || '참가에 실패했습니다.'));
        }
    },

    leavePost: async (postId) => {
        if (!confirm('참가를 취소하시겠어요?')) return;
        try {
            const { error } = await Boako.db.rpc('fn_leave_together_post', {
                p_post_id: postId,
                p_user_id: Boako.state.user.id
            });
            if (error) throw error;

            Boako.Util.toast('참가를 취소했습니다.');
            await Boako.Together.loadPosts();
        } catch (err) {
            console.error(err);
            Boako.Util.toast('❌ ' + (err.message || '취소에 실패했습니다.'));
        }
    },

    cancelPost: async (postId) => {
        if (!confirm('모집 글을 취소하시겠어요? 참가자들에게는 별도로 알려주세요.')) return;
        try {
            const { error } = await Boako.db.rpc('fn_cancel_together_post', {
                p_post_id: postId,
                p_author_id: Boako.state.user.id
            });
            if (error) throw error;

            Boako.Util.toast('모집을 취소했습니다.');
            await Boako.Together.loadPosts();
        } catch (err) {
            console.error(err);
            Boako.Util.toast('❌ ' + (err.message || '취소에 실패했습니다.'));
        }
    },

    // 🌟 카톡 공유 — 모집 카드를 피드 템플릿으로 공유 (친구초대 링크 포함)
    shareToKakao: (postId) => {
        const p = Boako.Together.State.posts.find(x => x.id === postId);
        if (!p) return;
        const dateStr = new Date(p.scheduled_date).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const gameLogo = Boako.Together.State.gameLogoMap[p.game_name] || TOGETHER_DEFAULT_LOGO;
        Boako.Util.shareToKakao({
            title: p.title || `${p.game_name || '보드게임'} 같이 하실 분 구해요`,
            description: `📅 ${dateStr} · 👥 ${p.current_count}/${p.max_participants}명 · ${p.game_name || '종목 미정'}`,
            imageUrl: gameLogo,
            view: 'together',
            postId: p.id,
            buttonTitle: '참가하기'
        });
    },

    // ========== 채팅방 입장 (메신저로 위임) ==========
    // 🌟 together_chats는 그 자체로 별도 모달을 만들지 않고, messenger.js의 통합 대화 목록에서
    // 대항전 소통채널(grandprix_match_chats)과 동일한 방식으로 렌더링됩니다.
    goToChat: async (postId) => {
        if (!Boako.state.user) {
            Boako.Util.toast('로그인 후 이용해주세요.');
            return;
        }
        if (!Boako.Messenger || !Boako.Messenger.View) {
            await Boako.Util.loadScript('js/messenger.js');
        }

        await Boako.View.render('messenger');

        // view.js가 setTimeout(0)으로 Messenger.View.renderMain()을 예약해두므로,
        // 방 목록이 채워질 시간을 준 뒤 목표 방을 열어줍니다.
        setTimeout(async () => {
            await Boako.Messenger.View.refreshRoomList();
            const uiRoomId = `together_${postId}`;
            if (Boako.Messenger.chatRooms[uiRoomId]) {
                Boako.Messenger.View.openRoom(uiRoomId);
            } else {
                Boako.Util.toast('채팅방을 찾을 수 없습니다. 잠시 후 다시 시도해주세요.');
            }
        }, 150);
    }
};

// 게임 로고를 못 찾았을 때 대체용
const TOGETHER_DEFAULT_LOGO = 'https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challenge%20(1).png';
const TOGETHER_DEFAULT_AVATAR = 'https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challenge%20(1).png';
