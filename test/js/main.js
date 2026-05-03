/**
 * [MAIN] 스크립트 실행 진입점 (가장 마지막에 로드되어야 합니다)
 */
window.onload = () => {
    // 모든 모듈이 로드된 후 초기화 함수 실행
    if (Boako && Boako.Auth) {
        Boako.Auth.init();
    } else {
        console.error("Core 모듈 로딩에 실패했습니다. 스크립트 순서를 확인해주세요.");
    }
};