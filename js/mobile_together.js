/**
 * [MOBILE TOGETHER] 모바일 전용 — 같이하자 (실시간 매칭 모집 게시판)
 * 🌟 [재사용 원칙] js/together.js의 loadPosts()/renderList()/renderCard()/joinPost()/leavePost()/
 *    cancelPost()/submitPost()/searchGames() 등은 'together-list-container'/'together-modal-root'/
 *    'together-input-*' 등 특정 컨테이너 id만 참조하고, 카드 자체도 순수 Tailwind 유틸리티
 *    클래스로만 그려져 있어서(모바일도 Tailwind CDN 로드) 전혀 손대지 않고 그대로 재사용함.
 * 🌟 [버그 회피] goToChat()만 유일하게 PC 전용 화면전환(Boako.View.render('messenger') +
 *    Boako.Messenger.View.openRoom())을 호출해서 모바일에서 에러남 — 모바일 쪽지함
 *    (js/mobile_messenger.js)으로 대신 이동하도록 모바일 세션에서 이 함수만 재정의함
 *    (together.js 파일 자체는 수정하지 않음). 참고로 같이하자 채팅방 자체는 쪽지함 쪽에서도
 *    아직 "곧 지원 예정" 단계라(1단계 범위 — DM만 완성), 이동은 되지만 대화는 다음 단계에 완성됨.
 * 🌟 [수정 범위] init()이 만드는 바깥 페이지 틀(.main-banner/.section-card 등 PC 전용 커스텀
 *    클래스)만 모바일 인라인 스타일로 새로 그림 — 내부 컨테이너 id만 정확히 넣어주면 나머지
 *    함수들은 수정 없이 그대로 동작함.
 * 🌟 [버그 회피] switchTab()이 활성/비활성 탭 스타일을 classList.add/remove('bg-slate-800',
 *    'text-white' 등)로 직접 토글하는 구조라서, 탭 버튼에 인라인 스타일이 아니라 PC와 동일한
 *    Tailwind 클래스를 그대로 부여해야 함(인라인 스타일이면 우선순위 때문에 클래스 토글이 씹힘).
 * 🌟 [알려진 제한] subscribeRealtime()의 'together-board-realtime' 채널은 아직 탭 리더 선출이
 *    적용 안 된 상태(PC도 마찬가지) — 사이트 전역 실시간 최적화 라운드에서 함께 정리할 백로그로 남김.
 */
window.Boako = window.Boako || {};
Boako.MobileTogether = {

    _patched: false,

    // 🌟 goToChat()만 모바일 세션에서 안전한 버전으로 완전히 교체 (together.js 파일 자체는 안 건드림)
    _ensurePatched: () => {
        if (Boako.MobileTogether._patched) return;
        Boako.MobileTogether._patched = true;

        Boako.Together.goToChat = async (postId) => {
            if (!Boako.state.user) {
                Boako.Util.toast('로그인 후 이용해주세요.');
                return;
            }
            await Boako.MobileShell.openMessenger();
            setTimeout(() => {
                if (Boako.MobileMessenger) Boako.MobileMessenger.openRoom(`together_${postId}`);
            }, 300);
        };
    },

    render: async (container) => {
        if (!Boako.Together || !Boako.Together.loadPosts) await Boako.Util.loadScript('/js/together.js');
        Boako.MobileTogether._ensurePatched();

        container.innerHTML = `
            <div style="background:linear-gradient(135deg,#0ea5e9,#0369a1); border-radius:16px; padding:20px; margin-bottom:14px; color:#fff;">
                <div style="font-size:17px; font-weight:900;">🎲 같이하자</div>
                <div style="font-size:11.5px; font-weight:700; opacity:0.9; margin-top:4px;">지금 같이 놀 사람을 모아보세요. 참가는 선착순, 승인 없이 바로 확정돼요.</div>
            </div>

            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
                <div style="display:flex; gap:6px;">
                    <button id="together-tab-btn-BOARD" class="together-tab-btn bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all" onclick="Boako.Together.switchTab('BOARD')">📋 전체 모집</button>
                    <button id="together-tab-btn-MINE" class="together-tab-btn bg-slate-100 text-slate-500 px-4 py-2 rounded-lg text-sm font-bold transition-all" onclick="Boako.Together.switchTab('MINE')">🙋 내 모임</button>
                </div>
                <button onclick="Boako.Together.openWriteModal()" class="bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-sky-700 transition-colors">+ 모집</button>
            </div>

            <div id="together-list-container" class="grid grid-cols-1 gap-3">
                <div style="text-align:center; padding:50px 0; color:#94a3b8; font-weight:700; font-size:13px;">불러오는 중...</div>
            </div>

            <div id="together-modal-root"></div>
        `;

        // 🌟 PC와 완전히 동일한 함수 그대로 재사용 (목록 로드/렌더링/실시간 구독 전부 위임)
        await Boako.Together.loadPosts();
        Boako.Together.subscribeRealtime();
    }
};
