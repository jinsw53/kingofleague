/**
 * [MAIN] 스크립트 실행 진입점
 */
window.onload = () => {
    let authInit;
    if (Boako && Boako.Auth) {
        authInit = Boako.Auth.init();
    } else {
        console.error("Core 모듈 로딩에 실패했습니다.");
        return;
    }

    if (Boako.HotIssue && Boako.HotIssue.init) {
        Boako.HotIssue.init();
    }

    if (Boako.Ticker && Boako.Ticker.init) {
        Boako.Ticker.init();
    }

    // 🌟 [신규] 카톡 공유 딜링크(?view=xxx&post=yyy)로 들어온 경우 해당 화면으로 바로 이동.
    // Boako.Auth.init()이 내부적으로 Boako.View.render('main')을 항상 호출하므로,
    // 그것과 경쟁하지 않도록 authInit이 끝난 뒤에 덮어쌜서 렌더한다.
    // post는 together.js가 renderList()에서 window.Boako.__deepLinkPostId로 소비해서 스크롤+하이라이트함
    const urlParams = new URLSearchParams(window.location.search);
    const deepLinkView = urlParams.get('view');
    if (deepLinkView) {
        const deepLinkPostId = urlParams.get('post');
        if (deepLinkPostId) window.Boako.__deepLinkPostId = deepLinkPostId;
        Promise.resolve(authInit).then(() => Boako.View.render(deepLinkView));
    }

    // 🌟 [수정] 카카오 로그인 리다이렉트 후 URL에 남아있는 인증 토큰 조각(#access_token=...)을
    // 방어적으로 정리한다. supabase-js가 보통 알아서 지우지만, 새로고침 시점에 따라
    // 남아있으면 "Session ... issued over 120s ago" 경고가 반복될 수 있어 한 번 더 정리한다.
    if (window.location.hash && window.location.hash.includes('access_token')) {
        history.replaceState(null, '', window.location.pathname + window.location.search);
    }

    // 🌟 [삭제됨] 탭 복귀 시 수동으로 refreshSession()을 호출하던 코드는 제거했습니다.
    // supabase-js는 기본 설정(autoRefreshToken)으로 토큰을 알아서 백그라운드에서 갱신하는데,
    // 여기서 탭 복귀마다 한 번 더 수동으로 갱신을 요청하다 보니 라이브러리의 자동 갱신과
    // 경쟁(race condition)이 생겨 "이미 사용된 refresh_token"으로 요청하는 400 에러가
    // 반복적으로 발생했습니다. 수동 호출 없이도 세션 유지에는 문제가 없습니다.
};
