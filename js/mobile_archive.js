/**
 * [MOBILE ARCHIVE] 모바일 전용 — 전적기록(기록실 / 랭킹보드 / 게임별 통계)
 * 🌟 [재사용 원칙] archive.js의 buildUI(containerId)는 컨테이너 id 하나만 받으면 3개 탭(기록실/
 *    랭킹보드/게임별 통계)과 검색/시즌·라운드 필터/무소속 포함 토글까지 전부 스스로 그리는
 *    완전 자기완결형 구조라 그대로 재사용함. archive.js 파일은 건드리지 않음.
 * 🌟 [전면 재설계] 기록실 탭이 PC 전용 <table>(Date/Player/Game Info/Logic/RP/Status/Link 7컬럼)
 *    구조라 모바일에서 가로 스크롤이 생기던 문제 — "가로 스크롤 절대 불가" 원칙에 따라
 *    Boako.Archive.renderRecords()만 모바일 전용 카드형 세로 리스트로 덮어씀. 데이터 조회
 *    (loadData/fetchAndRender/filterData)와 페이지네이션(renderPagination)은 그대로 재사용.
 * 🌟 [전면 재설계] 게임별 통계 탭의 펼침 목록도 PC 전용 <table>(순위/소속팀/닉네임/RP 4컬럼)
 *    구조라 동일한 이유로 Boako.Archive.renderGames()를 모바일 전용으로 덮어씀 — 바깥 게임
 *    카드(아코디언 헤더)는 PC와 동일한 구조를 유지하고, 펼쳐지는 안쪽 참가자 목록만 카드형으로 교체.
 * 🌟 랭킹보드 탭은 원래부터 `grid grid-cols-1 md:grid-cols-3`라 모바일(<768px)에서 이미 세로 1열로
 *    나오는 카드 그리드라 가로 스크롤 문제가 없어 손대지 않고 그대로 재사용.
 * 🌟 [버그수정 발견] 더보기 시트의 "📋 전적기록" 항목이 다른 항목들과 달리 onclick 자체가
 *    빠져있던 걸 발견 — mobile_shell.js에 openArchive() 진입점을 추가해서 연결.
 */
