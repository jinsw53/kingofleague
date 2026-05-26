/**
 * [MAIN] 스크립트 실행 진입점 (정밀 디버깅 모드)
 */
window.onload = () => {
    console.log("[DEBUG 🟢 00] window.onload 진입");
    if (Boako && Boako.Auth) {
        Boako.Auth.init();
    } else {
        console.error("Core 모듈 로딩 실패");
        return;
    }

    document.addEventListener('visibilitychange', async () => {
        console.log(`\n======================================================`);
        console.log(`[DEBUG 👁️ 01] visibilitychange 발생! 현재 상태: ${document.visibilityState}`);
        if (document.visibilityState === 'visible') {
            try {
                if (Boako.db && Boako.db.auth) {
                    console.log("[DEBUG 👁️ 02] 탭 복귀 감지 -> refreshSession() 호출 직전");
                    
                    // refreshSession 무한 펜딩 추적용 3초 시한폭탄
                    const refreshPromise = Boako.db.auth.refreshSession();
                    const timeout = new Promise((_, r) => setTimeout(() => r(new Error("refreshSession() 응답 없음 (3초 초과 행)")), 3000));
                    
                    await Promise.race([refreshPromise, timeout]);
                    console.log("[DEBUG 👁️ 03] refreshSession() 갱신 완료");
                }
            } catch (err) {
                console.error("[DEBUG 💥 04] 탭 복귀 중 에러 폭발:", err);
            }
        }
    });
};
