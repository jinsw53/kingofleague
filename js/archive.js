/**
 * [ARCHIVE] 기록실 및 실시간 랭킹 시스템 
 * DB: v_boako_total_records 및 v_game_popularity_all_players 가상 뷰 완벽 연동
 * 구조: 100% 서버사이드 페이징 & 실시간 백엔드 서치 엔진 통합 (3대장 체제)
 * 디자인: Tailwind CSS 기반 프리미엄 디자인 및 프로필 보안 부적 완벽 장착
 * 🌟 시즌 필터: 전체(올타임 통합, is_alltime=true) / 비시즌(season_no NULL) / 시즌 N
 * 🌟 기본 진입 시: 검증완료 기록 중 최근 시즌을 자동 감지해서 기본 필터로 설정, 없으면 '전체' 유지
 * 🌟 "무소속 포함" 토글(검색창 옆) — 기록실/랭킹보드/게임별통계 3개 탭 전부 동일하게 지원. 기본 OFF(팀 리그만).
 *    무소속 기록은 기록실에서 RP를 빨간 취소선 + "미집계" 라벨로 표시.
 *    챔피언 시스템(v_game_popularity_mvp)은 항상 team_only=true 고정이라 이 토글과 무관하게 절대 오염되지 않음.
 * 🌟 랭킹보드 카드: 닉네임/팀명이 길면 평소엔 말줄임표로 잘리고, 마우스 올리면 글씨가 확대되며 카드 위로 튀어나와 전체가 보임(archive-nick-hover).
 */
