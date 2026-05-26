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
    // 🛡️ [마스터 잠수 해제 장치] auth.js 안전 밸브 연동형 전역 신호등 엔진
    // ====================================================================
    // 🔴 전역 신호등 초기화 (auth.js의 Boako.db.from이 이 간판을 바라보고 서행 여부를 판단합니다)
    window.Boako_isRefreshing = false;

    document.addEventListener('visibilitychange', async () => {
        // 유저가 보드게임을 끝내고 브라우저 화면을 다시 활성화하는 바로 그 순간!
        // 중복 진입을 전역 플래그로 완벽하게 차단합니다.
        if (document.visibilityState === 'visible' && !window.Boako_isRefreshing) {
            window.Boako_isRefreshing = true; // 신호등 빨간불 ON ➡️ 유저가 즉시 버튼을 눌러도 0.2초 홀딩시킴
            console.log("♻️ [BOAKO 엔진] 유저 복귀 확인 ➡️ 기존 파이프라인 세션 싱크 가동");
            
            try {
                if (Boako.db && Boako.db.auth) {
                    // 대시보드 24시간 세팅 덕분에, 기존 인스턴스 그대로 안전하게 토큰만 재인증(싱크) 합니다.
                    const { data: { session }, error } = await Boako.db.auth.refreshSession();
                    
                    if (!error && session?.user) {
                        Boako.state.user = session.user;
                        console.log("✅ [BOAKO 엔진] 기존 통신 통로 복구 및 세션 동기화 성공!");
                    }
                }
            } catch (err) {
                console.warn("⚠️ 세션 복구 중 예외 발생 (비로그인 상태 또는 네트워크 단선)");
            } finally {
                // 세션 예열 및 재연결 통로가 완벽하게 뚫리는 0.3초 뒤에 안전하게 신호등을 파란불(false)로 끕니다.
                setTimeout(() => { window.Boako_isRefreshing = false; }, 300);
            }
        }
    });
    // ====================================================================
};
