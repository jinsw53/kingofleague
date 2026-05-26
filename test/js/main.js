/**
 * [MAIN] 스크립트 실행 진입점
 */
window.onload = () => {
    if (Boako && Boako.Auth) {
        Boako.Auth.init();
    } else {
        console.error("Core 모듈 로딩에 실패했습니다. 스크립트 순서를 확인해주세요.");
        return;
    }

    // 🔴 탭 복귀 중임을 알리는 전역 방어막
    window.Boako_isTabReturning = false;

    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible') {
            try {
                if (Boako.db && Boako.db.auth) {
                    console.log("♻️ [BOAKO 엔진] 크롬 탭 복귀 확인 ➡️ 세션 싱크 가동");
                    
                    // 세션 갱신 시작! 방어막을 폅니다.
                    window.Boako_isTabReturning = true; 
                    
                    await Boako.db.auth.refreshSession();
                    
                    // 1초 뒤에 세션 갱신 여파가 완전히 가라앉으면 방어막을 해제합니다.
                    setTimeout(() => { window.Boako_isTabReturning = false; }, 1000);
                }
            } catch (err) {
                console.warn("⚠️ 세션 복구 중 예외 발생");
            }
        }
    });
};
