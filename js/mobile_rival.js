/**
 * [MOBILE RIVAL] 모바일 전용 — 라이벌 매치 (라이벌 찾기 + 응원하기)
 * 🌟 [재사용 원칙] js/rival.js의 init(containerId)은 컨테이너 id 하나만 받으면 배너/탭/목록까지
 *    전부 스스로 그리는 완전 자기완결형 구조라 그대로 재사용함. searchRivals()/castVote()/
 *    executeChallenge()/toggleDetail() 등도 전부 특정 컨테이너 id만 참조하는 순수 DB/RPC 호출이라
 *    View.render 같은 PC 전용 화면전환 호출이 전혀 없음 — 완전히 안전하게 재사용 가능.
 *    switchTab()도 버튼의 className을 매번 통째로 새로 지정하는 방식이라 모바일 markup에 미리
 *    활성/비활성 클래스를 맞춰둘 필요조차 없음.
 * 🌟 [보정] .section-card 클래스가 PC index.html에만 정의돼있어 모바일엔 스타일이 없음 — 기능엔
 *    지장 없지만(안쪽은 전부 Tailwind 유틸리티 클래스) 모서리 둥글기/그림자만 없어져서 한 번
 *    가볍게 정의해줌(schedule.js 포팅 때와 동일 패턴, PC 원본 값과 무관하게 합리적 기본값만 보정).
 * 🌟 [버그수정] 라이벌 찾기 결과 행(순위+로고+종목명 / 내 기록 뱃지+화살표)이 줄바꿈도 말줄임도
 *    없이 한 줄로 욱여넣어져 있어서, 좁은 화면에서 넘치는 부분이 카드의 overflow:hidden에 걸려
 *    그냥 잘려나갔음(캘린더 때와 같은 유형의 문제). Tailwind 대괄호 클래스(text-[15px])는
 *    이스케이프가 까다로워서 대신 onclick 속성 접두사로 안전하게 행을 타겟팅해 줄바꿈 허용 +
 *    종목명 말줄임 처리를 덧붙임.
 */
window.Boako = window.Boako || {};
Boako.MobileRival = {

    render: async (container) => {
        if (!Boako.state.user) {
            container.innerHTML = `<div style="padding:60px 16px; text-align:center; color:#94a3b8; font-weight:700; font-size:13px;">🔒 로그인 후 이용할 수 있어요.</div>`;
            return;
        }
        if (!Boako.Rival || !Boako.Rival.init) await Boako.Util.loadScript('/js/rival.js');

        if (!document.getElementById('mobile-section-card-style')) {
            const style = document.createElement('style');
            style.id = 'mobile-section-card-style';
            style.textContent = `
                .section-card { border-radius:16px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.08); border:1px solid #e2e8f0; margin-bottom:14px; }
                /* 🌟 [버그수정] 라이벌 찾기 결과 행(순위+로고+종목명 / 내 기록 뱃지+화살표)이 줄바꿈도
                   말줄임도 없이 한 줄로 욱여넣어져 있어서, 좁은 화면에서 넘치는 부분이 카드의
                   overflow:hidden에 걸려 그냥 잘려나갔음(캘린더 때와 같은 유형의 문제).
                   Tailwind 대괄호 클래스(text-[15px])는 이스케이프가 까다로워서 대신 onclick
                   속성 접두사로 안전하게 행을 타겟팅해 줄바꿈 허용 + 종목명 말줄임 처리를 덧붙임. */
                #mobile-rival-root [onclick^="Boako.Rival.toggleDetail"] { flex-wrap: wrap; row-gap: 6px; }
                #mobile-rival-root [onclick^="Boako.Rival.toggleDetail"] > div:first-child { min-width: 0; flex: 1 1 auto; }
                #mobile-rival-root [onclick^="Boako.Rival.toggleDetail"] > div:first-child > span:last-child {
                    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;
                }
                #mobile-rival-root [onclick^="Boako.Rival.toggleDetail"] > div:last-child { flex-shrink: 0; }
            `;
            document.head.appendChild(style);
        }

        // 🌟 rival.js가 containerId 하나만 받으면 배너/탭/목록까지 전부 스스로 그림
        container.innerHTML = `<div id="mobile-rival-root"></div>`;
        Boako.Rival.init('mobile-rival-root');
    }
};
