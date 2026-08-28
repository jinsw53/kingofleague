/**
 * [MOBILE MATCH] 모바일 전용 — 대항전(밴 결과 / 게임별 매치업 / 스코어보드 / 소통채널)
 * 🌟 [재사용 원칙] match.js의 init(containerId)은 컨테이너 id 하나만 받으면 배너/진행상태바/
 *    3개 탭(밴 결과/매치업/스코어보드)/시즌 선택 드롭다운/종목별 소통 채널(채팅+일정투표 캘린더)까지
 *    전부 스스로 그리는 완전 자기완결형 구조라 그대로 재사용함. 필요한 스타일(이미지 확대 포탈,
 *    페널티 툴팁)도 injectStylesAndPortal()이 스스로 주입하고, 탭 안쪽 콘텐츠(밴 결과 카드/매치업/
 *    스코어보드 테이블/채팅)는 이미 grid-cols-2 등 반응형이라 모바일에서도 문제없이 그대로 재사용.
 * 🌟 [버그 회피] 밴 후보 카드의 "투표하러 가기" 버튼이 유일하게 PC 전용 화면전환
 *    (Boako.View.render('team').then(() => Boako.View.switchTeamTab('record')))을 부름 —
 *    match.js 파일 자체는 건드리지 않고, mobile_shell.js의 전역 View.render 패치를 확장해서
 *    'team' 인자로 불렸을 때만 실제로 모바일 팀 본부의 "대항전" 탭(openTeamHub('record'))으로
 *    연결되게 처리함(그 외 인자는 기존처럼 조용히 무시).
 * 🌟 [전면 재설계] 배너 상단 진행상태 바(밴픽 진행→엔트리 제출→대항전 경기)와 탭 바(밴 결과/
 *    매치업/스코어보드)는 PC 폭 기준 고정폭(whitespace-nowrap)/가로 스크롤(overflow-x-auto)로
 *    짜여있어 처음엔 CSS로 살짝만 손봤었는데, 그 정도로는 모바일에서 여전히 UI가 깨져서 완전히
 *    다시 설계함(가로 스크롤은 절대 쓰지 않는 방향으로 확정):
 *    1) 탭 바: overflow-x-auto를 grid-template-columns:repeat(3,1fr)로 강제해 3개 탭이
 *       화면 폭에 관계없이 항상 균등하게 한 줄에 다 들어오도록 함.
 *    2) 진행상태 바: "지금 진행 중인 단계"만 위에 크게, 나머지 두 단계는 아래 절반 크기로 깔리는
 *       레이아웃으로 재설계. match.js의 loadData()가 3단계 중 활성 단계에만 붙이는 원본 클래스
 *       (activeClass에 포함된 bg-blue-600)를 CSS :has() 선택자로 감지해서, 그 요소만 자동으로
 *       전체 폭 1행("order:-1")으로 올라가고 나머지 둘은 2열로 내려가게 함 — match.js의 상태
 *       판별 로직/DOM 구조는 그대로 두고 배치만 CSS로 재구성(자바스크립트 패치 불필요).
 *    두 군데 다 match.js 파일 자체는 건드리지 않고 모바일 CSS로만 재배치.
 */
window.Boako = window.Boako || {};
Boako.MobileMatch = {

    render: async (container) => {
        if (!Boako.Match || !Boako.Match.init) await Boako.Util.loadScript('/js/match.js');

        if (!document.getElementById('mobile-match-style')) {
            const style = document.createElement('style');
            style.id = 'mobile-match-style';
            style.textContent = `
                /* 🌟 배너 패딩을 모바일에 맞게 축소 (PC p-8=32px는 좁은 화면엔 과함) */
                #mobile-match-root .rounded-3xl.shadow-2xl {
                    padding: 16px !important;
                }

                /* 🌟 [버그수정] 로고/날짜/스폰서 배지 영역이 flex-col인데 정렬 속성이 없어서
                   날짜 배지(w-max)가 왼쪽으로 붙어보이던 문제 — 가운데 정렬 추가. */
                #mobile-match-root #match-season-logo-area {
                    align-items: center !important;
                }

                /* ========== 🌟 [전면 재설계] 진행상태 바 ==========
                   "지금 진행 중인 단계"만 위에 크게, 나머지 두 단계는 아래 절반 크기 2열로 배치.
                   활성 단계 판별은 match.js가 이미 붙여주는 원본 클래스(bg-blue-600)를
                   CSS :has()로 감지 — match.js의 상태 판별 로직은 그대로 재사용하고 배치만 재구성. */
                #mobile-match-root .backdrop-blur-md {
                    display: grid !important;
                    grid-template-columns: 1fr 1fr;
                    gap: 6px;
                    width: 100%;
                    background: transparent !important;
                    border: none !important;
                    padding: 0 !important;
                    backdrop-filter: none !important;
                }
                /* PC에서 단계 사이 구분용으로 쓰던 "▶" 화살표는 세로 배치에선 불필요해서 숨김 */
                #mobile-match-root .backdrop-blur-md > span.text-slate-600 {
                    display: none;
                }
                #mobile-match-root #status-ban,
                #mobile-match-root #status-entry,
                #mobile-match-root #status-play {
                    white-space: normal !important;
                    justify-content: center !important;
                    text-align: center;
                    border-radius: 10px !important;
                    padding: 7px 4px !important;
                    font-size: 10.5px !important;
                    grid-column: span 1;
                    order: 1;
                }
                /* 활성 단계(원본 activeClass의 bg-blue-600 포함)만 전체 폭 1행으로 올려서 크게 표시 */
                #mobile-match-root .backdrop-blur-md:has(#status-ban.bg-blue-600) #status-ban,
                #mobile-match-root .backdrop-blur-md:has(#status-entry.bg-blue-600) #status-entry,
                #mobile-match-root .backdrop-blur-md:has(#status-play.bg-blue-600) #status-play {
                    grid-column: 1 / -1 !important;
                    order: -1 !important;
                    font-size: 12.5px !important;
                    padding: 10px !important;
                }

                /* ========== 🌟 [전면 재설계] 탭 바 ==========
                   가로 스크롤(overflow-x-auto) 완전 제거 — 3등분 grid로 화면 폭에 관계없이
                   항상 한 줄에 다 들어오게 함. */
                #mobile-match-root .overflow-x-auto {
                    display: grid !important;
                    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
                    overflow-x: visible !important;
                    gap: 6px !important;
                    border-bottom: none !important;
                    padding-bottom: 4px !important;
                }
                #mobile-match-root [id^="btn-tab-"] {
                    white-space: normal !important;
                    padding: 10px 4px !important;
                    font-size: 11px !important;
                    line-height: 1.3;
                    border-radius: 10px !important;
                    border-bottom: none !important;
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    color: #64748b !important;
                }
                /* switchTab()이 활성 탭에 붙이는 원본 클래스(text-indigo-600)를 그대로 후크로 사용 */
                #mobile-match-root [id^="btn-tab-"].text-indigo-600 {
                    background: #0f172a;
                    color: #eef2ff !important;
                    border-color: #0f172a;
                }
            `;
            document.head.appendChild(style);
        }

        // 🌟 match.js가 containerId 하나만 받으면 배너/탭/스코어보드까지 전부 스스로 그림
        container.innerHTML = `<div id="mobile-match-root"></div>`;
        Boako.Match.init('mobile-match-root');
    }
};
