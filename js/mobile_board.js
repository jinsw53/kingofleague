/**
 * [MOBILE BOARD] 모바일 전용 — 게시판(공략/자유/질문/요청)
 * 🌟 [재사용 원칙] board.js의 init(containerId)은 컨테이너 id 하나만 받으면 목록/글쓰기(리치
 *    에디터+이미지 붙여넣기·드래그+유튜브 삽입+취소선)/상세/댓글/대댓글/임시글함/수정모달/
 *    쪽지보내기까지 전부 스스로 그리는 완전 자기완결형 구조라 그대로 재사용함. Boako.View.render
 *    같은 PC 전용 화면전환 호출이 파일 전체에 단 한 곳도 없어서 별도 안전판 로직 없이 그대로
 *    재사용 가능(라이벌 매치 포팅 때와 동일한 패턴).
 * 🌟 [보정] .main-banner/.section-card/.card-header/.card-body가 PC index.html에만 정의돼있어
 *    모바일엔 스타일이 없음 — 다른 화면들과 동일한 패턴으로 정의. 배너 h1/p엔 처음부터
 *    width:100%를 넣어서(다른 화면들에서 겪었던 가운데 정렬 문제) 재발을 방지함.
 */
window.Boako = window.Boako || {};
Boako.MobileBoard = {

    render: async (container) => {
        if (!Boako.Board || !Boako.Board.init) await Boako.Util.loadScript('/js/board.js');

        if (!document.getElementById('mobile-board-style')) {
            const style = document.createElement('style');
            style.id = 'mobile-board-style';
            style.textContent = `
                #mobile-board-root .section-card { border-radius:16px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.08); border:1px solid #e2e8f0; margin-bottom:14px; background:#fff; }
                /* 🌟 [버그 예방] 다른 화면들과 동일하게 처음부터 width:100%를 넣어서 배너 가운데 정렬이
                   어긋나지 않도록 함 */
                #mobile-board-root .main-banner {
                    min-height: 120px; border-radius: 20px; margin-bottom: 14px; padding: 20px 16px;
                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                    color: #fff; text-align: center; box-shadow: 0 10px 20px rgba(0,0,0,0.15);
                }
                #mobile-board-root .main-banner h1 { font-size: 19px; font-weight: 900; margin: 0 0 8px; width: 100%; }
                #mobile-board-root .main-banner p { font-size: 12px; font-weight: 700; margin: 4px 0 0; opacity: 0.95; width: 100%; }
                #mobile-board-root .card-header { padding: 14px 16px; font-weight: 900; border-bottom: 1px solid #f1f5f9; background:#fafafa; }
                #mobile-board-root .card-body { padding: 16px; }
            `;
            document.head.appendChild(style);
        }

        // 🌟 board.js가 containerId 하나만 받으면 목록/글쓰기/상세까지 전부 스스로 그림
        container.innerHTML = `<div id="mobile-board-root"></div>`;
        Boako.Board.init('mobile-board-root');
    }
};
