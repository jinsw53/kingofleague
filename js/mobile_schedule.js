/**
 * [MOBILE SCHEDULE] 모바일 전용 — 아카이브 일정 관리 및 캘린더 전광판
 * 🌟 [재사용 원칙] js/schedule.js는 다른 화면들과 달리 containerId 인자를 받지 않고
 *    document.getElementById('main-content') || document.getElementById('app')로 직접
 *    컨테이너를 찾는 구조라, 모바일 컨테이너 안에 id="app" div를 하나 심어주기만 하면
 *    View.renderMain()/renderUI()/showAllSchedules() 등이 전부 수정 없이 그대로 동작함.
 *    캘린더 그리드/일정 카드/톡캘린더 등록·취소·재등록 로직 전부 순수 DB/RPC 호출이라
 *    View.render 같은 PC 전용 화면전환 호출도 없음 — 완전히 안전하게 재사용 가능.
 * 🌟 [보정] 카드 바깥 틀에 쓰인 .section-card 클래스가 PC index.html에만 정의돼있어 모바일엔
 *    스타일이 없음 — 기능엔 지장 없지만(안쪽은 전부 인라인 스타일) 모서리 둥글기/그림자만 없어져서
 *    한 번 가볍게 정의해줌(PC 원본 값과 무관하게 이 화면 전용으로 합리적인 기본값만 보정).
 */
window.Boako = window.Boako || {};
Boako.MobileSchedule = {

    render: async (container) => {
        if (!Boako.Schedule || !Boako.Schedule.View || !Boako.Schedule.View.renderMain) {
            await Boako.Util.loadScript('/js/schedule.js');
        }

        if (!document.getElementById('mobile-schedule-style')) {
            const style = document.createElement('style');
            style.id = 'mobile-schedule-style';
            style.textContent = `.section-card { border-radius:16px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.08); border:1px solid #e2e8f0; }`;
            document.head.appendChild(style);
        }

        // 🌟 schedule.js가 찾는 컨테이너 id('main-content' 또는 'app')를 그대로 심어줌
        container.innerHTML = `<div id="app"></div>`;

        // 🌟 PC와 완전히 동일한 함수 그대로 재사용 (달력/일정 목록/톡캘린더 연동 전부 위임)
        await Boako.Schedule.View.renderMain();
    }
};
