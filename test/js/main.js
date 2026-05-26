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
};
