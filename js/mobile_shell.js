/**
 * [MOBILE SHELL] 모바일 전용 공통 뼈대 — 하단 고정 탭바 + 아바타 드로어 + 더보기 시트
 * 🌟 [신규] PC index.html의 로그인 박스(auth.js renderWidget)를 그대로 재사용하지 않고,
 *    "데이터 조회 로직은 동일하게, 화면 마크업만 모바일 전용으로 새로 작성"하는 원칙으로 만듦.
 *    Boako.db/Boako.state는 core.js를 그대로 공유하므로 PC와 로그인 세션이 완전히 동일하게 유지됨.
 * 🌟 [버그수정] Boako.Team.syncStatus()가 profiles.full_name을 조회해서
 *    Boako.state.user.nickname을 채우는 유일한 지점이었는데(PC auth.js도 로그인마다 이걸 부름),
 *    처음엔 여기서 이걸 안 불러서 닉네임이 항상 비어 하드코딩된 "사용자"만 뜨던 문제 — init()/
 *    onAuthStateChange 양쪽에서 호출하도록 수정. 팀 소속 여부(Boako.state.team)도 같은 함수가
 *    채움 — PC 전용 DOM 참조는 전부 null 가드돼있어 모바일에서 그대로 불러도 안전해서 재구현 없이
 *    그대로 재사용(드로어에 팀 소속 배지도 같이 추가).
 * 🌟 [버그수정] 상단바 아바타가 항상 👤 고정 이모지였던 문제 — 드로어의 프사 계산(커스텀/카카오)과
 *    같은 값으로 상단바 이미지도 함께 갱신하도록 renderDrawer()에서 한 번에 처리(두 곳이 따로
 *    놀지 않도록 단일 지점에서 동기화).
 * 🌟 [2단계: 화면별 포팅] "랭킹"(mobile_team.js), "소식지"(mobile_newsfeed.js),
 *    "토너먼트"(mobile_tournament.js) 연결 완료. 더보기 시트를 다른 화면(시즌 선택 등)이
 *    재사용할 수 있도록 openMoreSheet/openCustomSheet 추가.
 *    앱 최초 로드 시 PC의 View.render('main')과 동일하게 소식지 탭을 기본으로 자동 로드.
 * 🌟 [명칭 정정] 하단 탭/더보기 시트의 항목 라벨을 PC 상단 메뉴바(index.html #boako-main-nav-bar)와
 *    완전히 통일 — 처음에 "팀"이라는 이름을 임의로 붙였던 걸 PC의 실제 메뉴명("🏆 랭킹")으로 수정,
 *    더보기 시트도 PC 나머지 메뉴 항목을 라벨/순서 그대로(임의 작명 없이) 채움.
 * 🌟 [신규] 더보기 버튼/개별 시트 항목에 알림 배지 — PC의 checkTogetherBadge/checkBoardRequestBadge와
 *    동일한 조회 로직 재사용. "더보기" 안에 숨은 항목에 뭔가 있으면 더보기 버튼 자체에 점을 찍어서
 *    열어보도록 유도(집계 점) + 시트를 열면 각 항목 옆에 실제 숫자 표시. realtime 구독으로 항상 최신 유지.
 *    팀챗 안읽음은 PC에서도 세션 중 증가하는 방식(DB 단순 COUNT 불가)이라 아직 집계에 안 넣음 —
 *    팀챗 화면을 모바일로 포팅할 때 실시간 구독과 함께 추가 예정.
 * 🌟 [신규] 친구 초대 링크 적용 — captureReferralParam()/applyPendingReferral()이 이 파일 자체엔
 *    없었고 auth.js에만 정의돼있어서 로드는 되지만 아무도 안 부르고 있었음(초대 링크로 모바일에서
 *    가입해도 추천인 연결이 안 됐던 문제). 두 함수 다 DOM 의존이 없어 그대로 재사용해서 init()/
 *    onAuthStateChange 양쪽에서 호출하도록 추가.
 * 🌟 [신규] BGA 닉네임 설정 — PC의 requireBgaNickname()/saveInitialNick()은 마지막에
 *    Boako.Auth.renderWidget()을 불러 PC 전용 DOM(#login-widget-area)에서 에러가 나므로 그대로
 *    재사용 불가. 같은 조회/저장 로직(profiles.is_nick_changed, full_name)을 유지하되 화면은
 *    모바일 원칙대로 중앙 모달 대신 풀스크린 시트로 새로 작성.
 * 🌟 [신규] 실시간 알림 4종(쪽지/업적/라이벌결과/추천보너스) 구독 — achievements.js/rival_notify.js/
 *    recommend_notify.js는 자기 완결형 풀스크린 오버레이만 그려서 PC DOM 의존이 없어 그대로 재사용.
 *    messenger.js만 예외 — startRealtime() 콜백이 Boako.Auth.renderWidget()을 무조건 불러서 모바일에서
 *    에러가 나(토스트까지 못 뜨고 멈춤), 안읽은 개수 갱신+토스트만 필요한 부분을 모바일 전용으로 새로 작성.
 */
