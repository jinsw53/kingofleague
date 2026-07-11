/**
 * [BOARD] 공략 게시판 — 글쓰기/이미지/유튜브삽입/댓글/대댓글/공지/임시저장/추천수/인기순
 */
Boako.Board = {
    CATEGORIES: ['공략', '자유', '질문', '요청'],
    R2_UPLOAD_URL_ENDPOINT: 'https://qrredwrxdnvqwdxzanba.supabase.co/functions/v1/r2-upload-url',
    MAX_IMAGES: 15,

    State: {
        currentCategory: '공략',
        sortMode: 'latest', // 'latest' | 'popular'
        posts: [],
        currentPost: null,
        comments: [],
        badgeMap: {},
        pendingImages: [], // [{url, key}]
        selectedGameName: null,
        selectedGuideGame: null, // 공략 탭에서 선택된 게임 (null이면 게임 그리드 표시)
        currentDraftId: null,
        myLiked: false,
        isAdmin: false
    },

    GUIDE_UNSPECIFIED: '__UNSPECIFIED__',

    init: async (containerId) => {
        const root = document.getElementById(containerId);
        if (!root) return;
        Boako.Board.rootId = containerId;
        await Boako.Board.renderList();
    },

    // 🌟 [신규] 외부(검색결과 등)에서 "이 게임의 공략글로 바로 이동" 요청 시 사용
    openGuideForGame: async (gameName) => {
        Boako.Board.State.currentCategory = '공략';
        Boako.Board.State.selectedGuideGame = gameName || null;
        await Boako.Board.renderList();
    },

    // ========== 유틸 ==========

    escapeHtml: (str) => {
        const div = document.createElement('div');
        div.innerText = str || '';
        return div.innerHTML;
    },

    // 붙여넣기/드래그로 들어온 리치 HTML에서 위험 요소 제거
    // (script/style 태그, on* 속성, javascript: 링크, 유튜브 외 iframe)
    sanitizeContent: (html) => {
        const div = document.createElement('div');
        div.innerHTML = html;
        div.querySelectorAll('script, style, object, embed').forEach(el => el.remove());
        div.querySelectorAll('iframe').forEach(el => {
            const src = el.getAttribute('src') || '';
            if (!/^https:\/\/www\.youtube-nocookie\.com\/embed\//.test(src)) {
                el.remove();
            }
        });
        div.querySelectorAll('*').forEach(el => {
            [...el.attributes].forEach(attr => {
                const name = attr.name.toLowerCase();
                const value = attr.value.toLowerCase();
                if (name.startsWith('on') || value.startsWith('javascript:')) {
                    el.removeAttribute(attr.name);
                }
            });
        });
        return div.innerHTML;
    },

    timeAgo: (iso) => {
        const diffMs = Date.now() - new Date(iso).getTime();
        const min = Math.floor(diffMs / 60000);
        if (min < 1) return '방금 전';
        if (min < 60) return `${min}분 전`;
        const hr = Math.floor(min / 60);
        if (hr < 24) return `${hr}시간 전`;
        const day = Math.floor(hr / 24);
        if (day < 7) return `${day}일 전`;
        return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
    },

    compressImage: (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const maxW = 1280;
                    let { width, height } = img;
                    if (width > maxW) {
                        height = Math.round(height * (maxW / width));
                        width = maxW;
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                    canvas.toBlob((blob) => {
                        if (blob) resolve(blob);
                        else reject(new Error('이미지 압축 실패'));
                    }, 'image/webp', 0.75);
                };
                img.onerror = () => reject(new Error('이미지 로드 실패'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('파일 읽기 실패'));
            reader.readAsDataURL(file);
        });
    },

    uploadImage: async (file) => {
        if (file.type && !file.type.startsWith('image/')) {
            Boako.Util.toast('❌ 이미지 파일만 업로드 가능합니다.');
            return null;
        }
        if (Boako.Board.State.pendingImages.length >= Boako.Board.MAX_IMAGES) {
            Boako.Util.toast(`❌ 이미지는 게시글당 최대 ${Boako.Board.MAX_IMAGES}장까지 첨부할 수 있어요.`);
            return null;
        }

        try {
            const blob = await Boako.Board.compressImage(file);
            const { data: sessionData } = await Boako.db.auth.getSession();
            const token = sessionData?.session?.access_token;
            if (!token) {
                Boako.Util.toast('❌ 로그인 후 이용해주세요.');
                return null;
            }

            const uploadRes = await fetch(Boako.Board.R2_UPLOAD_URL_ENDPOINT, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'image/webp' },
                body: blob
            });
            const result = await uploadRes.json();
            if (!uploadRes.ok) throw new Error(result.error || '이미지 업로드 실패');

            Boako.Board.State.pendingImages.push({ url: result.publicUrl, key: result.key });
            return result.publicUrl;
        } catch (err) {
            console.error(err);
            Boako.Util.toast('❌ ' + (err.message || '이미지 업로드에 실패했습니다.'));
            return null;
        }
    },

    // ========== 유튜브 삽입 ==========

    extractYoutubeId: (url) => {
        const patterns = [
            /youtu\.be\/([a-zA-Z0-9_-]{11})/,
            /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
            /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
            /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
        ];
        for (const p of patterns) {
            const m = url.match(p);
            if (m) return m[1];
        }
        return null;
    },

    promptVideoEmbed: () => {
        const url = prompt('유튜브 영상 링크를 붙여넣으세요');
        if (!url) return;
        const videoId = Boako.Board.extractYoutubeId(url.trim());
        if (!videoId) {
            Boako.Util.toast('❌ 유튜브 링크만 지원합니다.');
            return;
        }
        const editor = document.getElementById('board-input-content');
        if (!editor) return;
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        wrapper.style.paddingBottom = '56.25%';
        wrapper.style.height = '0';
        wrapper.style.margin = '12px 0';
        wrapper.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${videoId}" style="position:absolute; top:0; left:0; width:100%; height:100%; border:0; border-radius:8px;" allowfullscreen></iframe>`;
        editor.appendChild(wrapper);
        editor.appendChild(document.createElement('br'));
    },

    // ========== 목록 ==========

    renderList: async () => {
        const root = document.getElementById(Boako.Board.rootId);
        if (!root) return;

        root.innerHTML = `
            <div class="main-banner" style="background:linear-gradient(135deg, #0f766e 0%, #134e4a 100%);">
                <h1>📝 아카이브 게시판</h1>
                <p>공략글, 자유로운 이야기를 나눠보세요.</p>
            </div>
            <section class="section-card">
                <div class="card-header flex justify-between items-center flex-wrap gap-3">
                    <div class="flex gap-2 flex-wrap" id="board-category-tabs">
                        ${Boako.Board.CATEGORIES.map(cat => `
                            <button onclick="Boako.Board.switchCategory('${cat}')" data-cat="${cat}" class="board-cat-btn px-4 py-2 rounded-lg text-sm font-bold transition-all relative ${Boako.Board.State.currentCategory === cat ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-500'}">
                                ${cat}
                                ${cat === '요청' ? `<span id="board-request-badge" style="display:none; position:absolute; top:-6px; right:-6px; background:#f43f5e; color:#fff; font-size:10px; font-weight:900; width:16px; height:16px; border-radius:50%; align-items:center; justify-content:center; line-height:1;">0</span>` : ''}
                            </button>
                        `).join('')}
                    </div>
                    <div class="flex gap-2 items-center flex-wrap">
                        <div class="flex gap-1 bg-slate-100 rounded-lg p-1" id="board-sort-tabs">
                            <button onclick="Boako.Board.switchSort('latest')" data-sort="latest" class="board-sort-btn px-3 py-1.5 rounded-md text-xs font-bold transition-all ${Boako.Board.State.sortMode === 'latest' ? 'bg-white shadow-sm text-teal-700' : 'text-slate-500'}">최신순</button>
                            <button onclick="Boako.Board.switchSort('popular')" data-sort="popular" class="board-sort-btn px-3 py-1.5 rounded-md text-xs font-bold transition-all ${Boako.Board.State.sortMode === 'popular' ? 'bg-white shadow-sm text-teal-700' : 'text-slate-500'}">🔥 인기순</button>
                        </div>
                        <button class="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-200 transition-colors" onclick="Boako.Board.openMyDrafts()">📝 내 임시글</button>
                        <button class="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-teal-700 transition-colors" onclick="Boako.Board.openWriteModal()">+ 글쓰기</button>
                    </div>
                </div>
                <div class="card-body" style="background:#f8fafc; padding:20px;">
                    <div id="board-list-container" class="flex flex-col gap-2">
                        <div class="text-center py-16 text-slate-400 font-bold">불러오는 중...</div>
                    </div>
                </div>
            </section>
            <div id="board-modal-root"></div>
        `;

        await Boako.Board.loadPosts();
        Boako.Board.loadRequestBadge();
    },

    loadRequestBadge: async () => {
        try {
            const { data: posts } = await Boako.db.from('board_posts')
                .select('id')
                .eq('category', '요청')
                .eq('is_deleted', false)
                .eq('is_draft', false);

            const postIds = (posts || []).map(p => p.id);
            const badge = document.getElementById('board-request-badge');
            if (!badge) return;

            if (postIds.length === 0) { badge.style.display = 'none'; return; }

            const { data: comments } = await Boako.db.from('board_comments')
                .select('post_id')
                .eq('is_deleted', false)
                .in('post_id', postIds);

            const answeredIds = new Set((comments || []).map(c => c.post_id));
            const unansweredCount = postIds.filter(id => !answeredIds.has(id)).length;

            if (unansweredCount > 0) {
                badge.textContent = unansweredCount;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        } catch (err) { console.error("요청 배지 갱신 실패:", err); }
    },

    switchCategory: (cat) => {
        Boako.Board.State.currentCategory = cat;
        Boako.Board.State.selectedGuideGame = null;
        document.querySelectorAll('.board-cat-btn').forEach(btn => {
            const isActive = btn.dataset.cat === cat;
            btn.classList.toggle('bg-teal-700', isActive);
            btn.classList.toggle('text-white', isActive);
            btn.classList.toggle('bg-slate-100', !isActive);
            btn.classList.toggle('text-slate-500', !isActive);
        });
        Boako.Board.loadPosts();
    },

    selectGuideGame: (name) => {
        Boako.Board.State.selectedGuideGame = name;
        Boako.Board.loadPosts();
    },

    backToGuideGrid: () => {
        Boako.Board.State.selectedGuideGame = null;
        Boako.Board.loadPosts();
    },

    loadGuideGameGrid: async () => {
        const container = document.getElementById('board-list-container');
        if (!container) return;

        const { data: posts, error } = await Boako.db.from('board_posts')
            .select('game_name')
            .eq('category', '공략')
            .eq('is_deleted', false)
            .eq('is_draft', false);

        if (error) {
            container.innerHTML = `<div class="text-center py-16 text-rose-400 font-bold">게시글을 불러오지 못했습니다.</div>`;
            return;
        }

        if (!posts || posts.length === 0) {
            container.innerHTML = `<div class="text-center py-16 text-slate-400 font-bold border border-dashed border-slate-300 rounded-xl bg-white">아직 공략글이 없습니다. 첫 공략글을 남겨보세요!</div>`;
            return;
        }

        const countMap = {};
        posts.forEach(p => {
            const key = p.game_name || Boako.Board.GUIDE_UNSPECIFIED;
            countMap[key] = (countMap[key] || 0) + 1;
        });

        const gameNames = Object.keys(countMap).filter(k => k !== Boako.Board.GUIDE_UNSPECIFIED);
        let logoMap = {};
        if (gameNames.length > 0) {
            const { data: games } = await Boako.db.from('games').select('game_name, image_url').in('game_name', gameNames);
            logoMap = Object.fromEntries((games || []).map(g => [g.game_name, g.image_url]));
        }

        const sortedKeys = Object.keys(countMap).sort((a, b) => countMap[b] - countMap[a]);

        container.innerHTML = `
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                ${sortedKeys.map(key => {
                    const isUnspecified = key === Boako.Board.GUIDE_UNSPECIFIED;
                    const displayName = isUnspecified ? '기타 (게임 미지정)' : key;
                    const logo = !isUnspecified ? Boako.Util.cdn(logoMap[key]) : null;
                    const clickArg = isUnspecified ? `'${Boako.Board.GUIDE_UNSPECIFIED}'` : `'${key.replace(/'/g, "\\'")}'`;
                    return `
                        <div onclick="Boako.Board.selectGuideGame(${clickArg})"
                             class="flex flex-col items-center gap-2 bg-white border border-slate-200 rounded-xl p-4 cursor-pointer hover:shadow-md hover:border-teal-300 transition-all">
                            <div class="w-16 h-16 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden">
                                ${logo ? `<img src="${logo}" class="w-full h-full object-contain p-1">` : `<span class="text-3xl">🎲</span>`}
                            </div>
                            <span class="text-xs font-bold text-slate-700 text-center truncate w-full">${Boako.Board.escapeHtml(displayName)}</span>
                            <span class="text-[10px] font-black text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">${countMap[key]}개</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    switchSort: (mode) => {
        Boako.Board.State.sortMode = mode;
        document.querySelectorAll('.board-sort-btn').forEach(btn => {
            const isActive = btn.dataset.sort === mode;
            btn.classList.toggle('bg-white', isActive);
            btn.classList.toggle('shadow-sm', isActive);
            btn.classList.toggle('text-teal-700', isActive);
            btn.classList.toggle('text-slate-500', !isActive);
        });
        Boako.Board.loadPosts();
    },

    loadPosts: async () => {
        const container = document.getElementById('board-list-container');
        if (!container) return;

        if (Boako.Board.State.currentCategory === '공략' && !Boako.Board.State.selectedGuideGame) {
            await Boako.Board.loadGuideGameGrid();
            return;
        }

        let query = Boako.db.from('board_posts').select('*').eq('is_deleted', false).eq('is_draft', false).eq('category', Boako.Board.State.currentCategory);
        if (Boako.Board.State.currentCategory === '공략' && Boako.Board.State.selectedGuideGame) {
            if (Boako.Board.State.selectedGuideGame === Boako.Board.GUIDE_UNSPECIFIED) {
                query = query.is('game_name', null);
            } else {
                query = query.eq('game_name', Boako.Board.State.selectedGuideGame);
            }
        }
        query = query.order('is_notice', { ascending: false });
        query = Boako.Board.State.sortMode === 'popular'
            ? query.order('like_count', { ascending: false })
            : query.order('created_at', { ascending: false });

        const { data: posts, error } = await query.limit(50);

        if (error) {
            console.error('게시글 로드 실패:', error);
            container.innerHTML = `<div class="text-center py-16 text-rose-400 font-bold">게시글을 불러오지 못했습니다.</div>`;
            return;
        }

        Boako.Board.State.posts = posts || [];

        if (posts.length === 0) {
            container.innerHTML = `<div class="text-center py-16 text-slate-400 font-bold border border-dashed border-slate-300 rounded-xl bg-white">아직 게시글이 없습니다. 첫 글을 남겨보세요!</div>`;
            return;
        }

        const authorIds = [...new Set(posts.map(p => p.author_id))];
        const postIds = posts.map(p => p.id);

        const [{ data: profiles }, { data: comments }] = await Promise.all([
            Boako.db.from('profiles').select('id, full_name').in('id', authorIds),
            Boako.db.from('board_comments').select('post_id').eq('is_deleted', false).in('post_id', postIds)
        ]);

        const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]));
        const commentCountMap = {};
        (comments || []).forEach(c => { commentCountMap[c.post_id] = (commentCountMap[c.post_id] || 0) + 1; });

        const backBtnHtml = (Boako.Board.State.currentCategory === '공략' && Boako.Board.State.selectedGuideGame)
            ? `<button onclick="Boako.Board.backToGuideGrid()" class="text-sm font-bold text-teal-600 hover:text-teal-700 mb-3">← 게임 목록으로</button>`
            : '';

        container.innerHTML = backBtnHtml + posts.map(p => `
            <div onclick="Boako.Board.openDetail(${p.id})" class="flex items-center justify-between gap-4 bg-white border ${p.is_notice ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200'} rounded-xl px-5 py-4 cursor-pointer hover:shadow-md transition-shadow">
                <div class="flex items-center gap-3 min-w-0 flex-1">
                    ${p.is_notice ? `<span class="text-[10px] font-black bg-amber-500 text-white px-2 py-1 rounded-md shrink-0">공지</span>` : `<span class="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded-md shrink-0">${p.category}</span>`}
                    ${p.game_name ? `<span class="text-[10px] font-bold text-teal-600 bg-teal-50 px-2 py-1 rounded-md shrink-0">🎲 ${Boako.Board.escapeHtml(p.game_name)}</span>` : ''}
                    <span class="font-bold text-slate-800 truncate">${Boako.Board.escapeHtml(p.title)}</span>
                    ${commentCountMap[p.id] ? `<span class="text-teal-600 text-xs font-black shrink-0">[${commentCountMap[p.id]}]</span>` : ''}
                </div>
                <div class="flex items-center gap-4 text-xs text-slate-400 font-bold shrink-0">
                    <span>${profileMap[p.author_id] || '익명'}</span>
                    <span>${Boako.Board.timeAgo(p.created_at)}</span>
                    ${p.like_count > 0 ? `<span class="text-rose-400">❤️ ${p.like_count}</span>` : ''}
                    <span>👁 ${p.view_count}</span>
                </div>
            </div>
        `).join('');
    },

    // ========== 임시글함 ==========

    openMyDrafts: async () => {
        if (!Boako.state.user) { Boako.Util.toast('로그인 후 이용해주세요.'); return; }

        try {
            const { data: drafts, error } = await Boako.db.rpc('fn_get_my_drafts');
            if (error) throw error;

            const modalHtml = `
                <div id="board-drafts-modal-overlay" class="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
                    <div class="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="font-black text-lg">📝 내 임시글</h3>
                            <button onclick="document.getElementById('board-drafts-modal-overlay').remove()" class="text-slate-400 font-black text-xl">×</button>
                        </div>
                        ${(!drafts || drafts.length === 0)
                            ? `<div class="text-center py-10 text-slate-400 font-bold text-sm">임시저장된 글이 없습니다.</div>`
                            : drafts.map(d => `
                                <div class="flex items-center justify-between gap-3 border border-slate-200 rounded-xl px-4 py-3 mb-2">
                                    <div class="min-w-0 flex-1">
                                        <div class="font-bold text-slate-800 truncate">${Boako.Board.escapeHtml(d.title) || '(제목 없음)'}</div>
                                        <div class="text-[11px] text-slate-400">${Boako.Board.timeAgo(d.updated_at)} 수정</div>
                                    </div>
                                    <div class="flex gap-2 shrink-0">
                                        <button onclick="document.getElementById('board-drafts-modal-overlay').remove(); Boako.Board.resumeDraft(${d.id})" class="text-xs font-bold bg-teal-600 text-white px-3 py-1.5 rounded-lg">이어쓰기</button>
                                        <button onclick="Boako.Board.deleteDraft(${d.id})" class="text-xs font-bold bg-slate-100 text-slate-500 px-3 py-1.5 rounded-lg">삭제</button>
                                    </div>
                                </div>
                            `).join('')
                        }
                    </div>
                </div>
            `;
            document.getElementById('board-modal-root').innerHTML = modalHtml;
        } catch (err) {
            Boako.Util.toast('❌ ' + (err.message || '임시글을 불러오지 못했습니다.'));
        }
    },

    resumeDraft: async (draftId) => {
        const { data: draft, error } = await Boako.db.from('board_posts').select('*').eq('id', draftId).single();
        if (error || !draft) { Boako.Util.toast('❌ 임시글을 찾을 수 없습니다.'); return; }
        await Boako.Board.openWriteModal(draft);
    },

    deleteDraft: async (draftId) => {
        if (!confirm('임시글을 삭제하시겠어요?')) return;
        try {
            const { error } = await Boako.db.rpc('fn_delete_board_post', { p_post_id: draftId });
            if (error) throw error;
            Boako.Util.toast('삭제되었습니다.');
            await Boako.Board.openMyDrafts();
        } catch (err) {
            Boako.Util.toast('❌ ' + (err.message || '삭제에 실패했습니다.'));
        }
    },

    // ========== 글쓰기 ==========

    openWriteModal: async (draft = null) => {
        if (!Boako.state.user) {
            Boako.Util.toast('로그인 후 이용해주세요.');
            return;
        }

        Boako.Board.State.selectedGameName = draft?.game_name || null;
        Boako.Board.State.currentDraftId = draft?.id || null;

        const { data: profile } = await Boako.db.from('profiles').select('is_admin').eq('id', Boako.state.user.id).single();
        Boako.Board.State.isAdmin = !!(profile && profile.is_admin);

        Boako.Board.State.pendingImages = [];
        if (draft) {
            const { data: imgs } = await Boako.db.from('board_post_images').select('image_url, r2_key').eq('post_id', draft.id);
            Boako.Board.State.pendingImages = (imgs || []).map(i => ({ url: i.image_url, key: i.r2_key }));
        }

        const root = document.getElementById(Boako.Board.rootId);
        if (!root) return;

        root.innerHTML = `
            <div class="max-w-3xl mx-auto">
                <button onclick="Boako.Board.renderList()" class="text-sm font-bold text-slate-400 hover:text-slate-600 mb-4">← 목록으로</button>

                <section class="section-card">
                    <div class="card-header">📝 ${draft ? '임시글 이어쓰기' : '글쓰기'}</div>
                    <div class="card-body">
                        <div class="flex gap-2 mb-3">
                            <select id="board-input-category" onchange="Boako.Board.onCategoryChange()" class="border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold">
                                ${Boako.Board.CATEGORIES.map(c => `<option value="${c}" ${draft?.category === c ? 'selected' : ''}>${c}</option>`).join('')}
                            </select>
                            ${Boako.Board.State.isAdmin ? `
                            <label class="flex items-center gap-2 text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3">
                                <input type="checkbox" id="board-input-notice" ${draft?.is_notice ? 'checked' : ''}> 공지글로 등록
                            </label>` : ''}
                        </div>

                        <div id="board-game-search-wrap" class="${draft?.category === '공략' ? '' : 'hidden'} mb-3 relative">
                            <label class="text-xs font-bold text-slate-600 block mb-1">다루는 게임 검색</label>
                            <input type="text" id="board-input-game-search" autocomplete="off" value="${Boako.Board.escapeHtml(draft?.game_name || '')}" placeholder="게임명을 입력해 검색하세요" oninput="Boako.Board.searchGames(this.value)" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                            <div id="board-game-search-results" class="hidden absolute z-10 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto"></div>
                        </div>

                        <input type="text" id="board-input-title" value="${Boako.Board.escapeHtml(draft?.title || '')}" placeholder="제목을 입력하세요" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold mb-3">

                        <div class="bg-sky-50 border border-sky-200 rounded-lg p-2.5 mb-2 text-[11px] font-bold text-sky-700 flex items-center justify-between flex-wrap gap-2">
                            <span>💡 PC에서는 스크린샷을 Ctrl+V로 붙여넣거나 드래그해서 넣을 수 있어요. (최대 ${Boako.Board.MAX_IMAGES}장, 자동 압축됨)</span>
                            <div class="flex gap-2 shrink-0">
                                <button type="button" onclick="Boako.Board.promptVideoEmbed()" class="bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black px-3 py-1.5 rounded-lg transition-colors">🎬 영상 추가</button>
                                <label class="bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-black px-3 py-1.5 rounded-lg cursor-pointer transition-colors">
                                    📷 사진 선택
                                    <input type="file" accept="image/*" multiple id="board-file-picker" style="display:none;">
                                </label>
                            </div>
                        </div>

                        <div id="board-input-content" contenteditable="true"
                             class="w-full min-h-[400px] border border-slate-200 rounded-lg px-3 py-3 text-sm leading-relaxed focus:outline-none focus:border-teal-500"
                             style="overflow-y:auto;" data-placeholder="내용을 입력하세요...">${draft?.content || ''}</div>
                        <div id="board-upload-indicator" class="hidden text-xs text-teal-600 font-bold mt-2">이미지 업로드 중...</div>

                        <div class="flex gap-2 mt-4">
                            <button onclick="Boako.Board.saveDraft()" class="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black py-3 rounded-xl transition-colors">임시저장</button>
                            <button onclick="Boako.Board.submitPost()" class="flex-[2] bg-teal-600 hover:bg-teal-700 text-white font-black py-3 rounded-xl transition-colors">
                                등록하기
                            </button>
                        </div>
                    </div>
                </section>
            </div>
        `;

        const editor = document.getElementById('board-input-content');

        editor.addEventListener('paste', async (e) => {
            const items = e.clipboardData?.items;
            if (items) {
                for (const item of items) {
                    if (item.type.startsWith('image/')) {
                        e.preventDefault();
                        const file = item.getAsFile();
                        await Boako.Board.handleImageInsert(file, editor);
                        return;
                    }
                }
            }

            const html = e.clipboardData?.getData('text/html');
            if (html && /<img[^>]+src=["']data:image\//i.test(html)) {
                e.preventDefault();
                await Boako.Board.handlePastedHtmlImages(html, editor);
            }
        });

        editor.addEventListener('dragover', (e) => e.preventDefault());
        editor.addEventListener('drop', async (e) => {
            e.preventDefault();
            const files = [...(e.dataTransfer?.files || [])].filter(f => f.type.startsWith('image/'));
            for (const file of files) {
                await Boako.Board.handleImageInsert(file, editor);
            }
        });

        document.getElementById('board-file-picker').addEventListener('change', async (e) => {
            const files = [...(e.target.files || [])];
            for (const file of files) {
                await Boako.Board.handleImageInsert(file, editor);
            }
            e.target.value = '';
        });
    },

    onCategoryChange: () => {
        const cat = document.getElementById('board-input-category').value;
        const wrap = document.getElementById('board-game-search-wrap');
        if (!wrap) return;
        wrap.classList.toggle('hidden', cat !== '공략');
        if (cat !== '공략') Boako.Board.State.selectedGameName = null;
    },

    searchGames: async (query) => {
        const resultsBox = document.getElementById('board-game-search-results');
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
            <div class="flex items-center gap-2 p-2 hover:bg-teal-50 cursor-pointer transition-colors" onclick="Boako.Board.selectGame('${g.game_name.replace(/'/g, "\\'")}')">
                <img src="${Boako.Util.cdn(g.image_url) || ''}" class="w-6 h-6 rounded object-contain bg-slate-50 border border-slate-100">
                <span class="text-xs font-bold text-slate-700">${g.game_name}</span>
            </div>
        `).join('');
        resultsBox.classList.remove('hidden');
    },

    selectGame: (name) => {
        Boako.Board.State.selectedGameName = name;
        const input = document.getElementById('board-input-game-search');
        if (input) input.value = name;
        const resultsBox = document.getElementById('board-game-search-results');
        if (resultsBox) resultsBox.classList.add('hidden');
    },

    handlePastedHtmlImages: async (html, editor) => {
        const indicator = document.getElementById('board-upload-indicator');
        if (indicator) indicator.classList.remove('hidden');

        const temp = document.createElement('div');
        temp.innerHTML = html;
        const imgs = temp.querySelectorAll('img[src^="data:image/"]');

        for (const imgEl of imgs) {
            try {
                const res = await fetch(imgEl.src);
                const blob = await res.blob();
                const file = new File([blob], 'pasted.png', { type: blob.type || 'image/png' });
                const url = await Boako.Board.uploadImage(file);
                if (url) imgEl.src = url;
                else imgEl.remove();
            } catch (err) {
                console.error('붙여넣은 이미지 처리 실패:', err);
                imgEl.remove();
            }
        }

        if (indicator) indicator.classList.add('hidden');
        editor.innerHTML += Boako.Board.sanitizeContent(temp.innerHTML);
    },

    handleImageInsert: async (file, editor) => {
        const indicator = document.getElementById('board-upload-indicator');
        if (indicator) indicator.classList.remove('hidden');

        const url = await Boako.Board.uploadImage(file);

        if (indicator) indicator.classList.add('hidden');
        if (!url) return;

        const img = document.createElement('img');
        img.src = url;
        img.style.maxWidth = '100%';
        img.style.borderRadius = '8px';
        img.style.margin = '8px 0';
        editor.appendChild(img);
        editor.appendChild(document.createElement('br'));
    },

    saveDraft: async () => {
        const category = document.getElementById('board-input-category').value;
        const title = document.getElementById('board-input-title').value.trim();
        const editor = document.getElementById('board-input-content');
        const gameName = category === '공략' ? (Boako.Board.State.selectedGameName || null) : null;
        const content = Boako.Board.sanitizeContent(editor.innerHTML);

        try {
            const { data: postId, error } = await Boako.db.rpc('fn_save_board_draft', {
                p_post_id: Boako.Board.State.currentDraftId,
                p_category: category,
                p_title: title,
                p_content: content,
                p_image_urls: Boako.Board.State.pendingImages,
                p_game_name: gameName
            });
            if (error) throw error;
            Boako.Board.State.currentDraftId = postId;
            Boako.Util.toast('💾 임시저장되었습니다.');
        } catch (err) {
            console.error(err);
            Boako.Util.toast('❌ ' + (err.message || '임시저장에 실패했습니다.'));
        }
    },

    submitPost: async () => {
        const category = document.getElementById('board-input-category').value;
        const title = document.getElementById('board-input-title').value.trim();
        const editor = document.getElementById('board-input-content');
        const isNotice = document.getElementById('board-input-notice')?.checked || false;
        const gameName = category === '공략' ? (Boako.Board.State.selectedGameName || null) : null;

        if (!title) { Boako.Util.toast('제목을 입력해주세요.'); return; }
        if (!editor.innerText.trim() && Boako.Board.State.pendingImages.length === 0) { Boako.Util.toast('내용을 입력해주세요.'); return; }

        const content = Boako.Board.sanitizeContent(editor.innerHTML);

        try {
            let postId;
            if (Boako.Board.State.currentDraftId) {
                const { error: saveErr } = await Boako.db.rpc('fn_save_board_draft', {
                    p_post_id: Boako.Board.State.currentDraftId,
                    p_category: category,
                    p_title: title,
                    p_content: content,
                    p_image_urls: Boako.Board.State.pendingImages,
                    p_game_name: gameName
                });
                if (saveErr) throw saveErr;

                const { error: pubErr } = await Boako.db.rpc('fn_publish_board_draft', {
                    p_post_id: Boako.Board.State.currentDraftId,
                    p_is_notice: isNotice
                });
                if (pubErr) throw pubErr;

                postId = Boako.Board.State.currentDraftId;
            } else {
                const { data, error } = await Boako.db.rpc('fn_create_board_post', {
                    p_category: category,
                    p_title: title,
                    p_content: content,
                    p_is_notice: isNotice,
                    p_image_urls: Boako.Board.State.pendingImages,
                    p_game_name: gameName
                });
                if (error) throw error;
                postId = data;
            }

            if (window.sfx) window.sfx.success();
            Boako.Util.toast('✅ 게시글이 등록되었습니다!');
            Boako.Board.State.currentDraftId = null;
            await Boako.Board.openDetail(postId);
        } catch (err) {
            console.error(err);
            Boako.Util.toast('❌ ' + (err.message || '등록에 실패했습니다.'));
        }
    },

    // ========== 상세 ==========

    openDetail: async (postId) => {
        const root = document.getElementById(Boako.Board.rootId);
        if (!root) return;

        root.innerHTML = `<div class="text-center py-20 text-slate-400 font-bold">불러오는 중...</div>`;

        const { data: post, error } = await Boako.db.from('board_posts').select('*').eq('id', postId).eq('is_deleted', false).single();
        if (error || !post) {
            root.innerHTML = `<div class="text-center py-20 text-rose-400 font-bold">게시글을 찾을 수 없습니다.</div>`;
            return;
        }

        Boako.Board.State.currentPost = post;
        Boako.db.rpc('fn_increment_post_view', { p_post_id: postId });

        if (Boako.state.user) {
            const { data: myLike } = await Boako.db.from('board_likes').select('id').eq('post_id', postId).eq('user_id', Boako.state.user.id).maybeSingle();
            Boako.Board.State.myLiked = !!myLike;
        } else {
            Boako.Board.State.myLiked = false;
        }

        const { data: comments } = await Boako.db.from('board_comments').select('*').eq('post_id', postId).eq('is_deleted', false).order('created_at', { ascending: true });
        Boako.Board.State.comments = comments || [];

        const allAuthorIds = [...new Set([post.author_id, ...(comments || []).map(c => c.author_id)])];
        const [{ data: profiles }, { data: equipped }] = await Promise.all([
            Boako.db.from('profiles').select('id, full_name').in('id', allAuthorIds),
            Boako.db.from('inventory').select('user_id, item_id').eq('is_equipped', true).in('user_id', allAuthorIds)
        ]);

        const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]));

        const normalItemIds = [...new Set((equipped || []).filter(r => !r.item_id.startsWith('item_supporter_badge_')).map(r => r.item_id))];
        let shopMap = {};
        if (normalItemIds.length > 0) {
            const { data: shopRows } = await Boako.db.from('shop_items').select('item_id, name, icon').in('item_id', normalItemIds);
            shopMap = Object.fromEntries((shopRows || []).map(s => [s.item_id, s]));
        }

        const badgeMap = {};
        (equipped || []).forEach(row => {
            if (!badgeMap[row.user_id]) badgeMap[row.user_id] = [];
            if (!row.item_id.startsWith('item_supporter_badge_')) {
                const s = shopMap[row.item_id];
                if (s) badgeMap[row.user_id].push(s);
            }
        });
        Boako.Board.State.badgeMap = badgeMap;
        Boako.Board.State.profileMap = profileMap;

        Boako.Board.renderDetail();
    },

    toggleLike: async () => {
        if (!Boako.state.user) { Boako.Util.toast('로그인 후 이용해주세요.'); return; }
        try {
            const { error } = await Boako.db.rpc('fn_toggle_board_like', { p_post_id: Boako.Board.State.currentPost.id });
            if (error) throw error;
            if (window.sfx) window.sfx.click();
            await Boako.Board.openDetail(Boako.Board.State.currentPost.id);
        } catch (err) {
            Boako.Util.toast('❌ ' + (err.message || '처리에 실패했습니다.'));
        }
    },

    renderAuthorLine: (authorId) => {
        const name = Boako.Board.State.profileMap?.[authorId] || '익명';
        const badges = Boako.Board.State.badgeMap[authorId] || [];
        const isMe = Boako.state.user && authorId === Boako.state.user.id;
        const badgeHtml = badges.map(b => {
            const iconHtml = (b.icon && b.icon.startsWith('http'))
                ? `<img src="${Boako.Util.cdn(b.icon)}" class="w-4 h-4 rounded-full object-cover" title="${b.name}">`
                : `<span title="${b.name}">${b.icon || '🏅'}</span>`;
            return iconHtml;
        }).join('');

        return `
            <span class="font-bold text-slate-700 ${isMe ? '' : 'cursor-pointer hover:text-teal-600 hover:underline'}"
                  ${isMe ? '' : `onclick="Boako.Board.openMessageModal('${authorId}', '${(name || '').replace(/'/g, "\\'")}')"`}>${name}</span>
            ${badgeHtml ? `<span class="inline-flex items-center gap-0.5 ml-1">${badgeHtml}</span>` : ''}
        `;
    },

    renderDetail: () => {
        const root = document.getElementById(Boako.Board.rootId);
        const post = Boako.Board.State.currentPost;
        const myId = Boako.state.user?.id;
        const isAuthor = myId === post.author_id;

        const topComments = Boako.Board.State.comments.filter(c => !c.parent_comment_id);
        const repliesOf = (id) => Boako.Board.State.comments.filter(c => c.parent_comment_id === id);

        const renderComment = (c, isReply) => {
            const canDelete = myId === c.author_id || Boako.Board.State.isAdmin;
            return `
                <div class="${isReply ? 'ml-8 border-l-2 border-slate-100 pl-4' : ''} py-3 ${isReply ? '' : 'border-b border-slate-100'}">
                    <div class="flex items-center justify-between mb-1">
                        <div class="flex items-center gap-2 text-sm">
                            ${Boako.Board.renderAuthorLine(c.author_id)}
                            <span class="text-[11px] text-slate-400">${Boako.Board.timeAgo(c.created_at)}</span>
                        </div>
                        <div class="flex items-center gap-3 text-[11px] font-bold text-slate-400">
                            ${!isReply ? `<button onclick="Boako.Board.toggleReplyForm(${c.id})" class="hover:text-teal-600">답글</button>` : ''}
                            ${canDelete ? `<button onclick="Boako.Board.deleteComment(${c.id})" class="hover:text-rose-500">삭제</button>` : ''}
                        </div>
                    </div>
                    <p class="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">${Boako.Board.escapeHtml(c.content)}</p>
                    ${!isReply ? `<div id="reply-form-${c.id}" class="hidden mt-2"></div>` : ''}
                    ${!isReply ? repliesOf(c.id).map(r => renderComment(r, true)).join('') : ''}
                </div>
            `;
        };

        root.innerHTML = `
            <div class="max-w-3xl mx-auto">
                <button onclick="Boako.Board.renderList()" class="text-sm font-bold text-slate-400 hover:text-slate-600 mb-4">← 목록으로</button>

                <section class="section-card">
                    <div class="card-body">
                        <div class="flex items-center gap-2 mb-2">
                            ${post.is_notice ? `<span class="text-[11px] font-black bg-amber-500 text-white px-2.5 py-1 rounded-md">공지</span>` : `<span class="text-[11px] font-black bg-slate-100 text-slate-500 px-2.5 py-1 rounded-md">${post.category}</span>`}
                            ${post.game_name ? `<span class="text-[11px] font-bold text-teal-600 bg-teal-50 px-2.5 py-1 rounded-md">🎲 ${Boako.Board.escapeHtml(post.game_name)}</span>` : ''}
                        </div>
                        <h1 class="text-2xl font-black text-slate-900 mb-3">${Boako.Board.escapeHtml(post.title)}</h1>
                        <div class="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                            <div class="flex items-center gap-2 text-sm">
                                ${Boako.Board.renderAuthorLine(post.author_id)}
                                <span class="text-[11px] text-slate-400">${Boako.Board.timeAgo(post.created_at)}</span>
                                <span class="text-[11px] text-slate-400">· 👁 ${post.view_count}</span>
                            </div>
                            ${isAuthor || Boako.Board.State.isAdmin ? `
                            <div class="flex gap-2 text-xs font-bold">
                                ${isAuthor ? `<button onclick="Boako.Board.openEditModal()" class="text-slate-400 hover:text-slate-600">수정</button>` : ''}
                                <button onclick="Boako.Board.deletePost()" class="text-slate-400 hover:text-rose-500">삭제</button>
                            </div>` : ''}
                        </div>
                        <div class="prose max-w-none text-slate-800 leading-relaxed">${post.content}</div>

                        <div class="flex justify-center mt-6 pt-4 border-t border-slate-100">
                            ${isAuthor
                                ? `<div class="flex items-center gap-2 text-sm font-black px-6 py-2.5 rounded-xl bg-slate-50 text-slate-400 border border-slate-200">🤍 추천 ${post.like_count || 0} <span class="text-[10px] font-bold">(본인 글)</span></div>`
                                : `<button onclick="Boako.Board.toggleLike()" class="flex items-center gap-2 text-sm font-black px-6 py-2.5 rounded-xl transition-colors ${Boako.Board.State.myLiked ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'}">${Boako.Board.State.myLiked ? '❤️' : '🤍'} 추천 ${post.like_count || 0}</button>`
                            }
                        </div>
                    </div>
                </section>

                <section class="section-card mt-6">
                    <div class="card-header">💬 댓글 ${Boako.Board.State.comments.length}개</div>
                    <div class="card-body">
                        <div class="flex gap-2 mb-6">
                            <input type="text" id="board-comment-input" placeholder="댓글을 입력하세요" class="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm" onkeydown="if(event.key==='Enter') Boako.Board.submitComment(null)">
                            <button onclick="Boako.Board.submitComment(null)" class="bg-slate-800 hover:bg-slate-900 text-white font-bold px-5 rounded-lg text-sm">등록</button>
                        </div>
                        <div id="board-comment-list">
                            ${topComments.length === 0 ? `<div class="text-center py-10 text-slate-400 font-bold text-sm">첫 댓글을 남겨보세요!</div>` : topComments.map(c => renderComment(c, false)).join('')}
                        </div>
                    </div>
                </section>
            </div>
        `;
    },

    toggleReplyForm: (commentId) => {
        const el = document.getElementById(`reply-form-${commentId}`);
        if (!el) return;
        if (!el.classList.contains('hidden')) {
            el.classList.add('hidden');
            el.innerHTML = '';
            return;
        }
        el.classList.remove('hidden');
        el.innerHTML = `
            <div class="flex gap-2">
                <input type="text" id="board-reply-input-${commentId}" placeholder="답글을 입력하세요" class="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-xs" onkeydown="if(event.key==='Enter') Boako.Board.submitComment(${commentId})">
                <button onclick="Boako.Board.submitComment(${commentId})" class="bg-teal-600 hover:bg-teal-700 text-white font-bold px-4 rounded-lg text-xs">등록</button>
            </div>
        `;
    },

    submitComment: async (parentId) => {
        if (!Boako.state.user) { Boako.Util.toast('로그인 후 이용해주세요.'); return; }
        const inputEl = parentId ? document.getElementById(`board-reply-input-${parentId}`) : document.getElementById('board-comment-input');
        const content = inputEl.value.trim();
        if (!content) return;

        try {
            const { error } = await Boako.db.rpc('fn_create_board_comment', {
                p_post_id: Boako.Board.State.currentPost.id,
                p_parent_comment_id: parentId,
                p_content: content
            });
            if (error) throw error;

            inputEl.value = '';
            await Boako.Board.openDetail(Boako.Board.State.currentPost.id);
        } catch (err) {
            Boako.Util.toast('❌ ' + (err.message || '댓글 등록에 실패했습니다.'));
        }
    },

    deleteComment: async (commentId) => {
        if (!confirm('댓글을 삭제하시겠어요?')) return;
        try {
            const { error } = await Boako.db.rpc('fn_delete_board_comment', { p_comment_id: commentId });
            if (error) throw error;
            await Boako.Board.openDetail(Boako.Board.State.currentPost.id);
        } catch (err) {
            Boako.Util.toast('❌ ' + (err.message || '삭제에 실패했습니다.'));
        }
    },

    deletePost: async () => {
        if (!confirm('게시글을 삭제하시겠어요?')) return;
        try {
            const { error } = await Boako.db.rpc('fn_delete_board_post', { p_post_id: Boako.Board.State.currentPost.id });
            if (error) throw error;
            Boako.Util.toast('삭제되었습니다.');
            await Boako.Board.renderList();
        } catch (err) {
            Boako.Util.toast('❌ ' + (err.message || '삭제에 실패했습니다.'));
        }
    },

    openEditModal: () => {
        const post = Boako.Board.State.currentPost;
        const modalHtml = `
            <div id="board-edit-modal-overlay" class="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
                <div class="bg-white rounded-2xl w-full max-w-2xl p-6 max-h-[92vh] overflow-y-auto">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="font-black text-lg">✏️ 글 수정</h3>
                        <button onclick="document.getElementById('board-edit-modal-overlay').remove()" class="text-slate-400 font-black text-xl">×</button>
                    </div>
                    <input type="text" id="board-edit-title" value="${Boako.Board.escapeHtml(post.title)}" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold mb-3">
                    <div id="board-edit-content" contenteditable="true" class="w-full min-h-[240px] border border-slate-200 rounded-lg px-3 py-3 text-sm leading-relaxed">${post.content}</div>
                    <button onclick="Boako.Board.submitEdit()" class="w-full bg-teal-600 hover:bg-teal-700 text-white font-black py-3 rounded-xl mt-4">저장</button>
                </div>
            </div>
        `;
        document.getElementById('board-modal-root')?.remove();
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    submitEdit: async () => {
        const title = document.getElementById('board-edit-title').value.trim();
        const content = Boako.Board.sanitizeContent(document.getElementById('board-edit-content').innerHTML);
        if (!title) { Boako.Util.toast('제목을 입력해주세요.'); return; }

        try {
            const { error } = await Boako.db.rpc('fn_update_board_post', {
                p_post_id: Boako.Board.State.currentPost.id,
                p_title: title,
                p_content: content
            });
            if (error) throw error;
            document.getElementById('board-edit-modal-overlay').remove();
            Boako.Util.toast('✅ 수정되었습니다.');
            await Boako.Board.openDetail(Boako.Board.State.currentPost.id);
        } catch (err) {
            Boako.Util.toast('❌ ' + (err.message || '수정에 실패했습니다.'));
        }
    },

    // ========== 쪽지 보내기 ==========

    openMessageModal: async (authorId, authorName) => {
        if (!Boako.state.user) { Boako.Util.toast('로그인 후 이용해주세요.'); return; }
        if (authorId === Boako.state.user.id) return;

        if (!Boako.Messenger || !Boako.Messenger.sendDirect) {
            await Boako.Util.loadScript('js/messenger.js');
        }

        const modalHtml = `
            <div id="board-msg-modal-overlay" class="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
                <div class="bg-white rounded-2xl w-full max-w-sm p-6">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="font-black text-base">💬 ${authorName} 님에게 쪽지</h3>
                        <button onclick="document.getElementById('board-msg-modal-overlay').remove()" class="text-slate-400 font-black text-xl">×</button>
                    </div>
                    <textarea id="board-msg-input" rows="4" placeholder="메시지를 입력하세요" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3"></textarea>
                    <button onclick="Boako.Board.sendMessage('${authorId}', '${authorName.replace(/'/g, "\\'")}')" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-2.5 rounded-xl">보내기</button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    sendMessage: async (authorId, authorName) => {
        const content = document.getElementById('board-msg-input').value.trim();
        if (!content) return;

        const success = await Boako.Messenger.sendDirect(authorId, content, authorName);
        document.getElementById('board-msg-modal-overlay')?.remove();
        Boako.Util.toast(success ? '💬 쪽지를 보냈습니다.' : '❌ 전송에 실패했습니다.');
    }
};
