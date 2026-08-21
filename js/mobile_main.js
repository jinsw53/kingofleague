/**
 * [MOBILE MAIN] 모바일 진입점 실행 시작점
 * 🌟 [1단계: 뼈대 테스트] PC의 main.js(window.onload → Boako.Auth.init())와 역할은 같지만,
 *    지금은 Boako.MobileShell.init()만 불러서 하단 탭바/드로어/시트 뼈대만 확인한다.
 */
window.onload = () => {
    if (Boako && Boako.MobileShell) {
        Boako.MobileShell.init();
    } else {
        console.error("모바일 셸 모듈 로딩에 실패했습니다.");
    }
};
