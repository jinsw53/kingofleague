/**
 * [MOBILE MAIN] 모바일 진입점 실행 시작점
 * 🌟 [1단계: 뼈대 테스트] PC의 main.js(window.onload → Boako.Auth.init())와 역할은 같지만,
 *    지금은 Boako.MobileShell.init()만 불러서 하단 탭바/드로어/시트 뼈대만 확인한다.
 * 🌟 [신규] PC main.js와 완전히 동일하게, 로그인 여부와 무관하게 전광판(Boako.Ticker)/실시간
 *    이슈(Boako.HotIssue)를 즉시 초기화. 둘 다 PC 전용 DOM 의존 없이 고정 id만 참조하므로
 *    그대로 재사용(mobile/index.html에 동일한 id로 컨테이너만 마련해둠).
 * 🌟 [신규] 카톡 공유 딥링크(?view=xxx&post=yyy) 지원 — PC main.js와 동일한 원리로,
 *    MobileShell.init()이 기본 탭(소식지)을 그리는 것과 경쟁하지 않도록 init이 끝난 뒤 덮어씀.
 */
window.onload = () => {
    let shellInit;
    if (Boako && Boako.MobileShell) {
        shellInit = Boako.MobileShell.init();
    } else {
        console.error("모바일 셸 모듈 로딩에 실패했습니다.");
        return;
    }

    if (Boako.HotIssue && Boako.HotIssue.init) {
        Boako.HotIssue.init();
    }

    if (Boako.Ticker && Boako.Ticker.init) {
        Boako.Ticker.init();
    }

    // 🌟 딥링크 화면 이름 → 모바일 진입 함수 매핑. 새 화면에 공유 기능을 추가할 때마다 여기만 추가하면 됨.
    const DEEP_LINK_ENTRIES = {
        together: () => Boako.MobileShell.openTogether(),
        tournament: () => Boako.MobileShell.switchTab('tournament'),
        team_list: () => Boako.MobileShell.openTeamList()
    };

    const urlParams = new URLSearchParams(window.location.search);
    const deepLinkView = urlParams.get('view');
    if (deepLinkView && DEEP_LINK_ENTRIES[deepLinkView]) {
        const deepLinkPostId = urlParams.get('post');
        if (deepLinkPostId) window.Boako.__deepLinkPostId = deepLinkPostId;
        Promise.resolve(shellInit).then(() => DEEP_LINK_ENTRIES[deepLinkView]());
    }
};
