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
    // 🛡️ [마스터 잠수 해제 장치] 중복 충돌 방지형 세션 수리 엔진 (웨일 상태 구현)
    // ====================================================================
    let isRefreshing = false; // 크롬의 다다닥 중복 이벤트를 막는 안전 잠금장치

    document.addEventListener('visibilitychange', async () => {
        // 유저가 보드게임을 끝내고 브라우저 화면을 다시 활성화하는 바로 그 순간!
        if (document.visibilityState === 'visible' && !isRefreshing) {
            isRefreshing = true; // 문 걸어 잠그기 (중복 진입 원천 차단)
            console.log("♻️ [BOAKO 엔진] 유저 복귀 확인 ➡️ 기존 파이프라인 세션 싱크 가동");
            
            try {
                if (Boako.db && Boako.db.auth) {
                    // 대시보드 24시간 세팅 덕분에, 기존 인스턴스 그대로 안전하게 토큰만 재인증(싱크) 합니다.
                    // createClient를 재호출하지 않으므로 GoTrueClient 충돌 경고가 절대 뜨지 않습니다.
                    const { data: { session }, error } = await Boako.db.auth.refreshSession();
                    
                    if (!error && session?.user) {
                        Boako.state.user = session.user;
                        console.log("✅ [BOAKO 엔진] 기존 통신 통로 복구 및 세션 동기화 성공!");
                    }
                }
            } catch (err) {
                console.warn("⚠️ 세션 복구 중 예외 발생 (비로그인 상태 또는 네트워크 단선)");
            } finally {
                // 처리가 완전히 끝나고 0.5초 뒤에 안전하게 잠금을 해제합니다.
                setTimeout(() => { isRefreshing = false; }, 500);
            }
        }
    });
    // ====================================================================
};
