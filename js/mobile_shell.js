/**
 * [MOBILE SHELL] 모바일 전용 공통 뼈대 — 하단 고정 탭바 + 아바타 드로어 + 더보기 시트
 * 🌟 [신규] PC index.html의 로그인 박스(auth.js renderWidget)를 그대로 재사용하지 않고,
 *    "데이터 조회 로직은 동일하게, 화면 마크업만 모바일 전용으로 새로 작성"하는 원칙으로 만듦.
 *    Boako.db/Boako.state는 core.js를 그대로 공유하므로 PC와 로그인 세션이 완전히 동일하게 유지됨.
 * 🌟 [1단계: 뼈대 테스트] 지금은 Boako.Auth.init() 전체를 부르지 않고, 세션 확인 + 최소한의
 *    프로필/안읽은쪽지 조회만 독립적으로 수행함. PC 전용 온보딩 모달(닉네임/공지사항/시즌스플래시/
 *    활성화오버레이 등)은 화면별 포팅 단계에서 모바일에 맞게 하나씩 다시 붙일 예정 — 지금 단계에서
 *    그대로 부르면 PC 전용 DOM(#login-widget-area 등)이 없어서 에러가 남.
 * 🌟 [2단계: 화면별 포팅 시작] "랭킹" 탭에 실제 화면(mobile_team.js) 연결. 더보기 시트를
 *    다른 화면(시즌 선택 등)이 재사용할 수 있도록 openMoreSheet/openCustomSheet 추가.
 * 🌟 [명칭 정정] 하단 탭/더보기 시트의 항목 라벨을 PC 상단 메뉴바(index.html #boako-main-nav-bar)와
 *    완전히 통일 — 처음에 "팀"이라는 이름을 임의로 붙였던 걸 PC의 실제 메뉴명("🏆 랭킹")으로 수정,
 *    더보기 시트도 PC 나머지 메뉴 항목을 라벨/순서 그대로(임의 작명 없이) 채움.
 * 🌟 [신규] 더보기 버튼/개별 시트 항목에 알림 배지 — PC의 checkTogetherBadge/checkBoardRequestBadge와
 *    동일한 조회 로직 재사용. "더보기" 안에 숨은 항목에 뭔가 있으면 더보기 버튼 자체에 점을 찍어서
 *    열어보도록 유도(집계 점) + 시트를 열면 각 항목 옆에 실제 숫자 표시. realtime 구독으로 항상 최신 유지.
 *    팀챗 안읽음은 PC에서도 세션 중 증가하는 방식(DB 단순 COUNT 불가)이라 아직 집계에 안 넣음 —
 *    팀챗 화면을 모바일로 포팅할 때 실시간 구독과 함께 추가 예정.
 */
