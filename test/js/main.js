/**
 * [MAIN] 스크립트 실행 진입점 (가장 마지막에 로드되어야 합니다)
 */
window.onload = () => {
    // 모든 모듈이 로드된 후 초기화 함수 실행
    if (Boako && Boako.Auth) {
        Boako.Auth.init();
    } else {
        console.error("Core 모듈 로딩에 실패했습니다. 스크립트 순서를 확인해주세요.");
        return; // 실패 시 실행 방지
    }

    // ====================================================================
    // 🛡️ [마스터 잠수 해제 장치] 보드게임 플레이 후 복귀 시 탭 강제 심폐소생
    // ====================================================================
    document.addEventListener('visibilitychange', async () => {
        // 유저가 한 시간 동안 보드게임을 하다가 아카이브 브라우저 화면을 딱 보는 바로 그 0초의 순간!
        if (document.visibilityState === 'visible') {
            console.log("♻️ [BOAKO 엔진] 유저 복귀 확인 ➡️ 잠들었던 수파베이스 커넥션 강제 심폐소생");
            
            try {
                if (Boako.db && Boako.db.auth) {
                    // 1. 단순 껍데기가 아닌 진짜 네트워크를 태워 세션을 수리(Refresh)합니다.
                    const { data: { session }, error } = await Boako.db.auth.refreshSession();
                    
                    // 2. 세션 수리 중 네트워크가 완전히 터졌거나 세션이 만료 정지 처리가 내려왔다면
                    if (error || !session) {
                        throw new Error("세션 파이프라인 수리 거부");
                    }
                    console.log("✅ 수파베이스 세션 파이프라인 및 토큰 복구 성공!");
                }
            } catch (err) {
                console.warn("⚠️ 세션 심폐소생 실패 ➡️ 안전하게 클라이언트 인스턴스 전격 즉시 리셋");
                // 통신 파이프라인 라인을 아예 공장 초기화하듯 완전히 새로 뚫어서 무응답 원천 차단
                Boako.db = supabase.createClient(Boako.config.url, Boako.config.key);
                
                // 만약 로그인 세션이 유효하다면 새 인스턴스에 강제 바인딩 처리
                try {
                    await Boako.db.auth.getSession();
                } catch(e) {}
            }
        }
    });
    // ====================================================================
};
