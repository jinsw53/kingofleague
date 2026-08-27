/**
 * [MOBILE TEAM LIST] 모바일 전용 — 리그 참여 팀 목록
 * 🌟 [재사용 원칙] js/team_list.js의 loadTeams()/renderPagination()/requestJoin()은 전부
 *    'team-grid-container'/'team-pagination-container'/'team-search-input'/'total-team-count'
 *    등 특정 컨테이너 id만 참조하고, 카드/페이지네이션 자체도 커스텀 클래스(.section-card 등)가
 *    아니라 순수 Tailwind 유틸리티 클래스로만 그려져 있어서(모바일도 Tailwind CDN 로드) 전혀
 *    손대지 않고 그대로 재사용 가능함. requestJoin()도 DB/RPC만 다루는 순수 로직이라 안전.
 * 🌟 [수정 범위] init()이 만드는 바깥 페이지 틀만 PC 전용 커스텀 클래스(.main-banner,
 *    .section-card, .card-header, .card-body)를 쓰고 있어서, 이 부분만 모바일 인라인 스타일로
 *    새로 작성함 — 내부에 같은 id(team-search-input/team-grid-container/team-pagination-container/
 *    total-team-count)만 정확히 넣어주면 loadTeams() 등은 수정 없이 그대로 동작함.
 * 🌟 [버그수정] core.js가 페이지 로드 시점에 미래 모듈들을 전부 빈 객체({})로 미리 선언해둠
 *    (window.Boako.TeamList = {};) — 그래서 team_list.js가 로드되기 전에도 Boako.TeamList는
 *    이미 truthy라서 !Boako.TeamList 체크가 항상 false로 나와 스크립트가 영원히 로드되지 않고,
 *    빈 객체에 loadTeams가 없어 "Boako.TeamList.loadTeams is not a function" 에러가 났음.
 *    반드시 구체적 메서드(.loadTeams) 존재 여부로 체크해야 함 — 다른 모바일 화면들(팀 본부의
 *    .syncStatus/.renderChallenges, 쪽지함의 Object.keys 길이, 검색의 .init)은 이미 이 방식으로
 *    안전하게 체크하고 있었음.
 * 🌟 [수정] 헤더 라벨 "방명록 및 로스터" → "등록된 팀 목록" (PC team_list.js와 동일하게 통일)
 * 🌟 [버그수정] 배너 텍스트가 왼쪽 정렬돼있었음 — PC .main-banner는 가운데 정렬인데 그 클래스가
 *    모바일엔 정의돼있지 않아 정렬이 다르게 보임. 인라인으로 직접 가운데 정렬 속성을 추가.
 */
window.Boako = window.Boako || {};
Boako.MobileTeamList = {

    render: async (container) => {
        if (!Boako.TeamList || !Boako.TeamList.loadTeams) await Boako.Util.loadScript('/js/team_list.js');

        container.innerHTML = `
            <div style="background:linear-gradient(135deg,#3b82f6,#1d4ed8); border-radius:16px; padding:20px; margin-bottom:14px; color:#fff; display:flex; flex-direction:column; align-items:center; text-align:center;">
                <div style="font-size:17px; font-weight:900;">👥 리그 참여 팀 목록</div>
                <div style="font-size:11.5px; font-weight:700; opacity:0.9; margin-top:4px;">BOAKO 아카이브에 등록된 전설적인 팀들을 확인하고 합류하세요!</div>
            </div>

            <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
                <span style="font-size:13px; font-weight:900; color:#1e293b;">등록된 팀 목록</span>
                <span id="total-team-count" style="background:#dbeafe; color:#1d4ed8; font-size:10.5px; font-weight:900; padding:3px 10px; border-radius:999px;">총 0개 팀</span>
            </div>

            <div style="display:flex; gap:8px; margin-bottom:14px;">
                <input type="text" id="team-search-input" placeholder="팀명 또는 팀장 이름으로 검색" style="flex:1; border:1px solid #e2e8f0; border-radius:10px; padding:10px 14px; font-size:13px;">
                <button onclick="Boako.TeamList.loadTeams(1)" style="background:#1e293b; color:#fff; font-weight:900; font-size:12.5px; padding:0 16px; border-radius:10px;">검색</button>
            </div>

            <div id="team-grid-container" class="grid grid-cols-1 gap-3"></div>
            <div id="team-pagination-container" class="flex justify-center items-center gap-2 mt-4"></div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();

        document.getElementById('team-search-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') Boako.TeamList.loadTeams(1);
        });

        // 🌟 PC와 완전히 동일한 함수 그대로 재사용 (카드/페이지네이션 렌더링 전부 위임)
        await Boako.TeamList.loadTeams(1);
    }
};
