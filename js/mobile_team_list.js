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
 */
window.Boako = window.Boako || {};
Boako.MobileTeamList = {

    render: async (container) => {
        if (!Boako.TeamList) await Boako.Util.loadScript('/js/team_list.js');

        container.innerHTML = `
            <div style="background:linear-gradient(135deg,#3b82f6,#1d4ed8); border-radius:16px; padding:20px; margin-bottom:14px; color:#fff;">
                <div style="font-size:17px; font-weight:900;">👥 리그 참여 팀 목록</div>
                <div style="font-size:11.5px; font-weight:700; opacity:0.9; margin-top:4px;">BOAKO 아카이브에 등록된 전설적인 팀들을 확인하고 합류하세요!</div>
            </div>

            <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
                <span style="font-size:13px; font-weight:900; color:#1e293b;">방명록 및 로스터</span>
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
