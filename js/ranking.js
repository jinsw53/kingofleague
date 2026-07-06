/**
 * 🏆 [RANKING] 시즌 종합 랭킹 + 명예의 전당
 * v_season_current_ranking(진행중) / season_final_rankings(확정) 기반
 */

Boako.Ranking = Boako.Ranking || {};

Boako.Ranking.State = {
    currentTab: 'ranking',
    seasons: [],
    selectedSeason: null,
    rankingRows: [],
    expandedTeam: null,
    hofSeasons: [],
    hofSelectedSeason: null,
    hofData: null
};

Boako.Ranking.init = async function() {
    const container = document.querySelector('.section-card .card-body') || document.querySelector('.card-body');
    if (!container) return;

    Boako.Ranking.injectStyle();

    try {
        const now = new Date().toISOString();

        const { data: allSeasons } = await Boako.db
            .from('seasons')
            .select('season_no, title, start_date, end_date')
            .lte('start_date', now)
            .order('season_no', { ascending: false });

        const currentSeason = (allSeasons || []).find(s => s.end_date >= now);

        Boako.Ranking.State.seasons = (allSeasons || []).map(s => ({
            season_no: s.season_no,
            title: `시즌 ${s.season_no}`,
            is_current: currentSeason ? s.season_no === currentSeason.season_no : false
        }));

        Boako.Ranking.State.selectedSeason = currentSeason
            ? currentSeason.season_no
            : (Boako.Ranking.State.seasons[0]?.season_no || null);

        const { data: finalizedSeasons } = await Boako.db
            .from('season_final_rankings')
            .select('season_no')
            .not('final_rank', 'is', null);
        Boako.Ranking.State.hofSeasons = [...new Set((finalizedSeasons || []).map(r => r.season_no))].sort((a, b) => b - a);
        Boako.Ranking.State.hofSelectedSeason = Boako.Ranking.State.hofSeasons[0] || null;

        container.innerHTML = Boako.Ranking.getShellHTML();
        await Boako.Ranking.loadRankingTab();

    } catch (e) {
        console.error('랭킹 초기화 실패:', e);
        container.innerHTML = `<div class="text-center py-20 text-rose-500 font-bold">랭킹 데이터 로드 실패: ${e.message}</div>`;
    }
};

