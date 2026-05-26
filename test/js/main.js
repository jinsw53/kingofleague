/**
 * [MAIN] 스크립트 실행 진입점 (가장 마지막에 로드되어야 합니다)
 */
window.onload = () => {
    // 모든 모듈이 로드된 후 초기화 함수 실행
    if (Boako && Boako.Auth) {
        Boako.Auth.init();
    } else {
        console.error("Core 모듈 로딩에 실패했습니다. 스크립트 순서를 확인해주세요.");
        return;
    }

    // ====================================================================
    // ♻️ [BOAKO 엔진] 탭 복귀 시 세션 동기화 (프록시 연동 변수 싹 다 제거됨)
    // ====================================================================
    document.addEventListener('visibilitychange', async () => {
        // 다른 탭을 보다가 아카이브 화면으로 딱 돌아오는 그 순간!
        if (document.visibilityState === 'visible') {
            try {
                if (Boako.db && Boako.db.auth) {
                    console.log("♻️ [BOAKO 엔진] 크롬 탭 복귀 확인 ➡️ 세션 싱크 가동");
                    await Boako.db.auth.refreshSession();
                }
            } catch (err) {
                console.warn("⚠️ 세션 복구 중 예외 발생");
            }
        }
    });
    // ====================================================================
};
