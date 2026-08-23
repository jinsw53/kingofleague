/**
 * [MOBILE SEARCH] 모바일 전용 — 통합검색 (팀/유저/게시글/게임)
 * 🌟 [재사용 원칙] js/search.js(Boako.Search)는 containerId만 참조하는 완전한 자기완결형 모듈이라
 *    검색 로직/결과 렌더링은 전혀 손대지 않고 그대로 재사용함. 유일한 문제는 검색 결과 항목 클릭 시
 *    하드코딩된 onclick="Boako.Util.navigateToLink(...)" 호출인데, 이 함수는 모든 case가
 *    Boako.View.render(...)를 호출하는 PC 전용 함수라 모바일에서 그대로 쓰면 에러남.
 * 🌟 [버그 회피] search.js 파일 자체는 절대 수정하지 않고, Boako.Util.navigateToLink를 모바일
 *    세션에서만 런타임에 완전히 다른 구현으로 교체함(우승 별 붙이기 때 _renderStarModalMode를
 *    래핑했던 것과 같은 패턴, 이번엔 원본을 아예 안 쓰므로 wrap이 아니라 직접 재정의).
 *    이미 포팅된 화면(토너먼트/랭킹)은 실제로 이동시키고, 아직 없는 화면(팀 목록/게시판/같이하자/
 *    라이벌매치/리그콘텐츠)은 토스트로 "곧 지원 예정" 안내만 함 — 해당 화면들이 모바일로 포팅되는
 *    대로 이 매핑표만 갱신하면 됨.
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
            switch (linkType) {
                case 'TOURNAMENT':
                    Boako.MobileShell.switchTab('tournament');
                    break;
                case 'SEASON_RANKING':
                    Boako.MobileShell.switchTab('ranking');
                    break;
                // 🌟 TEAM/USER는 PC에서도 팀 목록(team_list) 화면으로 보내는데, 아직 모바일에
                // 팀 목록 화면이 없어 안내만 함. 내 팀이면 팀 본부로라도 보내주는 게 자연스러움.
                case 'TEAM':
                    if (Boako.state.team?.info?.id === linkId) {
                        await Boako.MobileShell.openTeamHub('info');
                    } else {
                        Boako.Util.toast('👥 팀 목록 화면은 곧 지원될 예정이에요!');
                    }
                    break;
                case 'USER':
                case 'BOARD_POST':
                case 'BOARD_CATEGORY':
                case 'GAME':
                case 'TOGETHER_POST':
                case 'RIVAL_MATCH':
                case 'CHALLENGE':
                case 'GRANDPRIX':
                    Boako.Util.toast('🔧 이 화면은 곧 지원될 예정이에요!');
                    break;
                default:
                    console.warn('알 수 없는 link_type:', linkType);
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