Boako.Archive = {
    filteredRecords: [],
    gameRankings: [], 
    currentTab: 'records',
    
    // 🌟 서버 페이징용 독립형 상태 장부
    currentPage: 1,
    totalCount: 0,

    // 🌟 커스텀 필터 상태 관리용 변수
    currentSeasonFilter: 'all',
    currentRoundFilter: 'all',
    availableSeasons: [],
    availableRounds: [],
    _defaultSeasonApplied: false, // 🌟 최근 시즌 자동 감지는 최초 1회만
    includeFreeAgents: false, // 🌟 "무소속 포함" 토글 상태 (3개 탭 공통)

    // 🌟 지난 시즌 MVP 강조용
    prevMvpNickname: null,
    prevMvpSeasonNo: null,
    
    // 🎯 탭별로 완벽하게 최적화된 페이지당 사출 개수 정의
    getLimit: function() {
        if (this.currentTab === 'records') return 20; // 기록실: 20줄
        if (this.currentTab === 'rankings') return 9;  // 랭킹보드: 3줄 딱뎀 (9개)
        if (this.currentTab === 'games') return 10;   // 게임별 통계: 10줄 딱뎀 (10개)
        return 20;
    },

        // 🌟 지난 시즌 MVP 카드 전용 스타일 (한 번만 주입)
    injectMvpStyle: function() {
        if (document.getElementById('archive-mvp-style')) return;
        const style = document.createElement('style');
        style.id = 'archive-mvp-style';
        style.innerHTML = `
            .mvp-card-navy { background: linear-gradient(160deg,#1e1b4b,#312e81) !important; position: relative; overflow: hidden; }
            .mvp-card-navy::before { content:''; position:absolute; top:-40%; right:-15%; width:180px; height:180px; background: radial-gradient(circle, rgba(251,191,36,.25), transparent 70%); }
            .mvp-card-navy .mvp-rank-badge { background: rgba(255,255,255,0.15) !important; color: #fff !important; }
            .mvp-card-navy .mvp-name { color: #fff !important; }
            .mvp-card-navy .mvp-team-text { color: #c7d2fe !important; }
            .mvp-card-navy .mvp-stat-box { background: rgba(255,255,255,0.1) !important; }
            .mvp-card-navy .mvp-stat-label { color: #c7d2fe !important; }
            .mvp-card-navy .mvp-stat-value-rp { color: #fbbf24 !important; }
            .mvp-card-navy .mvp-stat-value-matches { color: #fff !important; }
            .mvp-card-navy .mvp-fwb-label { color: #a5b4fc !important; }
            .mvp-card-navy .mvp-fwb-badge { background: rgba(251,191,36,.15) !important; color: #fbbf24 !important; border-color: rgba(251,191,36,.3) !important; }
            .mvp-card-navy .mvp-progress-track { background: rgba(255,255,255,0.15) !important; }
            .archive-rp-freeagent { position: relative; display: inline-block; color: #94a3b8; }
            .archive-rp-freeagent::after {
                content: '';
                position: absolute;
                left: -2px; right: -2px; top: 50%;
                border-top: 2px solid #ef4444;
                transform: translateY(-50%) rotate(-4deg);
            }
            /* 🌟 랭킹보드 닉네임/팀명: 평소엔 말줄임표, 호버 시 글씨가 확대되며 카드 위로 튀어나와 전체가 보임 */
            .archive-nick-hover {
                display: inline-block;
                max-width: 100%;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                vertical-align: bottom;
                transform-origin: left center;
                transition: transform .15s ease;
                position: relative;
            }
            .archive-nick-hover:hover {
                overflow: visible;
                transform: scale(1.18);
                background: #ffffff;
                color: #1e293b !important;
                padding: 1px 6px;
                border-radius: 6px;
                box-shadow: 0 6px 16px rgba(0,0,0,0.2);
                z-index: 30;
            }
        `;
        document.head.appendChild(style);
    },

    // 1. view.js가 호출하는 최초 진입점
    buildUI: function(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        this.injectMvpStyle();

        container.innerHTML = `
            <div class="w-full animate-in fade-in duration-500">
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 bg-white p-4 rounded-2xl shadow-sm border border-slate-200 gap-4">
                    <div class="flex items-center gap-2">
                        <div class="bg-indigo-600 p-1.5 rounded-lg shadow-md">
                            <i data-lucide="trophy" class="text-white w-5 h-5"></i>
                        </div>
                        <h1 class="text-lg font-black tracking-tighter text-indigo-950 uppercase">Boako Team League</h1>
                    </div>
                    <div class="flex bg-slate-100 p-1 rounded-xl shadow-inner gap-1 overflow-x-auto max-w-full">
                        <button onclick="Boako.Archive.switchTab('records')" id="tab-records" class="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all bg-white text-indigo-600 shadow-sm border border-slate-200/60 whitespace-nowrap shrink-0">
                            <i data-lucide="history" class="w-4 h-4"></i> 기록실
                        </button>
                        <button onclick="Boako.Archive.switchTab('rankings')" id="tab-rankings" class="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black text-slate-500 hover:text-indigo-600 hover:bg-white/50 transition-all whitespace-nowrap shrink-0">
                            <i data-lucide="trending-up" class="w-4 h-4"></i> 랭킹보드
                        </button>
                        <button onclick="Boako.Archive.switchTab('games')" id="tab-games" class="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black text-slate-500 hover:text-indigo-600 hover:bg-white/50 transition-all whitespace-nowrap shrink-0">
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
                    <div class="flex flex-wrap items-center gap-2 relative z-30">
                        <div id="season-filter-container" class="relative w-[130px]"></div>
                        <div id="round-filter-wrapper" class="relative w-[130px]"></div>
                    </div>
                </div>

                <div class="relative mb-8 flex items-center gap-3">
                    <div class="relative flex-1">
                        <i data-lucide="search" class="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5"></i>
                        <input type="text" id="archive-search" oninput="Boako.Archive.filterData()" placeholder="닉네임이나 게임 종목 검색..."
                            class="w-full pl-12 pr-6 py-4 rounded-2xl border-none shadow-sm focus:ring-2 focus:ring-indigo-500 bg-white text-lg font-medium outline-none transition-all">
                    </div>
                    <label id="free-agent-filter-wrapper" style="display:flex;" class="items-center gap-2.5 bg-white px-4 py-4 rounded-2xl shadow-sm border border-slate-200 cursor-pointer select-none shrink-0 hover:border-indigo-300 transition-colors">
                        <span class="text-xs font-black text-slate-600 whitespace-nowrap">무소속 포함</span>
                        <span class="relative inline-flex items-center">
                            <input type="checkbox" id="free-agent-checkbox" onchange="Boako.Archive.toggleIncludeFreeAgents(this.checked)" class="sr-only peer">
                            <span class="w-9 h-5 bg-slate-200 peer-checked:bg-indigo-600 rounded-full transition-colors duration-200 inline-block"></span>
                            <span class="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 peer-checked:translate-x-4"></span>
                        </span>
                    </label>
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
        if (this.currentTab === 'rankings' && this.prevMvpNickname === null) {
            await this.loadPrevMvpInfo();
        }
        await this.loadData();
    },

    // 🌟 지난 시즌 MVP 닉네임만 가볍게 로드 (카드 강조 판별용)
    loadPrevMvpInfo: async function() {
        try {
            const { data: latestMvp } = await Boako.db
                .from('season_mvp')
                .select('season_no, nickname')
                .order('season_no', { ascending: false })
                .limit(1)
                .maybeSingle();
            this.prevMvpNickname = latestMvp?.nickname || null;
            this.prevMvpSeasonNo = latestMvp?.season_no || null;
        } catch (e) {
            console.error('지난 시즌 MVP 정보 로드 실패:', e);
            this.prevMvpNickname = null;
        }
    },

    // 🌟 지난 시즌 MVP가 현재 랭킹표에 없을 때만 뜨는 대체 안내 배너
    getPrevMvpFallbackBannerHTML: function() {
        return `
            <div style="background:linear-gradient(160deg,#1e1b4b,#312e81); border-radius:16px; padding:16px 20px; margin-bottom:24px; display:flex; align-items:center; gap:10px; position:relative; overflow:hidden;">
                <div style="position:absolute; top:-60%; right:-10%; width:140px; height:140px; background:radial-gradient(circle, rgba(251,191,36,.25), transparent 70%);"></div>
                <span style="font-size:18px; position:relative; z-index:1;">👑</span>
                <span style="color:#fff; font-weight:700; font-size:13px; position:relative; z-index:1;">시즌 ${this.prevMvpSeasonNo} MVP <b style="color:#fbbf24;">${this.prevMvpNickname}</b> 님은 이번 시즌 아직 활동 기록이 없습니다.</span>
            </div>
        `;
    },

    loadData: async function() {
        try {
            const { data, error } = await Boako.db
                .from('v_boako_total_records')
                .select('season_no, round_no, is_verified');

            if (error) throw error;
            
            this.updateSeasonOptions(data || []);
            this.updateRoundOptions(data || []);

            // 🌟 [최초 1회만] 검증완료(is_verified=0) 기록 중 가장 최근 시즌을 기본 필터로 자동 설정.
            // 그런 시즌이 하나도 없으면(전부 비시즌/미검증) '전체'를 그대로 유지.
            if (!this._defaultSeasonApplied) {
                this._defaultSeasonApplied = true;
                const verifiedSeasons = (data || [])
                    .filter(rec => rec.is_verified === 0 && rec.season_no !== null && rec.season_no !== undefined)
                    .map(rec => rec.season_no);
                if (verifiedSeasons.length > 0) {
                    this.currentSeasonFilter = Math.max(...verifiedSeasons);
                    this.renderSeasonDropdown();
                }
            }

            this.fetchAndRender(); 
        } catch (err) {
            console.error("아카이브 메타데이터 로드 오류:", err);
            Boako.Util.toast("데이터 구조를 불러오지 못했습니다.");
        }
    },

    // 🌟 커스텀 드롭다운 열기/닫기
    toggleDropdown: function(type) {
        const menu = document.getElementById(`archive-${type}-menu`);
        const overlay = document.getElementById(`archive-${type}-overlay`);
        if (menu && overlay) {
            menu.classList.toggle('hidden');
            overlay.classList.toggle('hidden');
        }
    },

    // 🌟 드롭다운 항목 선택 처리
    selectFilter: function(type, val) {
        this.toggleDropdown(type);
        if (type === 'season') {
            this.currentSeasonFilter = val;
            this.renderSeasonDropdown();
        } else {
            this.currentRoundFilter = val;
            this.renderRoundDropdown();
        }
        this.filterData(); // 선택 즉시 데이터 갱신
    },

    // 🌟 "무소속 포함" 토글 (기록실/랭킹보드/게임별통계 공통)
    toggleIncludeFreeAgents: function(checked) {
        this.includeFreeAgents = !!checked;
        this.currentPage = 1;
        this.fetchAndRender();
    },

    updateSeasonOptions: function(records) {
        const seasons = [...new Set(records.map(rec => rec.season_no).filter(Boolean))];
        seasons.sort((a, b) => a - b);
        this.availableSeasons = seasons;
        this.renderSeasonDropdown();
    },

    renderSeasonDropdown: function() {
        const container = document.getElementById('season-filter-container');
        if (!container) return;

        // 🌟 'all' = 전체(올타임 통합), 'none' = 비시즌(season_no NULL)만, 그 외 = 특정 시즌 번호
        const currentText = this.currentSeasonFilter === 'all' ? '전체'
            : this.currentSeasonFilter === 'none' ? '비시즌'
            : `시즌 ${this.currentSeasonFilter}`;
        
        container.innerHTML = `
            <button onclick="Boako.Archive.toggleDropdown('season')" class="w-full bg-white px-4 py-2.5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between gap-2 text-xs font-black text-slate-700 hover:border-indigo-400 hover:text-indigo-600 transition-colors">
                <div class="flex items-center gap-2"><i data-lucide="calendar" class="text-indigo-500 w-4 h-4"></i> <span>${currentText}</span></div>
                <i data-lucide="chevron-down" class="w-3 h-3 text-slate-400"></i>
            </button>
            <div id="archive-season-overlay" onclick="Boako.Archive.toggleDropdown('season')" class="hidden fixed inset-0 z-40"></div>
            <div id="archive-season-menu" class="hidden absolute top-full left-0 mt-2 w-full bg-slate-800 rounded-xl shadow-xl border border-slate-700 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                <div onclick="Boako.Archive.selectFilter('season', 'all')" class="px-4 py-3 text-xs font-black cursor-pointer transition-colors ${this.currentSeasonFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}">전체</div>
                <div onclick="Boako.Archive.selectFilter('season', 'none')" class="px-4 py-3 text-xs font-black cursor-pointer transition-colors ${this.currentSeasonFilter === 'none' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}">비시즌</div>
                ${this.availableSeasons.map(s => `
                    <div onclick="Boako.Archive.selectFilter('season', ${s})" class="px-4 py-3 text-xs font-black cursor-pointer transition-colors ${this.currentSeasonFilter === s ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}">시즌 ${s}</div>
                `).join('')}
            </div>
        `;
        if(window.lucide) lucide.createIcons();
    },

    updateRoundOptions: function(records) {
        const rounds = [...new Set(records.map(rec => rec.round_no).filter(Boolean))];
        rounds.sort((a, b) => a - b);
        this.availableRounds = rounds;
        this.renderRoundDropdown();
    },

    renderRoundDropdown: function() {
        const container = document.getElementById('round-filter-wrapper');
        if (!container) return;
        
        const currentText = this.currentRoundFilter === 'all' ? '전체 라운드' : `${this.currentRoundFilter} 라운드`;
        
        container.innerHTML = `
            <button onclick="Boako.Archive.toggleDropdown('round')" class="w-full bg-white px-4 py-2.5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between gap-2 text-xs font-black text-slate-700 hover:border-indigo-400 hover:text-indigo-600 transition-colors">
                <div class="flex items-center gap-2"><i data-lucide="layers" class="text-indigo-500 w-4 h-4"></i> <span>${currentText}</span></div>
                <i data-lucide="chevron-down" class="w-3 h-3 text-slate-400"></i>
            </button>
            <div id="archive-round-overlay" onclick="Boako.Archive.toggleDropdown('round')" class="hidden fixed inset-0 z-40"></div>
            <div id="archive-round-menu" class="hidden absolute top-full left-0 mt-2 w-full bg-slate-800 rounded-xl shadow-xl border border-slate-700 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                <div onclick="Boako.Archive.selectFilter('round', 'all')" class="px-4 py-3 text-xs font-black cursor-pointer transition-colors ${this.currentRoundFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}">전체 라운드</div>
                ${this.availableRounds.map(r => `
                    <div onclick="Boako.Archive.selectFilter('round', ${r})" class="px-4 py-3 text-xs font-black cursor-pointer transition-colors ${this.currentRoundFilter === r ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}">${r} 라운드</div>
                `).join('')}
            </div>
        `;
        if(window.lucide) lucide.createIcons();
    },

    // 🌟 [페이징 & 서치 통합 코어 엔진]
    fetchAndRender: async function() {
        const area = document.getElementById('archive-content-area');
        if (area) area.innerHTML = `<div class="text-center py-20 text-slate-400 font-bold">데이터 요청 중...</div>`;

        const searchVal = (document.getElementById('archive-search')?.value || '').toLowerCase();
        // 🌟 커스텀 상태 변수에서 필터값 읽기 ('all'(전체=올타임) | 'none'(비시즌) | 시즌 번호)
        const seasonVal = this.currentSeasonFilter;
        const roundVal = this.currentRoundFilter;
        const limit = this.getLimit();

        const from = (this.currentPage - 1) * limit;
        const to = from + limit - 1;

        // 💡 [분기 1] 게임별 통계 탭 — v_game_popularity_all_players는 team_only 차원으로 팀만/무소속포함을 둘 다 제공
        if (this.currentTab === 'games') {
            let query = Boako.db.from('v_game_popularity_all_players').select('*', { count: 'exact' });

            query = query.eq('team_only', !this.includeFreeAgents);

            if (seasonVal === 'all') {
                query = query.eq('is_alltime', true);
            } else if (seasonVal === 'none') {
                query = query.eq('is_alltime', false).is('season_no', null);
            } else {
                query = query.eq('is_alltime', false).eq('season_no', seasonVal);
            }

            if (searchVal) {
                query = query.or(`game_name.ilike.%${searchVal}%,player_nickname.ilike.%${searchVal}%`);
            }
            
            query = query.order('game_popularity_rank', { ascending: true })
                         .order('player_rank', { ascending: true })
                         .range(from, to);

            try {
                const { data, count, error } = await query;
                if (error) throw error;
                this.gameRankings = data || [];
                this.totalCount = count || 0;
                this.renderGames(); 
            } catch (err) {
                console.error("게임별 아카이브 뷰 데이터 로드 실패:", err);
                if (area) area.innerHTML = `<div class="text-center py-20 text-red-400 font-bold">게임 통계 로드에 실패했습니다.</div>`;
            }
            return;
        }

        // 💡 [분기 2 & 3] 기록실 및 랭킹보드 공통 베이스
        let query = Boako.db.from('v_boako_total_records').select('*', { count: 'exact' });

        if (seasonVal === 'none') query = query.is('season_no', null);
        else if (seasonVal !== 'all') query = query.eq('season_no', seasonVal);
        if (roundVal !== 'all') query = query.eq('round_no', roundVal);
        if (searchVal) {
            query = query.or(`nickname.ilike.%${searchVal}%,game_name.ilike.%${searchVal}%`);
        }

        // 🌟 랭킹보드는 검증 완료(is_verified=0) 기록만 집계 (기록실은 검증대기 상태도 일부러 같이 보여주므로 필터하지 않음)
        if (this.currentTab === 'rankings') {
            query = query.eq('is_verified', 0);
        }

        // 🌟 "무소속 포함" 토글이 꺼져 있으면 팀 소속 기록만 (기록실/랭킹보드 공통)
        if (!this.includeFreeAgents) {
            query = query.not('b_all_team', 'is', null);
        }

        if (this.currentTab === 'records') {
            query = query.order('created_at', { ascending: false }).range(from, to);
        } else {
            query = query.order('created_at', { ascending: false });
        }

        try {
            const { data, count, error } = await query;
            if (error) throw error;

            this.filteredRecords = data || [];
            
            if (this.currentTab === 'records') {
                this.totalCount = count || 0;
                this.renderRecords();
            } else {
                this.renderRankings();
            }
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
    switchTab: async function(tabName) {
        this.currentTab = tabName;
        this.currentPage = 1;

        if (tabName === 'rankings' && this.prevMvpNickname === null) {
            await this.loadPrevMvpInfo();
        }
        
        const activeClass = 'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all bg-white text-indigo-600 shadow-sm border border-slate-200/60 whitespace-nowrap shrink-0';
        const inactiveClass = 'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-indigo-600 hover:bg-white/50 transition-all whitespace-nowrap shrink-0';
        
        document.getElementById('tab-records').className = tabName === 'records' ? activeClass : inactiveClass;
        document.getElementById('tab-rankings').className = tabName === 'rankings' ? activeClass : inactiveClass;
        document.getElementById('tab-games').className = tabName === 'games' ? activeClass : inactiveClass;
        
        const titleEl = document.getElementById('archive-page-title');
        const descEl = document.getElementById('archive-page-desc');
        const subDescEl = document.getElementById('archive-page-subdesc');
        const roundFilter = document.getElementById('round-filter-wrapper');

        if (tabName === 'records') {
            titleEl.innerText = '시즌 경기 기록실';
            descEl.innerText = '시즌, 라운드 별로 팀 리그 기록을 확인하실 수 있습니다.';
            if (subDescEl) subDescEl.style.display = 'block';
            if (roundFilter) roundFilter.style.display = 'block';
        } else if (tabName === 'rankings') {
            titleEl.innerText = '리그 개인 순위표';
            descEl.innerText = '누적 RP 기준 전체 유저들의 순위입니다.';
            if (subDescEl) subDescEl.style.display = 'none';
            if (roundFilter) roundFilter.style.display = 'block';
        } else if (tabName === 'games') {
            titleEl.innerText = '시즌 대세 게임 & 게임별 순위';
            descEl.innerText = '가장 핫한 보드게임 종목 순위와 게임별 모든 유저의 기록 순위입니다.';
            if (subDescEl) subDescEl.style.display = 'none';
            if (roundFilter) roundFilter.style.display = 'none';
        }
        // 🌟 "무소속 포함" 토글은 이제 3개 탭 전부에서 동일하게 노출 (탭별로 숨기지 않음)
        
        this.fetchAndRender();
    },

    changePage: function(page) {
        const limit = this.getLimit();
        const totalPages = Math.ceil(this.totalCount / limit);
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
        return `${mo}.${da} ${mo === 'all' ? '' : ho}:${mi}`;
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

        html += this.filteredRecords.map(rec => {
            let logoHTML = `<span class="text-[10px]">👤</span>`;
            if (rec.logo_url && rec.b_all_team !== 'Free Agent') {
                logoHTML = `
                    <img src="${Boako.Util.cdn(rec.logo_url)}" class="w-3.5 h-3.5 object-contain rounded-sm shadow-sm" alt="${rec.b_all_team}">
                    <div class="fixed mb-2 w-32 h-32 p-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-[9999] pointer-events-none flex items-center justify-center transition-opacity duration-200"
                         style="display: none; opacity: 0; transform: translate(-50%, -100%); top: var(--archive-top, auto); left: var(--archive-left, auto);">
                        <img src="${Boako.Util.cdn(rec.logo_url)}" class="w-full h-full object-contain" alt="Large Logo">
                        <div class="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-white border-r border-b border-slate-200 rotate-45"></div>
                    </div>
                `;
            }

            // 🌟 무소속(Free Agent) 기록: RP는 빨간 취소선 + "미집계" 라벨 (계산은 정상이지만 팀 리그 집계엔 반영 안 됨을 명시)
            const isFreeAgent = !rec.b_all_team;
            const rpCellHTML = isFreeAgent
                ? `<div class="flex flex-col items-end leading-tight">
                       <span class="archive-rp-freeagent text-lg font-black tracking-tighter">${Math.floor(rec.rp || 0)}</span>
                       <span class="text-[8px] font-black text-red-500 uppercase tracking-wider mt-0.5">미집계</span>
                   </div>`
                : `<span class="font-black text-indigo-600 text-lg tracking-tighter">${Math.floor(rec.rp || 0)}</span>`;

            return `
                <tr class="hover:bg-indigo-50/20 transition-all group text-sm">
                    <td class="px-4 py-4 whitespace-nowrap text-[11px] font-bold text-slate-400">${this.formatDate(rec.created_at)}</td>
                    <td class="px-4 py-4 relative" data-handler="archive-tooltip">
                        <div class="flex flex-col leading-tight">
                            <span class="font-black text-slate-900">${rec.nickname || 'Unknown'}</span>
                            <div class="flex items-center gap-1.5 mt-1 cursor-pointer">
                                ${logoHTML}
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
                                        if (!type) return '무소속';
                                        const typeMap = { 'TOURNAMENT': '토너먼트', 'INDIVIDUAL': '개인전', 'TEAM': '팀전', 'FRIENDLY': '팀 내 친선전' };
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
                    <td class="px-4 py-4 text-right">${rpCellHTML}</td>
                    <td class="px-4 py-4 text-center">
                        ${rec.is_verified == 0 ? '<i data-lucide="check-circle-2" class="text-emerald-500 w-4 h-4 mx-auto"></i>' : '<i data-lucide="help-circle" class="text-slate-300 w-4 h-4 mx-auto opacity-30"></i>'}
                    </td>
                    <td class="px-4 py-4 text-right">
                        ${rec.post_url ? `<a href="${rec.post_url}" target="_blank" class="p-2 hover:bg-indigo-600 hover:text-white bg-slate-50 rounded-lg text-slate-400 transition-all inline-block border border-slate-100 shadow-sm"><i data-lucide="external-link" class="w-3 h-3"></i></a>` : ''}
                    </td>
                </tr>
            `;
        }).join('');

        html += `</tbody></table></div></div>`;
        html += this.renderPagination();

        area.innerHTML = html; 
        
        area.querySelectorAll('[data-handler="archive-tooltip"]').forEach(handler => {
            const tooltip = handler.querySelector('.fixed');
            if (!tooltip) return;

            handler.addEventListener('mouseenter', () => {
                tooltip.style.display = 'flex';
                setTimeout(() => { tooltip.style.opacity = '1'; }, 10);
            });

            handler.addEventListener('mousemove', (e) => {
                tooltip.style.setProperty('--archive-top', `${e.clientY - 12}px`);
                tooltip.style.setProperty('--archive-left', `${e.clientX}px`);
            });

            handler.addEventListener('mouseleave', () => {
                tooltip.style.opacity = '0';
                tooltip.style.display = 'none';
            });
        });

        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons(); 
        }
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

        const allSorted = Object.values(stats).sort((a, b) => b.rp - a.rp);
        this.totalCount = allSorted.length;

        const limit = this.getLimit();
        const from = (this.currentPage - 1) * limit;
        const to = from + limit;
        const paginatedSorted = allSorted.slice(from, to);

        if (paginatedSorted.length === 0) {
            area.innerHTML = `<div class="bg-white rounded-[2rem] shadow-xl border border-white p-20 text-center text-slate-400 font-bold">집계할 랭킹 데이터가 없습니다.</div>`;
            return;
        }

        const mvpInList = this.prevMvpNickname && allSorted.some(p => p.name === this.prevMvpNickname);
        let html = (this.prevMvpNickname && !mvpInList) ? this.getPrevMvpFallbackBannerHTML() : '';
        html += `<div class="grid grid-cols-1 md:grid-cols-3 gap-8 animate-in fade-in duration-500">`;

        html += paginatedSorted.map((p, index) => {
            const idx = from + index;
            const isPrevMvp = this.prevMvpNickname && p.name === this.prevMvpNickname;
            let logoHTML = `<span class="text-[10px]">👤</span>`;
            
            if (p.logo_url && p.team !== 'Free Agent') {
                logoHTML = `
                    <img src="${Boako.Util.cdn(p.logo_url)}" class="w-3.5 h-3.5 object-contain rounded-sm shadow-sm shrink-0" alt="${p.team}">
                    <div class="fixed mb-2 w-32 h-32 p-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-[9999] pointer-events-none flex items-center justify-center transition-opacity duration-200"
                         style="display: none; opacity: 0; transform: translate(-50%, -100%);">
                        <img src="${Boako.Util.cdn(p.logo_url)}" class="w-full h-full object-contain" alt="Large Logo">
                        <div class="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-white border-r border-b border-slate-200 rotate-45"></div>
                    </div>
                `;
            }

            return `
                <div class="${isPrevMvp ? 'mvp-card-navy' : 'bg-white border-white'} rounded-[2.5rem] p-8 shadow-xl border relative group hover:-translate-y-2 transition-transform duration-300">
                    ${isPrevMvp ? `<div style="position:absolute; top:16px; left:16px; background:#fbbf24; color:#78350f; font-size:9px; font-weight:900; padding:4px 11px; border-radius:999px; z-index:2;">👑 전 시즌 MVP</div>` : ''}
                    <div class="mvp-rank-badge absolute top-0 right-0 px-5 py-2 rounded-bl-2xl rounded-tr-[2.5rem] font-black text-xs tracking-widest ${idx < 3 ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-400'} flex items-baseline gap-1.5">
                        ${idx < 3 ? `<span class="text-xl select-none leading-none relative -top-[2px]">${idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</span>` : ''}
                        <span>RANK #${idx + 1}</span>
                    </div>
                    
                    <div class="flex items-center gap-5 mb-8 ${isPrevMvp ? 'pt-8' : 'pt-2'} overflow-visible">
                        <div class="relative shrink-0 group-hover:scale-105 transition-transform duration-300">
                            <img src="${Boako.Util.cdn((p.profile_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80').replace('http://', 'https://'))}" 
                                 class="w-14 h-14 rounded-2xl object-cover shadow-md border ${isPrevMvp ? 'border-amber-400' : 'border-slate-100'} bg-slate-50 p-0.5"
                                 onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'"
                                 alt="${p.name}">
                        </div>
                        <div class="min-w-0 flex-1">
                            <h3 class="mvp-name text-xl font-black text-slate-900 leading-none"><span class="archive-nick-hover">${p.name}</span></h3>
                            <div class="flex items-center gap-1.5 mt-1.5 relative cursor-pointer" data-handler="ranking-tooltip">
                                ${logoHTML}
                                <span class="mvp-team-text text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none"><span class="archive-nick-hover">${p.team || 'Free Agent'}</span></span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4 mb-8">
                        <div class="mvp-stat-box bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col items-center justify-center text-center shadow-sm overflow-hidden">
                            <p class="mvp-stat-label text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Total RP</p>
                            <p class="mvp-stat-value-rp ${(() => { const len = String(Math.floor(p.rp)).length; return len >= 7 ? 'text-lg' : len >= 5 ? 'text-2xl' : 'text-3xl'; })()} font-black text-indigo-600 tracking-tighter leading-none whitespace-nowrap">${Math.floor(p.rp)}</p>
                        </div>
                        <div class="mvp-stat-box bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col items-center justify-center text-center shadow-sm">
                            <p class="mvp-stat-label text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Matches</p>
                            <p class="mvp-stat-value-matches text-3xl font-black text-slate-800 tracking-tighter leading-none">${p.games}</p>
                        </div>
                    </div>
                    
                    <div class="flex justify-between items-center text-[11px] font-black tracking-tight uppercase mb-4 overflow-visible">
                        <span class="mvp-fwb-label text-slate-400 italic">First Win Bonus</span>
                        <span class="mvp-fwb-badge text-red-500 bg-red-50 px-3 py-1 rounded-lg border border-red-100 overflow-visible">+${p.wins} Times</span>
                    </div>
                    <div class="mvp-progress-track w-full bg-slate-100 h-2 rounded-full overflow-hidden p-0.5 border border-slate-200/50 shadow-inner">
                        <div class="bg-gradient-to-r from-indigo-500 to-indigo-700 h-full rounded-full transition-all duration-1000 ease-out" style="width: ${Math.min(100, (p.rp / allSorted[0].rp) * 100)}%"></div>
                    </div>
                </div>
            `;
        }).join('');

        html += `</div>`;
        html += this.renderPagination();
        area.innerHTML = html;
        
        // 🎯 [매칭 완치] 하위 fixed 툴팁 요소 존재 유무 및 예외 가드 완벽 구현
        area.querySelectorAll('[data-handler="ranking-tooltip"]').forEach(handler => {
            const tooltip = handler.querySelector('.fixed');
            if (!tooltip) return;

            handler.addEventListener('mouseenter', () => {
                tooltip.style.display = 'flex';
                setTimeout(() => { tooltip.style.opacity = '1'; }, 10);
            });

            handler.addEventListener('mousemove', (e) => {
                tooltip.style.setProperty('--ranking-top', `${e.clientY - 12}px`);
                tooltip.style.setProperty('--ranking-left', `${e.clientX}px`);
            });

            handler.addEventListener('mouseleave', () => {
                tooltip.style.opacity = '0';
                tooltip.style.display = 'none';
            });
        });

        if(window.lucide) lucide.createIcons();
    },

    // 7. 게임별 통계 렌더링
    renderGames: function() {
        const area = document.getElementById('archive-content-area');
        if (!area) return;

        if (this.gameRankings.length === 0) {
            area.innerHTML = `<div class="bg-white rounded-[2rem] shadow-xl border border-white p-20 text-center text-slate-400 font-bold">조건에 맞는 게임별 통계 데이터가 없습니다.</div>`;
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
                                <p class="text-xs text-slate-400 mt-1 font-bold uppercase tracking-wider">클릭하시면 상세정보가 보입니다.</p>
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
                                    ${game.playersList.map(p => {
                                        const teamLogoHtml = (p.teamLogo && p.team !== 'Free Agent')
                                            ? `<img src="${Boako.Util.cdn(p.teamLogo)}" class="w-4 h-4 rounded-sm object-contain shadow-sm shrink-0" alt="${p.team}">`
                                            : `<span class="text-[10px] shrink-0">👤</span>`;
                                        return `
                                        <tr class="hover:bg-slate-50 transition-colors font-medium">
                                            <td class="px-5 py-3.5 font-black text-xs">
                                                ${
                                                    p.rank === 1 ? '<span class="text-amber-500">🥇 1위</span>' :
                                                    p.rank === 2 ? '<span class="text-slate-400">🥈 2위</span>' :
                                                    p.rank === 3 ? '<span class="text-amber-700">🥉 3위</span>' : `<span class="text-slate-400 pl-1">${p.rank}위</span>`
                                                }
                                            </td>
                                            <td class="px-5 py-3.5 text-xs font-black text-slate-400 uppercase tracking-tight">
                                                <div class="flex items-center gap-1.5">
                                                    ${teamLogoHtml}
                                                    <span>${p.team || 'Free Agent'}</span>
                                                </div>
                                            </td>
                                            <td class="px-5 py-3.5 font-black text-slate-800">${p.name}</td>
                                            <td class="px-5 py-3.5 text-right font-mono font-black text-indigo-600">${Math.floor(p.rp).toLocaleString()} P</td>
                                        </tr>
                                    `}).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        html += this.renderPagination();

        area.innerHTML = html;
        if(window.lucide) lucide.createIcons();
    },

    // 🌟 [하단 페이지 공통 번호판 조립기]
    renderPagination: function() {
        const limit = this.getLimit();
        const totalPages = Math.ceil(this.totalCount / limit);
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
    }
};
