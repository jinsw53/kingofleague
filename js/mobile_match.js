/**
 * [MOBILE MATCH] 모바일 전용 — 대항전(밴 결과 / 게임별 매치업 / 스코어보드 / 소통채널)
 * 🌟 [재사용 원칙] match.js의 init(containerId)은 컨테이너 id 하나만 받으면 배너/진행상태바/
 *    3개 탭(밴 결과/매치업/스코어보드)/시즌 선택 드롭다운/종목별 소통 채널(채팅+일정투표 캘린더)까지
 *    전부 스스로 그리는 완전 자기완결형 구조라 그대로 재사용함. 필요한 스타일(이미지 확대 포탈,
 *    페널티 툴팁)도 injectStylesAndPortal()이 스스로 주입하고, 배너/탭 마크업도 전부 Tailwind
 *    반응형 클래스로만 짜여있어(md: 접두사로 PC 전용 가로 배치, 그 외엔 세로 배치) 별도 모바일
 *    CSS 보정이 거의 필요 없음.
 * 🌟 [버그 회피] 밴 후보 카드의 "투표하러 가기" 버튼이 유일하게 PC 전용 화면전환
 *    (Boako.View.render('team').then(() => Boako.View.switchTeamTab('record')))을 부름 —
 *    match.js 파일 자체는 건드리지 않고, mobile_shell.js의 전역 View.render 패치를 확장해서
 *    'team' 인자로 불렸을 때만 실제로 모바일 팀 본부의 "대항전" 탭(openTeamHub('record'))으로
 *    연결되게 처리함(그 외 인자는 기존처럼 조용히 무시).
 * 🌟 [버그수정] 배너 상단 진행상태 바(🚫 밴픽 진행 → ⚔️ 엔트리 제출 → 🏆 대항전 경기)와 탭 바
 *    (밴 결과/매치업/스코어보드)가 PC 폭 기준 고정폭(whitespace-nowrap)/가로 스크롤
 *    (overflow-x-auto)로 짜여있어 모바일 좁은 화면에서 배지가 잘리거나 가로 스크롤이 생기던
 *    문제 — 가로 스크롤은 절대 쓰지 않기로 해서, 대신 배지/탭 패딩·글자 크기를 줄이고 안 들어가면
 *    자연스럽게 다음 줄로 줄바꿈(flex-wrap)되도록 수정. match.js는 건드리지 않고 모바일
 *    CSS로만 보정.
 */
window.Boako = window.Boako || {};
Boako.MobileMatch = {

    render: async (container) => {
        if (!Boako.Match || !Boako.Match.init) await Boako.Util.loadScript('/js/match.js');

        if (!document.getElementById('mobile-match-style')) {
            const style = document.createElement('style');
            style.id = 'mobile-match-style';
            style.textContent = `
                /* 🌟 [버그수정] 진행상태 바(밴픽 진행→엔트리 제출→대항전 경기) — PC 폭 기준
                   whitespace-nowrap 배지 3개가 모바일에서 넘쳐 잘리던 문제. 가로 스크롤 대신
                   배지 크기를 줄이고 줄바꿈되게 함. */
                #mobile-match-root .backdrop-blur-md {
                    flex-wrap: wrap !important;
                    row-gap: 6px;
                }
                #mobile-match-root #status-ban,
                #mobile-match-root #status-entry,
                #mobile-match-root #status-play {
                    padding: 7px 10px !important;
                    font-size: 10.5px !important;
                }

                /* 🌟 [버그수정] 탭 바(밴 결과/매치업/스코어보드)의 overflow-x-auto 가로 스크롤을
                   완전히 제거 — 대신 패딩/글자 크기를 줄이고, 그래도 안 들어가면 줄바꿈. */
                #mobile-match-root .overflow-x-auto {
                    overflow-x: visible !important;
                    flex-wrap: wrap !important;
                }
                #mobile-match-root [id^="btn-tab-"] {
                    padding: 8px 10px !important;
                    font-size: 11px !important;
                }
            `;
            document.head.appendChild(style);
        }

        // 🌟 match.js가 containerId 하나만 받으면 배너/탭/스코어보드까지 전부 스스로 그림
        container.innerHTML = `<div id="mobile-match-root"></div>`;
        Boako.Match.init('mobile-match-root');
    }
};
