/**
 * [TEAM LIST] 생성된 팀 목록 및 현황을 보여주는 대시보드
 */
Boako.TeamList = {
    init: async (containerId) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        // 1. 기본 뼈대 (배너 + 검색창 + 리스트 컨테이너)
        const html = `
            <div class="main-banner" style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);">
                <h1>👥 리그 참여 팀 목록</h1>
                <p>BOAKO 아카이브에 등록된 전설적인 팀들을 확인하세요.</p>
            </div>

            <section class="section-card">
                <div class="card-header flex justify-between items-center">
                    <span>방명록 및 로스터</span>
                </div>
                
                <div class="card-body" style="background: #f8fafc; min-height: 400px; padding: 25px;">
                    <div class="flex gap-2 mb-8">
                        <div class="relative flex-1">
                            <i data-lucide="search" class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"></i>
                            <input type="text" id="team-search-input" placeholder="팀명 또는 팀장 이름으로 검색" class="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl text-sm font-bold transition-all shadow-sm">
                        </div>
                        <button onclick="Boako.TeamList.loadTeams()" class="bg-slate-800 text-white px-6 rounded-xl font-bold text-sm hover:bg-slate-700 transition-colors shadow-sm">검색</button>
                    </div>

                    <div id="team-grid-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div class="col-span-full text-center py-10 text-slate-400 font-bold text-sm flex flex-col items-center gap-2">
                            <i data-lucide="loader-2" class="w-8 h-8 animate-spin"></i>
                            참여 팀 정보를 불러오는 중입니다...
                        </div>
                    </div>
                </div>
            </section>
        `;
        
        container.innerHTML = html;
        if(typeof lucide !== 'undefined') lucide.createIcons();

        // 엔터키 검색 이벤트 연결
        document.getElementById('team-search-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') Boako.TeamList.loadTeams();
        });

        // 초기 데이터 로드
        await Boako.TeamList.loadTeams();
    },

    loadTeams: async () => {
        const container = document.getElementById('team-grid-container');
        const searchWord = document.getElementById('team-search-input').value.trim();
        
        container.innerHTML = `
            <div class="col-span-full text-center py-10 text-slate-400 font-bold flex flex-col items-center gap-2">
                <i data-lucide="loader-2" class="w-8 h-8 animate-spin"></i>
                검색 중...
            </div>
        `;

        try {
            // 🌟 public.teams 테이블에서 데이터 가져오기!
            let query = Boako.db
                .from('teams')
                .select('*')
                .order('created_at', { ascending: false }); // 최신 창단팀 순

            // 검색어가 있으면 팀명이나 리더 이름으로 필터링
            if (searchWord) {
                query = query.or(`team_name.ilike.%${searchWord}%,leader_name.ilike.%${searchWord}%`);
            }

            const { data: teams, error } = await query;

            if (error) throw error;

            if (!teams || teams.length === 0) {
                container.innerHTML = `
                    <div class="col-span-full bg-white border border-slate-200 rounded-xl p-10 text-center flex flex-col items-center justify-center shadow-sm">
                        <span class="text-4xl mb-3">📭</span>
                        <h4 class="font-black text-slate-600 text-lg mb-1">검색 결과 없음</h4>
                        <p class="text-sm text-slate-400 font-bold">조건에 맞는 팀을 찾을 수 없습니다.</p>
                    </div>`;
                if(typeof lucide !== 'undefined') lucide.createIcons();
                return;
            }

            // 카드 HTML 생성
            let listHtml = '';
            teams.forEach(team => {
                const logoSrc = team.logo_url || 'https://via.placeholder.com/150?text=NO+LOGO';
                const teamMotto = team.team_motto || '각오 한마디가 없습니다.';
                const leaderName = team.leader_name || '팀장 미지정';
                
                // 창단일 포맷팅 (예: 2026. 05. 20)
                const createDate = new Date(team.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });

                listHtml += `
                    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 group flex flex-col">
                        
                        <div class="h-32 bg-slate-50 border-b border-slate-100 flex items-center justify-center relative overflow-hidden p-4">
                            <div class="absolute inset-0 opacity-5 bg-center bg-cover blur-sm transition-transform duration-500 group-hover:scale-110" style="background-image: url('${logoSrc}')"></div>
                            
                            <img src="${logoSrc}" class="h-full w-full object-contain relative z-10 drop-shadow-md" onerror="this.src='https://via.placeholder.com/150?text=NO+LOGO'">
                        </div>

                        <div class="p-5 flex-1 flex flex-col">
                            <h3 class="text-xl font-black text-slate-800 mb-1 group-hover:text-blue-600 transition-colors">${team.team_name}</h3>
                            <p class="text-sm text-blue-500 font-bold italic mb-4 line-clamp-2 leading-relaxed">"${teamMotto}"</p>
                            
                            <div class="mt-auto pt-4 border-t border-slate-100 flex justify-between items-center">
                                <div class="flex items-center gap-2">
                                    <div class="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-white text-[10px] font-bold">
                                        👑
                                    </div>
                                    <span class="text-xs font-black text-slate-600">${leaderName}</span>
                                </div>
                                <span class="text-[10px] text-slate-400 font-bold">Since ${createDate}</span>
                            </div>
                        </div>
                        
                    </div>
                `;
            });

            container.innerHTML = listHtml;

        } catch (err) {
            console.error("팀 목록 로드 실패:", err);
            container.innerHTML = `<div class="col-span-full text-center py-10 text-red-500 font-bold text-sm bg-red-50 rounded-xl">데이터를 불러오는 중 오류가 발생했습니다.</div>`;
        }
    }
};