Boako.Ranking.injectStyle = function() {
    if (document.getElementById('ranking-style')) return;
    const style = document.createElement('style');
    style.id = 'ranking-style';
    style.innerHTML = `
        .rk-tab-btn { padding: 10px 20px; border-radius: 12px; font-weight: 900; font-size: 13px; transition: all .2s; cursor: pointer; }
        .rk-tab-btn.active { background: linear-gradient(135deg, #7c3aed, #4f46e5); color: #fff; box-shadow: 0 4px 12px rgba(124,58,237,.3); }
        .rk-tab-btn:not(.active) { background: #f1f5f9; color: #64748b; }
        .rk-row { transition: background .15s; }
        .rk-row:hover { background: #f8fafc; }
        .rk-rank-badge { width: 28px; height: 28px; border-radius: 8px; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:12px; }
        .rk-rank-1 { background: linear-gradient(135deg,#fbbf24,#f59e0b); color:#fff; }
        .rk-rank-2 { background: linear-gradient(135deg,#cbd5e1,#94a3b8); color:#fff; }
        .rk-rank-3 { background: linear-gradient(135deg,#fb923c,#ea580c); color:#fff; }
        .rk-rank-other { background:#f1f5f9; color:#64748b; }
        .rk-detail-row { background: #fafaff; }
.hof-card { background: linear-gradient(160deg,#1e1b4b,#312e81); border-radius: 24px; padding: 24px; color: #fff; position: relative; overflow: hidden; }
        .hof-card::before { content:''; position:absolute; top:-40%; right:-20%; width:200px; height:200px; background: radial-gradient(circle, rgba(251,191,36,.25), transparent 70%); }

        .hof-champion-card {
            position:relative; width:100%; min-height:280px; border-radius:18px; overflow:hidden;
            box-shadow: 0 8px 20px rgba(30,27,75,.3); text-align:left;
            background: linear-gradient(135deg, #312e81 0%, #312e81 45%, #1e1b4b 45%, #1e1b4b 100%);
            transition: transform .2s;
        }
        .hof-champion-card:hover { transform: translateY(-3px); box-shadow: 0 12px 26px rgba(30,27,75,.35); }
        .hcc-bg-diagonal { position:absolute; inset:0; background: linear-gradient(135deg, rgba(124,58,237,.35) 0%, transparent 40%), linear-gradient(315deg, rgba(0,0,0,.35) 0%, transparent 45%); }
        .hcc-bg-scrim { position:absolute; inset:0; background: linear-gradient(180deg, rgba(30,27,75,.35) 0%, rgba(30,27,75,.15) 35%, rgba(17,15,45,.92) 100%); }
        .hcc-season-overlay { position:absolute; inset:0; pointer-events:none; overflow:hidden; }
        .hcc-season-overlay span { position:absolute; line-height:1; }
        .hcc-game-badge-wrap { position:absolute; z-index:3; top:8px; left:50%; transform:translateX(-50%); }
        .hcc-game-badge { width:160px; height:160px; object-fit:contain; filter: drop-shadow(0 2px 8px rgba(0,0,0,.4)); }
        .hcc-body { position:relative; z-index:1; padding: 150px 10px 6px; }
        .hcc-top-row { display:flex; align-items:center; gap:4px; margin-bottom:14px; margin-left:11px; }
        .hcc-mvp-wrap { position:relative; width:100px; height:100px; margin-left:-22px; flex-shrink:0; }
        .hcc-mvp-photo { position:absolute; top:58%; left:49%; transform:translate(-50%,-50%); width:71px; height:71px; border-radius:50%; object-fit:cover; background:#fff; box-shadow: 0 2px 8px rgba(0,0,0,.4); }
        .hcc-fire-ring { position:absolute; inset:0; width:100%; height:100%; object-fit:contain; filter: drop-shadow(0 0 8px rgba(249,115,22,.55)); }
        .hcc-name-col { flex:1; text-align:left; padding-right:14px; min-width:0; }
        .hcc-nickname { font-size:21px; font-weight:900; font-style:italic; color:#fff; -webkit-text-stroke:1.7px #1e1b4b; paint-order: stroke fill; letter-spacing:.01em; line-height:1.05; margin:0 0 6px; text-shadow:2px 2px 0 rgba(0,0,0,.35); white-space:nowrap; display:inline-block; }
        .hcc-team-row { display:flex; align-items:center; gap:5px; min-width:0; margin-left:-8px; }
        .hcc-team-row img { width:15px; height:15px; border-radius:4px; object-fit:contain; background:#fff; padding:1px; flex-shrink:0; }
        .hcc-team-row span { font-size:10.5px; font-weight:800; color:#e9d5ff; white-space:nowrap; display:inline-block; }
        .hcc-stamp { position:absolute; z-index:2; bottom:8px; left:53px; width:130px; height:auto; transform:rotate(-14deg); filter: drop-shadow(0 3px 6px rgba(0,0,0,.55)); opacity:.97; pointer-events:none; }
    `;
    document.head.appendChild(style);
};

Boako.Ranking.getShellHTML = function() {
    return `
        <div class="flex items-center gap-2 mb-6 p-1 bg-slate-100 rounded-2xl w-fit">
            <button id="rk-tab-ranking" class="rk-tab-btn active" onclick="Boako.Ranking.switchTab('ranking')">🏆 랭킹</button>
            <button id="rk-tab-hof" class="rk-tab-btn" onclick="Boako.Ranking.switchTab('hof')">🎖️ 명예의 전당</button>
        </div>
        <div id="rk-content"></div>
    `;
};

Boako.Ranking.switchTab = async function(tabId) {
    if (window.sfx) window.sfx.click();
    Boako.Ranking.State.currentTab = tabId;

    document.getElementById('rk-tab-ranking').className = `rk-tab-btn${tabId === 'ranking' ? ' active' : ''}`;
    document.getElementById('rk-tab-hof').className = `rk-tab-btn${tabId === 'hof' ? ' active' : ''}`;

    if (tabId === 'ranking') {
        await Boako.Ranking.loadRankingTab();
    } else {
        await Boako.Ranking.loadHofTab();
    }
};

