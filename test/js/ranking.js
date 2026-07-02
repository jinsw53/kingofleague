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
            title: s.title,
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
        .hof-champion-card { background:#fff; border:1px solid #e2e8f0; border-radius:16px; padding:14px; text-align:center; transition: transform .2s; }
        .hof-champion-card:hover { transform: translateY(-3px); box-shadow: 0 8px 20px rgba(0,0,0,.08); }
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
        <option value="${s.season_no}" ${s.season_no === Boako.Ranking.State.selectedSeason ? 'selected' : ''}>
            ${s.title}${s.is_current ? ' 🔴 진행중' : ''}
        </option>
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
                            <img src="${r.logo_url || 'https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challenge%20(1).png'}" class="w-8 h-8 rounded-lg object-contain bg-slate-50 border border-slate-100 p-0.5">
                            <span class="font-black text-slate-800 text-sm">${r.team_name}</span>
                            <i data-lucide="chevron-${isExpanded ? 'up' : 'down'}" class="w-3.5 h-3.5 text-slate-300"></i>
                        </div>
                    </td>
                    <td class="py-3 px-3 text-center text-xs font-bold text-slate-500">${r.grandprix_lp ?? 0}</td>
                    <td class="py-3 px-3 text-center text-xs font-bold text-slate-500">${r.bingo_lp ?? 0}</td>
                    <td class="py-3 px-3 text-center text-xs font-bold text-slate-500">${r.challenge_lp ?? 0}</td>
                    <td class="py-3 px-3 text-center text-xs font-bold text-slate-500">${r.kol_lp ?? 0}</td>
                    <td class="py-3 px-3 text-center text-xs font-bold text-slate-500">${r.champion_lp ?? 0}</td>
                    <td class="py-3 px-3 text-center text-xs font-bold text-indigo-500">${(() => {
                        const sum = [1,2,3,4,5,6,7,8,9].reduce((acc, n) => acc + (Number(r[`round_${n}_lp`]) || 0), 0);
                        const excludedSum = [r.excluded_round_1, r.excluded_round_2].reduce((acc, e) => {
                            if (!e) return acc;
                            const val = Object.values(e)[0];
                            return acc + (Number(val) || 0);
                        }, 0);
                        return (sum - excludedSum).toLocaleString();
                    })()}</td>
                    <td class="py-3 px-3 text-right font-black text-indigo-700">🏆 ${Number(r.total_lp).toLocaleString()} LP</td>
                </tr>
            `;

            const detailRow = isExpanded ? `
                <tr class="rk-detail-row">
                    <td colspan="9" class="p-4">
                        <div class="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-2">
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
                        <div class="text-[10px] text-slate-400 font-bold mt-2 text-center">상위 7라운드만 반영, 하위 2라운드는 제외됩니다.</div>
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
            <select onchange="Boako.Ranking.changeSeason(this.value)" class="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-black text-slate-700 outline-none focus:border-indigo-500 shadow-sm">
                ${seasonOptionsHtml}
            </select>
        </div>

        <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm overflow-x-auto">
            <table class="w-full text-left min-w-[720px]">
                <thead class="bg-slate-50 border-b border-slate-200">
                    <tr class="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        <th class="py-3 px-3">순위</th>
                        <th class="py-3 px-3">팀</th>
                        <th class="py-3 px-3 text-center">대항전</th>
                        <th class="py-3 px-3 text-center">빙고</th>
                        <th class="py-3 px-3 text-center">챌린지</th>
                        <th class="py-3 px-3 text-center">킹오브리그</th>
                        <th class="py-3 px-3 text-center">챔피언</th>
                        <th class="py-3 px-3 text-center">정규리그</th>
                        <th class="py-3 px-3 text-right">총 LP</th>
                    </tr>
                </thead>
                <tbody>${tableRowsHtml}</tbody>
            </table>
        </div>
    `;
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

        const { data: seasonMeta } = await Boako.db.from('seasons').select('title').eq('season_no', seasonNo).single();

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

        Boako.Ranking.State.hofData = {
            seasonTitle: seasonMeta?.title || '',
            championTeam: championTeamRow,
            mvp,
            championGames: championGames || []
        };

        content.innerHTML = Boako.Ranking.getHofHTML();
        if (window.lucide) window.lucide.createIcons();

    } catch (e) {
        console.error('명예의 전당 로드 실패:', e);
        content.innerHTML = `<div class="text-center py-16 text-rose-500 font-bold">로드 실패: ${e.message}</div>`;
    }
};

Boako.Ranking.getHofHTML = function() {
    const d = Boako.Ranking.State.hofData;
    if (!d) return '';

    const seasonOptionsHtml = Boako.Ranking.State.hofSeasons.map(sNo => {
        const meta = Boako.Ranking.State.seasons.find(s => s.season_no === sNo);
        return `<option value="${sNo}" ${sNo === Boako.Ranking.State.hofSelectedSeason ? 'selected' : ''}>${meta?.title || `시즌 ${sNo}`}</option>`;
    }).join('');

    const DEFAULT_LOGO = 'https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challenge%20(1).png';

    const championTeamHtml = d.championTeam ? `
        <div class="hof-card">
            <div class="relative z-10 flex items-center gap-5">
                <img src="${d.championTeam.logo_url || DEFAULT_LOGO}" class="w-20 h-20 rounded-2xl object-contain bg-white/10 border border-white/20 p-2 shadow-lg">
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
            <img src="${d.mvp.teamLogo || DEFAULT_LOGO}" class="w-16 h-16 rounded-2xl object-contain bg-slate-50 border border-slate-100 p-1.5">
            <div>
                <div class="text-[10px] font-black text-violet-500 uppercase tracking-widest mb-1">⭐ 시즌 MVP</div>
                <div class="text-xl font-black text-slate-800">${d.mvp.nickname}</div>
                <div class="text-xs font-bold text-slate-400 mt-1">${d.mvp.team || '무소속'} · <span class="text-amber-500">${d.mvp.rp.toLocaleString()} RP</span></div>
            </div>
        </div>
    ` : `
        <div class="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm text-center text-slate-400 font-bold text-sm">MVP 기록 없음</div>
    `;

    const championGamesHtml = d.championGames.length === 0
        ? `<div class="col-span-full text-center py-10 text-slate-400 font-bold border border-dashed border-slate-200 rounded-xl bg-slate-50">챔피언 기록이 없습니다.</div>`
        : d.championGames.map(g => `
            <div class="hof-champion-card">
                <div class="text-[9px] font-black text-slate-300 uppercase mb-1">TOP ${g.game_popularity_rank}</div>
                <div class="text-sm font-black text-slate-800 truncate mb-1">${g.game_name}</div>
                <div class="text-xs font-bold text-violet-600">${g.team_name}</div>
                <div class="text-[10px] text-slate-400 font-bold mt-0.5">${g.mvp_nickname || ''}</div>
            </div>
        `).join('');

    return `
        <div class="mb-5 flex items-center justify-between">
            <h3 class="font-black text-slate-800 text-lg">${d.seasonTitle} 명예의 전당</h3>
            <select onchange="Boako.Ranking.changeHofSeason(this.value)" class="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-black text-slate-700 outline-none focus:border-indigo-500 shadow-sm">
                ${seasonOptionsHtml}
            </select>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            ${championTeamHtml}
            ${mvpHtml}
        </div>

        <h5 class="font-black text-slate-800 text-sm mb-3 flex items-center gap-2">🎮 종목별 챔피언 (인기 TOP 10)</h5>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            ${championGamesHtml}
        </div>
    `;
};

Boako.Ranking.changeHofSeason = async function(seasonNo) {
    Boako.Ranking.State.hofSelectedSeason = Number(seasonNo);
    await Boako.Ranking.loadHofTab();
};