window.Boako = window.Boako || {};
Boako.MobileShell = {

    activeTab: 'feed',

    init: async () => {
        // 🌟 [신규] 친구 초대 링크(?ref=추천인id) 캡처 — PC auth.js와 동일하게, Boako.db 생성보다도
        // 먼저(로그인 여부 무관하게) 실행돼야 함. Boako.Auth.captureReferralParam은 DOM 의존이
        // 전혀 없어(localStorage만 다룸) 그대로 재사용 가능.
        Boako.Auth.captureReferralParam();

        // core.js가 Boako.db를 만들지 않으므로(원래 auth.js의 init 초반부가 하던 일) 여기서 직접 생성
        if (!Boako.db) {
            Boako.db = supabase.createClient(Boako.config.url, Boako.config.key);
        }

        const { data: { session } } = await Boako.db.auth.getSession();
        if (session?.user) {
            Boako.state.user = session.user;
        }

        // 🌟 [버그수정] Boako.Team.syncStatus()가 profiles.full_name을 조회해서
        // Boako.state.user.nickname을 채우는 유일한 지점이었는데(PC auth.js도 로그인마다 이걸 부름),
        // 여기서 안 부르니 닉네임이 항상 비어서 하드코딩된 "사용자"만 뜨던 문제.
        // 팀 소속 여부(Boako.state.team)도 같은 함수가 채움 — PC 전용 DOM 참조는 전부
        // null 가드돼있어 모바일에서 그대로 불러도 안전해서 재구현 없이 그대로 재사용.
        if (Boako.state.user) {
            if (!Boako.Team.syncStatus) await Boako.Util.loadScript('/js/team.js');
            await Boako.Team.syncStatus();

            // 🌟 [신규] 대기 중인 추천인이 있으면 적용(1회성, 이미 있으면 무시) —
            // Boako.Auth.applyPendingReferral도 DOM 의존 없이 RPC만 부르므로 그대로 재사용.
            await Boako.Auth.applyPendingReferral();

            // 🌟 [신규] BGA 닉네임 미설정 유저는 기록이 영원히 매칭 안 되므로 최우선으로 확인.
            // PC의 requireBgaNickname()/saveInitialNick()은 마지막에 Boako.Auth.renderWidget()을
            // 불러 PC 전용 DOM(#login-widget-area)에서 에러가 나서, 모바일 전용으로 새로 작성.
            await Boako.MobileShell.requireBgaNickname();

            // 🌟 [신규] 실시간 알림 4종 구독. achievements/rival_notify/recommend_notify는
            // 자기 완결형 풀스크린 오버레이만 그려서 PC 전용 DOM 의존이 없어 그대로 재사용 가능.
            // messenger.js만 예외 — startRealtime() 콜백이 Boako.Auth.renderWidget()을 무조건
            // 불러서 모바일에서 에러가 나(토스트까지 못 뜨고 멈춤), 그 부분만 모바일 전용으로 새로 작성.
            Boako.MobileShell.startMessengerRealtime();
            if (!Boako.Achievements) await Boako.Util.loadScript('/js/achievements.js');
            Boako.Achievements.startRealtime();
            Boako.Achievements.checkUnseenAchievements();
            if (!Boako.RivalNotify) await Boako.Util.loadScript('/js/rival_notify.js');
            Boako.RivalNotify.startRealtime();
            Boako.RivalNotify.checkUnseenResults();
            if (!Boako.RecommendNotify) await Boako.Util.loadScript('/js/recommend_notify.js');
            Boako.RecommendNotify.startRealtime();
            Boako.RecommendNotify.checkUnseenResults();
        }

        Boako.MobileShell.bindTabBar();
        await Boako.MobileShell.renderDrawer();
        Boako.MobileShell.renderSheet();

        // 🌟 [신규] "더보기" 안에 숨은 항목 중 알림이 있으면, 더보기 버튼 자체에 점을 찍어서
        // 클릭을 유도. PC의 checkTogetherBadge/checkBoardRequestBadge와 동일한 조회 로직 재사용.
        Boako.MobileShell.refreshMoreBadge();
        Boako.MobileShell.subscribeMoreBadge();

        // 🌟 [신규] PC가 첫 로드 시 View.render('main')(=소식지)을 그리는 것과 동일하게,
        // 모바일도 앱을 열자마자 하단 탭바의 기본 탭(소식지)을 자동으로 로드
        Boako.MobileShell.switchTab('feed');

        // 로그인 상태 변화(로그아웃 등)에도 드로어 내용이 갱신되도록
        Boako.db.auth.onAuthStateChange(async (e, s) => {
            if (e === 'INITIAL_SESSION') return;
            Boako.state.user = s?.user || null;
            if (Boako.state.user) {
                if (!Boako.Team.syncStatus) await Boako.Util.loadScript('/js/team.js');
                await Boako.Team.syncStatus();
                await Boako.Auth.applyPendingReferral();
                await Boako.MobileShell.requireBgaNickname();

                Boako.MobileShell.startMessengerRealtime();
                if (!Boako.Achievements) await Boako.Util.loadScript('/js/achievements.js');
                Boako.Achievements.startRealtime();
                Boako.Achievements.checkUnseenAchievements();
                if (!Boako.RivalNotify) await Boako.Util.loadScript('/js/rival_notify.js');
                Boako.RivalNotify.startRealtime();
                Boako.RivalNotify.checkUnseenResults();
                if (!Boako.RecommendNotify) await Boako.Util.loadScript('/js/recommend_notify.js');
                Boako.RecommendNotify.startRealtime();
                Boako.RecommendNotify.checkUnseenResults();
            } else {
                Boako.state.team = null;
                Boako.MobileShell.stopMessengerRealtime();
                if (Boako.Achievements?.stopRealtime) Boako.Achievements.stopRealtime();
                if (Boako.RivalNotify?.stopRealtime) Boako.RivalNotify.stopRealtime();
                if (Boako.RecommendNotify?.stopRealtime) Boako.RecommendNotify.stopRealtime();
            }
            await Boako.MobileShell.renderDrawer();
        });
    },

    // ========== 🌟 [신규] BGA 닉네임 설정 (PC requireBgaNickname/saveInitialNick과 동일 로직,
    // 모달 대신 모바일 원칙에 따라 풀스크린 시트로 새로 작성) ==========
    requireBgaNickname: async () => {
        if (document.getElementById('mobile-nick-modal')) return;

        try {
            const { data: profile } = await Boako.db.from('profiles')
                .select('is_nick_changed')
                .eq('id', Boako.state.user.id)
                .single();
            if (profile && profile.is_nick_changed === 1) return; // 이미 설정한 유저 — 다시 안 띄움
        } catch (e) {
            console.error('닉네임 변경 여부 확인 실패:', e);
            return; // 확인 자체가 실패하면 억지로 안 띄움 (PC와 달리 재시도 없이 조용히 넘어감)
        }

        const modalHtml = `
            <div id="mobile-nick-modal" style="position:fixed; inset:0; z-index:9999; background:#fff; display:flex; flex-direction:column; padding:24px 20px; padding-top:calc(24px + env(safe-area-inset-top));">
                <div style="text-align:center; margin-top:24px;">
                    <div style="font-size:40px; margin-bottom:10px;">🎮</div>
                    <div style="font-size:18px; font-weight:900; color:#1e293b;">BGA 닉네임 설정</div>
                    <div style="font-size:12px; color:#94a3b8; font-weight:700; margin-top:6px;">리그 기록 연동을 위해 꼭 필요해요!</div>
                </div>
                <div style="margin-top:28px;">
                    <div style="font-size:12.5px; color:#64748b; font-weight:700; text-align:center; line-height:1.6; margin-bottom:14px;">
                        보드게임 아레나에서 사용 중인<br><span style="color:#ef4444;">정확한 닉네임</span>을 입력해주세요.
                    </div>
                    <a href="https://boardgamearena.com/" target="_blank" rel="noopener" style="display:block; text-align:center; font-size:12px; font-weight:900; color:#4f46e5; margin-bottom:16px;">BGA에서 내 닉네임 확인하러 가기 →</a>
                    <input type="text" id="mobile-nick-input" value="${Boako.state.user.nickname || ''}" placeholder="대소문자 구별하여 정확히 입력" style="width:100%; border:2px solid #e2e8f0; border-radius:12px; padding:14px; text-align:center; font-weight:900; font-size:16px; color:#1e293b;">
                </div>
                <div style="flex:1;"></div>
                <button onclick="Boako.MobileShell.saveInitialNick()" style="width:100%; background:#1e293b; color:#fff; font-weight:900; font-size:14px; padding:15px; border-radius:12px;">확인 및 설정 완료</button>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    saveInitialNick: async () => {
        const inputEl = document.getElementById('mobile-nick-input');
        const newValue = inputEl.value.trim();
        if (!newValue) {
            Boako.Util.toast('닉네임을 입력해 주세요!');
            inputEl.focus();
            return;
        }

        try {
            const { error } = await Boako.db.from('profiles').update({
                full_name: newValue,
                is_nick_changed: 1
            }).eq('id', Boako.state.user.id);
            if (error) throw new Error(error.message);

            Boako.state.user.nickname = newValue;
            document.getElementById('mobile-nick-modal')?.remove();
            await Boako.MobileShell.renderDrawer(); // 🌟 PC의 renderWidget() 대신 모바일 드로어 갱신
            Boako.Util.toast('🎉 BGA 닉네임이 완벽하게 연동되었습니다!');
        } catch (e) {
            Boako.Util.toast('수정 실패: ' + e.message);
        }
    },

    // ========== 🌟 [신규] 쪽지 실시간 알림 (모바일 전용 — messenger.js의 startRealtime()을
    // 그대로 재사용하지 않는 유일한 예외). PC 버전은 새 쪽지 도착 시 Boako.Auth.renderWidget()과
    // Boako.Messenger.View.refreshRoomList()를 무조건 부르는데, 둘 다 PC 전용 DOM(#login-widget-area,
    // #chat-room-list 등)이 없으면 에러가 나서 그 뒤에 있는 토스트 코드까지 실행이 안 됨.
    // 안읽은 개수 갱신(=아바타 드로어 재렌더)과 토스트만 필요한 부분이라 가볍게 새로 작성.
    _messengerChannel: null,

    startMessengerRealtime: () => {
        if (!Boako.state.user || Boako.MobileShell._messengerChannel) return;
        Boako.MobileShell._messengerChannel = Boako.db.channel('mobile-messages-changes')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
                const newMsg = payload.new;
                const myId = Boako.state.user.id;
                if (newMsg.receiver_id === myId || newMsg.sender_id === myId) {
                    await Boako.MobileShell.renderDrawer(); // 안읽은 쪽지 수 재조회 + 상단바/드로어 배지 갱신
                    if (newMsg.receiver_id === myId) Boako.Util.toast(`💬 ${newMsg.sender_name_override}님의 쪽지가 도착했습니다!`);
                }
            }).subscribe();
    },

    stopMessengerRealtime: () => {
        if (Boako.MobileShell._messengerChannel) {
            Boako.db.removeChannel(Boako.MobileShell._messengerChannel);
            Boako.MobileShell._messengerChannel = null;
        }
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

        // 🌟 [2단계: 화면별 포팅] "랭킹"에 이어 "소식지"/"토너먼트"도 연결. 나머지는 아직 placeholder.
        if (tab === 'ranking') {
            (async () => {
                area.innerHTML = `<div style="padding:40px 0; text-align:center; color:#94a3b8; font-weight:700; font-size:13px;">불러오는 중...</div>`;
                if (!Boako.MobileTeam) await Boako.Util.loadScript('/js/mobile_team.js');
                Boako.MobileTeam.render(area);
            })();
        } else if (tab === 'feed') {
            (async () => {
                area.innerHTML = `<div style="padding:40px 0; text-align:center; color:#94a3b8; font-weight:700; font-size:13px;">불러오는 중...</div>`;
                if (!Boako.MobileNewsfeed) await Boako.Util.loadScript('/js/mobile_newsfeed.js');
                Boako.MobileNewsfeed.render(area);
            })();
        } else if (tab === 'tournament') {
            (async () => {
                area.innerHTML = `<div style="padding:40px 0; text-align:center; color:#94a3b8; font-weight:700; font-size:13px;">불러오는 중...</div>`;
                if (!Boako.MobileTournament) await Boako.Util.loadScript('/js/mobile_tournament.js');
                Boako.MobileTournament.render(area);
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

        // 🌟 [버그수정] 상단바 아바타가 항상 👤 이모지 고정이었던 문제 — 드로어 계산과 같은
        // displayAvatarUrl로 상단바 이미지도 동시에 갱신 (두 군데 로직이 따로 놀지 않도록 한 곳에서 처리)
        const topbarImg = document.getElementById('mobile-avatar-img');
        const topbarEmoji = document.getElementById('mobile-avatar-emoji');
        if (displayAvatarUrl) {
            if (topbarImg) { topbarImg.src = displayAvatarUrl; topbarImg.classList.remove('hidden'); }
            if (topbarEmoji) topbarEmoji.classList.add('hidden');
        } else {
            if (topbarImg) topbarImg.classList.add('hidden');
            if (topbarEmoji) topbarEmoji.classList.remove('hidden');
        }

        // 🌟 [신규] PC renderWidget()의 팀 소속 배지와 동일 — Boako.state.team은 이제
        // init()/onAuthStateChange에서 부른 Team.syncStatus()가 채워둠
        const teamBadgeHtml = Boako.state.team?.info
            ? `<div style="display:inline-flex; align-items:center; gap:5px; margin-top:6px; padding:4px 10px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; font-size:11px; font-weight:900; color:#1e40af;">
                   <img src="${Boako.Util.cdn(Boako.state.team.info.logo_url || '')}" style="width:14px; height:14px; border-radius:50%; object-fit:cover; border:1px solid #93c5fd;">
                   ${Boako.state.team.info.team_name} 멤버
               </div>`
            : `<div style="margin-top:6px; padding:4px 8px; background:#f1f5f9; border-radius:6px; font-size:11px; font-weight:700; color:#64748b;">🛡️ 아카이브 멤버</div>`;

        wrap.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; gap:8px; padding-bottom:16px; border-bottom:1px solid #e2e8f0; margin-bottom:14px;">
                <div style="width:56px; height:56px; border-radius:50%; background:#e2e8f0; overflow:hidden; display:flex; align-items:center; justify-content:center; font-size:26px;">
                    ${displayAvatarUrl ? `<img src="${displayAvatarUrl}" style="width:100%; height:100%; object-fit:cover;">` : '👤'}
                </div>
                <span style="font-size:14px; font-weight:900;">${user.nickname || '사용자'}</span>
                ${teamBadgeHtml}
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