Boako.Ranking.loadRankingTab = async function() {
    const content = document.getElementById('rk-content');
    if (!content) return;
    content.innerHTML = `<div class="text-center py-16 text-slate-400 font-bold animate-pulse">랭킹 집계 중...</div>`;

    try {
        const seasonNo = Boako.Ranking.State.selectedSeason;
        const seasonInfo = Boako.Ranking.State.seasons.find(s => s.season_no === seasonNo);
        if (!seasonNo) {
            content.innerHTML = `<div class="text-center py-16 text-slate-400 font-bold">시즌 정보가 없습니다.</div>`;
            return;
        }

        const isCurrent = seasonInfo?.is_current;
        const sourceTable = isCurrent ? 'v_season_current_ranking' : 'season_final_rankings';

        const { data: rows, error } = await Boako.db
            .from(sourceTable)
            .select('*')
            .eq('season_no', seasonNo)
            .order('total_lp', { ascending: false });
        if (error) throw error;

        const rankedRows = (rows || []).map((r, idx) => ({
            ...r,
            _rank: isCurrent ? (idx + 1) : r.final_rank
        }));

        Boako.Ranking.State.rankingRows = rankedRows;
        content.innerHTML = Boako.Ranking.getRankingHTML(seasonInfo, isCurrent);
        if (window.lucide) window.lucide.createIcons();

    } catch (e) {
        console.error('랭킹 로드 실패:', e);
        content.innerHTML = `<div class="text-center py-16 text-rose-500 font-bold">로드 실패: ${e.message}</div>`;
    }
};

