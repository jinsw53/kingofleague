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
    // 🛡️ [마스터 잠수 해제 장치] 고장 난 통신 채널 파이프라인 완전 재부팅 엔진
    // ====================================================================
    document.addEventListener('visibilitychange', async () => {
        // 유저가 한 시간 동안 보드게임을 하다가 아카이브 브라우저 화면을 다시 활성화하는 바로 그 0초의 순간!
        if (document.visibilityState === 'visible') {
            console.log("♻️ [BOAKO 엔진] 유저 복귀 확인 ➡️ 단선된 수파베이스 통신 기지국 완전 재부팅 발사");
            
            try {
                // 1. 유령 상태가 된 통신 풀(Pool)을 아예 메모리에서 지워버리고 완전 새 클라이언트를 생성합니다.
                // 대시보드에서 만료 시간을 24시간으로 늘려두셨기 때문에, 새 인스턴스를 파도 브라우저 쿠키의 세션은 무사히 살아있습니다.
                Boako.db = supabase.createClient(Boako.config.url, Boako.config.key);

                // 2. 새 통신 라인을 타고 서버에 찌를 수 있도록 인증 세션을 강제로 동기화(싱크) 시킵니다.
                const { data: { session }, error } = await Boako.db.auth.getSession();
                
                if (!error && session?.user) {
                    Boako.state.user = session.user;
                    console.log("✅ [BOAKO 엔진] 수파베이스 통신 기지국 및 로그인 세션 새 파이프라인 정비 완벽 완료!");
                } else {
                    console.log("ℹ️ [BOAKO 엔진] 비로그인 또는 세션 만료 상태로 기지국 리셋 완료");
                }
            } catch (err) {
                console.error("🚨 기지국 재부팅 중 치명적 예외 발생:", err);
            }
        }
    });
    // ====================================================================
};
