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
 * 🌟 [버그수정] .main-banner가 PC index.html에만 정의돼있어(가운데 정렬/고정 높이/둥근 모서리)
 *    모바일엔 배경색만 남고 나머지 레이아웃이 다 빠져서 이상하게 보였음 — PC와 동일한 값으로 정의.
 * 🌟 [버그수정] 라이벌 찾기 결과 행이 좁은 화면에서 잘리던 걸 처음엔 줄바꿈으로 미봉했다가
 *    PC와 다른 2줄 모양이 돼서 다시 수정 — PC처럼 한 줄에 맞도록 종목명은 말줄임, 오른쪽
 *    뱃지는 폰트/여백을 압축해서 같은 줄에 들어가게 함.
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
                /* 🌟 [버그수정] .main-banner가 PC index.html에만 정의돼있어(가운데 정렬/고정 높이/
                   둥근 모서리) 모바일엔 배경색만 남고 나머지 레이아웃이 다 빠져서 이상하게 보였음 —
                   PC와 동일한 값(높이만 모바일에 맞게 min-height로 완화)으로 정의. */
                #mobile-rival-root .main-banner {
                    min-height: 140px; border-radius: 20px; margin-bottom: 14px; padding: 20px 16px;
                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                    color: #fff; text-align: center; box-shadow: 0 10px 20px rgba(0,0,0,0.15);
                }
                #mobile-rival-root .main-banner h1 { font-size: 19px; font-weight: 900; margin: 0 0 8px; }
                #mobile-rival-root .main-banner p { font-size: 12px; font-weight: 700; margin: 4px 0 0; opacity: 0.95; }
                /* 🌟 [버그수정] 라이벌 찾기 결과 행(순위+로고+종목명 / 내 기록 뱃지+화살표)이 PC에서는
                   한 줄에 다 들어가는데, 처음엔 그냥 잘렸었고 → 줄바꿈으로 미봉했더니 PC와 다른
                   2줄 모양이 됐음. PC처럼 한 줄에 맞도록: 종목명은 말줄임 처리로 줄여주고,
                   오른쪽 뱃지는 폰트/여백을 살짝 압축해서 같은 줄에 들어가게 함. */
                #mobile-rival-root [onclick^="Boako.Rival.toggleDetail"] { flex-wrap: nowrap; gap: 8px; }
                #mobile-rival-root [onclick^="Boako.Rival.toggleDetail"] > div:first-child { min-width: 0; flex: 1 1 auto; overflow: hidden; }
                #mobile-rival-root [onclick^="Boako.Rival.toggleDetail"] > div:first-child > span:last-child {
                    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;
                }
                #mobile-rival-root [onclick^="Boako.Rival.toggleDetail"] > div:last-child { flex-shrink: 0; gap: 6px !important; }
                #mobile-rival-root [onclick^="Boako.Rival.toggleDetail"] > div:last-child span {
                    font-size: 10px !important; padding: 4px 7px !important; white-space: nowrap;
                }
            `;
            document.head.appendChild(style);
        }

        // 🌟 rival.js가 containerId 하나만 받으면 배너/탭/목록까지 전부 스스로 그림
        container.innerHTML = `<div id="mobile-rival-root"></div>`;
        Boako.Rival.init('mobile-rival-root');
    }
};
