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
 * 🌟 [버그수정] 캘린더가 좁은 화면에서 잘려서 나오던 문제 — PC 마크업 자체가 여백을 3겹으로
 *    쌓고 있었음: #mobile-content-area 16px + schedule.js 바깥 div 20px + .section-card 25px
 *    = 좌우 합쳐 122px. 390px 화면 기준 캘린더 그리드에 겨우 268px만 남아 7칸이 옹색하게
 *    눌리다 못해 실제로 넘쳐서 우측이 통째로 잘려나갔음(html/body의 overflow-x:hidden 때문에
 *    스크롤도 안 되고 그냥 잘림). 인라인 스타일이라 CSS로 덮어쓰려면 !important가 필요해서
 *    바깥/카드 패딩을 모바일 전용으로 축소하고, 혹시 남는 초과분은 가로 스크롤로라도 보이도록
 *    안전장치를 추가함.
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
            style.textContent = `
                .section-card { border-radius:16px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.08); border:1px solid #e2e8f0; }
                /* 🌟 여백 3겹 쌓임(16+20+25=122px) 문제 수정 — 모바일 화면에서 캘린더가 잘리지 않도록 축소.
                   인라인 스타일을 덮어써야 해서 !important 필요, 구조를 알기 때문에 자식 결합자로 안전하게 지정. */
                #app > div { padding: 8px !important; box-sizing: border-box; max-width: 100% !important; }
                #app .section-card { padding: 12px !important; box-sizing: border-box; }
                /* 혹시 그래도 넘치면 잘리는 대신 가로 스크롤로라도 볼 수 있게 안전장치 */
                #app { overflow-x: auto; -webkit-overflow-scrolling: touch; }
            `;
            document.head.appendChild(style);
        }

        // 🌟 schedule.js가 찾는 컨테이너 id('main-content' 또는 'app')를 그대로 심어줌
        container.innerHTML = `<div id="app"></div>`;

        // 🌟 PC와 완전히 동일한 함수 그대로 재사용 (달력/일정 목록/톡캘린더 연동 전부 위임)
        await Boako.Schedule.View.renderMain();
    }
};