window.Boako = window.Boako || {};
Boako.MobileArchive = {

    render: async (container) => {
        if (!Boako.Archive || !Boako.Archive.buildUI) await Boako.Util.loadScript('/js/archive.js');

        // 🌟 모바일 전용 렌더러로 교체 (archive.js 파일 자체는 건드리지 않음)
        Boako.Archive.renderRecords = Boako.MobileArchive._renderRecordsCards;
        Boako.Archive.renderGames = Boako.MobileArchive._renderGamesCards;

        container.innerHTML = `<div id="mobile-archive-root"></div>`;
        Boako.Archive.buildUI('mobile-archive-root');
    },

    _formatDate: function (dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const mo = String(d.getMonth() + 1).padStart(2, '0');
        const da = String(d.getDate()).padStart(2, '0');
        const ho = String(d.getHours()).padStart(2, '0');
        const mi = String(d.getMinutes()).padStart(2, '0');
        return `${mo}.${da} ${ho}:${mi}`;
    },

    // 🌟 [모바일 전용] 기록실 카드형 리스트 — Boako.Archive.filteredRecords/formatDate/renderPagination을
    // 그대로 참조하는 것만 다르고, 나머지 상태 관리는 전부 archive.js 원본이 담당.
    _renderRecordsCards: function () {
        const area = document.getElementById('archive-content-area');
        if (!area) return;

        if (this.filteredRecords.length === 0) {
            area.innerHTML = `<div style="background:#fff; border-radius:16px; box-shadow:0 1px 2px rgba(0,0,0,.04); padding:48px 20px; text-align:center; color:#94a3b8; font-weight:700; font-size:13px;">조건에 맞는 기록이 없습니다.</div>`;
            return;
        }

        const matchTypeLabel = (type) => {
            if (!type) return '무소속';
            const map = { TOURNAMENT: '토너먼트', INDIVIDUAL: '개인전', TEAM: '팀전', FRIENDLY: '팀 내 친선전' };
            return map[type.toUpperCase()] || type;
        };

        const cardsHtml = this.filteredRecords.map(rec => {
            const isFreeAgent = !rec.b_all_team;
            const teamLogoHtml = (rec.logo_url && !isFreeAgent)
                ? `<img src="${Boako.Util.cdn(rec.logo_url)}" style="width:12px; height:12px; border-radius:2px; object-fit:contain; flex-shrink:0;" alt="${rec.b_all_team}">`
                : `<span style="font-size:10px; flex-shrink:0;">👤</span>`;

            const rpHtml = isFreeAgent
                ? `<div style="display:flex; flex-direction:column; align-items:flex-end; line-height:1.2;">
                       <span style="position:relative; font-weight:900; font-size:18px; color:#94a3b8;">${Math.floor(rec.rp || 0)}<span style="position:absolute; left:-2px; right:-2px; top:50%; border-top:2px solid #ef4444; transform:translateY(-50%) rotate(-4deg);"></span></span>
                       <span style="font-size:8px; font-weight:900; color:#ef4444; text-transform:uppercase; margin-top:2px;">미집계</span>
                   </div>`
                : `<span style="font-weight:900; font-size:18px; color:#4f46e5;">${Math.floor(rec.rp || 0)}</span>`;

            const statusIconHtml = rec.is_verified == 0
                ? `<i data-lucide="check-circle-2" style="color:#10b981; width:15px; height:15px;"></i>`
                : `<i data-lucide="help-circle" style="color:#cbd5e1; width:15px; height:15px; opacity:.5;"></i>`;

            const linkHtml = rec.post_url
                ? `<a href="${rec.post_url}" target="_blank" style="display:flex; align-items:center; justify-content:center; width:22px; height:22px; background:#f8fafc; border:1px solid #f1f5f9; border-radius:6px; color:#94a3b8;"><i data-lucide="external-link" style="width:11px; height:11px;"></i></a>`
                : '';

            return `
                <div style="background:#fff; border-radius:16px; box-shadow:0 1px 2px rgba(0,0,0,.05); padding:14px; margin-bottom:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                        <div style="min-width:0;">
                            <div style="font-weight:900; font-size:15px; color:#0f172a;">${rec.nickname || 'Unknown'}</div>
                            <div style="display:flex; align-items:center; gap:4px; margin-top:3px;">
                                ${teamLogoHtml}
                                <span style="font-size:10px; font-weight:900; color:#94a3b8; text-transform:uppercase; letter-spacing:.03em;">${rec.b_all_team || 'Free Agent'}</span>
                            </div>
                        </div>
                        ${rpHtml}
                    </div>

                    <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-bottom:8px;">
                        <span style="font-weight:800; font-size:13.5px; color:#312e81;">${rec.game_name || '-'}</span>
                        ${rec.is_first == 1 ? `<span style="background:#ef4444; color:#fff; font-size:8px; font-weight:900; padding:1px 5px; border-radius:4px; text-transform:uppercase;">1ST</span>` : ''}
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:10.5px; color:#94a3b8; font-weight:700; border-top:1px solid #f1f5f9; padding-top:8px;">
                        <span>S${rec.season_no || 0} R${rec.round_no || 0} · ${matchTypeLabel(rec.match_type)}</span>
                        <span>${Boako.MobileArchive._formatDate(rec.created_at)}</span>
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:9px;">
                        <div style="display:flex; gap:4px;">
                            <span style="font-size:9.5px; font-weight:800; background:#f8fafc; border:1px solid #f1f5f9; border-radius:5px; padding:3px 6px; color:#64748b;">🧠 ${rec.weight || 0}</span>
                            <span style="font-size:9.5px; font-weight:800; background:#f8fafc; border:1px solid #f1f5f9; border-radius:5px; padding:3px 6px; color:#64748b;">⏳ ${rec.playtime || 0}</span>
                            <span style="font-size:9.5px; font-weight:800; background:#eef2ff; border:1px solid #e0e7ff; border-radius:5px; padding:3px 6px; color:#4f46e5;">🎲 ${rec.multiplier || 0}</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            ${statusIconHtml}
                            ${linkHtml}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        area.innerHTML = cardsHtml + this.renderPagination();
        if (window.lucide) lucide.createIcons();
    },

    // 🌟 [모바일 전용] 게임별 통계 — 바깥 게임 카드(아코디언 헤더)는 PC와 동일, 펼쳐지는
    // 참가자 목록(원래 <table>)만 카드형 한 줄 리스트로 교체.
    _renderGamesCards: function () {
        const area = document.getElementById('archive-content-area');
        if (!area) return;

        if (this.gameRankings.length === 0) {
            area.innerHTML = `<div style="background:#fff; border-radius:16px; box-shadow:0 1px 2px rgba(0,0,0,.04); padding:48px 20px; text-align:center; color:#94a3b8; font-weight:700; font-size:13px;">조건에 맞는 게임별 통계 데이터가 없습니다.</div>`;
            return;
        }

        const gameMap = new Map();
        this.gameRankings.forEach(row => {
            if (!gameMap.has(row.game_name)) {
                gameMap.set(row.game_name, {
                    popularityRank: row.game_popularity_rank,
                    playersCount: row.total_unique_players,
                    recordsCount: row.total_records_count,
                    playersList: []
                });
            }
            gameMap.get(row.game_name).playersList.push({
                rank: row.player_rank,
                name: row.player_nickname,
                team: row.player_team_name,
                teamLogo: row.player_team_logo,
                rp: row.player_total_rp
            });
        });

        let html = `<div style="display:flex; flex-direction:column; gap:12px;">`;

        gameMap.forEach((game, gameName) => {
            const rankBadgeStyle = game.popularityRank === 1 ? 'background:#f59e0b; color:#fff;'
                : game.popularityRank === 2 ? 'background:#94a3b8; color:#fff;'
                : game.popularityRank === 3 ? 'background:#b45309; color:#fff;'
                : 'background:#f1f5f9; color:#64748b;';

            const rankMedal = (rank) => rank === 1 ? '🥇 1위' : rank === 2 ? '🥈 2위' : rank === 3 ? '🥉 3위' : `${rank}위`;
            const rankColor = (rank) => rank === 1 ? '#f59e0b' : rank === 2 ? '#94a3b8' : rank === 3 ? '#b45309' : '#94a3b8';

            const playersHtml = game.playersList.map(p => {
                const teamLogoHtml = (p.teamLogo && p.team !== 'Free Agent')
                    ? `<img src="${Boako.Util.cdn(p.teamLogo)}" style="width:14px; height:14px; border-radius:3px; object-fit:contain; flex-shrink:0;" alt="${p.team}">`
                    : `<span style="font-size:11px; flex-shrink:0;">👤</span>`;
                return `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:9px 0; border-bottom:1px solid #f1f5f9;">
                        <div style="display:flex; align-items:center; gap:10px; min-width:0;">
                            <span style="font-size:12px; font-weight:900; color:${rankColor(p.rank)}; min-width:38px; flex-shrink:0;">${rankMedal(p.rank)}</span>
                            <div style="min-width:0;">
                                <div style="font-size:12.5px; font-weight:900; color:#1e293b;">${p.name}</div>
                                <div style="display:flex; align-items:center; gap:4px; margin-top:2px;">
                                    ${teamLogoHtml}
                                    <span style="font-size:9.5px; font-weight:800; color:#94a3b8; text-transform:uppercase;">${p.team || 'Free Agent'}</span>
                                </div>
                            </div>
                        </div>
                        <span style="font-size:13px; font-weight:900; color:#4f46e5; flex-shrink:0;">${Math.floor(p.rp).toLocaleString()} P</span>
                    </div>
                `;
            }).join('');

            html += `
                <div style="background:#fff; border-radius:16px; box-shadow:0 1px 2px rgba(0,0,0,.05); padding:14px; overflow:hidden;">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; cursor:pointer;" onclick="this.nextElementSibling.classList.toggle('hidden')">
                        <div style="display:flex; align-items:center; gap:10px; min-width:0;">
                            <div style="width:34px; height:34px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:14px; flex-shrink:0; ${rankBadgeStyle}">${game.popularityRank}</div>
                            <div style="min-width:0;">
                                <div style="font-weight:900; font-size:14.5px; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${gameName}</div>
                                <div style="font-size:9.5px; font-weight:800; color:#cbd5e1; text-transform:uppercase; margin-top:2px;">탭해서 순위 보기</div>
                            </div>
                        </div>
                        <i data-lucide="chevron-down" style="color:#94a3b8; width:16px; height:16px; flex-shrink:0;"></i>
                    </div>
                    <div style="margin-top:6px; padding-top:2px;" class="hidden">
                        <div style="display:flex; gap:6px; margin-bottom:8px;">
                            <span style="font-size:9.5px; font-weight:900; background:#eef2ff; color:#4f46e5; border:1px solid #e0e7ff; padding:3px 8px; border-radius:8px;">👥 유저 ${game.playersCount}명</span>
                            <span style="font-size:9.5px; font-weight:900; background:#f8fafc; color:#64748b; border:1px solid #f1f5f9; padding:3px 8px; border-radius:8px;">📝 기록 ${game.recordsCount}개</span>
                        </div>
                        ${playersHtml}
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        html += this.renderPagination();

        area.innerHTML = html;
        if (window.lucide) lucide.createIcons();
    }
};