window.Boako = window.Boako || {};
Boako.MobileShell = {

    activeTab: 'feed',

    init: async () => {
        // core.js가 Boako.db를 만들지 않으므로(원래 auth.js의 init 초반부가 하던 일) 여기서 직접 생성
        if (!Boako.db) {
            Boako.db = supabase.createClient(Boako.config.url, Boako.config.key);
        }

        const { data: { session } } = await Boako.db.auth.getSession();
        if (session?.user) {
            Boako.state.user = session.user;
        }

        Boako.MobileShell.bindTabBar();
        await Boako.MobileShell.renderDrawer();
        Boako.MobileShell.renderSheet();

        // 🌟 [신규] "더보기" 안에 숨은 항목 중 알림이 있으면, 더보기 버튼 자체에 점을 찍어서
        // 클릭을 유도. PC의 checkTogetherBadge/checkBoardRequestBadge와 동일한 조회 로직 재사용.
        Boako.MobileShell.refreshMoreBadge();
        Boako.MobileShell.subscribeMoreBadge();

        // 로그인 상태 변화(로그아웃 등)에도 드로어 내용이 갱신되도록
        Boako.db.auth.onAuthStateChange(async (e, s) => {
            if (e === 'INITIAL_SESSION') return;
            Boako.state.user = s?.user || null;
            await Boako.MobileShell.renderDrawer();
        });
    },

    // ========== 하단 탭바 ==========
    bindTabBar: () => {
        document.querySelectorAll('.mobile-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => Boako.MobileShell.switchTab(btn.dataset.tab));
        });
        Boako.MobileShell.updateTabBarStyle();
    },

    switchTab: (tab) => {
        Boako.MobileShell.activeTab = tab;
        Boako.MobileShell.updateTabBarStyle();
        const area = document.getElementById('mobile-content-area');
        if (!area) return;

        // 🌟 [2단계: 화면별 포팅] "랭킹" 탭(PC의 "🏆 랭킹" 메뉴와 동일한 화면) 먼저 연결. 나머지는 아직 placeholder.
        if (tab === 'ranking') {
            (async () => {
                area.innerHTML = `<div style="padding:40px 0; text-align:center; color:#94a3b8; font-weight:700; font-size:13px;">불러오는 중...</div>`;
                if (!Boako.MobileTeam) await Boako.Util.loadScript('/js/mobile_team.js');
                Boako.MobileTeam.render(area);
            })();
        } else {
            area.innerText = `"${tab}" 탭 선택됨 (화면 포팅 예정)`;
        }
    },

    updateTabBarStyle: () => {
        document.querySelectorAll('.mobile-tab-btn').forEach(btn => {
            const isActive = btn.dataset.tab === Boako.MobileShell.activeTab;
            btn.style.color = isActive ? '#4f46e5' : '#64748b';
        });
    },

    // ========== 아바타 드로어 / 더보기 시트 열고 닫기 ==========
    openDrawer: () => {
        document.getElementById('mobile-drawer').style.transform = 'translateX(0)';
        Boako.MobileShell._showDim();
    },
    openSheet: () => {
        document.getElementById('mobile-sheet').style.transform = 'translateY(0)';
        Boako.MobileShell._showDim();
    },
    // 🌟 [신규] 하단 탭바 "더보기" 전용 — 다른 화면(예: mobile_team.js 시즌 선택)이 같은 시트 껍데기를
    // 빌려 쓴 뒤 남겨둔 내용이 있을 수 있으므로, 열기 전에 항상 기본 메뉴로 다시 그림
    openMoreSheet: () => {
        Boako.MobileShell.renderSheet();
        Boako.MobileShell.openSheet();
    },
    // 🌟 [신규] 화면별 포팅 단계에서 시트 컴포넌트를 재사용하기 위한 범용 열기 함수
    // (예: mobile_team.js의 시즌 선택 목록). 별도 UI를 새로 안 만들고 이 시트 껍데기를 빌려 씀.
    openCustomSheet: (html) => {
        const wrap = document.getElementById('mobile-sheet-content');
        if (wrap) wrap.innerHTML = html;
        Boako.MobileShell.openSheet();
    },
    closeAll: () => {
        document.getElementById('mobile-drawer').style.transform = 'translateX(100%)';
        document.getElementById('mobile-sheet').style.transform = 'translateY(100%)';
        const dim = document.getElementById('mobile-dim');
        dim.style.opacity = '0';
        dim.style.pointerEvents = 'none';
    },
    _showDim: () => {
        const dim = document.getElementById('mobile-dim');
        dim.style.opacity = '1';
        dim.style.pointerEvents = 'auto';
    },

    // ========== 아바타 드로어 내용 (PC 로그인 박스와 동일한 데이터, 마크업만 새로 그림) ==========
    renderDrawer: async () => {
        const wrap = document.getElementById('mobile-drawer-content');
        if (!wrap) return;
        const user = Boako.state.user;

        if (!user) {
            wrap.innerHTML = `
                <button onclick="Boako.Auth.login()" style="width:100%; background:#fee500; color:#181600; font-weight:900; font-size:14px; padding:12px; border-radius:10px;">🟡 카카오 로그인</button>
            `;
            return;
        }

        // 🌟 [1단계] PC renderWidget()과 동일한 조회 로직(프로필/커스텀 아바타/안읽은 쪽지 개수)을
        // 그대로 재사용 — 단, 화면 마크업은 여기서 모바일 전용으로 새로 그림.
        let customAvatarUrl = null;
        let unreadCount = 0;
        try {
            const { data: profileRow } = await Boako.db.from('profiles').select('custom_avatar_url').eq('id', user.id).single();
            customAvatarUrl = profileRow?.custom_avatar_url || null;

            const res = await Boako.db.from('messages')
                .select('message_id', { count: 'exact', head: true })
                .eq('receiver_id', user.id)
                .eq('is_read', false);
            unreadCount = res.count || 0;
        } catch (e) {
            console.error('모바일 드로어 데이터 조회 실패:', e);
        }

        const kakaoAvatarUrl = user.user_metadata?.avatar_url?.replace('http://', 'https://') || null;
        const displayAvatarUrl = customAvatarUrl || kakaoAvatarUrl;

        // 상단바의 알림 점(unread 뱃지)도 같이 갱신
        const dot = document.getElementById('mobile-avatar-dot');
        if (dot) dot.classList.toggle('hidden', unreadCount === 0);

        wrap.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; gap:8px; padding-bottom:16px; border-bottom:1px solid #e2e8f0; margin-bottom:14px;">
                <div style="width:56px; height:56px; border-radius:50%; background:#e2e8f0; overflow:hidden; display:flex; align-items:center; justify-content:center; font-size:26px;">
                    ${displayAvatarUrl ? `<img src="${displayAvatarUrl}" style="width:100%; height:100%; object-fit:cover;">` : '👤'}
                </div>
                <span style="font-size:14px; font-weight:900;">${user.nickname || '사용자'}</span>
            </div>
            <div style="display:flex; flex-direction:column; gap:2px;">
                <div style="display:flex; align-items:center; justify-content:space-between; padding:11px 4px;">
                    <span style="font-size:13px; font-weight:700;">📬 쪽지</span>
                    ${unreadCount > 0 ? `<span style="font-size:12px; color:#ef4444; font-weight:900;">${unreadCount}</span>` : ''}
                </div>
                <div style="padding:11px 4px; font-size:13px; font-weight:700;">💬 팀챗</div>
                <div style="padding:11px 4px; font-size:13px; font-weight:700;">🔬 전력분석실</div>
                <div style="padding:11px 4px; font-size:13px; font-weight:700;">🎒 인벤토리</div>
                <div onclick="Boako.Auth.copyReferralLink && Boako.Auth.copyReferralLink()" style="padding:11px 4px; font-size:13px; font-weight:700; color:#92400e;">🎁 내 초대 링크 복사</div>
            </div>
            <div style="margin-top:16px; padding-top:12px; border-top:1px solid #e2e8f0;">
                <div onclick="Boako.Auth.logout && Boako.Auth.logout()" style="padding:11px 4px; font-size:13px; font-weight:700; color:#94a3b8;">로그아웃</div>
            </div>
        `;
    },

    // ========== 더보기 시트 내용 ==========
    // 🌟 [수정] PC 상단 메뉴바(index.html #boako-main-nav-bar)의 나머지 항목을 라벨/순서 그대로 반영.
    // (하단 탭바에 이미 있는 소식지/토너먼트/랭킹만 제외) — 임의로 이름 짓지 않고 PC와 완전히 통일.
    // 관리자 전용(검수센터)/팀장 전용(기록 인증) 메뉴는 권한 체크 로직을 아직 안 붙여서 우선 제외.
    // 🌟 [신규] 같이 하자/게시판 항목에 PC와 동일한 배지 숫자(moreBadgeCounts)를 같이 표시.
    renderSheet: () => {
        const wrap = document.getElementById('mobile-sheet-content');
        if (!wrap) return;
        const c = Boako.MobileShell.moreBadgeCounts;
        const badge = (n) => n > 0 ? `<span style="background:#ef4444; color:#fff; font-size:11px; font-weight:900; min-width:18px; height:18px; border-radius:999px; display:inline-flex; align-items:center; justify-content:center; padding:0 5px;">${n}</span>` : '';
        wrap.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:2px;">
                <div style="padding:12px 4px; font-size:14px; font-weight:700;">⚡ 라이벌 매치</div>
                <div style="padding:12px 4px; font-size:14px; font-weight:700;">⚔️ 대항전</div>
                <div style="padding:12px 4px; font-size:14px; font-weight:700;">🎯 리그 콘텐츠</div>
                <div style="padding:12px 4px; font-size:14px; font-weight:700;">📋 전적기록</div>
                <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 4px; font-size:14px; font-weight:700;">
                    <span>🤝 같이 하자</span>${badge(c.together)}
                </div>
                <div style="padding:12px 4px; font-size:14px; font-weight:700;">🛡️ 팀 창단</div>
                <div style="padding:12px 4px; font-size:14px; font-weight:700;">👥 팀 목록</div>
                <div onclick="window.open('https://cafe.naver.com/boardgamearena', '_blank')" style="padding:12px 4px; font-size:14px; font-weight:700;">☕ 카페</div>
                <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 4px; font-size:14px; font-weight:700;">
                    <span>📝 게시판</span>${badge(c.boardRequest)}
                </div>
                <div style="padding:12px 4px; font-size:14px; font-weight:700;">🛒 포인트 샵</div>
                <div style="padding:12px 4px; font-size:14px; font-weight:700;">📅 일정표</div>
            </div>
        `;
    },

    // ========== 🌟 [신규] "더보기" 안에 숨은 항목의 알림 집계 (더보기 버튼 자체에 점 찍기) ==========
    // PC auth.js의 checkTogetherBadge/checkBoardRequestBadge와 완전히 동일한 조회 로직 재사용,
    // 마크업(개별 시트 행 배지 + 더보기 버튼 점)만 모바일 전용으로 새로 그림.
    // 🌟 팀챗 안읽음은 PC에서도 realtime 세션 중 증가하는 방식(DB로 단순 COUNT 불가)이라
    // 아직 여기 집계에 안 넣음 — 팀챗 화면을 모바일로 포팅할 때 실시간 구독과 함께 추가 예정.
    moreBadgeCounts: { together: 0, boardRequest: 0 },

    refreshMoreBadge: async () => {
        try {
            const { count } = await Boako.db.from('together_posts')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'RECRUITING')
                .gt('scheduled_date', new Date().toISOString());
            Boako.MobileShell.moreBadgeCounts.together = count || 0;
        } catch (e) { console.error('같이하자 배지 조회 실패:', e); }

        try {
            const { data: posts } = await Boako.db.from('board_posts')
                .select('id').eq('category', '요청').eq('is_deleted', false).eq('is_draft', false);
            const postIds = (posts || []).map(p => p.id);
            let unanswered = 0;
            if (postIds.length > 0) {
                const { data: comments } = await Boako.db.from('board_comments')
                    .select('post_id').eq('is_deleted', false).in('post_id', postIds);
                const answeredIds = new Set((comments || []).map(c => c.post_id));
                unanswered = postIds.filter(id => !answeredIds.has(id)).length;
            }
            Boako.MobileShell.moreBadgeCounts.boardRequest = unanswered;
        } catch (e) { console.error('게시판 요청 배지 조회 실패:', e); }

        const total = Boako.MobileShell.moreBadgeCounts.together + Boako.MobileShell.moreBadgeCounts.boardRequest;
        const dot = document.getElementById('mobile-more-dot');
        if (dot) dot.classList.toggle('hidden', total === 0);
    },

    subscribeMoreBadge: () => {
        if (Boako.MobileShell._moreBadgeChannel) return; // 중복 구독 방지
        Boako.MobileShell._moreBadgeChannel = Boako.db.channel('mobile-more-badge-global')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'together_posts' }, () => Boako.MobileShell.refreshMoreBadge())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'board_posts' }, () => Boako.MobileShell.refreshMoreBadge())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'board_comments' }, () => Boako.MobileShell.refreshMoreBadge())
            .subscribe();
    }
};
