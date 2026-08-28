/**
 * [MOBILE LEAGUE] 모바일 전용 — 리그 콘텐츠(팀 빙고 쟁탈전 / 드루와! 챌린지 / 챔피언 / 킹 오브 리그)
 * 🌟 [재사용 원칙] league.js의 buildUI(containerId)는 컨테이너 id 하나만 받으면 4개 탭과 탭 안쪽
 *    콘텐츠(챌린지 등록/로스터/투표 캘린더, 빙고판, 챔피언 명예의 전당, 킹 오브 리그 이벤트로그)까지
 *    전부 스스로 그리는 완전 자기완결형 구조라 그대로 재사용함. 탭 바 자체가 이미
 *    "grid grid-cols-2 sm:flex"로 짜여있어(PC=가로 4개, 모바일=2x2 그리드) 대항전 포팅 때 겪었던
 *    가로 스크롤/잘림 문제가 애초에 없어서 별도 재설계가 필요 없었음.
 * 🌟 [버그수정] 헤더 배너 이미지가 상대경로("league_champion_belt_banner.png")로 박혀있어서,
 *    /mobile/ 하위 페이지에서 그대로 불러오면 사이트 루트가 아니라 /mobile/ 기준으로 요청돼
 *    경로가 깨짐 — league.js 파일은 건드리지 않고, buildUI() 실행 직후 절대경로로 교체.
 * 🌟 [버그 회피] 챌린지 카드의 "채팅방 이동" 버튼이 유일하게 PC 전용 화면전환
 *    (Boako.View.render('messenger'))을 부름 — league.js 파일은 건드리지 않고, 모바일
 *    쪽지함(mobile_messenger.js)으로 대신 연결. 쪽지함 목록에서 챌린지 채팅방은 이미
 *    "곧 지원 예정" 안내가 뜨도록 되어있어(mobile_messenger.js) 자연스럽게 처리됨.
 */
window.Boako = window.Boako || {};
Boako.MobileLeague = {

    render: async (container) => {
        if (!Boako.League || !Boako.League.buildUI) await Boako.Util.loadScript('/js/league.js');

        Boako.League.openChallengeChat = async () => {
            await Boako.MobileShell.openMessenger();
        };

        // 🌟 league.js가 containerId 하나만 받으면 4개 탭까지 전부 스스로 그림
        container.innerHTML = `<div id="mobile-league-root"></div>`;
        Boako.League.buildUI('mobile-league-root');

        const bannerImg = document.getElementById('league-header-main-img');
        if (bannerImg) bannerImg.src = '/league_champion_belt_banner.png';
    }
};