Boako.Ranking.getRankingHTML = function(seasonInfo, isCurrent) {
    const seasonOptionsHtml = Boako.Ranking.State.seasons.map(s => `
        <div onclick="Boako.Ranking.changeSeason(${s.season_no})" class="group px-4 py-3 cursor-pointer rounded-xl font-black text-xs transition-all duration-200 flex items-center gap-2 ${s.season_no === Boako.Ranking.State.selectedSeason ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}">
            <div class="w-1.5 h-1.5 rounded-full ${s.season_no === Boako.Ranking.State.selectedSeason ? 'bg-indigo-500' : 'bg-transparent'}"></div>
            <span class="flex-1">${s.title}</span>
            ${s.is_current ? '<span class="text-[9px] text-rose-500 font-black">🔴 진행중</span>' : ''}
        </div>
    `).join('');

    const rows = Boako.Ranking.State.rankingRows;

    const tableRowsHtml = rows.length === 0
        ? `<tr><td colspan="9" class="text-center py-12 text-slate-400 font-bold">이번 시즌 집계된 팀이 없습니다.</td></tr>`
        : rows.map(r => {
            const rankBadgeClass = r._rank === 1 ? 'rk-rank-1' : r._rank === 2 ? 'rk-rank-2' : r._rank === 3 ? 'rk-rank-3' : 'rk-rank-other';
            const isExpanded = Boako.Ranking.State.expandedTeam === r.team_name;

const mainRow = `
                <tr class="rk-row border-b border-slate-100 cursor-pointer" onclick="Boako.Ranking.toggleTeamDetail('${r.team_name.replace(/'/g, "\\'")}')">
                    <td class="py-3 px-3"><div class="rk-rank-badge ${rankBadgeClass}">${r._rank ?? '-'}</div></td>
                    <td class="py-3 px-3">
                        <div class="flex items-center gap-2">
                            <img src="${Boako.Util.cdn(r.logo_url || 'https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challenge%20(1).png')}" class="w-8 h-8 rounded-lg object-contain bg-slate-50 border border-slate-100 p-0.5">
                            <span class="font-black text-slate-800 text-sm">${r.team_name}</span>
                            <i data-lucide="chevron-${isExpanded ? 'up' : 'down'}" class="w-3.5 h-3.5 text-slate-300"></i>
                        </div>
                    </td>
                    <td class="py-3 px-3 text-right font-black text-indigo-700">🏆 ${Number(r.total_lp).toLocaleString()} LP</td>
                </tr>
            `;

            const detailRow = isExpanded ? `
                <tr class="rk-detail-row">
                    <td colspan="3" class="p-4">
                        <div class="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
                            <div class="bg-white border border-slate-200 rounded-xl p-2 text-center">
                                <div class="text-[9px] font-black text-slate-400 uppercase">대항전</div>
                                <div class="text-sm font-black text-slate-700">${r.grandprix_lp ?? 0}</div>
                            </div>
                            <div class="bg-white border border-slate-200 rounded-xl p-2 text-center">
                                <div class="text-[9px] font-black text-slate-400 uppercase">빙고</div>
                                <div class="text-sm font-black text-slate-700">${r.bingo_lp ?? 0}</div>
                            </div>
                            <div class="bg-white border border-slate-200 rounded-xl p-2 text-center">
                                <div class="text-[9px] font-black text-slate-400 uppercase">챌린지</div>
                                <div class="text-sm font-black text-slate-700">${r.challenge_lp ?? 0}</div>
                            </div>
                            <div class="bg-white border border-slate-200 rounded-xl p-2 text-center">
                                <div class="text-[9px] font-black text-slate-400 uppercase">킹오브리그</div>
                                <div class="text-sm font-black text-slate-700">${r.kol_lp ?? 0}</div>
                            </div>
                            <div class="bg-white border border-slate-200 rounded-xl p-2 text-center">
                                <div class="text-[9px] font-black text-slate-400 uppercase">챔피언</div>
                                <div class="text-sm font-black text-slate-700">${r.champion_lp ?? 0}</div>
                            </div>
                            <div class="bg-indigo-50 border border-indigo-200 rounded-xl p-2 text-center">
                                <div class="text-[9px] font-black text-indigo-400 uppercase">정규리그</div>
                                <div class="text-sm font-black text-indigo-700">${(() => {
                                    const sum = [1,2,3,4,5,6,7,8,9].reduce((acc, n) => acc + (Number(r[`round_${n}_lp`]) || 0), 0);
                                    const excludedSum = [r.excluded_round_1, r.excluded_round_2].reduce((acc, e) => {
                                        if (!e) return acc;
                                        const val = Object.values(e)[0];
                                        return acc + (Number(val) || 0);
                                    }, 0);
                                    return (sum - excludedSum).toLocaleString();
                                })()}</div>
                            </div>
                        </div>
                        <div class="grid grid-cols-3 sm:grid-cols-9 gap-2">
                            ${[1,2,3,4,5,6,7,8,9].map(n => {
                                const val = r[`round_${n}_lp`];
                                const excluded1Round = r.excluded_round_1 ? Object.keys(r.excluded_round_1)[0] : null;
                                const excluded2Round = r.excluded_round_2 ? Object.keys(r.excluded_round_2)[0] : null;
                                const isExcluded = String(n) === excluded1Round || String(n) === excluded2Round;
                                return `
                                    <div class="bg-white border ${isExcluded ? 'border-rose-200 opacity-50' : 'border-slate-200'} rounded-xl p-2 text-center">
                                        <div class="text-[9px] font-black text-slate-400 uppercase">R${n}</div>
                                        <div class="text-sm font-black ${isExcluded ? 'text-rose-400 line-through' : 'text-slate-700'}">${val ?? '-'}</div>
                                        ${isExcluded ? '<div class="text-[8px] font-bold text-rose-400">제외</div>' : ''}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                        <div class="text-[10px] text-slate-400 font-bold mt-2 text-center">정규리그는 상위 7라운드만 반영, 하위 2라운드는 제외됩니다.</div>
                    </td>
                </tr>
            ` : '';

            return mainRow + detailRow;
        }).join('');

    return `
        <div class="mb-5 flex items-center justify-between">
            <div>
                <h3 class="font-black text-slate-800 text-lg">${seasonInfo?.title || ''}</h3>
                <p class="text-xs text-slate-400 font-bold mt-0.5">${isCurrent ? '🔴 실시간 집계 중' : '✅ 시즌 종료, 확정된 최종 기록'}</p>
            </div>
<div class="relative z-30">
                <button onclick="Boako.Ranking.toggleSeasonDropdown()" class="bg-white px-4 py-2.5 rounded-xl shadow-sm border border-slate-200 flex items-center gap-2 text-xs font-black text-slate-700 hover:border-indigo-400 hover:shadow-md transition-all duration-200 group">
                    <span>${seasonInfo?.title || ''}</span>
                    <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500 transition-colors"></i>
                </button>
                <div id="rk-season-dropdown-overlay" onclick="Boako.Ranking.toggleSeasonDropdown()" class="hidden fixed inset-0 z-40 bg-transparent"></div>
                <div id="rk-season-dropdown-menu" class="hidden absolute top-full right-0 mt-2 w-[200px] bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_15px_40px_-10px_rgba(0,0,0,0.15)] border border-white/60 overflow-hidden z-50 p-1">
                    <div class="max-h-64 overflow-y-auto custom-scrollbar">
                        ${seasonOptionsHtml}
                    </div>
                </div>
            </div>
        </div>

        <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <table class="w-full text-left">
                <thead class="bg-slate-50 border-b border-slate-200">
                    <tr class="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        <th class="py-3 px-3">순위</th>
                        <th class="py-3 px-3">팀</th>
                        <th class="py-3 px-3 text-right">총 LP</th>
                    </tr>
                </thead>
                <tbody>${tableRowsHtml}</tbody>
            </table>
        </div>
    `;
};

Boako.Ranking.toggleSeasonDropdown = function() {
    if (window.sfx) window.sfx.click();
    const menu = document.getElementById('rk-season-dropdown-menu');
    const overlay = document.getElementById('rk-season-dropdown-overlay');
    if (menu && overlay) {
        menu.classList.toggle('hidden');
        overlay.classList.toggle('hidden');
    }
};

Boako.Ranking.changeSeason = async function(seasonNo) {
    Boako.Ranking.State.selectedSeason = Number(seasonNo);
    Boako.Ranking.State.expandedTeam = null;
    await Boako.Ranking.loadRankingTab();
};

Boako.Ranking.toggleTeamDetail = function(teamName) {
    if (window.sfx) window.sfx.click();
    Boako.Ranking.State.expandedTeam = Boako.Ranking.State.expandedTeam === teamName ? null : teamName;
    const seasonInfo = Boako.Ranking.State.seasons.find(s => s.season_no === Boako.Ranking.State.selectedSeason);
    const isCurrent = seasonInfo?.is_current;
    document.getElementById('rk-content').innerHTML = Boako.Ranking.getRankingHTML(seasonInfo, isCurrent);
    if (window.lucide) window.lucide.createIcons();
};

Boako.Ranking.loadHofTab = async function() {
    const content = document.getElementById('rk-content');
    if (!content) return;

    if (Boako.Ranking.State.hofSeasons.length === 0) {
        content.innerHTML = `
            <div class="flex flex-col items-center justify-center py-20 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                <span class="text-3xl mb-2">🎖️</span>
                <h3 class="font-black text-slate-500 text-sm">아직 명예의 전당에 헌액된 시즌이 없습니다.</h3>
                <p class="text-xs text-slate-400 font-bold mt-1">시즌이 종료되면 이곳에 우승팀, MVP, 챔피언이 기록됩니다.</p>
            </div>
        `;
        return;
    }

    content.innerHTML = `<div class="text-center py-16 text-slate-400 font-bold animate-pulse">명예의 전당 집계 중...</div>`;

    try {
        const seasonNo = Boako.Ranking.State.hofSelectedSeason;



        const { data: championTeamRow } = await Boako.db
            .from('season_final_rankings')
            .select('team_name, logo_url, total_lp')
            .eq('season_no', seasonNo)
            .eq('final_rank', 1)
            .single();

        const { data: mvpRecords } = await Boako.db
            .from('v_boako_total_records')
            .select('nickname, rp, b_all_team, team_logo_url')
            .eq('season_no', seasonNo)
            .eq('is_verified', 0);

        let mvp = null;
        if (mvpRecords && mvpRecords.length > 0) {
            const rpMap = {};
            mvpRecords.forEach(r => {
                if (!rpMap[r.nickname]) rpMap[r.nickname] = { nickname: r.nickname, rp: 0, team: r.b_all_team, teamLogo: r.team_logo_url };
                rpMap[r.nickname].rp += (r.rp || 0);
            });
            mvp = Object.values(rpMap).sort((a, b) => b.rp - a.rp)[0];
        }

        const { data: championGames } = await Boako.db
            .from('champion_lp_awards')
            .select('game_name, game_popularity_rank, team_name, mvp_nickname')
            .eq('season_no', seasonNo)
            .order('game_popularity_rank', { ascending: true });

        // 🌟 게임 로고 / 팀 로고 / MVP 프로필 사진 별도 조회 후 병합
        const gameNames = [...new Set((championGames || []).map(g => g.game_name).filter(Boolean))];
        const teamNames = [...new Set((championGames || []).map(g => g.team_name).filter(Boolean))];
        const mvpNicknames = [...new Set((championGames || []).map(g => g.mvp_nickname).filter(Boolean))];

        const [{ data: gameImgs }, { data: teamLogos }, { data: mvpProfiles }] = await Promise.all([
            gameNames.length ? Boako.db.from('games').select('game_name, image_url').in('game_name', gameNames) : { data: [] },
            teamNames.length ? Boako.db.from('teams').select('team_name, logo_url').in('team_name', teamNames) : { data: [] },
            mvpNicknames.length ? Boako.db.from('profiles').select('full_name, profile_url').in('full_name', mvpNicknames) : { data: [] }
        ]);

        const gameImgMap = Object.fromEntries((gameImgs || []).map(g => [g.game_name, g.image_url]));
        const teamLogoMap = Object.fromEntries((teamLogos || []).map(t => [t.team_name, t.logo_url]));
        const mvpProfileMap = Object.fromEntries((mvpProfiles || []).map(p => [p.full_name, p.profile_url]));

        const championGamesEnriched = (championGames || []).map(g => ({
            ...g,
            game_logo: gameImgMap[g.game_name] || null,
            team_logo: teamLogoMap[g.team_name] || null,
            mvp_profile: mvpProfileMap[g.mvp_nickname] || null
        }));

         Boako.Ranking.State.hofData = {
            seasonTitle: `시즌 ${seasonNo}`,
            championTeam: championTeamRow,
            mvp,
            championGames: championGamesEnriched
        };

        content.innerHTML = Boako.Ranking.getHofHTML();
        if (window.lucide) window.lucide.createIcons();
        Boako.Ranking.autoFitChampionNames();

    } catch (e) {
        console.error('명예의 전당 로드 실패:', e);
        content.innerHTML = `<div class="text-center py-16 text-rose-500 font-bold">로드 실패: ${e.message}</div>`;
    }
};

Boako.Ranking.getHofHTML = function() {
    const d = Boako.Ranking.State.hofData;
    if (!d) return '';

    const seasonOptionsHtml = Boako.Ranking.State.hofSeasons.map(sNo => `
        <div onclick="Boako.Ranking.changeHofSeason(${sNo})" class="group px-4 py-3 cursor-pointer rounded-xl font-black text-xs transition-all duration-200 flex items-center gap-2 ${sNo === Boako.Ranking.State.hofSelectedSeason ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}">
            <div class="w-1.5 h-1.5 rounded-full ${sNo === Boako.Ranking.State.hofSelectedSeason ? 'bg-indigo-500' : 'bg-transparent'}"></div>
            <span>시즌 ${sNo}</span>
        </div>
    `).join('');

    const DEFAULT_LOGO = Boako.Util.cdn('https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challenge%20(1).png');

    const championTeamHtml = d.championTeam ? `
        <div class="hof-card">
            <div class="relative z-10 flex items-center gap-5">
                <img src="${Boako.Util.cdn(d.championTeam.logo_url) || DEFAULT_LOGO}" class="w-20 h-20 rounded-2xl object-contain bg-white/10 border border-white/20 p-2 shadow-lg">
                <div>
                    <div class="text-[10px] font-black text-amber-300 uppercase tracking-widest mb-1">👑 시즌 우승팀</div>
                    <div class="text-2xl font-black text-white">${d.championTeam.team_name}</div>
                    <div class="text-sm font-bold text-indigo-200 mt-1">🏆 ${Number(d.championTeam.total_lp).toLocaleString()} LP</div>
                </div>
            </div>
        </div>
    ` : `
        <div class="hof-card">
            <div class="relative z-10 text-center py-4 text-indigo-200 font-bold text-sm">우승팀 기록 없음</div>
        </div>
    `;

    const mvpHtml = d.mvp ? `
        <div class="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex items-center gap-5">
            <img src="${Boako.Util.cdn(d.mvp.teamLogo) || DEFAULT_LOGO}" class="w-16 h-16 rounded-2xl object-contain bg-slate-50 border border-slate-100 p-1.5">
            <div>
                <div class="text-[10px] font-black text-violet-500 uppercase tracking-widest mb-1">⭐ 시즌 MVP</div>
                <div class="text-xl font-black text-slate-800">${d.mvp.nickname}</div>
                <div class="text-xs font-bold text-slate-400 mt-1">${d.mvp.team || '무소속'} · <span class="text-amber-500">${d.mvp.rp.toLocaleString()} RP</span></div>
            </div>
        </div>
    ` : `
        <div class="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm text-center text-slate-400 font-bold text-sm">MVP 기록 없음</div>
    `;

    const CHAMPION_BELT = Boako.Util.cdn('https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/CHAMPION.png');
    const FIRE_RING = Boako.Util.cdn('https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/firering.png');
    const seasonKey = Boako.Ranking.getSeasonKey();
    const seasonOverlayHtml = Boako.Ranking.getSeasonOverlayHtml(seasonKey);

    const championGamesHtml = d.championGames.length === 0
        ? `<div class="col-span-full text-center py-10 text-slate-400 font-bold border border-dashed border-slate-200 rounded-xl bg-slate-50">챔피언 기록이 없습니다.</div>`
        : d.championGames.map(g => `
            <div class="hof-champion-card" data-season="${seasonKey}">
                <div class="hcc-bg-diagonal"></div>
                <div class="hcc-bg-scrim"></div>
                ${seasonOverlayHtml}
                <div class="hcc-game-badge-wrap">
                    <img class="hcc-game-badge" src="${Boako.Util.cdn(g.game_logo) || DEFAULT_LOGO}">
                </div>
                <div class="hcc-body">
                    <div class="hcc-top-row">
                        <div class="hcc-mvp-wrap">
                            <img class="hcc-mvp-photo" src="${Boako.Util.cdn(g.mvp_profile) || DEFAULT_LOGO}">
                            <img class="hcc-fire-ring" src="${FIRE_RING}">
                        </div>
                        <div class="hcc-name-col">
                            <div class="hcc-nickname">${g.mvp_nickname || '미정'}</div>
                            <div class="hcc-team-row">
                                <img src="${Boako.Util.cdn(g.team_logo) || DEFAULT_LOGO}">
                                <span>${g.team_name}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <img class="hcc-stamp" src="${CHAMPION_BELT}">
            </div>
        `).join('');

    return `
        <div class="mb-5 flex items-center justify-between">
            <h3 class="font-black text-slate-800 text-lg">${d.seasonTitle} 명예의 전당</h3>
<div class="relative z-30">
                <button onclick="Boako.Ranking.toggleHofSeasonDropdown()" class="bg-white px-4 py-2.5 rounded-xl shadow-sm border border-slate-200 flex items-center gap-2 text-xs font-black text-slate-700 hover:border-indigo-400 hover:shadow-md transition-all duration-200 group">
                    <span>시즌 ${Boako.Ranking.State.hofSelectedSeason}</span>
                    <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500 transition-colors"></i>
                </button>
                <div id="rk-hof-season-dropdown-overlay" onclick="Boako.Ranking.toggleHofSeasonDropdown()" class="hidden fixed inset-0 z-40 bg-transparent"></div>
                <div id="rk-hof-season-dropdown-menu" class="hidden absolute top-full right-0 mt-2 w-[160px] bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_15px_40px_-10px_rgba(0,0,0,0.15)] border border-white/60 overflow-hidden z-50 p-1">
                    <div class="max-h-64 overflow-y-auto custom-scrollbar">
                        ${seasonOptionsHtml}
                    </div>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            ${championTeamHtml}
            ${mvpHtml}
        </div>

        <h5 class="font-black text-slate-800 text-sm mb-3 flex items-center gap-2">🎮 종목별 챔피언 (인기 TOP 10)</h5>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            ${championGamesHtml}
        </div>
    `;
};

Boako.Ranking.getSeasonKey = function() {
    const m = new Date().getMonth() + 1;
    if (m === 12 || m <= 2) return 'winter';
    if (m >= 3 && m <= 5) return 'spring';
    if (m >= 6 && m <= 8) return 'summer';
    return '';
};

Boako.Ranking.getSeasonOverlayHtml = function(season) {
    if (season === 'winter') {
        return `<div class="hcc-season-overlay">
            <span style="top:10%; left:8%; font-size:14px; opacity:.5;">❄️</span>
            <span style="top:22%; left:80%; font-size:10px; opacity:.4;">❄️</span>
            <span style="top:40%; left:15%; font-size:9px; opacity:.35;">❄️</span>
            <span style="top:55%; left:88%; font-size:16px; opacity:.3;">❄️</span>
            <span style="top:70%; left:5%; font-size:12px; opacity:.4;">❄️</span>
            <span style="top:85%; left:75%; font-size:11px; opacity:.35;">❄️</span>
            <span style="top:5%; left:55%; font-size:9px; opacity:.3;">❄️</span>
            <span style="top:33%; left:45%; font-size:8px; opacity:.25;">❄️</span>
        </div>`;
    }
    if (season === 'spring') {
        return `<div class="hcc-season-overlay">
            <span style="top:8%; left:12%; font-size:13px; opacity:.55;">🌸</span>
            <span style="top:20%; left:78%; font-size:10px; opacity:.4;">🌸</span>
            <span style="top:38%; left:20%; font-size:9px; opacity:.35;">🌸</span>
            <span style="top:52%; left:85%; font-size:15px; opacity:.35;">🌸</span>
            <span style="top:68%; left:8%; font-size:11px; opacity:.4;">🌸</span>
            <span style="top:82%; left:70%; font-size:10px; opacity:.35;">🌸</span>
            <span style="top:4%; left:50%; font-size:8px; opacity:.3;">🌸</span>
            <span style="top:30%; left:48%; font-size:8px; opacity:.25;">🌸</span>
        </div>`;
    }
    if (season === 'summer') {
        return `<div class="hcc-season-overlay">
            <span style="top:6%; left:20%; font-size:16px; opacity:.35;">☀️</span>
            <span style="top:15%; left:70%; font-size:10px; opacity:.3;">🌴</span>
            <span style="top:45%; left:85%; font-size:12px; opacity:.3;">🌊</span>
            <span style="top:60%; left:6%; font-size:11px; opacity:.3;">🌊</span>
            <span style="top:75%; left:60%; font-size:10px; opacity:.28;">🌴</span>
            <span style="top:30%; left:10%; font-size:9px; opacity:.25;">☀️</span>
        </div>`;
    }
    return '';
};

Boako.Ranking.autoFitChampionNames = function() {
    document.querySelectorAll('.hcc-nickname, .hcc-team-row span').forEach(el => {
        const card = el.closest('.hof-champion-card');
        const cardRect = card.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const edgeMargin = 10;
        const availWidth = (cardRect.right - elRect.left) - edgeMargin;

        const clone = el.cloneNode(true);
        clone.style.position = 'absolute';
        clone.style.visibility = 'hidden';
        clone.style.whiteSpace = 'nowrap';
        clone.style.webkitTextStroke = '0px';
        clone.style.left = '-9999px';
        clone.style.top = '0';
        document.body.appendChild(clone);

        let size = parseFloat(getComputedStyle(el).fontSize);
        let guard = 0;
        while (clone.offsetWidth > availWidth && size > 7 && guard < 30) {
            size -= 0.5;
            clone.style.fontSize = size + 'px';
            guard++;
        }

        el.style.fontSize = size + 'px';
        document.body.removeChild(clone);
    });
};

Boako.Ranking.toggleHofSeasonDropdown = function() {
    if (window.sfx) window.sfx.click();
    const menu = document.getElementById('rk-hof-season-dropdown-menu');
    const overlay = document.getElementById('rk-hof-season-dropdown-overlay');
    if (menu && overlay) {
        menu.classList.toggle('hidden');
        overlay.classList.toggle('hidden');
    }
};

Boako.Ranking.changeHofSeason = async function(seasonNo) {
    Boako.Ranking.State.hofSelectedSeason = Number(seasonNo);
    await Boako.Ranking.loadHofTab();
};
