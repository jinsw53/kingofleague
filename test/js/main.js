/**
 * [MAIN] 스크립트 실행 진입점 (디버깅 제거 완전 순정본)
 */
window.onload = () => {
    if (Boako && Boako.Auth) {
        Boako.Auth.init();
    } else {
        console.error("Core 모듈 로딩에 실패했습니다.");
        return;
    }

    // 탭 복귀 시 토큰 갱신만 조용히 요청 (화면 버벅임 없음)
    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible') {
            try {
                if (Boako.db && Boako.db.auth) {
                    await Boako.db.auth.refreshSession();
                }
            } catch (err) {
                console.warn("세션 복구 중 예외 발생", err);
            }
        }
    });
};
