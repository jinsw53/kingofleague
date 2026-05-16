/**
 * [ARCHIVE] 기록실 및 실시간 랭킹 시스템 
 * DB: v_boako_total_records 가상 뷰 100% 실시간 연동
 */
Boako.Archive = {
    allRecords: [],
    filteredRecords: [],
    currentTab: 'records',

    // 1. view.js가 호출하는 최초 진입점
    buildUI: function(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // 전체 뼈대(헤더, 필터, 탭, 결과출력창) 그리기
        container.innerHTML = `
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
                    <p class="text-slate-400 mt-3 font-medium text-lg">점수 산출 근거($W \\times T \\times M$)를 투명하게 공개하는 공식 아카이브입니다.</p>
                </div>
                <div class="flex gap-2">
                    <div class="bg-white px-3 py-2 rounded-xl shadow-sm border border-slate-200 flex items-center gap-2">
                        <i data-lucide="calendar" class="text-indigo-500 w-4 h-4"></i>
                        <select id="archive-season" onchange="Boako.Archive.filterData()" class="bg-transparent border-none text-xs font-black outline-none cursor-pointer">
                            <option value="all">전체 시즌</option>
                            <option value="1">시즌 1</option>
                            <option value="2">시즌 2</option>
                        </select>
                    </div>
                    <div class="bg-white px-3 py-2 rounded-xl shadow-sm border border-slate-200 flex items-center gap-2">
                        <i data-lucide="layers" class="text-indigo-500 w-4 h-4"></i>
                        <select id="archive-round" onchange="Boako.Archive.filterData()" class="bg-transparent border-none text-xs font-black outline-none cursor-pointer">
                            <option value="all">전체 라운드</option>
                            <option value="1">1 라운드</option>
                            <option value="2">2 라운드</option>
                            <option value="3">3 라운드</option>
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

    loadData: async function() {
        try {
            // 🌟 100% 실제 Supabase DB 연결 부분
            const { data, error } = await Boako.db
                .from('v_boako_total_records')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            
            this.allRecords = data || [];
            this.filterData(); 
        } catch (err) {
            console.error("아카이브 데이터 로드 오류:", err);
            Boako.Util.toast("데이터를 불러오는 중 오류가 발생했습니다.");
            document.getElementById('archive-content-area').innerHTML = `<div class="text-center py-20 text-red-400 font-bold">데이터를 불러오지 못했습니다.</div>`;
        }
    },

    // 3. 필터링 로직 (메모리상에서 처리하여 속도 극대화)
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

    // 4. 탭 전환
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
                                <th class="px-8 py-5">Source</th>
                                <th class="px-8 py-5">Date</th>
                                <th class="px-8 py-5">Player</th>
                                <th class="px-8 py-5">Game Info</th>
                                <th class="px-8 py-5 text-center">Logic ($W \\times T \\times M$)</th>
                                <th class="px-8 py-5 text-right font-black">RP</th>
                                <th class="px-8 py-5 text-center">Status</th>
                                <th class="px-8 py-5"></th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-50">
        `;

        html += this.filteredRecords.map(rec => `
            <tr class="hover:bg-indigo-50/20 transition-all group">
                <td class="px-8 py-5">
                    <span class="px-2 py-0.5 rounded text-[9px] font-black tracking-widest uppercase ${rec.record_source === 'TOURNAMENT' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}">
                        ${rec.record_source || 'BTLDB'}
                    </span>
                </td>
                <td class="px-8 py-5 whitespace-nowrap text-xs font-bold text-slate-400">${this.formatDate(rec.created_at)}</td>
                <td class="px-8 py-5">
                    <div class="flex flex-col leading-tight">
                        <span class="font-black text-slate-900">${rec.nickname || 'Unknown'}</span>
                        <span class="text-[9px] text-slate-400 font-bold uppercase tracking-widest">${rec.b_all_team || 'Free Agent'}</span>
                    </div>
                </td>
                <td class="px-8 py-5">
                    <div class="flex flex-col leading-tight">
                        <div class="flex items-center gap-1.5 mb-1">
                            <span class="font-bold text-indigo-900">${rec.game_name || '-'}</span>
                            ${rec.is_first == 1 ? '<span class="bg-red-500 text-white text-[8px] px-1 rounded font-black tracking-tighter uppercase shadow-sm">1ST WIN</span>' : ''}
                        </div>
                        <span class="text-[9px] text-slate-400 font-bold uppercase tracking-tight">S${rec.season_no || 0} R${rec.round_no || 0} · ${rec.match_type || '일반'}</span>
                    </div>
                </td>
                <td class="px-8 py-5">
                    <div class="flex items-center justify-center gap-1.5">
                        <div class="w-8 h-8 flex items-center justify-center bg-slate-50 text-slate-500 border border-slate-200 rounded-lg text-xs font-black" title="Weight">${rec.weight || 0}</div>
                        <span class="text-slate-200 font-bold">×</span>
                        <div class="w-8 h-8 flex items-center justify-center bg-slate-50 text-slate-500 border border-slate-200 rounded-lg text-xs font-black" title="Playtime">${rec.playtime || 0}</div>
                        <span class="text-slate-200 font-bold">×</span>
                        <div class="w-8 h-8 flex items-center justify-center bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg text-xs font-black" title="Multiplier">${rec.multiplier || 0}</div>
                    </div>
                </td>
                <td class="px-8 py-5 text-right font-black text-indigo-600 text-xl tracking-tighter">${(rec.rp || 0).toFixed(1)}</td>
                <td class="px-8 py-5 text-center">
                    ${rec.is_verified == 1 ? '<i data-lucide="check-circle-2" class="text-emerald-500 w-5 h-5 mx-auto"></i>' : '<i data-lucide="help-circle" class="text-slate-300 w-5 h-5 mx-auto"></i>'}
                </td>
                <td class="px-8 py-5 text-right">
                    ${rec.post_url ? `<a href="${rec.post_url}" target="_blank" class="p-2 hover:bg-indigo-100 rounded-lg text-indigo-400 hover:text-indigo-600 transition-all inline-block border border-slate-100 shadow-sm bg-white"><i data-lucide="external-link" class="w-4 h-4"></i></a>` : ''}
                </td>
            </tr>
        `).join('');

        html += `</tbody></table></div></div>`;
        area.innerHTML = html;
        if(window.lucide) lucide.createIcons();
    },

    // 6. 랭킹보드 그리드 렌더링
    renderRankings: function() {
        const area = document.getElementById('archive-content-area');
        if (!area) return;

        const stats = {};
        this.filteredRecords.forEach(r => {
            if (!stats[r.nickname]) stats[r.nickname] = { name: r.nickname, team: r.b_all_team, rp: 0, games: 0, wins: 0 };
            stats[r.nickname].rp += (r.rp || 0);
            stats[r.nickname].games += 1;
            if (r.is_first == 1) stats[r.nickname].wins += 1;
        });

        const sorted = Object.values(stats).sort((a, b) => b.rp - a.rp);

        if (sorted.length === 0) {
            area.innerHTML = `<div class="bg-white rounded-[2rem] shadow-xl border border-white p-20 text-center text-slate-400 font-bold">집계할 랭킹 데이터가 없습니다.</div>`;
            return;
        }

        let html = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">`;

        html += sorted.map((p, idx) => `
            <div class="bg-white rounded-[2rem] p-7 shadow-xl border border-white relative overflow-hidden group hover:-translate-y-2 transition-transform duration-300">
                <div class="absolute top-0 right-0 px-4 py-1.5 rounded-bl-xl font-black text-xs ${idx < 3 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}">
                    RANK #${idx + 1}
                </div>
                <div class="flex items-center gap-4 mb-6 pt-2">
                    <div class="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl bg-indigo-50 group-hover:scale-110 transition-transform">
                        ${idx === 0 ? '👑' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '👤'}
                    </div>
                    <div>
                        <h3 class="text-xl font-black text-slate-900 leading-none">${p.name}</h3>
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">${p.team || 'Free Agent'}</p>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3 mb-6">
                    <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total RP</p>
                        <p class="text-3xl font-black text-indigo-600 tracking-tighter">${Math.floor(p.rp)}</p>
                    </div>
                    <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Matches</p>
                        <p class="text-3xl font-black text-slate-800 tracking-tighter">${p.games}</p>
                    </div>
                </div>
                <div class="flex justify-between items-center text-[10px] font-black tracking-tight uppercase">
                    <span class="text-slate-400 italic">First Win Bonus</span>
                    <span class="text-red-500 bg-red-50 px-2 py-1 rounded-md">+${p.wins} Times</span>
                </div>
                <div class="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
                    <div class="bg-indigo-600 h-full transition-all duration-1000" style="width: ${Math.min(100, (p.rp / sorted[0].rp) * 100)}%"></div>
                </div>
            </div>
        `).join('');

        html += `</div>`;
        area.innerHTML = html;
        if(window.lucide) lucide.createIcons();
    }
};
