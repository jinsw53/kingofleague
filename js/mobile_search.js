/**
 * [MOBILE SEARCH] 모바일 전용 — 통합검색 (팀/유저/게시글/게임)
 * 🌟 [재사용 원칙] js/search.js(Boako.Search)는 containerId만 참조하는 완전한 자기완결형 모듈이라
 *    검색 로직/결과 렌더링은 전혀 손대지 않고 그대로 재사용함. 유일한 문제는 검색 결과 항목 클릭 시
 *    하드코딩된 onclick="Boako.Util.navigateToLink(...)" 호출인데, 이 함수는 모든 case가
 *    Boako.View.render(...)를 호출하는 PC 전용 함수라 모바일에서 그대로 쓰면 에러남.
 * 🌟 [버그 회피] search.js 파일 자체는 절대 수정하지 않고, Boako.Util.navigateToLink를 모바일
 *    세션에서만 런타임에 완전히 다른 구현으로 교체함(우승 별 붙이기 때 _renderStarModalMode를
 *    래핑했던 것과 같은 패턴, 이번엔 원본을 아예 안 쓰므로 wrap이 아니라 직접 재정의).
 * 🌟 [버그수정 — 매핑표 갱신] 처음 만들 때는 팀 목록/게시판/같이하자/라이벌매치/리그콘텐츠가
 *    모바일에 아직 없어서 전부 "곧 지원 예정" 토스트만 띄웠는데, 그 사이 해당 화면들이 전부 포팅
 *    완료됐는데도 이 매핑표가 안 갱신돼서 실제로는 다 갈 수 있는데 계속 안내 토스트만 뜨고 있었음.
 *    js/util.js의 PC 원본 navigateToLink와 동일한 목적지로 전부 다시 연결:
 *      - BOARD_POST/BOARD_CATEGORY/GAME → js/board.js를 그대로 재사용하는 mobile_board.js라
 *        Boako.Board.openDetail/switchCategory/openGuideForGame이 이미 로드돼있어 PC와 동일 호출
 *      - RIVAL_MATCH → mobile_rival.js도 js/rival.js를 그대로 재사용하므로 Boako.Rival.switchTab 동일 호출
 *      - TEAM/USER → mobile_team_list.js로 이동(PC와 동일하게 유저도 팀 목록에서 찾도록 안내)
 *      - TOGETHER_POST → mobile_together.js, CHALLENGE/GRANDPRIX → mobile_league.js
 */
window.Boako = window.Boako || {};
Boako.MobileSearch = {

    _patched: false,

    // 🌟 최초 1회만 Boako.Util.navigateToLink를 모바일 안전 버전으로 완전히 교체
    _ensurePatched: () => {
        if (Boako.MobileSearch._patched) return;
        Boako.MobileSearch._patched = true;

        Boako.Util.navigateToLink = async (linkType, linkId) => {
            Boako.MobileShell.closeAll();
            try {
                switch (linkType) {
                    case 'TOURNAMENT':
                        Boako.MobileShell.switchTab('tournament');
                        break;
                    case 'SEASON_RANKING':
                        Boako.MobileShell.switchTab('ranking');
                        break;
                    case 'TEAM':
                        if (Boako.state.team?.info?.id === linkId) {
                            await Boako.MobileShell.openTeamHub('info');
                        } else {
                            await Boako.MobileShell.openTeamList();
                        }
                        break;
                    case 'USER':
                        // 🌟 PC와 동일 — 유저 검색 결과는 소속 팀을 찾아보도록 팀 목록으로 안내
                        await Boako.MobileShell.openTeamList();
                        break;
                    case 'BOARD_POST':
                        await Boako.MobileShell.openBoard();
                        setTimeout(() => {
                            if (Boako.Board && typeof Boako.Board.openDetail === 'function') {
                                Boako.Board.openDetail(Number(linkId));
                            }
                        }, 150);
                        break;
                    case 'BOARD_CATEGORY':
                        await Boako.MobileShell.openBoard();
                        setTimeout(() => {
                            if (Boako.Board && typeof Boako.Board.switchCategory === 'function') {
                                Boako.Board.switchCategory(linkId);
                            }
                        }, 150);
                        break;
                    case 'GAME':
                        await Boako.MobileShell.openBoard();
                        setTimeout(() => {
                            if (Boako.Board && typeof Boako.Board.openGuideForGame === 'function') {
                                Boako.Board.openGuideForGame(linkId);
                            }
                        }, 150);
                        break;
                    case 'TOGETHER_POST':
                        await Boako.MobileShell.openTogether();
                        break;
                    case 'RIVAL_MATCH':
                        await Boako.MobileShell.openRival();
                        setTimeout(() => {
                            if (Boako.Rival && typeof Boako.Rival.switchTab === 'function') {
                                Boako.Rival.switchTab('cheer');
                            }
                        }, 150);
                        break;
                    case 'CHALLENGE':
                    case 'GRANDPRIX':
                        await Boako.MobileShell.openLeague();
                        break;
                    default:
                        console.warn('알 수 없는 link_type:', linkType);
                }
            } catch (err) {
                console.error('링크 이동 실패:', err);
            }
        };
    },

    render: async (container) => {
        Boako.MobileSearch._ensurePatched();

        container.innerHTML = `
            <div style="display:flex; gap:8px; margin-bottom:16px;">
                <input type="text" id="mobile-search-input" placeholder="팀/유저/게시글/게임 검색" style="flex:1; border:1px solid #e2e8f0; border-radius:10px; padding:11px 14px; font-size:14px;" onkeypress="if(event.key==='Enter') Boako.MobileSearch.runSearch()">
                <button onclick="Boako.MobileSearch.runSearch()" style="background:#7c3aed; color:#fff; font-weight:900; font-size:13px; padding:0 18px; border-radius:10px;">검색</button>
            </div>
            <div id="mobile-search-body"></div>
        `;

        setTimeout(() => {
            const input = document.getElementById('mobile-search-input');
            if (input) input.focus();
        }, 100);
    },

    runSearch: async () => {
        const input = document.getElementById('mobile-search-input');
        const query = input?.value.trim();
        if (!query) return;

        if (!Boako.Search || !Boako.Search.init) await Boako.Util.loadScript('/js/search.js');

        const body = document.getElementById('mobile-search-body');
        if (body) body.id = 'mobile-search-master-container'; // Boako.Search.init이 기대하는 컨테이너 id로 부여

        // 🌟 PC와 완전히 동일한 검색/렌더 로직 그대로 재사용 (containerId만 모바일 것으로 지정)
        await Boako.Search.init('mobile-search-master-container', query);
    }
};
