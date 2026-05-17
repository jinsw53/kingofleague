/**
 * [ARCHIVE] 기록실 및 실시간 랭킹 시스템 
 * DB: v_boako_total_records 가상 뷰 100% 실시간 연동
 * 디자인: Tailwind CSS 기반 프리미엄 디자인 원상 복구본
 */
Boako.Archive = {
    allRecords: [],
    filteredRecords: [],
    currentTab: 'records',

    // 1. view.js가 호출하는 최초 진입점
    buildUI: function(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // 전체 뼈대(헤더, 필터, 탭, 결과출력창) 그리기 (Tailwind 100% 복구)
        container.innerHTML = `
            <div class="w-full animate-in fade-in duration-500">
                <div class="flex items-center justify-between mb-8 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                    <div class="flex items-center gap-2">
                        <div class="bg-indigo-600 p-1.5 rounded-lg shadow-md">
                            <i data-lucide="trophy" class="text-white w-5 h-5"></i>
                        </div>
                        <h1 class="text-lg font-black tracking-tighter text-indigo-950 uppercase">Boako Archive</h1>
                    </div>
                    <div class="flex bg-slate-100 p-1 rounded-xl">
                        <button onclick="Boako.Archive.switchTab('records')" id="tab-records" class="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all bg-white text-indigo-600 shadow-sm border border-slate-200">
                            <i data-lucide="history" class="w-4 h-4"></i> 기록실
                        </button>
                        <button onclick="Boako.Archive.switchTab('rankings')" id="tab-rankings" class="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-indigo-600 transition-all">
                            <i data-lucide="trending-up" class="w-4 h-4"></i> 랭킹보드
                        </button>
                    </div>
                </div>

                <div class="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <h2 id="archive-page-title" class="text-3xl font-black text-slate-900 tracking-tight leading-none">시즌 경기 기록실</h2>
                        
                        <p class="text-slate-400 mt-2 font-medium text-sm">시즌, 라운드 별로 팀 리그 기록을 확인하실 수 있습니다.</p>
                        
                        <p class="text-slate-400 mt-1 font-medium text-xs">( 🧠 = 웨이트 | ⏳ = 플레이타임 | 🎲 = 리그 배점 )</p>
                    </div>
                    <div class="flex gap-2">
                        <div class="bg-white px-3 py-2 rounded-xl shadow-sm border border-slate-200 flex items-center gap-2">
                            <i data-lucide="calendar" class="text-indigo-500 w-4 h-4"></i>
                            <select id="archive-season" onchange="Boako.Archive.filterData()" class="bg-transparent border-none text-xs font-black outline-none cursor-pointer">
                                <option value="all">전체 시즌</option>
                            </select>
                        </div>
                        <div class="bg-white px-3 py-2 rounded-xl shadow-sm border border-slate-200 flex items-center gap-2">
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

    // 2. DB 초기화 및 데이터 로드
    init: async function() {
        if (!Boako.db) {
            setTimeout(() => this.init(), 500);
            return;
        }
        await this.loadData();
    },

    // 🔍 archive.js 내 loadData 함수 원본 규격 (수정 없음)
    loadData: async function() {
        try {
            const { data, error } = await Boako.db
                .from('v_boako_total_records')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            
            this.allRecords = data || [];

            this.updateSeasonOptions();
            this.updateRoundOptions();

            this.filterData(); 
        } catch (err) {
            console.error("아카이브 데이터 로드 오류:", err);
            Boako.Util.toast("데이터를 불러오는 중 오류가 발생했습니다.");
            document.getElementById('archive-content-area').innerHTML = `<div class="text-center py-20 text-red-400 font-bold">데이터를 불러오지 못했습니다.</div>`;
        }
    },

    // 3. 필터링 로직 원본 규격 (수정 없음)
    filterData: function() {
        const searchVal = (document.getElementById('archive-search')?.value || '').toLowerCase();
        const seasonVal = document.getElementById('archive-season')?.value || 'all';
        const roundVal = document.getElementById('archive-round')?.value || 'all';

        this.filteredRecords = this.allRecords.filter(rec => {
            const matchSearch = (rec.nickname?.toLowerCase().includes(searchVal) || rec.game_name?.toLowerCase().includes(searchVal));
            const matchSeason = seasonVal === 'all' || String(rec.season_no) === seasonVal;
            const matchRound = roundVal === 'all' || String(rec.round_no) === roundVal;
            return matchSearch && matchSeason && matchRound;
        });

        if (this.currentTab === 'records') this.renderRecords();
        else this.renderRankings();
    },

    // 4. 탭 전환 로직
    switchTab: function(tabName) {
        this.currentTab = tabName;
        const isRec = tabName === 'records';
        
        const activeClass = 'flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all bg-white text-indigo-600 shadow-sm border border-slate-200';
        const inactiveClass = 'flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-indigo-600 transition-all';
        
        document.getElementById('tab-records').className = isRec ? activeClass : inactiveClass;
        document.getElementById('tab-rankings').className = !isRec ? activeClass : inactiveClass;
        document.getElementById('archive-page-title').innerText = isRec ? '시즌 경기 기록실' : '종합 리그 순위표';
        
        this.filterData();
    },

    // 날짜 포맷터
    formatDate: function(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const mo = String(d.getMonth() + 1).padStart(2, '0');
        const da = String(d.getDate()).padStart(2, '0');
        const ho = String(d.getHours()).padStart(2, '0');
        const mi = String(d.getMinutes()).padStart(2, '0');
        return `${mo}.${da} ${ho}:${mi}`;
    },

    // 🌟 [정밀 수정 구역] 생성 시점에 가장 숫자가 큰 최신 시즌을 판별하여 자동으로 selected 속성 부여
    updateSeasonOptions: function() {
        const seasonSelect = document.getElementById('archive-season');
        if (!seasonSelect) return;

        const seasons = [...new Set(this.allRecords.map(rec => rec.season_no).filter(Boolean))];
        
        // 오름차순 정렬 (시즌 1 -> 시즌 2 -> 시즌 3 순서로)
        seasons.sort((a, b) => a - b);

        // 정렬된 배열의 맨 마지막 원소가 무조건 가장 숫자가 큰 '최신 시즌'이 됩니다.
        const maxSeason = seasons.length > 0 ? seasons[seasons.length - 1] : null;

        let optionsHTML = `<option value="all">전체 시즌</option>`;
        
        seasons.forEach(s => {
            // 🔗 현재 그리는 시즌이 최신 시즌(maxSeason)과 일치하면 selected 속성을 마크업에 즉시 박아버립니다.
            const isSelected = s === maxSeason ? 'selected' : '';
            optionsHTML += `<option value="${s}" ${isSelected}>시즌 ${s}</option>`;
        });

        seasonSelect.innerHTML = optionsHTML;
    }, 

    /**
     * DB 내 round_no를 분석해서 라운드 드롭다운 옵션을 동적으로 늘려주는 빌더
     */
    updateRoundOptions: function() {
        const roundSelect = document.getElementById('archive-round');
        if (!roundSelect) return;

        const rounds = [...new Set(this.allRecords.map(rec => rec.round_no).filter(Boolean))];
        rounds.sort((a, b) => a - b);

        let optionsHTML = `<option value="all">전체 라운드</option>`;
        rounds.forEach(r => {
            optionsHTML += `<option value="${r}">${r} 라운드</option>`;
        });

        roundSelect.innerHTML = optionsHTML;
    }, 

    // 5. 기록실 테이블 렌더링 (Logic 헤더 수정 완료 / 마우스 오버 대형 팝업 로고 반영 완료)
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
        area.innerHTML = html; 
        if(window.lucide) lucide.createIcons(); 
    },

    // 6. 랭킹보드 그리드 렌더링
// 🔍 archive.js 파일 맨 밑바닥에 있는 기존 renderRankings 구역만 찾아서 요걸로 덮어쓰세요!
    renderRankings: function() {
        const area = document.getElementById('archive-content-area');
        if (!area) return;

        const stats = {};
        this.filteredRecords.forEach(r => {
            if (!stats[r.nickname]) stats[r.nickname] = { name: r.nickname, team: r.b_all_team, logo_url: r.logo_url, rp: 0, games: 0, wins: 0 };
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
                
                <div class="absolute top-0 right-0 px-5 py-2 rounded-bl-2xl rounded-tr-[2.5rem] font-black text-xs tracking-widest ${idx < 3 ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-400'} flex items-center gap-1.5">
                    ${
                        idx < 3 
                            ? `
                                <span class="text-lg select-none leading-none relative top-[2px]">
                                    ${idx === 0 ? '👑' : idx === 1 ? '🥈' : '🥉'}
                                </span>
                              `
                            : ''
                    }
                    <span>RANK #${idx + 1}</span>
                </div>
                
                <div class="flex items-center gap-5 mb-8 pt-2 overflow-visible">
                    <div class="relative group-hover:scale-105 transition-transform duration-300">
                        <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80" 
                             class="w-14 h-14 rounded-2xl object-cover shadow-md border border-slate-100 bg-slate-50 p-0.5" 
                             alt="${p.name}">
                        ${
                            idx < 3 
                                ? `
                                    <div class="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full shadow-md border border-slate-100 flex items-center justify-center text-[10px] select-none text-slate-900">
                                        ${idx === 0 ? '👑' : idx === 1 ? '🥈' : '🥉'}
                                    </div>
                                  ` 
                                : ''
                        }
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
    }
};
