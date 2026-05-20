/**
 * [ARCHIVE] 기록실 및 실시간 랭킹 시스템 
 * DB: v_boako_total_records 및 v_game_popularity_all_players 가상 뷰 연동 완결본
 * 디자인: Tailwind CSS 기반 프리미엄 디자인 완벽 보존
 */
Boako.Archive = {
    filteredRecords: [],
    gameRankings: [], // 👈 [신설] 게임별 대세 랭킹 데이터를 담을 전용 장부
    currentTab: 'records',
    
    // 🌟 [서버 페이징용 핵심 상태 장부]
    currentPage: 1,
    itemsPerPage: 20,
    totalCount: 0,

    // 1. view.js가 호출하는 최초 진입점
    buildUI: function(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="w-full animate-in fade-in duration-500">
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 bg-white p-4 rounded-2xl shadow-sm border border-slate-200 gap-4">
                    <div class="flex items-center gap-2">
                        <div class="bg-indigo-600 p-1.5 rounded-lg shadow-md">
                            <i data-lucide="trophy" class="text-white w-5 h-5"></i>
                        </div>
                        <h1 class="text-lg font-black tracking-tighter text-indigo-950 uppercase">Boako Archive</h1>
                    </div>
                    <div class="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
                        <button onclick="Boako.Archive.switchTab('records')" id="tab-records" class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all bg-white text-indigo-600 shadow-sm border border-slate-200 whitespace-nowrap">
                            <i data-lucide="history" class="w-4 h-4"></i> 기록실
                        </button>
                        <button onclick="Boako.Archive.switchTab('rankings')" id="tab-rankings" class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-indigo-600 transition-all whitespace-nowrap">
                            <i data-lucide="trending-up" class="w-4 h-4"></i> 랭킹보드
                        </button>
                        <button onclick="Boako.Archive.switchTab('games')" id="tab-games" class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-indigo-600 transition-all whitespace-nowrap">
                            <i data-lucide="gamepad-2" class="w-4 h-4"></i> 게임별 통계
                        </button>
                    </div>
                </div>

                <div class="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <h2 id="archive-page-title" class="text-3xl font-black text-slate-900 tracking-tight leading-none">시즌 경기 기록실</h2>
                        <p id="archive-page-desc" class="text-slate-400 mt-2 font-medium text-sm">시즌, 라운드 별로 팀 리그 기록을 확인하실 수 있습니다.</p>
                        <p id="archive-page-subdesc" class="text-slate-400 mt-1 font-medium text-xs">( 🧠 = 웨이트 | ⏳ = 플레이타임 | 🎲 = 리그 배점 )</p>
                    </div>
                    <div class="flex gap-2">
                        <div class="bg-white px-3 py-2 rounded-xl shadow-sm border border-slate-200 flex items-center gap-2">
                            <i data-lucide="calendar" class="text-indigo-500 w-4 h-4"></i>
                            <select id="archive-season" onchange="Boako.Archive.filterData()" class="bg-transparent border-none text-xs font-black outline-none cursor-pointer">
                                <option value="all">전체 시즌</option>
                            </select>
                        </div>
                        <div id="round-filter-wrapper" class="bg-white px-3 py-2 rounded-xl shadow-sm border border-slate-200 flex items-center gap-2">
                            <i data-lucide="layers" class="text-indigo-500 w-4 h-4"></i>
                            <select id="archive-round" onchange="Boako.Archive.filterData()" class="bg-transparent border-none text-xs font-black outline-none cursor-pointer">
                                <option value="all">전체 라운드</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="relative mb-8">
                    <i data-lucide="search" class="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5"></i>
                    <input type="text" id="archive-search" oninput="Boako.Archive.filterData()" placeholder="닉네임이나 게임 종목 검색..."
                        class="w-full pl-12 pr-6 py-4 rounded-2xl border-none shadow-sm focus:ring-2 focus:ring-indigo-500 bg-white text-lg font-medium outline-none transition-all">
                </div>

                <div id="archive-content-area">
                    <div class="text-center py-20 text-slate-400 font-bold">데이터 동기화 중...</div>
                </div>
            </div>
        `;

        if(window.lucide) lucide.createIcons();
        this.init();
    },

    // 2. DB 초기화 및 메타데이터 로드
    init: async function() {
        if (!Boako.db) {
            setTimeout(() => this.init(), 500);
            return;
        }
        await this.loadData();
    },

    // 드롭다운 옵션 구성을 위해 필터용 컬럼만 초경량 리딩
    loadData: async function() {
        try {
            const { data, error } = await Boako.db
                .from('v_boako_total_records')
                .select('season_no, round_no');

            if (error) throw error;
            
            this.updateSeasonOptions(data || []);
            this.updateRoundOptions(data || []);

            this.fetchAndRender(); 
        } catch (err) {
            console.error("아카이브 메타데이터 로드 오류:", err);
            Boako.Util.toast("데이터 구조를 불러오지 못했습니다.");
        }
    },

    // 🌟 [엔진 튜닝: 3번 탭 연동을 위한 분기 가동]
    fetchAndRender: async function() {
        const area = document.getElementById('archive-content-area');
        if (area) area.innerHTML = `<div class="text-center py-20 text-slate-400 font-bold">데이터 요청 중...</div>`;

        const searchVal = (document.getElementById('archive-search')?.value || '').toLowerCase();
        const seasonVal = document.getElementById('archive-season')?.value || 'all';
        const roundVal = document.getElementById('archive-round')?.value || 'all';

        // 💡 [분기점] 새로 만든 '게임별 통계' 탭일 때는 타겟 뷰를 완전히 다르게 정격 타격합니다!
        if (this.currentTab === 'games') {
            let query = Boako.db.from('v_game_popularity_all_players').select('*');
            
            // 아카이브 전용 드롭다운 시즌 필터 연동 (전체 시즌이 아닐 때만)
            if (seasonVal !== 'all') query = query.eq('season_no', seasonVal);
            
            // 검색어 필터링 (게임명 또는 유저 닉네임)
            if (searchVal) {
                query = query.or(`game_name.ilike.%${searchVal}%,player_nickname.ilike.%${searchVal}%`);
            }
            
            // 대세 순위 및 인게임 유저 순위 정렬 고정
            query = query.order('game_popularity_rank', { ascending: true })
                         .order('player_rank', { ascending: true });

            try {
                const { data, error } = await query;
                if (error) throw error;
                this.gameRankings = data || [];
                this.renderGames(); // 게임 전용 프리미엄 렌더러 호출
            } catch (err) {
                console.error("게임별 아카이브 뷰 데이터 로드 실패:", err);
                if (area) area.innerHTML = `<div class="text-center py-20 text-red-400 font-bold">게임 통계 로드에 실패했습니다.</div>`;
            }
            return; // 게임 연산 끝났으므로 탈출
        }

        // --- 1번(기록실) & 2번(랭킹보드) 기존 정석 로직 유지 ---
        let query = Boako.db.from('v_boako_total_records').select('*', { count: 'exact' });

        if (seasonVal !== 'all') query = query.eq('season_no', seasonVal);
        if (roundVal !== 'all') query = query.eq('round_no', roundVal);
        if (searchVal) {
            query = query.or(`nickname.ilike.%${searchVal}%,game_name.ilike.%${searchVal}%`);
        }

        query = query.order('created_at', { ascending: false });

        if (this.currentTab === 'records') {
            const from = (this.currentPage - 1) * this.itemsPerPage;
            const to = from + this.itemsPerPage - 1;
            query = query.range(from, to);
        }

        try {
            const { data, count, error } = await query;
            if (error) throw error;

            this.filteredRecords = data || [];
            this.totalCount = count || 0;

            if (this.currentTab === 'records') this.renderRecords();
            else this.renderRankings();
        } catch (err) {
            console.error("서버 페이징 로드 에러:", err);
            if (area) area.innerHTML = `<div class="text-center py-20 text-red-400 font-bold">서버 연결에 실패했습니다.</div>`;
        }
    },

    filterData: function() {
        this.currentPage = 1;
        this.fetchAndRender();
    },

    // 4. 탭 전환 로직
    switchTab: function(tabName) {
        this.currentTab = tabName;
        this.currentPage = 1;
        
        const activeClass = 'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all bg-white text-indigo-600 shadow-sm border border-slate-200 whitespace-nowrap';
        const inactiveClass = 'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-indigo-600 transition-all whitespace-nowrap';
        
        document.getElementById('tab-records').className = tabName === 'records' ? activeClass : inactiveClass;
        document.getElementById('tab-rankings').className = tabName === 'rankings' ? activeClass : inactiveClass;
        document.getElementById('tab-games').className = tabName === 'games' ? activeClass : inactiveClass;
        
        // 🎯 [UI 분기] 선택된 탭에 맞는 대제목과 설명 문구 및 서브필터 가시성 핸들링
        const titleEl = document.getElementById('archive-page-title');
        const descEl = document.getElementById('archive-page-desc');
        const subDescEl = document.getElementById('archive-page-subdesc');
        const roundFilter = document.getElementById('round-filter-wrapper');

        if (tabName === 'records') {
            titleEl.innerText = '시즌 경기 기록실';
            descEl.innerText = '시즌, 라운드 별로 팀 리그 기록을 확인하실 수 있습니다.';
            if (subDescEl) subDescEl.style.display = 'block';
            if (roundFilter) roundFilter.style.display = 'flex';
        } else if (tabName === 'rankings') {
            titleEl.innerText = '종합 리그 순위표';
            descEl.innerText = '이번 시즌 누적 RP 기준 전체 유저들의 랭킹 스코어보드입니다.';
            if (subDescEl) subDescEl.style.display = 'none';
            if (roundFilter) roundFilter.style.display = 'flex';
        } else if (tabName === 'games') {
            titleEl.innerText = '시즌 대세 게임 & MVP';
            descEl.innerText = '시즌별로 가장 활성화된 인기 게임 종목과 해당 게임의 플레이어 랭킹을 한눈에 확인합니다.';
            if (subDescEl) subDescEl.style.display = 'none';
            // 💡 게임별 통계는 9개 라운드가 통산 누적 집계되므로 라운드 필터를 숨겨 억까 방지!
            if (roundFilter) roundFilter.style.display = 'none';
        }
        
        this.fetchAndRender();
    },

    changePage: function(page) {
        const totalPages = Math.ceil(this.totalCount / this.itemsPerPage);
        if (page < 1 || page > totalPages) return;
        
        this.currentPage = page;
        this.fetchAndRender();

        const area = document.getElementById('archive-content-area');
        if (area) area.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    formatDate: function(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const mo = String(d.getMonth() + 1).padStart(2, '0');
        const da = String(d.getDate()).padStart(2, '0');
        const ho = String(d.getHours()).padStart(2, '0');
        const mi = String(d.getMinutes()).padStart(2, '0');
        return `${mo}.${da} ${ho}:${mi}`;
    },

    updateSeasonOptions: function(records) {
        const seasonSelect = document.getElementById('archive-season');
        if (!seasonSelect) return;

        const seasons = [...new Set(records.map(rec => rec.season_no).filter(Boolean))];
        seasons.sort((a, b) => a - b);
        const maxSeason = seasons.length > 0 ? seasons[seasons.length - 1] : null;

        let optionsHTML = `<option value="all">전체 시즌</option>`;
        seasons.forEach(s => {
            const isSelected = s === maxSeason ? 'selected' : '';
            optionsHTML += `<option value="${s}" ${isSelected}>시즌 ${s}</option>`;
        });
        seasonSelect.innerHTML = optionsHTML;
    }, 

    updateRoundOptions: function(records) {
        const roundSelect = document.getElementById('archive-round');
        if (!roundSelect) return;

        const rounds = [...new Set(records.map(rec => rec.round_no).filter(Boolean))];
        rounds.sort((a, b) => a - b);

        let optionsHTML = `<option value="all">전체 라운드</option>`;
        rounds.forEach(r => {
            optionsHTML += `<option value="${r}">${r} 라운드</option>`;
        });
        roundSelect.innerHTML = optionsHTML;
    }, 

    // 5. 기록실 테이블 렌더링
    renderRecords: function() {
        const area = document.getElementById('archive-content-area'); 
        if (!area) return;

        if (this.filteredRecords.length === 0) {
            area.innerHTML = `<div class="bg-white rounded-[2rem] shadow-xl border border-white p-20 text-center text-slate-400 font-bold">조건에 맞는 기록이 없습니다.</div>`;
            return;
        }

        let html = `
            <div class="bg-white rounded-[2rem] shadow-xl border border-white overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead>
                            <tr class="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                                <th class="px-4 py-5 w-[100px]">Date</th> 
                                <th class="px-4 py-5">Player</th>
                                <th class="px-4 py-5">Game Info</th>
                                <th class="px-4 py-5 text-center w-[160px] leading-tight select-none">
                                    <div class="text-slate-400 text-[10px] font-black uppercase tracking-widest">Logic</div>
                                    <div class="text-[9px] text-slate-400 font-bold mt-0.5 tracking-wider">( 🧠 | ⏳ | 🎲 )</div>
                                </th>
                                <th class="px-4 py-5 text-right font-black w-[8px]">RP</th>
                                <th class="px-4 py-5 text-center w-[70px]">Status</th>
                                <th class="px-4 py-5 w-[50px]"></th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-50">
        `;

        html += this.filteredRecords.map(rec => `
            <tr class="hover:bg-indigo-50/20 transition-all group text-sm">
                <td class="px-4 py-4 whitespace-nowrap text-[11px] font-bold text-slate-400">${this.formatDate(rec.created_at)}</td>
                <td class="px-4 py-4">
                    <div class="flex flex-col leading-tight">
                        <span class="font-black text-slate-900">${rec.nickname || 'Unknown'}</span>
                        <div class="flex items-center gap-1.5 mt-1 relative group/logo cursor-pointer">
                            ${
                                rec.logo_url && rec.b_all_team !== 'Free Agent'
                                    ? `
                                        <img src="${rec.logo_url}" class="w-3.5 h-3.5 object-contain rounded-sm shadow-sm" alt="${rec.b_all_team}">
                                        <div class="hidden group-hover/logo:flex absolute bottom-full left-0 mb-2 z-50 bg-white p-3 rounded-2xl shadow-2xl border border-slate-100 flex-col items-center gap-2 animate-in fade-in zoom-in-95 duration-200 min-w-[120px]">
                                            <img src="${rec.logo_url}" class="w-16 h-16 object-contain rounded-xl bg-slate-50 p-1" alt="${rec.b_all_team} Large">
                                            <span class="text-[10px] font-black text-indigo-950 uppercase tracking-wider">${rec.b_all_team}</span>
                                            <div class="absolute top-full left-4 -mt-1 w-2 h-2 bg-white border-r border-b border-slate-100 rotate-45"></div>
                                        </div>
                                      `
                                    : `<span class="text-[10px]">👤</span>`
                            }
                            <span class="text-[9px] text-slate-400 font-black uppercase tracking-widest leading-none">${rec.b_all_team || 'Free Agent'}</span>
                        </div>
                    </div>
                </td>
                <td class="px-4 py-4">
                    <div class="flex flex-col leading-tight">
                        <div class="flex items-center gap-1.5 mb-0.5 flex-wrap">
                            <span class="font-bold text-indigo-900">${rec.game_name || '-'}</span>
                            ${rec.is_first == 1 ? '<span class="bg-red-500 text-white text-[8px] px-1 rounded font-black tracking-tighter uppercase shadow-sm">1ST</span>' : ''}
                        </div>
                        <span class="text-[9px] text-slate-400 font-bold uppercase tracking-tight">
                            S${rec.season_no || 0} R${rec.round_no || 0} · ${
                                (function(type) {
                                    if (!type) return '일반';
                                    const typeMap = { 'TOURNAMENT': '토너먼트', 'INDIVIDUAL': '개인전', 'TEAM': '팀전' };
                                    return typeMap[type.toUpperCase()] || type;
                                })(rec.match_type)
                            }
                        </span>
                    </div>
                </td>
                <td class="px-4 py-4 text-center">
                    <div class="flex items-center justify-center gap-1">
                        <div class="w-7 h-7 flex items-center justify-center bg-slate-50 text-slate-500 border border-slate-200 rounded-md text-[11px] font-black shadow-sm" title="Weight">${rec.weight || 0}</div>
                        <span class="text-slate-300 text-xs">×</span>
                        <div class="w-7 h-7 flex items-center justify-center bg-slate-50 text-slate-500 border border-slate-200 rounded-md text-[11px] font-black shadow-sm" title="Playtime">${rec.playtime || 0}</div>
                        <span class="text-slate-300 text-xs">×</span>
                        <div class="w-7 h-7 flex items-center justify-center bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-md text-[11px] font-black shadow-sm" title="Multiplier">${rec.multiplier || 0}</div>
                    </div>
                </td>
                <td class="px-4 py-4 text-right font-black text-indigo-600 text-lg tracking-tighter">${Math.floor(rec.rp || 0)}</td>
                <td class="px-4 py-4 text-center">
                    ${rec.is_verified == 0 ? '<i data-lucide="check-circle-2" class="text-emerald-500 w-4 h-4 mx-auto"></i>' : '<i data-lucide="help-circle" class="text-slate-300 w-4 h-4 mx-auto opacity-30"></i>'}
                </td>
                <td class="px-4 py-4 text-right">
                    ${rec.post_url ? `<a href="${rec.post_url}" target="_blank" class="p-2 hover:bg-indigo-600 hover:text-white bg-slate-50 rounded-lg text-slate-400 transition-all inline-block border border-slate-100 shadow-sm"><i data-lucide="external-link" class="w-3 h-3"></i></a>` : ''}
                </td>
            </tr>
        `).join('');

        html += `</tbody></table></div></div>`;
        html += this.renderPagination();

        area.innerHTML = html; 
        if(window.lucide) lucide.createIcons(); 
    },

    renderPagination: function() {
        const totalPages = Math.ceil(this.totalCount / this.itemsPerPage);
        if (totalPages <= 1) return '';

        let pHTML = `<div class="flex items-center justify-center gap-2 mt-8 select-none animate-in fade-in duration-300">`;

        pHTML += `
            <button onclick="Boako.Archive.changePage(${this.currentPage - 1})" ${this.currentPage === 1 ? 'disabled class="p-2 rounded-xl text-slate-300 bg-slate-50 border border-slate-100 cursor-not-allowed"' : 'class="p-2 rounded-xl text-slate-600 bg-white border border-slate-200 hover:border-indigo-500 hover:text-indigo-600 shadow-sm transition-all"'}>
                <i data-lucide="chevron-left" class="w-4 h-4"></i>
            </button>
        `;

        for (let i = 1; i <= totalPages; i++) {
            if (i === this.currentPage) {
                pHTML += `<button class="w-9 h-9 rounded-xl bg-indigo-600 text-white font-black text-xs shadow-md border border-indigo-600">${i}</button>`;
            } else {
                pHTML += `<button onclick="Boako.Archive.changePage(${i})" class="w-9 h-9 rounded-xl bg-white text-slate-600 font-bold text-xs border border-slate-200 hover:border-indigo-500 hover:text-indigo-600 shadow-sm transition-all">${i}</button>`;
            }
        }

        pHTML += `
            <button onclick="Boako.Archive.changePage(${this.currentPage + 1})" ${this.currentPage === totalPages ? 'disabled class="p-2 rounded-xl text-slate-300 bg-slate-50 border border-slate-100 cursor-not-allowed"' : 'class="p-2 rounded-xl text-slate-600 bg-white border border-slate-200 hover:border-indigo-500 hover:text-indigo-600 shadow-sm transition-all"'}>
                <i data-lucide="chevron-right" class="w-4 h-4"></i>
            </button>
        `;

        pHTML += `</div>`;
        return pHTML;
    },

    // 6. 랭킹보드 그리드 렌더링
    renderRankings: function() {
        const area = document.getElementById('archive-content-area');
        if (!area) return;

        const stats = {};
        this.filteredRecords.forEach(r => {
            if (!stats[r.nickname]) {
                stats[r.nickname] = { 
                    name: r.nickname, 
                    team: r.b_all_team, 
                    logo_url: r.logo_url, 
                    profile_url: r.profile_url, 
                    is_prev_mvp: r.is_prev_mvp || false, 
                    rp: 0, 
                    games: 0, 
                    wins: 0 
                };
            }
            stats[r.nickname].rp += (r.rp || 0);
            stats[r.nickname].games += 1;
            if (r.is_first == 1) stats[r.nickname].wins += 1;
        });

        const sorted = Object.values(stats).sort((a, b) => b.rp - a.rp);

        if (sorted.length === 0) {
            area.innerHTML = `<div class="bg-white rounded-[2rem] shadow-xl border border-white p-20 text-center text-slate-400 font-bold">집계할 랭킹 데이터가 없습니다.</div>`;
            return;
        }

        let html = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">`;

        html += sorted.map((p, idx) => `
            <div class="bg-white rounded-[2.5rem] p-8 shadow-xl border border-white relative group hover:-translate-y-2 transition-transform duration-300">
                <div class="absolute top-0 right-0 px-5 py-2 rounded-bl-2xl rounded-tr-[2.5rem] font-black text-xs tracking-widest ${idx < 3 ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-400'} flex items-baseline gap-1.5">
                    ${idx < 3 ? `<span class="text-xl select-none leading-none relative -top-[2px]">${idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</span>` : ''}
                    <span>RANK #${idx + 1}</span>
                </div>
                
                <div class="flex items-center gap-5 mb-8 pt-2 overflow-visible">
                   <div class="relative group-hover:scale-105 transition-transform duration-300">
    <img src="${(p.profile_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80').replace('http://', 'https://')}" 
         class="w-14 h-14 rounded-2xl object-cover shadow-md border border-slate-100 bg-slate-50 p-0.5"
         onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'"
         alt="${p.name}">
    ${p.is_prev_mvp ? `<div class="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full shadow-md border border-slate-100 flex items-center justify-center text-[10px] select-none text-slate-900">👑</div>` : ''}
</div>
                    <div>
                        <h3 class="text-xl font-black text-slate-900 leading-none">${p.name}</h3>
                        <div class="flex items-center gap-1.5 mt-1.5 relative group/logo cursor-pointer overflow-visible">
                            ${
                                p.logo_url && p.team !== 'Free Agent'
                                    ? `
                                        <img src="${p.logo_url}" class="w-3.5 h-3.5 object-contain rounded-sm shadow-sm" alt="${p.team}">
                                        <div class="hidden group-hover/logo:flex absolute bottom-full left-0 mb-2 z-50 bg-white p-3 rounded-2xl shadow-2xl border border-slate-100 flex-col items-center gap-2 animate-in fade-in zoom-in-95 duration-200 min-w-[120px]">
                                            <img src="${p.logo_url}" class="w-16 h-16 object-contain rounded-xl bg-slate-50 p-1" alt="${p.team} Large">
                                            <span class="text-[10px] font-black text-indigo-950 uppercase tracking-wider">${p.team}</span>
                                            <div class="absolute top-full left-4 -mt-1 w-2 h-2 bg-white border-r border-b border-slate-100 rotate-45"></div>
                                        </div>
                                      `
                                    : `<span class="text-[10px]">👤</span>`
                            }
                            <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">${p.team || 'Free Agent'}</span>
                        </div>
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-4 mb-8">
                    <div class="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col items-center justify-center text-center shadow-sm">
                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Total RP</p>
                        <p class="text-3xl font-black text-indigo-600 tracking-tighter leading-none">${Math.floor(p.rp)}</p>
                    </div>
                    <div class="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col items-center justify-center text-center shadow-sm">
                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Matches</p>
                        <p class="text-3xl font-black text-slate-800 tracking-tighter leading-none">${p.games}</p>
                    </div>
                </div>
                
                <div class="flex justify-between items-center text-[11px] font-black tracking-tight uppercase mb-4 overflow-visible">
                    <span class="text-slate-400 italic">First Win Bonus</span>
                    <span class="text-red-500 bg-red-50 px-3 py-1 rounded-lg border border-red-100 overflow-visible">+${p.wins} Times</span>
                </div>
                <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden p-0.5 border border-slate-200/50 shadow-inner">
                    <div class="bg-gradient-to-r from-indigo-500 to-indigo-700 h-full rounded-full transition-all duration-1000 ease-out" style="width: ${Math.min(100, (p.rp / sorted[0].rp) * 100)}%"></div>
                </div>
            </div>
        `).join('');

        html += `</div>`;
        area.innerHTML = html;
        if(window.lucide) lucide.createIcons();
    },

    // 🌟 [신설 핵심 엔진: 대세 게임 & 인게임 전원 출력 프리미엄 렌더러]
    renderGames: function() {
        const area = document.getElementById('archive-content-area');
        if (!area) return;

        if (this.gameRankings.length === 0) {
            area.innerHTML = `<div class="bg-white rounded-[2rem] shadow-xl border border-white p-20 text-center text-slate-400 font-bold">집계할 게임별 통계 데이터가 없습니다.</div>`;
            return;
        }

        // 1층 뷰가 던져준 쿼리를 Map으로 완벽 폴더 정리 (순서 보장)
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
                rp: row.player_total_rp
            });
        });

        // 소장님의 하이엔드 럭셔리 컴포넌트 렌더링 시동
        let html = `<div class="flex flex-col gap-6 animate-in fade-in duration-500">`;

        gameMap.forEach((game, gameName) => {
            html += `
                <div class="bg-white rounded-[2rem] shadow-xl border border-white p-6 overflow-hidden transition-all duration-300 hover:shadow-2xl">
                    <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-100 pb-4 cursor-pointer group" 
                         onclick="this.nextElementSibling.classList.toggle('hidden')">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg ${
                                game.popularityRank === 1 ? 'bg-amber-500 text-white shadow-amber-200' :
                                game.popularityRank === 2 ? 'bg-slate-400 text-white shadow-slate-200' :
                                game.popularityRank === 3 ? 'bg-amber-700 text-white shadow-amber-900/20' : 'bg-slate-100 text-slate-500'
                            } shadow-md">
                                ${game.popularityRank}
                            </div>
                            <div>
                                <h3 class="text-xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors">${gameName}</h3>
                                <p class="text-xs text-slate-400 mt-1 font-bold uppercase tracking-wider">Game Popularity Rank</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3 self-end sm:self-center">
                            <span class="bg-indigo-50 text-indigo-600 border border-indigo-100 px-3 py-1.5 rounded-xl text-xs font-black">👥 유저 ${game.playersCount}명</span>
                            <span class="bg-slate-50 text-slate-600 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-black">📝 기록 ${game.recordsCount}개</span>
                            <i data-lucide="chevron-down" class="text-slate-400 w-5 h-5 transition-transform group-hover:translate-y-0.5"></i>
                        </div>
                    </div>
                    
                    <div class="players-list-wrapper mt-4 pt-2 hidden animate-in slide-in-from-top-2 duration-200">
                        <div class="overflow-x-auto rounded-xl border border-slate-100 shadow-inner bg-slate-50/50">
                            <table class="w-full text-left border-collapse text-sm">
                                <thead>
                                    <tr class="bg-slate-100/70 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-200">
                                        <th class="px-5 py-3 w-[80px]">순위</th>
                                        <th class="px-5 py-3 w-[150px]">소속 팀</th>
                                        <th class="px-5 py-3">닉네임</th>
                                        <th class="px-5 py-3 text-right w-[120px]">획득 RP</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-100/60 bg-white">
                                    ${game.playersList.map(p => `
                                        <tr class="hover:bg-slate-50 transition-colors font-medium">
                                            <td class="px-5 py-3.5 font-black text-xs">
                                                ${
                                                    p.rank === 1 ? '<span class="text-amber-500">🥇 1위</span>' :
                                                    p.rank === 2 ? '<span class="text-slate-400">🥈 2위</span>' :
                                                    p.rank === 3 ? '<span class="text-amber-700">🥉 3위</span>' : `<span class="text-slate-400 pl-1">${p.rank}위</span>`
                                                }
                                            </td>
                                            <td class="px-5 py-3.5 text-xs font-black text-slate-400 uppercase tracking-tight">${p.team || 'Free Agent'}</td>
                                            <td class="px-5 py-3.5 font-black text-slate-800">${p.name}</td>
                                            <td class="px-5 py-3.5 text-right font-mono font-black text-indigo-600">${Math.floor(p.rp).toLocaleString()} P</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        area.innerHTML = html;
        if(window.lucide) lucide.createIcons();
    }
};
