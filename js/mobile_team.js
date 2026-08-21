/**
 * [MOBILE TEAM] 모바일 전용 — 시즌 팀 순위 화면
 * 🌟 [신규] PC js/ranking.js의 Boako.Ranking(loadRankingTab/getRankingHTML)과 완전히 동일한
 *    데이터 조회 로직(seasons/v_season_current_ranking/season_final_rankings)을 그대로 재사용하되,
 *    화면 마크업만 모바일 전용으로 새로 작성 — PC의 <table> 3열 구조를 세로 카드 목록 +
 *    탭하면 펼쳐지는 아코디언(5개 세부리그 + 정규리그 9라운드 상세)으로 변경.
 * 🌟 시즌 선택은 PC의 커스텀 드롭다운 대신, 이미 만들어둔 mobile_shell.js의 더보기 시트를
 *    재사용(Boako.MobileShell.openCustomSheet)해서 시즌 목록을 그 안에 띄움 — 별도 UI 안 늘림.
 */
window.Boako = window.Boako || {};
Boako.MobileTeam = {

    State: {
        seasons: [],
        selectedSeason: null,
        rows: [],
        expandedTeam: null
    },

    render: async (container) => {
        container.innerHTML = `<div style="padding:40px 0; text-align:center; color:#94a3b8; font-weight:700; font-size:13px;">랭킹 집계 중...</div>`;
        try {
            await Boako.MobileTeam.loadSeasons();
            if (!Boako.MobileTeam.State.selectedSeason) {
                container.innerHTML = `<div style="padding:40px 16px; text-align:center; color:#94a3b8; font-weight:700; font-size:13px;">진행 중인 시즌이 없습니다.</div>`;
                return;
            }
            await Boako.MobileTeam.loadRanking();
            Boako.MobileTeam.draw();
        } catch (e) {
            console.error('모바일 팀 순위 로드 실패:', e);
            container.innerHTML = `<div style="padding:40px 16px; text-align:center; color:#ef4444; font-weight:700; font-size:13px;">로드 실패: ${e.message}</div>`;
        }
    },

    // 🌟 PC Boako.Ranking.init()의 시즌 목록 구성 로직과 동일 (33~49행)
    loadSeasons: async () => {
        const now = new Date().toISOString();
        const { data: allSeasons } = await Boako.db
            .from('seasons')
            .select('season_no, title, start_date, end_date')
            .lte('start_date', now)
            .order('season_no', { ascending: false });

        const currentSeason = (allSeasons || []).find(s => s.end_date >= now);

        Boako.MobileTeam.State.seasons = (allSeasons || []).map(s => ({
            season_no: s.season_no,
            title: `시즌 ${s.season_no}`,
            is_current: currentSeason ? s.season_no === currentSeason.season_no : false
        }));

        Boako.MobileTeam.State.selectedSeason = currentSeason
            ? currentSeason.season_no
            : (Boako.MobileTeam.State.seasons[0]?.season_no || null);
    },

    // 🌟 PC Boako.Ranking.loadRankingTab()과 동일한 조회 로직 (167~203행)
    loadRanking: async () => {
        const seasonNo = Boako.MobileTeam.State.selectedSeason;
        const seasonInfo = Boako.MobileTeam.State.seasons.find(s => s.season_no === seasonNo);
        const isCurrent = seasonInfo?.is_current;
        const sourceTable = isCurrent ? 'v_season_current_ranking' : 'season_final_rankings';

        const { data: rows, error } = await Boako.db
            .from(sourceTable)
            .select('*')
            .eq('season_no', seasonNo)
            .order('total_lp', { ascending: false });
        if (error) throw error;

        Boako.MobileTeam.State.rows = (rows || []).map((r, idx) => ({
            ...r,
            _rank: isCurrent ? (idx + 1) : r.final_rank
        }));
        Boako.MobileTeam.State._isCurrent = isCurrent;
    },

    // ========== 화면 그리기 ==========
    draw: () => {
        const container = document.getElementById('mobile-content-area');
        if (!container) return;
        const { seasons, selectedSeason, rows, expandedTeam, _isCurrent } = Boako.MobileTeam.State;
        const seasonInfo = seasons.find(s => s.season_no === selectedSeason);

        const rankBadge = (rank) => {
            if (rank === 1) return { bg: '#fef3c7', text: '#b45309' };
            if (rank === 2) return { bg: '#f1f5f9', text: '#64748b' };
            if (rank === 3) return { bg: '#fee2e2', text: '#b91c1c' };
            return { bg: '#f1f5f9', text: '#94a3b8' };
        };

        const cardsHtml = rows.length === 0
            ? `<div style="padding:32px 0; text-align:center; color:#94a3b8; font-weight:700; font-size:13px;">이번 시즌 집계된 팀이 없습니다.</div>`
            : rows.map(r => {
                const bd = rankBadge(r._rank);
                const isOpen = expandedTeam === r.team_name;
                return `
                    <div style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden;">
                        <div onclick="Boako.MobileTeam.toggle('${r.team_name.replace(/'/g, "\\'")}')" style="display:flex; align-items:center; gap:10px; padding:12px 14px; cursor:pointer;">
                            <div style="width:26px; height:26px; border-radius:50%; background:${bd.bg}; color:${bd.text}; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:900; flex-shrink:0;">${r._rank ?? '-'}</div>
                            <img src="${Boako.Util.cdn(r.logo_url || 'https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challenge%20(1).png')}" style="width:26px; height:26px; border-radius:6px; object-fit:contain; background:#f8fafc; border:1px solid #f1f5f9; flex-shrink:0;">
                            <span style="flex:1; font-size:13px; font-weight:900; color:#1e293b; min-width:0;">${r.team_name}</span>
                            <span style="font-size:12.5px; font-weight:900; color:#4338ca; white-space:nowrap;">🏆 ${Number(r.total_lp).toLocaleString()} LP</span>
                            <span style="font-size:13px; color:#cbd5e1;">${isOpen ? '▲' : '▼'}</span>
                        </div>
                        ${isOpen ? Boako.MobileTeam.buildDetailHtml(r) : ''}
                    </div>
                `;
            }).join('');

        container.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
                <div>
                    <div style="font-size:15px; font-weight:900; color:#1e293b;">${seasonInfo?.title || ''}</div>
                    <div style="font-size:11px; color:#94a3b8; font-weight:700; margin-top:1px;">${_isCurrent ? '🔴 실시간 집계 중' : '✅ 시즌 종료, 확정 기록'}</div>
                </div>
                <button onclick="Boako.MobileTeam.openSeasonSheet()" style="display:flex; align-items:center; gap:5px; background:#fff; border:1px solid #e2e8f0; border-radius:10px; padding:8px 12px; font-size:12px; font-weight:900; color:#334155;">
                    시즌 선택 ▾
                </button>
            </div>
            <div style="display:flex; flex-direction:column; gap:8px;">${cardsHtml}</div>
        `;
    },

    // 🌟 PC getRankingHTML의 상세(detailRow) 부분과 동일한 필드/제외라운드 로직 (236~289행)을
    // 세로 그리드로 재구성. 6칸(5개 세부리그+정규리그 합) → 9칸(라운드별) 둘 다 3열 그리드 유지
    // (PC도 좁은 화면에선 이미 3열로 떨어지는 반응형 클래스를 쓰고 있어서 그대로 가져와도 잘 맞음).
    buildDetailHtml: (r) => {
        const regularSum = [1, 2, 3, 4, 5, 6, 7, 8, 9].reduce((acc, n) => acc + (Number(r[`round_${n}_lp`]) || 0), 0);
        const excludedSum = [r.excluded_round_1, r.excluded_round_2].reduce((acc, e) => {
            if (!e) return acc;
            const val = Object.values(e)[0];
            return acc + (Number(val) || 0);
        }, 0);
        const regularNet = (regularSum - excludedSum).toLocaleString();

        const summaryCell = (label, val, highlight) => `
            <div style="background:${highlight ? '#eef2ff' : '#fff'}; border:1px solid ${highlight ? '#c7d2fe' : '#e2e8f0'}; border-radius:10px; padding:8px 4px; text-align:center;">
                <div style="font-size:9px; font-weight:900; color:${highlight ? '#818cf8' : '#94a3b8'}; text-transform:uppercase;">${label}</div>
                <div style="font-size:13px; font-weight:900; color:${highlight ? '#4338ca' : '#334155'}; margin-top:2px;">${val}</div>
            </div>
        `;

        const excluded1Round = r.excluded_round_1 ? Object.keys(r.excluded_round_1)[0] : null;
        const excluded2Round = r.excluded_round_2 ? Object.keys(r.excluded_round_2)[0] : null;

        const roundCells = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => {
            const val = r[`round_${n}_lp`];
            const isExcluded = String(n) === excluded1Round || String(n) === excluded2Round;
            return `
                <div style="background:#fff; border:1px solid ${isExcluded ? '#fecdd3' : '#e2e8f0'}; opacity:${isExcluded ? '0.6' : '1'}; border-radius:10px; padding:7px 4px; text-align:center;">
                    <div style="font-size:9px; font-weight:900; color:#94a3b8; text-transform:uppercase;">R${n}</div>
                    <div style="font-size:12.5px; font-weight:900; color:${isExcluded ? '#fb7185' : '#334155'}; text-decoration:${isExcluded ? 'line-through' : 'none'}; margin-top:1px;">${val ?? '-'}</div>
                    ${isExcluded ? `<div style="font-size:8px; font-weight:800; color:#fb7185;">제외</div>` : ''}
                </div>
            `;
        }).join('');

        return `
            <div style="padding:0 14px 14px;">
                <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:6px; margin-bottom:8px;">
                    ${summaryCell('대항전', r.grandprix_lp ?? 0, false)}
                    ${summaryCell('빙고', r.bingo_lp ?? 0, false)}
                    ${summaryCell('챌린지', r.challenge_lp ?? 0, false)}
                    ${summaryCell('킹오브리그', r.kol_lp ?? 0, false)}
                    ${summaryCell('챔피언', r.champion_lp ?? 0, false)}
                    ${summaryCell('정규리그', regularNet, true)}
                </div>
                <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:6px;">
                    ${roundCells}
                </div>
                <div style="font-size:10px; color:#94a3b8; font-weight:700; margin-top:8px; text-align:center;">정규리그는 상위 7라운드만 반영, 하위 2라운드는 제외됩니다.</div>
            </div>
        `;
    },

    toggle: (teamName) => {
        Boako.MobileTeam.State.expandedTeam = Boako.MobileTeam.State.expandedTeam === teamName ? null : teamName;
        Boako.MobileTeam.draw();
    },

    // 🌟 시즌 선택은 별도 UI를 새로 안 만들고, mobile_shell.js의 시트(더보기와 동일한 컴포넌트)를
    // 재사용 — 열릴 때 이 화면 전용 내용으로 갈아끼움
    openSeasonSheet: () => {
        const html = Boako.MobileTeam.State.seasons.map(s => `
            <div onclick="Boako.MobileTeam.changeSeason(${s.season_no})" style="display:flex; align-items:center; justify-content:space-between; padding:13px 6px; font-size:14px; font-weight:800; ${s.season_no === Boako.MobileTeam.State.selectedSeason ? 'color:#4338ca;' : 'color:#334155;'}">
                <span>${s.title}</span>
                ${s.is_current ? `<span style="font-size:10px; color:#ef4444; font-weight:900;">🔴 진행중</span>` : ''}
            </div>
        `).join('');
        Boako.MobileShell.openCustomSheet(html);
    },

    changeSeason: async (seasonNo) => {
        Boako.MobileTeam.State.selectedSeason = seasonNo;
        Boako.MobileTeam.State.expandedTeam = null;
        Boako.MobileShell.closeAll();
        const container = document.getElementById('mobile-content-area');
        container.innerHTML = `<div style="padding:40px 0; text-align:center; color:#94a3b8; font-weight:700; font-size:13px;">불러오는 중...</div>`;
        await Boako.MobileTeam.loadRanking();
        Boako.MobileTeam.draw();
    }
};
